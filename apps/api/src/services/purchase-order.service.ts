import { prisma, POStatus } from '@printing-workflow/db';
import { calculatePOAmounts } from '../lib/utils.js';
import { generateBradfordPOPdf } from './bradford-po.service.js';
import { queueEmail } from '../lib/queue.js';
import { emailTemplates } from '../lib/email.js';

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

  // Generate Bradford PO PDF and send to JD Graphic
  try {
    const { pdfBytes, fileName } = await generateBradfordPOPdf(po.id);

    const poWithDetails = await getPOById(po.id);

    if (poWithDetails && poWithDetails.job) {
      const poNumber = po.externalRef?.split('-')[0] || `PO-${po.id.slice(0, 7)}`;

      const template = emailTemplates.bradfordPOToJD(
        data.componentId,
        poWithDetails.job.jobNo,
        poNumber,
        parseFloat(po.vendorAmount.toString())
      );

      // Send email to both JD Graphic production and Nick
      const jdEmails = ['production@jdgraphic.com', 'nick@jdgraphic.com'];

      for (const email of jdEmails) {
        await queueEmail({
          to: email,
          subject: template.subject,
          html: template.html,
          attachments: [
            {
              filename: fileName,
              content: pdfBytes,
            },
          ],
        });

        // Create notification record
        await prisma.notification.create({
          data: {
            type: 'PO_CREATED',
            jobId: poWithDetails.job.id,
            recipient: email,
            subject: template.subject,
            body: template.html,
          },
        });
      }

      console.log(`✅ Bradford PO PDF generated and emailed to JD Graphic (${jdEmails.join(', ')}): ${fileName}`);
    }
  } catch (error) {
    console.error('Failed to generate/send Bradford PO PDF:', error);
    // Don't fail the entire PO creation if PDF generation fails
  }

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
