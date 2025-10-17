import { prisma, JobStatus } from '@printing-workflow/db';
import { calculateJobPricing } from '@printing-workflow/shared';
import { generateJobNumber } from '../lib/utils.js';
import { queueAutoPOCreation } from '../lib/queue.js';

export async function createJobFromQuote(quoteId: string) {
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

  const jobNo = await generateJobNumber();

  const job = await prisma.job.create({
    data: {
      jobNo,
      quoteId,
      customerId: quote.quoteRequest.customerId,
      status: JobStatus.PENDING,
      specs: quote.quoteRequest.specs,
      customerTotal: quote.total,
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
  });

  return job;
}

export async function createDirectJob(data: {
  customerId: string;
  sizeId: string;
  quantity: number;
  specs?: any;
  description?: string;
}) {
  // Calculate all pricing using the pricing calculator
  const pricing = calculateJobPricing(data.sizeId, data.quantity);

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
