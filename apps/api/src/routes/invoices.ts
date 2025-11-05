import { FastifyPluginAsync } from 'fastify';
import { generateInvoiceSchema } from '@printing-workflow/shared';
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
      dueAt,
      issuedAt,
    } = request.body as {
      jobId?: string;
      toCompanyId: string;
      fromCompanyId: string;
      amount: number;
      dueAt?: string;
      issuedAt?: string;
    };

    const invoice = await createInvoiceManual({
      jobId,
      toCompanyId,
      fromCompanyId,
      amount,
      dueAt: dueAt ? new Date(dueAt) : undefined,
      issuedAt: issuedAt ? new Date(issuedAt) : undefined,
    });

    return invoice;
  });

  // PATCH /api/invoices/:id - Update invoice
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { amount, dueAt, issuedAt, paidAt } = request.body as {
      amount?: number;
      dueAt?: string;
      issuedAt?: string;
      paidAt?: string;
    };

    const invoice = await updateInvoice(id, {
      amount,
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

  // GET /api/invoices/batch-preview - Preview batch payment before confirming
  fastify.get('/batch-preview', async (request, reply) => {
    const { invoiceIds } = request.query as { invoiceIds: string };

    if (!invoiceIds) {
      return reply.status(400).send({ error: 'invoiceIds query parameter is required (comma-separated)' });
    }

    const invoiceIdArray = invoiceIds.split(',').map(id => id.trim());

    if (invoiceIdArray.length === 0) {
      return reply.status(400).send({ error: 'At least one invoice ID is required' });
    }

    const { prisma } = await import('@printing-workflow/db');

    // Get all the selected invoices (Impact→Customer)
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIdArray },
        fromCompanyId: COMPANY_IDS.IMPACT_DIRECT, // Only Impact Direct customer invoices
      },
      include: {
        job: true,
        toCompany: true,
      },
    });

    if (invoices.length === 0) {
      return reply.status(404).send({ error: 'No valid customer invoices found' });
    }

    // Build customer invoice data
    const customerInvoices = invoices.map(invoice => ({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      amount: parseFloat(invoice.amount.toString()),
      jobNo: invoice.job?.jobNo || 'N/A',
      jobId: invoice.jobId,
      toCompany: invoice.toCompany.name,
    }));

    // Get corresponding Bradford invoices for these jobs
    const jobIds = invoices.map(inv => inv.jobId).filter(Boolean) as string[];
    const bradfordInvoices = await prisma.invoice.findMany({
      where: {
        jobId: { in: jobIds },
        fromCompanyId: COMPANY_IDS.BRADFORD,
        toCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      },
      include: {
        job: true,
      },
    });

    const bradfordInvoiceData = bradfordInvoices.map(inv => ({
      id: inv.id,
      invoiceNo: inv.invoiceNo,
      amount: parseFloat(inv.amount.toString()),
      jobNo: inv.job?.jobNo || 'N/A',
      jobId: inv.jobId,
      status: inv.paidAt ? 'PAID' : 'SENT',
      dueAt: inv.dueAt,
    }));

    // Calculate totals
    const totalReceived = customerInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalOwedToBradford = bradfordInvoiceData.reduce((sum, inv) => sum + inv.amount, 0);
    const netProfit = totalReceived - totalOwedToBradford;

    return {
      customerInvoices,
      totalReceived,
      bradfordInvoices: bradfordInvoiceData,
      totalOwedToBradford,
      netProfit,
    };
  });

  // POST /api/invoices/batch-confirm-payment - Confirm batch payment with transfer number and send email
  fastify.post('/batch-confirm-payment', async (request, reply) => {
    const { invoiceIds, bradfordCosts, transferNumber } = request.body as {
      invoiceIds: string[];
      bradfordCosts?: Array<{ invoiceId: string; amount: number }>;
      transferNumber: string;
    };

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return reply.status(400).send({ error: 'invoiceIds array is required' });
    }

    if (!transferNumber || transferNumber.trim() === '') {
      return reply.status(400).send({ error: 'transferNumber is required' });
    }

    const { prisma } = await import('@printing-workflow/db');
    const { sendEmail, emailTemplates } = await import('../lib/email.js');

    // Get all the selected invoices (Impact→Customer)
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        fromCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      },
      include: {
        job: true,
        toCompany: true,
      },
    });

    if (invoices.length === 0) {
      return reply.status(404).send({ error: 'No valid customer invoices found' });
    }

    // Mark all customer invoices as paid
    const markedPaid = [];
    for (const invoice of invoices) {
      const updated = await markInvoiceAsPaid(invoice.id);
      markedPaid.push({
        invoiceNo: invoice.invoiceNo,
        amount: parseFloat(invoice.amount.toString()),
        jobNo: invoice.job?.jobNo || 'N/A',
        toCompany: invoice.toCompany.name,
      });
    }

    // Get corresponding Bradford invoices for these jobs
    const jobIds = invoices.map(inv => inv.jobId).filter(Boolean) as string[];
    const bradfordInvoices = await prisma.invoice.findMany({
      where: {
        jobId: { in: jobIds },
        fromCompanyId: COMPANY_IDS.BRADFORD,
        toCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      },
      include: {
        job: true,
      },
    });

    // Build Bradford invoice data (use manual costs if provided)
    const bradfordInvoiceData = bradfordInvoices.map(inv => {
      const manualCost = bradfordCosts?.find(bc => bc.invoiceId === inv.id);
      const amount = manualCost?.amount ?? parseFloat(inv.amount.toString());

      return {
        invoiceNo: inv.invoiceNo,
        amount,
        jobNo: inv.job?.jobNo || 'N/A',
      };
    });

    // Calculate totals
    const totalReceived = markedPaid.reduce((sum, inv) => sum + inv.amount, 0);
    const totalOwedToBradford = bradfordInvoiceData.reduce((sum, inv) => sum + inv.amount, 0);
    const netProfit = totalReceived - totalOwedToBradford;

    // Send email notification to all stakeholders
    try {
      const emailData = emailTemplates.paymentBatchConfirmed({
        customerInvoices: markedPaid.map(inv => ({
          invoiceNo: inv.invoiceNo,
          jobNo: inv.jobNo,
          customer: inv.toCompany,
          amount: inv.amount,
        })),
        bradfordInvoices: bradfordInvoiceData,
        totalReceived,
        totalOwedToBradford,
        netProfit,
        transferNumber,
      });

      await sendEmail({
        to: 'steve.gustafson@bgeltd.com',
        cc: 'nick@jdgraphic.com,brandon@impactdirectprinting.com',
        subject: emailData.subject,
        html: emailData.html,
      });

      console.log(`[Batch Payment] Email sent to Steve, Nick, and Brandon for transfer ${transferNumber}`);
    } catch (error) {
      console.error('[Batch Payment] Error sending email:', error);
      // Don't fail the entire request if email fails
    }

    return {
      success: true,
      markedPaid,
      totalReceived,
      bradfordInvoices: bradfordInvoiceData,
      totalOwedToBradford,
      netProfit,
      transferNumber,
      message: `Successfully marked ${markedPaid.length} invoices as paid and sent notification email`,
    };
  });

  // POST /api/invoices/batch-mark-paid - Mark multiple invoices as paid and calculate Bradford payment
  fastify.post('/batch-mark-paid', async (request, reply) => {
    const { invoiceIds } = request.body as { invoiceIds: string[] };

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return reply.status(400).send({ error: 'invoiceIds array is required' });
    }

    const { prisma } = await import('@printing-workflow/db');

    // Get all the selected invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        id: { in: invoiceIds },
        fromCompanyId: COMPANY_IDS.IMPACT_DIRECT, // Only Impact Direct customer invoices
      },
      include: {
        job: true,
        toCompany: true,
      },
    });

    if (invoices.length === 0) {
      return reply.status(404).send({ error: 'No valid customer invoices found' });
    }

    // Mark all as paid
    const markedPaid = [];
    for (const invoice of invoices) {
      const updated = await markInvoiceAsPaid(invoice.id);
      markedPaid.push({
        invoiceNo: invoice.invoiceNo,
        amount: parseFloat(invoice.amount.toString()),
        jobNo: invoice.job?.jobNo || 'N/A',
        toCompany: invoice.toCompany.name,
      });
    }

    // Get corresponding Bradford invoices for these jobs
    const jobIds = invoices.map(inv => inv.jobId).filter(Boolean) as string[];
    const bradfordInvoices = await prisma.invoice.findMany({
      where: {
        jobId: { in: jobIds },
        fromCompanyId: COMPANY_IDS.BRADFORD,
        toCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      },
      include: {
        job: true,
      },
    });

    const bradfordInvoiceData = bradfordInvoices.map(inv => ({
      invoiceNo: inv.invoiceNo,
      amount: parseFloat(inv.amount.toString()),
      jobNo: inv.job?.jobNo || 'N/A',
      dueAt: inv.dueAt,
    }));

    // Calculate totals
    const totalReceived = markedPaid.reduce((sum, inv) => sum + inv.amount, 0);
    const totalOwedToBradford = bradfordInvoiceData.reduce((sum, inv) => sum + inv.amount, 0);
    const netProfit = totalReceived - totalOwedToBradford;

    return {
      markedPaid,
      totalReceived,
      bradfordInvoices: bradfordInvoiceData,
      totalOwedToBradford,
      netProfit,
    };
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
    const { jobId, toCompanyId } = request.query as {
      jobId?: string;
      toCompanyId?: string;
    };

    const invoices = await listInvoices({ jobId, toCompanyId });
    return { invoices };
  });
};
