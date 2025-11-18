import { FastifyPluginAsync } from 'fastify';
import { createPurchaseOrderSchema } from '@printing-workflow/shared';
import { POStatus } from '@printing-workflow/db';
import {
  createPurchaseOrder,
  updatePOStatus,
  updatePurchaseOrder,
  uploadPOPdf,
  uploadBradfordPOPdf,
  getPOById,
  listPurchaseOrders,
  generatePurchaseOrderPdf,
} from '../services/purchase-order.service.js';
import {
  parseBradfordPO,
  createPOFromParsedPDF,
} from '../services/pdf-parser.service.js';

export const purchaseOrderRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/purchase-orders - Create purchase order
  fastify.post('/', async (request, reply) => {
    const body = createPurchaseOrderSchema.parse(request.body);
    const po = await createPurchaseOrder(body);
    return po;
  });

  // POST /api/purchase-orders/upload-bradford-pdf - Upload Bradford PDF and create PO
  fastify.post('/upload-bradford-pdf', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    // Check if PDF
    if (data.mimetype !== 'application/pdf') {
      return reply.status(400).send({ error: 'File must be a PDF' });
    }

    try {
      // Read file buffer
      const buffer = await data.toBuffer();

      // Parse PDF
      const parsed = await parseBradfordPO(buffer);

      // Get optional jobId from fields
      const fields = data.fields as any;
      const jobId = fields?.jobId?.value;

      // Create PO data
      const poData = await createPOFromParsedPDF(parsed, jobId);

      // Create the PO
      const po = await createPurchaseOrder(poData);

      return {
        success: true,
        purchaseOrder: po,
        parsed: {
          customerCode: parsed.customerCode,
          customerId: parsed.customerId,
          amount: parsed.amount,
          poNumber: parsed.poNumber,
          description: parsed.description,
        },
      };
    } catch (error: any) {
      console.error('Error parsing Bradford PDF:', error);
      return reply.status(400).send({
        error: error.message || 'Failed to parse PDF',
      });
    }
  });

  // PATCH /api/purchase-orders/:id - Update purchase order
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const {
      originalAmount,
      vendorAmount,
      marginAmount,
      status,
      externalRef,
    } = request.body as {
      originalAmount?: number;
      vendorAmount?: number;
      marginAmount?: number;
      status?: POStatus;
      externalRef?: string;
    };

    const po = await updatePurchaseOrder(id, {
      originalAmount,
      vendorAmount,
      marginAmount,
      status,
      externalRef,
    });

    return po;
  });

  // PATCH /api/purchase-orders/:id/status - Update PO status (legacy endpoint)
  fastify.patch('/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: POStatus };

    const po = await updatePOStatus(id, status);
    return po;
  });

  // POST /api/purchase-orders/:id/upload-pdf - Upload PDF for purchase order
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
      const result = await uploadPOPdf(id, buffer, data.filename);
      return result;
    } catch (error: any) {
      console.error('Error uploading PO PDF:', error);
      return reply.status(400).send({
        error: error.message || 'Failed to upload PDF',
      });
    }
  });

  // POST /api/purchase-orders/:id/generate-pdf - Generate PDF for purchase order
  fastify.post('/:id/generate-pdf', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const po = await generatePurchaseOrderPdf(id);
      return {
        success: true,
        purchaseOrder: po,
        message: 'PDF generated successfully',
      };
    } catch (error: any) {
      console.error('Error generating PO PDF:', error);
      return reply.status(400).send({
        error: error.message || 'Failed to generate PDF',
      });
    }
  });

  // POST /api/purchase-orders/bradford-to-jd - Bradford uploads their PO PDF to JD
  fastify.post('/bradford-to-jd', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    // Check if PDF
    if (data.mimetype !== 'application/pdf') {
      return reply.status(400).send({ error: 'File must be a PDF' });
    }

    try {
      // Get jobId and optional manual PO number from form fields
      const fields = data.fields as any;
      const jobId = fields?.jobId?.value;
      const manualPONumber = fields?.poNumber?.value;

      if (!jobId) {
        return reply.status(400).send({ error: 'jobId is required' });
      }

      const buffer = await data.toBuffer();
      const result = await uploadBradfordPOPdf(
        jobId,
        buffer,
        data.filename,
        manualPONumber
      );

      return {
        success: true,
        purchaseOrder: result.po,
        file: result.file,
        extractedPONumber: result.extractedPONumber,
        poNumber: result.poNumber,
        message: result.extractedPONumber
          ? `Successfully extracted PO# ${result.poNumber} from PDF`
          : manualPONumber
          ? `Using manual PO# ${result.poNumber}`
          : `Generated PO# ${result.poNumber}`,
      };
    } catch (error: any) {
      console.error('Error uploading Bradford PO PDF:', error);
      return reply.status(400).send({
        error: error.message || 'Failed to upload Bradford PO PDF',
      });
    }
  });

  // GET /api/purchase-orders/:id - Get PO by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const po = await getPOById(id);

    if (!po) {
      return reply.status(404).send({ error: 'Purchase order not found' });
    }

    return po;
  });

  // GET /api/purchase-orders - List purchase orders
  fastify.get('/', async (request, reply) => {
    const { jobId, originCompanyId, targetCompanyId, status } = request.query as {
      jobId?: string;
      originCompanyId?: string;
      targetCompanyId?: string;
      status?: POStatus;
    };

    const pos = await listPurchaseOrders({
      jobId,
      originCompanyId,
      targetCompanyId,
      status,
    });

    return { purchaseOrders: pos };
  });

  // GET /api/purchase-orders/bradford-payments - List all Bradford pending payments
  fastify.get('/bradford-payments', async (request, reply) => {
    try {
      const { prisma } = fastify;

      // Find all POs with unpaid Bradford cuts (third-party vendor jobs)
      const pendingPayments = await prisma.purchaseOrder.findMany({
        where: {
          marginAmount: {
            gt: 0, // Bradford has a cut
          },
          bradfordCutPaid: {
            not: true, // Not yet paid
          },
          targetCompanyId: {
            not: 'jd-graphic', // Exclude JD Graphic jobs (those are BRADFORD_JD routing)
          },
        },
        include: {
          job: {
            select: {
              jobNo: true,
              customer: {
                select: {
                  name: true,
                },
              },
            },
          },
          targetCompany: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Calculate totals
      const totalPending = pendingPayments.reduce(
        (sum, po) => sum + parseFloat(po.marginAmount.toString()),
        0
      );

      return {
        pendingPayments: pendingPayments.map((po) => ({
          id: po.id,
          poNumber: po.poNumber,
          jobNo: po.job?.jobNo,
          customerName: po.job?.customer?.name,
          vendorName: po.targetCompany?.name,
          originalAmount: parseFloat(po.originalAmount.toString()),
          vendorAmount: parseFloat(po.vendorAmount.toString()),
          bradfordCut: parseFloat(po.marginAmount.toString()),
          createdAt: po.createdAt,
          status: po.status,
        })),
        summary: {
          count: pendingPayments.length,
          totalPending,
        },
      };
    } catch (error: any) {
      console.error('Error fetching Bradford payments:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to fetch Bradford payments',
      });
    }
  });

  // POST /api/purchase-orders/:id/mark-bradford-paid - Mark Bradford cut as paid
  fastify.post('/:id/mark-bradford-paid', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { notes } = request.body as { notes?: string };
      const { prisma } = fastify;

      // Find the PO
      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          job: {
            select: {
              jobNo: true,
            },
          },
        },
      });

      if (!po) {
        return reply.status(404).send({ error: 'Purchase order not found' });
      }

      // Verify it has a Bradford cut
      if (parseFloat(po.marginAmount.toString()) <= 0) {
        return reply.status(400).send({
          error: 'This purchase order has no Bradford cut to pay',
        });
      }

      // Verify it's not already paid
      if (po.bradfordCutPaid) {
        return reply.status(400).send({
          error: 'Bradford cut has already been marked as paid',
          paidDate: po.bradfordCutPaidDate,
        });
      }

      // Mark as paid
      const updatedPO = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          bradfordCutPaid: true,
          bradfordCutPaidDate: new Date(),
          bradfordPaymentNotes: notes,
        },
      });

      console.log(
        `✅ Marked Bradford cut as paid for PO ${po.poNumber} (Job ${po.job?.jobNo}): $${po.marginAmount}`
      );

      return {
        success: true,
        message: `Bradford cut of $${po.marginAmount} marked as paid`,
        purchaseOrder: {
          id: updatedPO.id,
          poNumber: updatedPO.poNumber,
          bradfordCut: parseFloat(updatedPO.marginAmount.toString()),
          bradfordCutPaid: updatedPO.bradfordCutPaid,
          bradfordCutPaidDate: updatedPO.bradfordCutPaidDate,
          bradfordPaymentNotes: updatedPO.bradfordPaymentNotes,
        },
      };
    } catch (error: any) {
      console.error('Error marking Bradford payment as paid:', error);
      return reply.status(500).send({
        error: error.message || 'Failed to mark payment as paid',
      });
    }
  });
};
