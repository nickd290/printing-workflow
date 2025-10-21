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
};
