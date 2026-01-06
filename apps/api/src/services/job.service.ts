import { prisma, JobStatus, RoutingType } from '@printing-workflow/db';
import { calculateJobPricing, calculateCustomPricing, calculateSimplePricing, recalculatePricing, PRODUCT_SIZES, COMPANY_IDS } from '@printing-workflow/shared';
import { generateJobNumber } from '../lib/utils.js';
import { queueAutoPOCreation } from '../lib/queue.js';
import { createThirdPartyVendorPO } from './purchase-order.service.js';

/**
 * Validates that all required financial fields are present in job data
 * @throws Error if any required financial field is missing or zero
 */
function validateJobFinancialFields(jobData: {
  customerTotal?: any;
  bradfordTotal?: any;
  jdTotal?: any;
  impactMargin?: any;
}, jobNo?: string) {
  const requiredFields = {
    customerTotal: jobData.customerTotal,
    bradfordTotal: jobData.bradfordTotal,
    jdTotal: jobData.jdTotal,
    impactMargin: jobData.impactMargin,
  };

  const missingOrZeroFields: string[] = [];

  for (const [fieldName, value] of Object.entries(requiredFields)) {
    if (value === null || value === undefined) {
      missingOrZeroFields.push(`${fieldName} (missing)`);
    } else if (Number(value) === 0) {
      missingOrZeroFields.push(`${fieldName} ($0.00)`);
    }
  }

  if (missingOrZeroFields.length > 0) {
    const jobIdentifier = jobNo ? ` for job ${jobNo}` : '';
    throw new Error(
      `Invalid job financial data${jobIdentifier}: The following required fields are missing or zero: ${missingOrZeroFields.join(', ')}. ` +
      `All jobs must have complete financial calculations (customerTotal, bradfordTotal, jdTotal, impactMargin). ` +
      `This indicates a pricing calculation failure. Please ensure the job has valid size and quantity data.`
    );
  }
}

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

  // Extract size and quantity from quote specs for pricing calculation
  const specs = quote.quoteRequest.specs as any;
  const sizeName = specs?.sizeName || specs?.size || specs?.productSize || specs?.flatSize || specs?.foldedSize;
  const quantity = specs?.quantity || specs?.qty;

  // Validate required fields for pricing calculation
  if (!sizeName || !quantity) {
    const missingFields = [];
    if (!sizeName) missingFields.push('sizeName/size');
    if (!quantity) missingFields.push('quantity');
    throw new Error(
      `Cannot create job from quote: missing required fields in quote specs: ${missingFields.join(', ')}. ` +
      `Quote specs must contain size name and quantity for auto-calculation.`
    );
  }

  // Calculate Bradford/JD split from the quote's customerTotal (PRESERVE customer pricing)
  // Use reverse calculation: given the customerTotal, calculate Bradford/JD based on pricing rules
  const pricing = await calculateFromCustomerTotal(
    prisma,
    Number(quote.total),  // PRESERVE the customer total from the quote
    Number(quantity),
    String(sizeName),
    specs?.jdSuppliesPaper ?? false  // Default to false (50/50 split)
  );

  // Validate that all required financial fields are present
  validateJobFinancialFields(pricing);

  const jobNo = await generateJobNumber();

  const job = await prisma.job.create({
    data: {
      jobNo,
      quoteId,
      customerId: quote.quoteRequest.customerId,
      status: JobStatus.PENDING,
      specs: quote.quoteRequest.specs,
      customerPONumber: customerPONumber.trim(),

      // Product details
      sizeName: String(sizeName),
      quantity: Number(quantity),

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
      jdSuppliesPaper: specs?.jdSuppliesPaper ?? false,  // Default to false (50/50 split)
    },
    include: {
      customer: true,
      quote: true,
    },
  });

  // Queue auto-PO creation (Impact → Bradford)
  await queueAutoPOCreation({
    jobId: job.id,
    customerTotal: pricing.customerTotal,
    bradfordTotal: pricing.bradfordTotal,
    jdTotal: pricing.jdTotal,
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
  customPaperCPM?: number; // Custom Bradford paper CPM (optional)
  jdSuppliesPaper?: boolean; // True if JD supplies paper (10/10 split, no Bradford markup)
  bradfordWaivesPaperMargin?: boolean; // True if Bradford waives paper margin (50/50 total split)

  // Vendor Routing (new)
  routingType?: RoutingType; // BRADFORD_JD (default) or THIRD_PARTY_VENDOR
  vendorId?: string; // Third-party vendor ID (required if THIRD_PARTY_VENDOR)
  vendorAmount?: number; // Manual vendor quote amount (required if THIRD_PARTY_VENDOR)
  bradfordCut?: number; // Bradford's portion for third-party jobs (required if THIRD_PARTY_VENDOR)
}) {
  // Validate customer PO number is provided
  if (!data.customerPONumber || data.customerPONumber.trim() === '') {
    throw new Error('Customer PO number is required');
  }

  // Determine routing type (default to BRADFORD_JD for backward compatibility)
  const routingType = data.routingType || RoutingType.BRADFORD_JD;

  // Validate third-party vendor routing requirements
  if (routingType === RoutingType.THIRD_PARTY_VENDOR) {
    // Validate vendor ID
    if (!data.vendorId || data.vendorId.trim() === '') {
      throw new Error('Vendor ID is required for third-party vendor routing');
    }

    // Validate vendor amount (handle empty strings and convert to number)
    const vendorAmount = typeof data.vendorAmount === 'string'
      ? parseFloat(data.vendorAmount)
      : data.vendorAmount;

    if (vendorAmount === undefined || vendorAmount === null || isNaN(vendorAmount) || vendorAmount <= 0) {
      throw new Error('Valid vendor quote amount is required for third-party vendor routing (must be greater than $0)');
    }

    // Validate Bradford's cut (handle empty strings and convert to number)
    const bradfordCut = typeof data.bradfordCut === 'string'
      ? parseFloat(data.bradfordCut)
      : data.bradfordCut;

    if (bradfordCut === undefined || bradfordCut === null || isNaN(bradfordCut) || bradfordCut < 0) {
      throw new Error("Bradford's cut amount is required for third-party vendor routing (must be $0 or greater)");
    }

    // Verify vendor exists and is active
    const vendor = await prisma.vendor.findUnique({
      where: { id: data.vendorId },
    });

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    if (!vendor.isActive) {
      throw new Error('Cannot create job with inactive vendor');
    }

    // Update data with parsed numeric values
    data.vendorAmount = vendorAmount;
    data.bradfordCut = bradfordCut;
  }

  // Get sizeName from sizeId (lookup in legacy PRODUCT_SIZES)
  const sizeInfo = PRODUCT_SIZES[data.sizeId];
  if (!sizeInfo) {
    throw new Error(`Invalid size ID: ${data.sizeId}`);
  }

  // Build pricing overrides if custom values provided
  const overrides = data.customPrice || data.customPaperCPM
    ? {
        customerCPM: data.customPrice ? data.customPrice / (data.quantity / 1000) : undefined,
        paperChargedCPM: data.customPaperCPM,
      }
    : undefined;

  // Calculate all pricing using the dynamic pricing calculator
  const pricing = await calculateDynamicPricing(
    prisma,
    sizeInfo.name, // sizeName
    data.quantity,
    overrides,
    data.jdSuppliesPaper ?? false,
    data.bradfordWaivesPaperMargin ?? false
  );

  // Validate that all required financial fields are present
  validateJobFinancialFields(pricing);

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

      // Vendor routing
      routingType,
      vendorId: data.vendorId,
      vendorAmount: data.vendorAmount,
      bradfordCut: data.bradfordCut,

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
      jdSuppliesPaper: data.jdSuppliesPaper ?? false,  // Default to false (normal mode)
      bradfordWaivesPaperMargin: data.bradfordWaivesPaperMargin ?? false, // Default to false (normal mode)

      // Approval workflow (required if pricing is below cost)
      requiresApproval: pricing.requiresApproval ?? false,
    },
    include: {
      customer: true,
      vendor: true,
    },
  });

  // Conditional PO creation based on routing type
  if (routingType === RoutingType.BRADFORD_JD) {
    // Traditional flow: Queue auto-PO creation (Impact → Bradford)
    await queueAutoPOCreation({
      jobId: job.id,
      customerTotal: pricing.customerTotal,
      bradfordTotal: pricing.bradfordTotal,
      jdTotal: pricing.jdTotal,
      customerPONumber: data.customerPONumber.trim(),
    });
  } else if (routingType === RoutingType.THIRD_PARTY_VENDOR) {
    // New flow: Create third-party vendor PO (Impact → Third-Party Vendor)
    await createThirdPartyVendorPO({
      jobId: job.id,
      vendorId: data.vendorId!,
      vendorAmount: data.vendorAmount!,
      bradfordCut: data.bradfordCut!,
      customerPONumber: data.customerPONumber.trim(),
    });
  }

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
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      customer: true,
      vendor: true,
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
          targetVendor: true,
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

  // Serialize dates for JSON response
  return job ? serializeJobForJSON(job) : null;
}

