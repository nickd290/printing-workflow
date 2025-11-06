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
