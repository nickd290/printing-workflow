import { FastifyPluginAsync } from 'fastify';
import { generateInvoiceSchema } from '@printing-workflow/shared';
import { InvoiceStatus } from '@printing-workflow/db';
import {
  createInvoiceForJob,
  getInvoiceById,
  listInvoices,
  markInvoiceAsPaid,
  triggerBradfordInvoiceChain,
} from '../services/invoice.service.js';
import { queueInvoicePdfGeneration } from '../lib/queue.js';
import { COMPANY_IDS } from '@printing-workflow/shared';

export const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
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