export async function getJobByJobNo(jobNo: string) {
  const job = await prisma.job.findUnique({
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

  // Serialize dates for JSON response
  return job ? serializeJobForJSON(job) : null;
}

export async function listJobs(filters?: {
  customerId?: string;
  status?: JobStatus;
  companyId?: string; // For filtering by company (Bradford, JD Graphic)
  userRole?: string; // CUSTOMER, BROKER_ADMIN, BRADFORD_ADMIN, MANAGER
}) {
  // Build where clause based on filters and role
  let whereClause: any = {
    deletedAt: null, // Exclude soft deleted jobs
  };

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
    const bradfordJobs = await prisma.job.findMany({
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
        vendor: true,
        proofs: {
          include: {
            file: true,
            approvals: true,
          },
          orderBy: {
            version: 'desc',
          },
        },
        files: true,
        purchaseOrders: {
          include: {
            originCompany: true,
            targetCompany: true,
            targetVendor: true,
          },
        },
        invoices: {
          include: {
            pdfFile: true,
            fromCompany: true,
            toCompany: true,
          },
        },
        sampleShipments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Serialize dates for JSON response (fixes 500 error)
    return bradfordJobs.map(serializeJobForJSON);
  }

  // Default: return all matching jobs (for Impact Direct admins or specific customer filter)
  const jobs = await prisma.job.findMany({
    where: whereClause,
    include: {
      customer: true,
      quote: true,
      vendor: true,
      proofs: {
        include: {
          file: true,
          approvals: true,
        },
        orderBy: {
          version: 'desc',
        },
      },
      files: true,
      purchaseOrders: {
        include: {
          originCompany: true,
          targetCompany: true,
          targetVendor: true,
        },
      },
      invoices: {
        include: {
          pdfFile: true,
          fromCompany: true,
          toCompany: true,
        },
      },
      sampleShipments: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Serialize ALL dates for JSON response (comprehensive fix)
  return jobs.map(serializeJobForJSON);
}

/**
 * Comprehensively serialize all DateTime fields in a job object to ISO strings
 * This prevents JSON serialization errors when sending data to the client
 */
export function serializeJobForJSON(job: any) {
  return {
    ...job,
    // Job-level dates
    deliveryDate: job.deliveryDate?.toISOString() ?? null,
    mailDate: job.mailDate?.toISOString() ?? null,
    inHomesDate: job.inHomesDate?.toISOString() ?? null,
    approvedAt: job.approvedAt?.toISOString() ?? null,
    submittedForProductionAt: job.submittedForProductionAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    deletedAt: job.deletedAt?.toISOString() ?? null,

    // Quote dates (if included)
    quote: job.quote ? {
      ...job.quote,
      createdAt: job.quote.createdAt.toISOString(),
      updatedAt: job.quote.updatedAt.toISOString(),
    } : null,

    // Customer/Vendor dates
    customer: job.customer ? {
      ...job.customer,
      createdAt: job.customer.createdAt.toISOString(),
      updatedAt: job.customer.updatedAt.toISOString(),
    } : null,

    vendor: job.vendor ? {
      ...job.vendor,
      createdAt: job.vendor.createdAt.toISOString(),
      updatedAt: job.vendor.updatedAt.toISOString(),
    } : null,

    // Purchase orders
    purchaseOrders: job.purchaseOrders?.map((po: any) => ({
      ...po,
      bradfordCutPaidDate: po.bradfordCutPaidDate?.toISOString() ?? null,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
      // Nested company dates
      originCompany: po.originCompany ? {
        ...po.originCompany,
        createdAt: po.originCompany.createdAt.toISOString(),
        updatedAt: po.originCompany.updatedAt.toISOString(),
      } : null,
      targetCompany: po.targetCompany ? {
        ...po.targetCompany,
        createdAt: po.targetCompany.createdAt.toISOString(),
        updatedAt: po.targetCompany.updatedAt.toISOString(),
      } : null,
      targetVendor: po.targetVendor ? {
        ...po.targetVendor,
        createdAt: po.targetVendor.createdAt.toISOString(),
        updatedAt: po.targetVendor.updatedAt.toISOString(),
      } : null,
      pdfFile: po.pdfFile ? {
        ...po.pdfFile,
        createdAt: po.pdfFile.createdAt.toISOString(),
      } : null,
    })),

    // Proofs
    proofs: job.proofs?.map((proof: any) => ({
      ...proof,
      createdAt: proof.createdAt.toISOString(),
      shareExpiresAt: proof.shareExpiresAt?.toISOString() ?? null,
      file: proof.file ? {
        ...proof.file,
        createdAt: proof.file.createdAt.toISOString(),
      } : null,
      approvals: proof.approvals?.map((approval: any) => ({
        ...approval,
        createdAt: approval.createdAt.toISOString(),
      })),
    })),

    // Files
    files: job.files?.map((file: any) => ({
      ...file,
      createdAt: file.createdAt.toISOString(),
    })),

    // Invoices
    invoices: job.invoices?.map((invoice: any) => ({
      ...invoice,
      issuedAt: invoice.issuedAt?.toISOString() ?? null,
      dueAt: invoice.dueAt?.toISOString() ?? null,
      paidAt: invoice.paidAt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      pdfFile: invoice.pdfFile ? {
        ...invoice.pdfFile,
        createdAt: invoice.pdfFile.createdAt.toISOString(),
      } : null,
      fromCompany: invoice.fromCompany ? {
        ...invoice.fromCompany,
        createdAt: invoice.fromCompany.createdAt.toISOString(),
        updatedAt: invoice.fromCompany.updatedAt.toISOString(),
      } : null,
      toCompany: invoice.toCompany ? {
        ...invoice.toCompany,
        createdAt: invoice.toCompany.createdAt.toISOString(),
        updatedAt: invoice.toCompany.updatedAt.toISOString(),
      } : null,
    })),

    // Sample shipments
    sampleShipments: job.sampleShipments?.map((shipment: any) => ({
      ...shipment,
      sentAt: shipment.sentAt?.toISOString() ?? null,
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    })),
  };
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

// ============================================================================
// Job Updates with Activity Tracking
// ============================================================================

interface JobUpdateData {
  quantity?: number;
  deliveryDate?: Date | string;
  packingSlipNotes?: string;
  customerPONumber?: string;
  specs?: any;
  // Financial fields
  customerTotal?: number | string;
  paperChargedCPM?: number | string;
  jdTotal?: number | string;
  paperChargedTotal?: number | string;
  paperCostTotal?: number | string;
  impactMargin?: number | string;
  bradfordTotal?: number | string;
  bradfordPrintMargin?: number | string;
  bradfordPaperMargin?: number | string;
  bradfordTotalMargin?: number | string;
  // CPM fields
  customerCPM?: number | string;
  printCPM?: number | string;
  paperCostCPM?: number | string;
  impactMarginCPM?: number | string;
  bradfordTotalCPM?: number | string;
  bradfordPrintMarginCPM?: number | string;
  bradfordPaperMarginCPM?: number | string;
  bradfordTotalMarginCPM?: number | string;
}

interface UpdateContext {
  changedBy: string;       // User email or ID
  changedByRole: string;   // CUSTOMER, BROKER_ADMIN, BRADFORD_ADMIN
}

/**
 * Update job with activity tracking and email notifications
 */
export async function updateJob(
  jobId: string,
  updates: JobUpdateData,
  context: UpdateContext
) {
  // Get current job state
  const currentJob = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: {
        include: {
          employees: {
            where: { isPrimary: true },
          },
        },
      },
    },
  });

  if (!currentJob) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // Track changes for activity log
  const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];

  // Build update data and track changes
  const updateData: any = {};

  // Quantity
  if (updates.quantity !== undefined && updates.quantity !== currentJob.quantity) {
    changes.push({
      field: 'quantity',
      oldValue: currentJob.quantity?.toString() || 'None',
      newValue: updates.quantity.toString(),
    });
    updateData.quantity = updates.quantity;
  }

  // Delivery Date
  if (updates.deliveryDate !== undefined) {
    const newDate = typeof updates.deliveryDate === 'string'
      ? new Date(updates.deliveryDate)
      : updates.deliveryDate;
    const oldDate = currentJob.deliveryDate;

    // Compare dates (null-safe)
    const datesAreDifferent = oldDate?.getTime() !== newDate.getTime();

    if (datesAreDifferent) {
      changes.push({
        field: 'deliveryDate',
        oldValue: oldDate ? oldDate.toLocaleDateString() : 'None',
        newValue: newDate.toLocaleDateString(),
      });
      updateData.deliveryDate = newDate;
    }
  }

  // Packing Slip Notes
  if (updates.packingSlipNotes !== undefined && updates.packingSlipNotes !== currentJob.packingSlipNotes) {
    changes.push({
      field: 'packingSlipNotes',
      oldValue: currentJob.packingSlipNotes || 'None',
      newValue: updates.packingSlipNotes,
    });
    updateData.packingSlipNotes = updates.packingSlipNotes;
  }

  // Customer PO Number
  if (updates.customerPONumber !== undefined && updates.customerPONumber !== currentJob.customerPONumber) {
    changes.push({
      field: 'customerPONumber',
      oldValue: currentJob.customerPONumber || 'None',
      newValue: updates.customerPONumber,
    });
    updateData.customerPONumber = updates.customerPONumber;
  }

  // Specs (Job specifications as JSON)
  if (updates.specs !== undefined) {
    const oldSpecs = currentJob.specs as any || {};
    const newSpecs = updates.specs;

    // Track changes in specs object
    for (const key of Object.keys(newSpecs)) {
      if (JSON.stringify(oldSpecs[key]) !== JSON.stringify(newSpecs[key])) {
        changes.push({
          field: `specs.${key}`,
          oldValue: JSON.stringify(oldSpecs[key]) || 'None',
          newValue: JSON.stringify(newSpecs[key]),
        });
      }
    }

    updateData.specs = newSpecs;
  }

  // Customer Total
  if (updates.customerTotal !== undefined) {
    const newValue = typeof updates.customerTotal === 'string'
      ? parseFloat(updates.customerTotal)
      : updates.customerTotal;
    const oldValue = currentJob.customerTotal ? parseFloat(currentJob.customerTotal.toString()) : 0;

    if (newValue !== oldValue) {
      changes.push({
        field: 'customerTotal',
        oldValue: `$${oldValue.toFixed(2)}`,
        newValue: `$${newValue.toFixed(2)}`,
      });
      updateData.customerTotal = newValue;
    }
  }

  // Bradford Total
  if (updates.bradfordTotal !== undefined) {
    const newValue = typeof updates.bradfordTotal === 'string'
      ? parseFloat(updates.bradfordTotal)
      : updates.bradfordTotal;
    const oldValue = currentJob.bradfordTotal ? parseFloat(currentJob.bradfordTotal.toString()) : 0;

    if (newValue !== oldValue) {
      changes.push({
        field: 'bradfordTotal',
        oldValue: `$${oldValue.toFixed(2)}`,
        newValue: `$${newValue.toFixed(2)}`,
      });
      updateData.bradfordTotal = newValue;
    }
  }

  // JD Total
  if (updates.jdTotal !== undefined) {
    const newValue = typeof updates.jdTotal === 'string'
      ? parseFloat(updates.jdTotal)
      : updates.jdTotal;
    const oldValue = currentJob.jdTotal ? parseFloat(currentJob.jdTotal.toString()) : 0;

    if (newValue !== oldValue) {
      changes.push({
        field: 'jdTotal',
        oldValue: `$${oldValue.toFixed(2)}`,
        newValue: `$${newValue.toFixed(2)}`,
      });
      updateData.jdTotal = newValue;
    }
  }

  // Paper Cost Total
  if (updates.paperCostTotal !== undefined) {
    const newValue = typeof updates.paperCostTotal === 'string'
      ? parseFloat(updates.paperCostTotal)
      : updates.paperCostTotal;
    const oldValue = currentJob.paperCostTotal ? parseFloat(currentJob.paperCostTotal.toString()) : 0;

    if (newValue !== oldValue) {
      changes.push({
        field: 'paperCostTotal',
        oldValue: `$${oldValue.toFixed(2)}`,
        newValue: `$${newValue.toFixed(2)}`,
      });
      updateData.paperCostTotal = newValue;
    }
  }

  // Paper Charged Total
  if (updates.paperChargedTotal !== undefined) {
    const newValue = typeof updates.paperChargedTotal === 'string'
      ? parseFloat(updates.paperChargedTotal)
      : updates.paperChargedTotal;
    const oldValue = currentJob.paperChargedTotal ? parseFloat(currentJob.paperChargedTotal.toString()) : 0;

    if (newValue !== oldValue) {
      changes.push({
        field: 'paperChargedTotal',
        oldValue: `$${oldValue.toFixed(2)}`,
        newValue: `$${newValue.toFixed(2)}`,
      });
      updateData.paperChargedTotal = newValue;
    }
  }

  // ===================================================================================
  // SIMPLIFIED PRICING RECALCULATION
  // ===================================================================================
  // When any pricing field changes, recalculate using simple 50/50 split:
  // - Impact Margin = (customerTotal - bradfordTotal) / 2
  // - Bradford Print Margin = (customerTotal - bradfordTotal) / 2
  // - Bradford Paper Margin = paperChargedTotal - paperCostTotal
  // - All CPMs calculated from totals
  // ===================================================================================

  const pricingFieldsChanged =
    updateData.customerTotal !== undefined ||
    updateData.bradfordTotal !== undefined ||
    updateData.jdTotal !== undefined ||
    updateData.paperCostTotal !== undefined ||
    updateData.paperChargedTotal !== undefined;

  if (pricingFieldsChanged && currentJob.sizeName && currentJob.quantity) {
    try {
      // Get current pricing values (use updated value if changed, otherwise use current)
      const currentPricing = {
        sizeName: currentJob.sizeName,
        quantity: updateData.quantity ?? currentJob.quantity,
        customerTotal: currentJob.customerTotal ? Number(currentJob.customerTotal) : 0,
        bradfordTotal: currentJob.bradfordTotal ? Number(currentJob.bradfordTotal) : 0,
        jdTotal: currentJob.jdTotal ? Number(currentJob.jdTotal) : 0,
        paperCostTotal: currentJob.paperCostTotal ? Number(currentJob.paperCostTotal) : 0,
        paperChargedTotal: currentJob.paperChargedTotal ? Number(currentJob.paperChargedTotal) : 0,
      };

      // Prepare updates (only include fields that were actually changed)
      const pricingUpdates: any = {};
      if (updateData.customerTotal !== undefined) pricingUpdates.customerTotal = Number(updateData.customerTotal);
      if (updateData.bradfordTotal !== undefined) pricingUpdates.bradfordTotal = Number(updateData.bradfordTotal);
      if (updateData.jdTotal !== undefined) pricingUpdates.jdTotal = Number(updateData.jdTotal);
      if (updateData.paperCostTotal !== undefined) pricingUpdates.paperCostTotal = Number(updateData.paperCostTotal);
      if (updateData.paperChargedTotal !== undefined) pricingUpdates.paperChargedTotal = Number(updateData.paperChargedTotal);
      if (updateData.quantity !== undefined) pricingUpdates.quantity = Number(updateData.quantity);

      // Recalculate all pricing fields using simplified calculator
      const recalculatedPricing = recalculatePricing(pricingUpdates, currentPricing as any);

      // Update all pricing fields
      updateData.customerCPM = recalculatedPricing.customerCPM;
      updateData.impactMarginCPM = recalculatedPricing.impactMarginCPM;
      updateData.bradfordTotalCPM = recalculatedPricing.bradfordTotalCPM;
      updateData.bradfordPrintMarginCPM = recalculatedPricing.bradfordPrintMarginCPM;
      updateData.bradfordPaperMarginCPM = recalculatedPricing.bradfordPaperMarginCPM;
      updateData.bradfordTotalMarginCPM = recalculatedPricing.bradfordTotalMarginCPM;
      updateData.printCPM = recalculatedPricing.printCPM;
      updateData.paperCostCPM = recalculatedPricing.paperCostCPM;
      updateData.paperChargedCPM = recalculatedPricing.paperChargedCPM;

      updateData.customerTotal = recalculatedPricing.customerTotal;
      updateData.impactMargin = recalculatedPricing.impactMargin;
      updateData.bradfordTotal = recalculatedPricing.bradfordTotal;
      updateData.bradfordPrintMargin = recalculatedPricing.bradfordPrintMargin;
      updateData.bradfordPaperMargin = recalculatedPricing.bradfordPaperMargin;
      updateData.bradfordTotalMargin = recalculatedPricing.bradfordTotalMargin;
      updateData.jdTotal = recalculatedPricing.jdTotal;
      updateData.paperCostTotal = recalculatedPricing.paperCostTotal;
      updateData.paperChargedTotal = recalculatedPricing.paperChargedTotal;

      // Track the recalculation in activity log
      changes.push({
        field: 'pricing',
        oldValue: 'N/A',
        newValue: 'Pricing recalculated with 50/50 margin split',
      });

      console.log(`[Job ${jobId}] Pricing recalculated - Customer: $${recalculatedPricing.customerTotal.toFixed(2)}, Bradford: $${recalculatedPricing.bradfordTotal.toFixed(2)}, Impact Margin: $${recalculatedPricing.impactMargin.toFixed(2)}`);
    } catch (error) {
      console.error(`[Job ${jobId}] Failed to recalculate pricing:`, error);
      // Continue with the update even if recalculation fails
    }
  }

  // NOTE: CPM recalculation is now handled by recalculatePricing() above.
  // The simplified calculator automatically calculates all CPMs from totals.

  // If no changes, return current job
  if (changes.length === 0) {
    return currentJob;
  }

  // Update job and create activity records in a transaction
  const updatedJob = await prisma.$transaction(async (tx) => {
    // Update the job
    const job = await tx.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        customer: {
          include: {
            employees: {
              where: { isPrimary: true },
            },
          },
        },
        files: true,
        proofs: {
          include: {
            file: true,
            approvals: true,
          },
        },
        purchaseOrders: {
          include: {
            originCompany: true,
            targetCompany: true,
            targetVendor: true,
          },
        },
        invoices: {
          include: {
            fromCompany: true,
            toCompany: true,
          },
        },
        shipments: true,
        sampleShipments: true,
      },
    });

    // Create activity records for each change
    for (const change of changes) {
      await tx.jobActivity.create({
        data: {
          jobId,
          action: 'UPDATED',
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          changedBy: context.changedBy,
          changedByRole: context.changedByRole as any,
        },
      });
    }

    return job;
  });

  // Send email notifications (non-blocking)
  sendJobUpdateEmail(updatedJob, changes, context).catch((error) => {
    console.error('Failed to send job update email:', error);
  });

  return updatedJob;
}

