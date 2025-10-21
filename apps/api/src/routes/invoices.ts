import { FastifyPluginAsync } from 'fastify';
import { generateInvoiceSchema } from '@printing-workflow/shared';
import { InvoiceStatus } from '@printing-workflow/db';
import {
  createInvoiceForJob,
  createInvoiceManual,
  updateInvoice,
  uploadInvoicePdf,
  getInvoiceById,
  listInvoices,
  markInvoiceAsPaid,
  triggerBradfordInvoiceChain,
  generateInvoicePdf,
} from '../services/invoice.service.js';
import { queueInvoicePdfGeneration } from '../lib/queue.js';
import { COMPANY_IDS } from '@printing-workflow/shared';

export const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/invoices - Create invoice manually
  fastify.post('/', async (request, reply) => {
    const {
      jobId,
      toCompanyId,
      fromCompanyId,
      amount,
      status,
      dueAt,
      issuedAt,
    } = request.body as {
      jobId?: string;
      toCompanyId: string;
      fromCompanyId: string;
      amount: number;
      status?: InvoiceStatus;
      dueAt?: string;
      issuedAt?: string;
    };

    const invoice = await createInvoiceManual({
      jobId,
      toCompanyId,
      fromCompanyId,
      amount,
      status,
      dueAt: dueAt ? new Date(dueAt) : undefined,
      issuedAt: issuedAt ? new Date(issuedAt) : undefined,
    });

    return invoice;
  });

  // PATCH /api/invoices/:id - Update invoice
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { amount, status, dueAt, issuedAt, paidAt } = request.body as {
      amount?: number;
      status?: InvoiceStatus;
      dueAt?: string;
      issuedAt?: string;
      paidAt?: string;
    };

    const invoice = await updateInvoice(id, {
      amount,
      status,
      dueAt: dueAt ? new Date(dueAt) : undefined,
      issuedAt: issuedAt ? new Date(issuedAt) : undefined,
      paidAt: paidAt ? new Date(paidAt) : undefined,
    });

    return invoice;
  });

  // POST /api/invoices/:id/upload-pdf - Upload PDF for invoice
  fastify.post('/:id/upload-pdf', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    // Check if PDF
    if (data.mimetype !== 'application/pdf') {
      return reply.status(400).send({ error: 'File must be a PDF' });
    }

    try {
      const buffer = await data.toBuffer();
      const invoice = await uploadInvoicePdf(id, buffer, data.filename);
      return invoice;
    } catch (error: any) {
      console.error('Error uploading invoice PDF:', error);
      return reply.status(400).send({
        error: error.message || 'Failed to upload PDF',
      });
    }
  });

  // POST /api/invoices/:id/generate-pdf - Generate PDF for existing invoice
  fastify.post('/:id/generate-pdf', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const invoice = await generateInvoicePdf(id);
      return {
        success: true,
        invoice,
        message: 'PDF generated successfully',
      };
    } catch (error: any) {
      console.error('Error generating invoice PDF:', error);
      return reply.status(400).send({
        error: error.message || 'Failed to generate PDF',
      });
    }
  });

  // POST /api/invoices/:jobId/generate - Generate invoice for job
  fastify.post('/:jobId/generate', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const { toCompanyId, fromCompanyId } = request.body as {
      toCompanyId: string;
      fromCompanyId: string;
    };

    // Create invoice
    const invoice = await createInvoiceForJob({
      jobId,
      toCompanyId,
      fromCompanyId,
    });

    // Queue PDF generation
    await queueInvoicePdfGeneration({ invoiceId: invoice.id });

    // If this is a customer invoice from Impact Direct, trigger Bradford invoice chain
    if (fromCompanyId === COMPANY_IDS.IMPACT_DIRECT &&
        (toCompanyId === COMPANY_IDS.JJSA || toCompanyId === COMPANY_IDS.BALLANTINE)) {
      console.log('[Invoice Route] Customer invoice created, triggering Bradford chain...');
      await triggerBradfordInvoiceChain(jobId);
    }

    return invoice;
  });

  // POST /api/invoices/:id/paid - Mark invoice as paid
  fastify.post('/:id/paid', async (request, reply) => {
    const { id } = request.params as { id: string };
    const invoice = await markInvoiceAsPaid(id);
    return invoice;
  });

  // GET /api/invoices/:id - Get invoice by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const invoice = await getInvoiceById(id);

    if (!invoice) {
      return reply.status(404).send({ error: 'Invoice not found' });
    }

    return invoice;
  });

  // GET /api/invoices - List invoices
  fastify.get('/', async (request, reply) => {
    const { jobId, toCompanyId, status } = request.query as {
      jobId?: string;
      toCompanyId?: string;
      status?: InvoiceStatus;
    };

    const invoices = await listInvoices({ jobId, toCompanyId, status });
    return { invoices };
  });
};
