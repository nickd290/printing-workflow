import { env } from '../env.js';
import { COMPANY_IDS } from '@printing-workflow/shared';

// Job data types
export interface SendEmailJob {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

export interface GenerateInvoicePdfJob {
  invoiceId: string;
}

export interface CreateAutoPOJob {
  jobId: string;
  customerTotal: number;
  bradfordTotal: number;
  jdTotal: number;
}

// Simple in-memory queue (runs synchronously without Redis)
// For production, switch back to BullMQ with Redis

export async function queueEmail(data: SendEmailJob) {
  console.log(`[Email Queue] To: ${data.to}, Subject: ${data.subject}`);
  console.log(`[Email Queue] Body: ${data.html.substring(0, 200)}...`);
  // In development, just log emails instead of sending
  return Promise.resolve();
}

export async function queueInvoicePdfGeneration(data: GenerateInvoicePdfJob) {
  console.log(`[PDF Queue] Generating invoice PDF for: ${data.invoiceId}`);
  // PDF generation will happen inline when needed
  return Promise.resolve();
}

export async function queueAutoPOCreation(data: CreateAutoPOJob) {
  console.log(`[PO Queue] Creating auto-POs for job: ${data.jobId}`);
  console.log(`[PO Queue]   Customer Total: $${data.customerTotal}`);
  console.log(`[PO Queue]   Bradford Total: $${data.bradfordTotal}`);
  console.log(`[PO Queue]   JD Total: $${data.jdTotal}`);

  // Run synchronously without queue
  try {
    const { createAutoPurchaseOrder } = await import('../services/purchase-order.service.js');

    // PO #1: Impact Direct → Bradford
    await createAutoPurchaseOrder({
      jobId: data.jobId,
      originCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      targetCompanyId: COMPANY_IDS.BRADFORD,
      originalAmount: data.customerTotal,
      vendorAmount: data.bradfordTotal,
    });

    // PO #2: Bradford → JD Graphic
    await createAutoPurchaseOrder({
      jobId: data.jobId,
      originCompanyId: COMPANY_IDS.BRADFORD,
      targetCompanyId: COMPANY_IDS.JD_GRAPHIC,
      originalAmount: data.bradfordTotal,
      vendorAmount: data.jdTotal,
    });

    console.log(`[PO Queue] ✅ Auto-POs created successfully (Impact→Bradford, Bradford→JD)`);
  } catch (error) {
    console.error(`[PO Queue] ❌ Failed to create auto-POs:`, error);
  }

  return Promise.resolve();
}

// No connection export needed - running synchronously
export const connection = null;