/**
 * Send email notification for job updates
 */
async function sendJobUpdateEmail(
  job: any,
  changes: Array<{ field: string; oldValue: string; newValue: string }>,
  context: UpdateContext
) {
  const { sendEmail, emailTemplates } = await import('../lib/email.js');

  // Format changes for email
  const changesText = changes
    .map(c => {
      const fieldName = c.field.replace('specs.', '').replace(/([A-Z])/g, ' $1').trim();
      const formatted = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
      return `• ${formatted}: ${c.oldValue} → ${c.newValue}`;
    })
    .join('\n');

  // Get customer email
  const customerEmail = job.customer?.employees?.[0]?.email || job.customer?.email;

  // Email to nick@jdgraphic.com (primary recipient)
  const nickEmail = 'nick@jdgraphic.com';

  await sendEmail(
    nickEmail,
    `Job ${job.jobNo} Updated by ${context.changedByRole}`,
    `<div>
      <h2>Job ${job.jobNo} Updated</h2>
      <p><strong>Customer:</strong> ${job.customer?.name}</p>
      <p><strong>Updated by:</strong> ${context.changedBy} (${context.changedByRole})</p>
      <h3>Changes:</h3>
      <pre>${changesText}</pre>
    </div>`
  );

  // Email to customer (secondary recipient)
  if (customerEmail) {
    await sendEmail(
      customerEmail,
      `Your Job ${job.jobNo} Has Been Updated`,
      `<div>
        <h2>Job ${job.jobNo} Updated</h2>
        <p>The following changes were made to your job:</p>
        <pre>${changesText}</pre>
        <p>If you have any questions, please contact us.</p>
      </div>`
    );
  }
}
