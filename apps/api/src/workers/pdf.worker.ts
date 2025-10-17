import { Worker, Job } from 'bullmq';
import { connection, GenerateInvoicePdfJob } from '../lib/queue.js';
import { QUEUE_NAMES } from '@printing-workflow/shared';
import { prisma } from '@printing-workflow/db';
import { generateInvoicePdf } from '../services/invoice.service.js';

const pdfWorker = new Worker(
  QUEUE_NAMES.PDF_GENERATION,
  async (job: Job<GenerateInvoicePdfJob>) => {
    const { invoiceId } = job.data;

    console.log(`Generating PDF for invoice ${invoiceId}`);

    try {
      const result = await generateInvoicePdf(invoiceId);
      console.log(`PDF generated successfully for invoice ${invoiceId}`);
      return result;
    } catch (error) {
      console.error(`Failed to generate PDF for invoice ${invoiceId}:`, error);
      throw error;
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
