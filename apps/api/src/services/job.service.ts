import { prisma, JobStatus } from '@printing-workflow/db';
import { calculateJobPricing, calculateCustomPricing } from '@printing-workflow/shared';
import { generateJobNumber } from '../lib/utils.js';
import { queueAutoPOCreation } from '../lib/queue.js';

export async function createJobFromQuote(quoteId: string, customerPONumber: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      quoteRequest: {
        include: {
          customer: true,
        },
      },
    },
  });

  if (!quote) {
    throw new Error('Quote not found');
  }

  if (!quote.approvedAt) {
    throw new Error('Quote must be approved before creating a job');
  }

  // Validate customer PO number is provided
  if (!customerPONumber || customerPONumber.trim() === '') {
    throw new Error('Customer PO number is required');
  }

  const jobNo = await generateJobNumber();

  const job = await prisma.job.create({
    data: {
      jobNo,
      quoteId,
      customerId: quote.quoteRequest.customerId,
      status: JobStatus.PENDING,
      specs: quote.quoteRequest.specs,
      customerTotal: quote.total,
      customerPONumber: customerPONumber.trim(),
    },
    include: {
      customer: true,
      quote: true,
    },
  });

  // Queue auto-PO creation (Impact → Bradford)
  await queueAutoPOCreation({
    jobId: job.id,
    customerTotal: parseFloat(job.customerTotal.toString()),
    customerPONumber: customerPONumber.trim(),
  });

  return job;
}

export async function createDirectJob(data: {
  customerId: string;
  sizeId: string;
  quantity: number;
  customerPONumber: string; // Required field
  specs?: any;
  description?: string;
  customPrice?: number; // Custom customer price (optional)
}) {
  // Validate customer PO number is provided
  if (!data.customerPONumber || data.customerPONumber.trim() === '') {
    throw new Error('Customer PO number is required');
  }

  // Calculate all pricing using the pricing calculator
  // Use custom pricing calculator if customPrice is provided
  const pricing = calculateCustomPricing(data.sizeId, data.quantity, data.customPrice);

  const jobNo = await generateJobNumber();

  // Merge description into specs if provided
  const specs = data.specs || {
    description: data.description || '',
    sizeId: data.sizeId,
    quantity: data.quantity,
  };

  const job = await prisma.job.create({
    data: {
      jobNo,
      customerId: data.customerId,
      status: JobStatus.PENDING,
      specs,
      customerPONumber: data.customerPONumber.trim(),

      // Product details
      sizeId: pricing.sizeId,
      sizeName: pricing.sizeName,
      quantity: pricing.quantity,

      // CPM rates
      customerCPM: pricing.customerCPM,
      impactMarginCPM: pricing.impactMarginCPM,
      bradfordTotalCPM: pricing.bradfordTotalCPM,
      bradfordPrintMarginCPM: pricing.bradfordPrintMarginCPM,
      bradfordPaperMarginCPM: pricing.bradfordPaperMarginCPM,
      bradfordTotalMarginCPM: pricing.bradfordTotalMarginCPM,
      printCPM: pricing.printCPM,
      paperCostCPM: pricing.paperCostCPM,
      paperChargedCPM: pricing.paperChargedCPM,

      // Total amounts
      customerTotal: pricing.customerTotal,
      impactMargin: pricing.impactMargin,
      bradfordTotal: pricing.bradfordTotal,
      bradfordPrintMargin: pricing.bradfordPrintMargin,
      bradfordPaperMargin: pricing.bradfordPaperMargin,
      bradfordTotalMargin: pricing.bradfordTotalMargin,
      jdTotal: pricing.jdTotal,
      paperCostTotal: pricing.paperCostTotal,
      paperChargedTotal: pricing.paperChargedTotal,

      // Paper specifications
      paperType: pricing.paperType,
      paperWeightTotal: pricing.paperWeightTotal,
      paperWeightPer1000: pricing.paperWeightPer1000,

      // Approval workflow (required if pricing is below cost)
      requiresApproval: pricing.isLoss,
    },
    include: {
      customer: true,
    },
  });

  // Queue auto-PO creation (Impact → Bradford)
  await queueAutoPOCreation({
    jobId: job.id,
    customerTotal: pricing.customerTotal,
    bradfordTotal: pricing.bradfordTotal,
    jdTotal: pricing.jdTotal,
    customerPONumber: data.customerPONumber.trim(),
  });

  return job;
}

export async function updateJobStatus(jobId: string, status: JobStatus) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status,
      ...(status === JobStatus.COMPLETED ? { completedAt: new Date() } : {}),
    },
  });
}

export async function getJobById(id: string) {
  return prisma.job.findUnique({
    where: { id },
    include: {
      customer: true,
      quote: {
        include: {
          quoteRequest: true,
        },
      },
      files: true,
      proofs: {
        include: {
          file: true,
          approvals: true,
        },
        orderBy: {
          version: 'desc',
        },
      },
      purchaseOrders: {
        include: {
          originCompany: true,
          targetCompany: true,
        },
      },
      invoices: {
        include: {
          pdfFile: true,
          fromCompany: true,
          toCompany: true,
        },
      },
      shipments: {
        include: {
          recipients: true,
        },
      },
      sampleShipments: true,
    },
  });
}

