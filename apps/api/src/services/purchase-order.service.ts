import { prisma, POStatus } from '@printing-workflow/db';
import { calculatePOAmounts } from '../lib/utils.js';

export async function createPurchaseOrder(data: {
  originCompanyId: string;
  targetCompanyId: string;
  jobId?: string;
  originalAmount: number;
  vendorAmount: number;
  marginAmount: number;
  externalRef?: string;
}) {
  const po = await prisma.purchaseOrder.create({
    data: {
      originCompanyId: data.originCompanyId,
      targetCompanyId: data.targetCompanyId,
      jobId: data.jobId,
      originalAmount: data.originalAmount,
      vendorAmount: data.vendorAmount,
      marginAmount: data.marginAmount,
      externalRef: data.externalRef,
      status: POStatus.PENDING,
    },
    include: {
      originCompany: true,
      targetCompany: true,
      job: true,
    },
  });

  return po;
}

/**
 * Create auto PO with pricing from the pricing system
 * Called by the purchase order queue
 */
export async function createAutoPurchaseOrder(data: {
  jobId: string;
  originCompanyId: string;
  targetCompanyId: string;
  originalAmount: number;
  vendorAmount?: number; // If provided, use exact amount from pricing system
}) {
  let vendorAmount: number;
  let marginAmount: number;

  if (data.vendorAmount !== undefined) {
    // Use exact amounts from pricing system
    vendorAmount = data.vendorAmount;
    marginAmount = data.originalAmount - data.vendorAmount;
  } else {
    // Fall back to old calculation (for backwards compatibility)
    const amounts = calculatePOAmounts(data.originalAmount);
    vendorAmount = amounts.vendorAmount;
    marginAmount = amounts.marginAmount;
  }

  const po = await createPurchaseOrder({
    originCompanyId: data.originCompanyId,
    targetCompanyId: data.targetCompanyId,
    jobId: data.jobId,
    originalAmount: data.originalAmount,
    vendorAmount,
    marginAmount,
  });

  console.log(
    `Auto PO created: ${data.originCompanyId} → ${data.targetCompanyId} | Original: $${data.originalAmount}, Vendor: $${vendorAmount}, Margin: $${marginAmount}`
  );

  return po;
}

/**
 * Create PO from Bradford webhook (Bradford → JD Graphic)
 */
export async function createPOFromWebhook(data: {
  componentId: string;
  estimateNumber: string;
  amount: number;
  jobId?: string;
  originCompanyId: string;
  targetCompanyId: string;
}) {
  const po = await createPurchaseOrder({
    originCompanyId: data.originCompanyId,
    targetCompanyId: data.targetCompanyId,
    jobId: data.jobId,
    originalAmount: data.amount,
    vendorAmount: data.amount,
    marginAmount: 0, // Bradford keeps the margin
    externalRef: `${data.componentId}-${data.estimateNumber}`,
  });

  return po;
}

export async function updatePOStatus(id: string, status: POStatus) {
  return prisma.purchaseOrder.update({
    where: { id },
    data: { status },
  });
}

export async function getPOById(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      originCompany: true,
      targetCompany: true,
      job: {
        include: {
          customer: true,
        },
      },
    },
  });
}

export async function listPurchaseOrders(filters?: {
  jobId?: string;
  originCompanyId?: string;
  targetCompanyId?: string;
  status?: POStatus;
}) {
  return prisma.purchaseOrder.findMany({
    where: {
      jobId: filters?.jobId,
      originCompanyId: filters?.originCompanyId,
      targetCompanyId: filters?.targetCompanyId,
      status: filters?.status,
    },
    include: {
      originCompany: true,
      targetCompany: true,
      job: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function findPOByExternalRef(externalRef: string) {
  return prisma.purchaseOrder.findFirst({
    where: { externalRef },
    include: {
      originCompany: true,
      targetCompany: true,
      job: true,
    },
  });
}
