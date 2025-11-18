import { prisma, JobStatus, RoutingType } from '@printing-workflow/db';
import { calculateJobPricing, calculateCustomPricing, calculateDynamicPricing, calculateFromCustomerTotal, PRODUCT_SIZES, COMPANY_IDS } from '@printing-workflow/shared';
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
          contacts: {
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

  // JD Supplies Paper (margin calculation flag)
  if (updates.jdSuppliesPaper !== undefined && updates.jdSuppliesPaper !== currentJob.jdSuppliesPaper) {
    changes.push({
      field: 'jdSuppliesPaper',
      oldValue: currentJob.jdSuppliesPaper ? 'Yes' : 'No',
      newValue: updates.jdSuppliesPaper ? 'Yes' : 'No',
    });
    updateData.jdSuppliesPaper = updates.jdSuppliesPaper;
  }

  // Bradford Waives Paper Margin (margin calculation flag)
  if (updates.bradfordWaivesPaperMargin !== undefined && updates.bradfordWaivesPaperMargin !== currentJob.bradfordWaivesPaperMargin) {
    changes.push({
      field: 'bradfordWaivesPaperMargin',
      oldValue: currentJob.bradfordWaivesPaperMargin ? 'Yes (50/50 split)' : 'No (Bradford keeps paper markup)',
      newValue: updates.bradfordWaivesPaperMargin ? 'Yes (50/50 split)' : 'No (Bradford keeps paper markup)',
    });
    updateData.bradfordWaivesPaperMargin = updates.bradfordWaivesPaperMargin;
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

  // Paper Charged CPM
  if (updates.paperChargedCPM !== undefined) {
    const newValue = typeof updates.paperChargedCPM === 'string'
      ? parseFloat(updates.paperChargedCPM)
      : updates.paperChargedCPM;
    const oldValue = currentJob.paperChargedCPM ? parseFloat(currentJob.paperChargedCPM.toString()) : 0;

    if (newValue !== oldValue) {
      changes.push({
        field: 'paperChargedCPM',
        oldValue: `$${oldValue.toFixed(2)}/M`,
        newValue: `$${newValue.toFixed(2)}/M`,
      });
      updateData.paperChargedCPM = newValue;
    }
  }

  // ===================================================================================
  // PRICING RECALCULATION - SIMPLE RULE
  // ===================================================================================
  // The pricing system follows a simple rule:
  // 1. Start with customer price (from pricing rule OR manual override)
  // 2. Apply 2 adjustable flags:
  //    - jdSuppliesPaper: If true, 10/10/80 split, no paper markup
  //    - bradfordWaivesPaperMargin: If true, 50/50 total margin, paper at cost
  // 3. Calculate all other fields using basic math
  //
  // When any pricing field or flag changes, we recalculate all derived fields
  // while preserving the user's manual edits (see "MANUAL OVERRIDE PROTECTION" below)
  // ===================================================================================

  const pricingFieldsChanged = updateData.customerTotal !== undefined ||
                               updateData.paperChargedCPM !== undefined ||
                               updateData.paperChargedTotal !== undefined ||
                               updateData.jdSuppliesPaper !== undefined ||
                               updateData.bradfordWaivesPaperMargin !== undefined;

  // Detect if ONLY margin flags changed (not other pricing fields)
  // When margin flags change, skip the standard pricing recalculation and use the special margin logic instead
  const marginFlagsChanged = (updateData.jdSuppliesPaper !== undefined ||
                             updateData.bradfordWaivesPaperMargin !== undefined);

  // Run pricing recalculation when any pricing field changes (including margin flags)
  // The calculator properly handles all margin modes based on the flags passed to it
  if (pricingFieldsChanged && currentJob.sizeName && currentJob.quantity) {
    try {
      const { calculateDynamicPricing } = await import('@printing-workflow/shared/pricing-calculator');

      // Prepare overrides based on what was changed
      const overrides: any = {};

      // ==========================================
      // MANUAL OVERRIDE PROTECTION
      // ==========================================
      // When a user manually edits pricing fields (like customerTotal or paperChargedCPM),
      // we need to recalculate all derived fields while preserving their manual edits.
      //
      // Example: User changes customerTotal → we recalculate margins, but keep their customerTotal
      // This prevents the calculator from overwriting the user's intentional manual changes.
      //
      // Track user's manual values to preserve them after recalculation
      const userCustomerTotal = updateData.customerTotal;
      const userPaperChargedCPM = updateData.paperChargedCPM;
      const userPaperChargedTotal = updateData.paperChargedTotal;

      // If customerTotal changed, calculate customerCPM from it
      if (updateData.customerTotal !== undefined) {
        const newCustomerTotal = typeof updateData.customerTotal === 'string'
          ? parseFloat(updateData.customerTotal)
          : updateData.customerTotal;
        const quantityInThousands = currentJob.quantity / 1000;
        overrides.customerCPM = newCustomerTotal / quantityInThousands;
      }

      // If paperChargedCPM changed, use it directly
      if (updateData.paperChargedCPM !== undefined) {
        overrides.paperChargedCPM = typeof updateData.paperChargedCPM === 'string'
          ? parseFloat(updateData.paperChargedCPM)
          : updateData.paperChargedCPM;
      }

      // If paperChargedTotal changed, calculate paperChargedCPM from it
      if (updateData.paperChargedTotal !== undefined) {
        const newPaperChargedTotal = typeof updateData.paperChargedTotal === 'string'
          ? parseFloat(updateData.paperChargedTotal)
          : updateData.paperChargedTotal;
        const quantityInThousands = currentJob.quantity / 1000;
        overrides.paperChargedCPM = newPaperChargedTotal / quantityInThousands;
      }

      // Recalculate all pricing fields
      const jdSuppliesPaper = updateData.jdSuppliesPaper ?? currentJob.jdSuppliesPaper ?? false;
      const bradfordWaivesPaperMargin = updateData.bradfordWaivesPaperMargin ?? currentJob.bradfordWaivesPaperMargin ?? false;
      const recalculatedPricing = await calculateDynamicPricing(
        prisma,
        currentJob.sizeName,
        currentJob.quantity,
        overrides,
        jdSuppliesPaper,
        bradfordWaivesPaperMargin
      );

      // Update all derived pricing fields
      updateData.customerCPM = recalculatedPricing.customerCPM;
      updateData.impactMarginCPM = recalculatedPricing.impactMarginCPM;
      updateData.bradfordTotalCPM = recalculatedPricing.bradfordTotalCPM;
      updateData.bradfordPrintMarginCPM = recalculatedPricing.bradfordPrintMarginCPM;
      updateData.bradfordPaperMarginCPM = recalculatedPricing.bradfordPaperMarginCPM;
      updateData.bradfordTotalMarginCPM = recalculatedPricing.bradfordTotalMarginCPM;
      updateData.printCPM = recalculatedPricing.printCPM;
      updateData.paperCostCPM = recalculatedPricing.paperCostCPM;

      // Preserve user's manual paperChargedCPM if they set it
      if (userPaperChargedCPM !== undefined) {
        updateData.paperChargedCPM = userPaperChargedCPM;
      } else {
        updateData.paperChargedCPM = recalculatedPricing.paperChargedCPM;
      }

      // Update totals
      // Preserve user's manual customerTotal if they set it
      if (userCustomerTotal !== undefined) {
        updateData.customerTotal = userCustomerTotal;
      } else {
        updateData.customerTotal = recalculatedPricing.customerTotal;
      }
      updateData.impactMargin = recalculatedPricing.impactMargin;
      updateData.bradfordTotal = recalculatedPricing.bradfordTotal;
      updateData.bradfordPrintMargin = recalculatedPricing.bradfordPrintMargin;
      updateData.bradfordPaperMargin = recalculatedPricing.bradfordPaperMargin;
      updateData.bradfordTotalMargin = recalculatedPricing.bradfordTotalMargin;
      updateData.jdTotal = recalculatedPricing.jdTotal;
      updateData.paperCostTotal = recalculatedPricing.paperCostTotal;

      // Preserve user's manual paperChargedTotal if they set it
      if (userPaperChargedTotal !== undefined) {
        updateData.paperChargedTotal = userPaperChargedTotal;
      } else {
        updateData.paperChargedTotal = recalculatedPricing.paperChargedTotal;
      }

      updateData.paperWeightTotal = recalculatedPricing.paperWeightTotal;

      // Track the recalculation in activity log
      changes.push({
        field: 'pricing',
        oldValue: 'N/A',
        newValue: 'All pricing fields recalculated based on updated values',
      });

      console.log(`[Job ${jobId}] Pricing recalculated - Bradford Total: $${recalculatedPricing.bradfordTotal.toFixed(2)}, Customer Total: $${recalculatedPricing.customerTotal.toFixed(2)}`);
    } catch (error) {
      console.error(`[Job ${jobId}] Failed to recalculate pricing:`, error);
      // Continue with the update even if recalculation fails
    }
  }

  // AUTOMATIC CPM RECALCULATION FROM TOTALS
  // If any total amount changed or quantity changed, recalculate corresponding CPM values
  const totalFieldsChanged =
    updateData.customerTotal !== undefined ||
    updateData.jdTotal !== undefined ||
    updateData.paperChargedTotal !== undefined ||
    updateData.paperCostTotal !== undefined ||
    updateData.impactMargin !== undefined ||
    updateData.bradfordTotal !== undefined ||
    updateData.bradfordPrintMargin !== undefined ||
    updateData.bradfordPaperMargin !== undefined ||
    updateData.bradfordTotalMargin !== undefined ||
    updateData.quantity !== undefined;

  if (totalFieldsChanged && currentJob.quantity && currentJob.quantity > 0) {
    const currentQuantity = updateData.quantity ?? currentJob.quantity;
    const quantityInThousands = currentQuantity / 1000;

    // Recalculate each CPM from its corresponding total
    if (updateData.customerTotal !== undefined) {
      updateData.customerCPM = updateData.customerTotal / quantityInThousands;
    }
    if (updateData.jdTotal !== undefined) {
      updateData.printCPM = updateData.jdTotal / quantityInThousands;
    }
    if (updateData.paperChargedTotal !== undefined) {
      updateData.paperChargedCPM = updateData.paperChargedTotal / quantityInThousands;
    }
    if (updateData.paperCostTotal !== undefined) {
      updateData.paperCostCPM = updateData.paperCostTotal / quantityInThousands;
    }
    if (updateData.impactMargin !== undefined) {
      updateData.impactMarginCPM = updateData.impactMargin / quantityInThousands;
    }
    if (updateData.bradfordTotal !== undefined) {
      updateData.bradfordTotalCPM = updateData.bradfordTotal / quantityInThousands;
    }
    if (updateData.bradfordPrintMargin !== undefined) {
      updateData.bradfordPrintMarginCPM = updateData.bradfordPrintMargin / quantityInThousands;
    }
    if (updateData.bradfordPaperMargin !== undefined) {
      updateData.bradfordPaperMarginCPM = updateData.bradfordPaperMargin / quantityInThousands;
    }
    if (updateData.bradfordTotalMargin !== undefined) {
      updateData.bradfordTotalMarginCPM = updateData.bradfordTotalMargin / quantityInThousands;
    }

    // If quantity changed, recalculate ALL CPMs from current totals
    if (updateData.quantity !== undefined && updateData.quantity > 0) {
      const newQuantityInThousands = updateData.quantity / 1000;

      updateData.customerCPM = (updateData.customerTotal ?? currentJob.customerTotal) / newQuantityInThousands;
      if (currentJob.jdTotal) {
        updateData.printCPM = (updateData.jdTotal ?? currentJob.jdTotal) / newQuantityInThousands;
      }
      if (currentJob.paperChargedTotal) {
        updateData.paperChargedCPM = (updateData.paperChargedTotal ?? currentJob.paperChargedTotal) / newQuantityInThousands;
      }
      if (currentJob.paperCostTotal) {
        updateData.paperCostCPM = (updateData.paperCostTotal ?? currentJob.paperCostTotal) / newQuantityInThousands;
      }
      if (currentJob.impactMargin) {
        updateData.impactMarginCPM = (updateData.impactMargin ?? currentJob.impactMargin) / newQuantityInThousands;
      }
      if (currentJob.bradfordTotal) {
        updateData.bradfordTotalCPM = (updateData.bradfordTotal ?? currentJob.bradfordTotal) / newQuantityInThousands;
      }
      if (currentJob.bradfordPrintMargin) {
        updateData.bradfordPrintMarginCPM = (updateData.bradfordPrintMargin ?? currentJob.bradfordPrintMargin) / newQuantityInThousands;
      }
      if (currentJob.bradfordPaperMargin) {
        updateData.bradfordPaperMarginCPM = (updateData.bradfordPaperMargin ?? currentJob.bradfordPaperMargin) / newQuantityInThousands;
      }
      if (currentJob.bradfordTotalMargin) {
        updateData.bradfordTotalMarginCPM = (updateData.bradfordTotalMargin ?? currentJob.bradfordTotalMargin) / newQuantityInThousands;
      }
    }

    console.log(`[Job ${jobId}] CPM values automatically recalculated from updated totals`);
  }

  // NOTE: Margin recalculation is now handled by calculateDynamicPricing() above
  // All 3 margin modes (Normal, JD Supplies Paper, Bradford Waives) are correctly
  // implemented in pricing-calculator.ts. No need for duplicate logic here.

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
            contacts: {
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
  const customerEmail = job.customer?.contacts?.[0]?.email || job.customer?.email;

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