export async function getJobByJobNo(jobNo: string) {
  return prisma.job.findUnique({
    where: { jobNo },
    include: {
      customer: true,
      quote: true,
      files: true,
      proofs: {
        include: {
          file: true,
          approvals: true,
        },
        orderBy: {
          version: 'desc',
        },
      },
    },
  });
}

export async function listJobs(filters?: {
  customerId?: string;
  status?: JobStatus;
  companyId?: string; // For filtering by company (Bradford, JD Graphic)
  userRole?: string; // CUSTOMER, BROKER_ADMIN, BRADFORD_ADMIN, MANAGER
}) {
  // Build where clause based on filters and role
  let whereClause: any = {};

  // Filter by customer
  if (filters?.customerId) {
    whereClause.customerId = filters.customerId;
  }

  // Filter by status
  if (filters?.status) {
    whereClause.status = filters.status;
  }

  // Role-based filtering for companies (Bradford, JD Graphic)
  // They see jobs where they have purchase orders
  if (filters?.companyId && filters?.userRole === 'BRADFORD_ADMIN') {
    // Bradford sees jobs where they are either origin or target of a PO
    return prisma.job.findMany({
      where: {
        ...whereClause,
        purchaseOrders: {
          some: {
            OR: [
              { originCompanyId: filters.companyId },
              { targetCompanyId: filters.companyId },
            ],
          },
        },
      },
      include: {
        customer: true,
        quote: true,
        purchaseOrders: {
          include: {
            originCompany: true,
            targetCompany: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Default: return all matching jobs (for Impact Direct admins or specific customer filter)
  return prisma.job.findMany({
    where: whereClause,
    include: {
      customer: true,
      quote: true,
      purchaseOrders: {
        include: {
          originCompany: true,
          targetCompany: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

// ============================================================================
// Job Completion & File Readiness
// ============================================================================

export interface JobReadinessStatus {
  isReady: boolean;
  uploadedArtworkCount: number;
  uploadedDataFileCount: number;
  requiredArtworkCount: number;
  requiredDataFileCount: number;
  missingArtwork: number;
  missingDataFiles: number;
}

/**
 * Check if a job has all required files uploaded and is ready for production
 */
export async function checkJobReadiness(jobId: string): Promise<JobReadinessStatus> {
  // Get job with files
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      files: {
        where: {
          kind: {
            in: ['ARTWORK', 'DATA_FILE'],
          },
        },
      },
    },
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // Count uploaded files by type
  const uploadedArtworkCount = job.files.filter((f) => f.kind === 'ARTWORK').length;
  const uploadedDataFileCount = job.files.filter((f) => f.kind === 'DATA_FILE').length;

  // Required counts (defaults: 1 artwork, 0 data files)
  const requiredArtworkCount = job.requiredArtworkCount ?? 1;
  const requiredDataFileCount = job.requiredDataFileCount ?? 0;

  // Calculate missing files
  const missingArtwork = Math.max(0, requiredArtworkCount - uploadedArtworkCount);
  const missingDataFiles = Math.max(0, requiredDataFileCount - uploadedDataFileCount);

  // Job is ready if all required files are uploaded
  const isReady = missingArtwork === 0 && missingDataFiles === 0;

  return {
    isReady,
    uploadedArtworkCount,
    uploadedDataFileCount,
    requiredArtworkCount,
    requiredDataFileCount,
    missingArtwork,
    missingDataFiles,
  };
}

/**
 * Update job's readiness status based on uploaded files
 * Returns true if status changed from not ready to ready
 */
export async function updateJobReadiness(jobId: string): Promise<boolean> {
  const status = await checkJobReadiness(jobId);

  // Get current job state before update
  const currentJob = await prisma.job.findUnique({
    where: { id: jobId },
    select: { isReadyForProduction: true },
  });

  // Update the job's isReadyForProduction flag
  await prisma.job.update({
    where: { id: jobId },
    data: {
      isReadyForProduction: status.isReady,
    },
  });

  // Return true if job just became ready (status changed from false to true)
  const wasNotReady = !currentJob?.isReadyForProduction;
  return wasNotReady && status.isReady;
}

/**
 * Get file upload progress for a job
 */
export async function getJobFileProgress(jobId: string): Promise<{
  artwork: {
    uploaded: number;
    required: number;
    complete: boolean;
  };
  dataFiles: {
    uploaded: number;
    required: number;
    complete: boolean;
  };
  overall: {
    complete: boolean;
    percentage: number;
  };
}> {
  const status = await checkJobReadiness(jobId);

  const artworkComplete = status.missingArtwork === 0;
  const dataFilesComplete = status.missingDataFiles === 0;

  // Calculate overall percentage
  const totalRequired = status.requiredArtworkCount + status.requiredDataFileCount;
  const totalUploaded = status.uploadedArtworkCount + status.uploadedDataFileCount;
  const percentage = totalRequired > 0 ? Math.round((totalUploaded / totalRequired) * 100) : 100;

  return {
    artwork: {
      uploaded: status.uploadedArtworkCount,
      required: status.requiredArtworkCount,
      complete: artworkComplete,
    },
    dataFiles: {
      uploaded: status.uploadedDataFileCount,
      required: status.requiredDataFileCount,
      complete: dataFilesComplete,
    },
    overall: {
      complete: status.isReady,
      percentage,
    },
  };
}
