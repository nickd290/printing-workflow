import { prisma, WebhookSource } from '@printing-workflow/db';
import { createPOFromWebhook, findPOByExternalRef } from './purchase-order.service.js';
import { getJobByJobNo } from './job.service.js';
import { COMPANY_IDS } from '@printing-workflow/shared';

export async function logWebhookEvent(data: {
  source: WebhookSource;
  payload: any;
}) {
  return prisma.webhookEvent.create({
    data: {
      source: data.source,
      payload: data.payload,
      processed: false,
    },
  });
}

export async function markWebhookAsProcessed(id: string) {
  return prisma.webhookEvent.update({
    where: { id },
    data: { processed: true },
  });
}

/**
 * Process Bradford PO webhook
 * This creates a PO from Bradford to JD Graphic
 */
export async function processBradfordPOWebhook(payload: {
  componentId: string;
  estimateNumber: string;
  amount: number;
  pdfUrl?: string;
  jobNo?: string;
}) {
  // Log webhook event
  const webhookEvent = await logWebhookEvent({
    source: WebhookSource.BRADFORD,
    payload,
  });

  try {
    // Check if we already processed this PO
    const externalRef = `${payload.componentId}-${payload.estimateNumber}`;
    const existingPO = await findPOByExternalRef(externalRef);

    if (existingPO) {
      console.log(`PO already exists for ${externalRef}`);
      await markWebhookAsProcessed(webhookEvent.id);
      return existingPO;
    }

    // Try to find associated job
    let jobId: string | undefined;
    if (payload.jobNo) {
      const job = await getJobByJobNo(payload.jobNo);
      jobId = job?.id;
    }

    // Create PO from Bradford to JD Graphic
    const po = await createPOFromWebhook({
      componentId: payload.componentId,
      estimateNumber: payload.estimateNumber,
      amount: payload.amount,
      jobId,
      originCompanyId: COMPANY_IDS.BRADFORD,
      targetCompanyId: COMPANY_IDS.JD_GRAPHIC,
    });

    // Mark webhook as processed
    await markWebhookAsProcessed(webhookEvent.id);

    console.log(
      `Bradford PO processed: ${payload.componentId}-${payload.estimateNumber} → $${payload.amount}`
    );

    return po;
  } catch (error) {
    console.error('Failed to process Bradford webhook:', error);
    throw error;
  }
}

export async function listWebhookEvents(filters?: {
  source?: WebhookSource;
  processed?: boolean;
}) {
  return prisma.webhookEvent.findMany({
    where: {
      source: filters?.source,
      processed: filters?.processed,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 100,
  });
}
