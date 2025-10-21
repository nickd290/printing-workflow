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

export interface GeneratePurchaseOrderPdfJob {
  purchaseOrderId: string;
}

export interface CreateAutoPOJob {
  jobId: string;
  customerTotal: number;
  bradfordTotal: number;
  jdTotal: number;
  customerPONumber?: string;
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

export async function queuePurchaseOrderPdfGeneration(data: GeneratePurchaseOrderPdfJob) {
  console.log(`[PDF Queue] Generating purchase order PDF for: ${data.purchaseOrderId}`);
  // PDF generation will happen inline when needed
  return Promise.resolve();
}

export async function queueAutoPOCreation(data: CreateAutoPOJob) {
  console.log(`[PO Queue] Creating auto-POs for job: ${data.jobId}`);
  console.log(`[PO Queue]   Customer PO#: ${data.customerPONumber || 'N/A'}`);
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
      customerPONumber: data.customerPONumber,
    });

    // Note: PO #2 (Bradford → JD Graphic) is created via Bradford PO PDF upload
    // This allows Bradford to upload their actual PO PDF and extract the PO#

    console.log(`[PO Queue] ✅ Auto-PO created successfully (Impact→Bradford)`);
  } catch (error) {
    console.error(`[PO Queue] ❌ Failed to create auto-PO:`, error);
  }

  return Promise.resolve();
}

// No connection export needed - running synchronously
export const connection = null;
