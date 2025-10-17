import { FastifyPluginAsync } from 'fastify';
import { createPurchaseOrderSchema } from '@printing-workflow/shared';
import { POStatus } from '@printing-workflow/db';
import {
  createPurchaseOrder,
  updatePOStatus,
  getPOById,
  listPurchaseOrders,
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

  // PATCH /api/purchase-orders/:id/status - Update PO status
  fastify.patch('/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: POStatus };

    const po = await updatePOStatus(id, status);
    return po;
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
};
