import { Worker, Job } from 'bullmq';
import { connection, GenerateInvoicePdfJob, GeneratePurchaseOrderPdfJob } from '../lib/queue.js';
import { QUEUE_NAMES } from '@printing-workflow/shared';
import { prisma } from '@printing-workflow/db';
import { generateInvoicePdf } from '../services/invoice.service.js';
import { generatePurchaseOrderPdf } from '../services/purchase-order.service.js';

type PdfJobData = GenerateInvoicePdfJob | GeneratePurchaseOrderPdfJob;

const pdfWorker = new Worker(
  QUEUE_NAMES.PDF_GENERATION,
  async (job: Job<PdfJobData>) => {
    const jobData = job.data;

    // Check if it's an invoice PDF job or PO PDF job
    if ('invoiceId' in jobData) {
      const { invoiceId } = jobData;
      console.log(`Generating PDF for invoice ${invoiceId}`);

      try {
        const result = await generateInvoicePdf(invoiceId);
        console.log(`PDF generated successfully for invoice ${invoiceId}`);
        return result;
      } catch (error) {
        console.error(`Failed to generate PDF for invoice ${invoiceId}:`, error);
        throw error;
      }
    } else if ('purchaseOrderId' in jobData) {
      const { purchaseOrderId } = jobData;
      console.log(`Generating PDF for purchase order ${purchaseOrderId}`);

      try {
        const result = await generatePurchaseOrderPdf(purchaseOrderId);
        console.log(`PDF generated successfully for purchase order ${purchaseOrderId}`);
        return result;
      } catch (error) {
        console.error(`Failed to generate PDF for purchase order ${purchaseOrderId}:`, error);
        throw error;
      }
    } else {
      throw new Error('Invalid PDF job data');
    }
  },
  { connection }
);

pdfWorker.on('completed', (job) => {
  console.log(`PDF job ${job.id} completed`);
});

pdfWorker.on('failed', (job, err) => {
  console.error(`PDF job ${job?.id} failed:`, err);
});

export { pdfWorker };
