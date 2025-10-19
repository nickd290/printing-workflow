import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@printing-workflow/db';
import { parseCustomerPO } from '../services/pdf-parser.service.js';

const customerRoutes: FastifyPluginAsync = async (server) => {
  // Customer uploads their PO
  server.post('/upload-po', async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      const customerId = data.fields.customerId?.value as string;

      if (!customerId) {
        return reply.code(400).send({ error: 'Customer ID is required' });
      }

      console.log(`📄 Customer ${customerId.toUpperCase()} uploading PO: ${data.filename}`);

      // Parse the PO file
      const parsed = await parseCustomerPO(buffer);

      // Build specs from parsed data
      const specs = {
        description: parsed.description || `Order from customer PO - ${data.filename}`,
        paper: parsed.paper || undefined,
        flatSize: parsed.flatSize || undefined,
        foldedSize: parsed.foldedSize || undefined,
        colors: parsed.colors || undefined,
        finishing: parsed.finishing || undefined,
        deliveryDate: parsed.deliveryDate || undefined,
        samples: parsed.samples || undefined,
        rawPOText: parsed.rawText?.substring(0, 1000) || undefined,
      };

      // Generate job number
      const { generateJobNumber } = await import('../lib/utils.js');
      const jobNo = await generateJobNumber();

      // Create job directly without pricing calculation
      // (customer POs may not have complete size/quantity info)
      const job = await prisma.job.create({
        data: {
          jobNo,
          customerId,
          status: 'PENDING',
          customerTotal: String(parsed.total || 0),
          specs,
        },
        include: {
          customer: true,
        },
      });

      // Update job with PO number and delivery date if available
      if (parsed.poNumber || parsed.deliveryDate) {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            customerPONumber: parsed.poNumber || undefined,
            deliveryDate: parsed.deliveryDate ? new Date(parsed.deliveryDate) : undefined,
          },
        });
      }

      // Auto-create PO from Impact Direct to Bradford
      await prisma.purchaseOrder.create({
        data: {
          originCompanyId: 'impact-direct',
          targetCompanyId: 'bradford',
          jobId: job.id,
          originalAmount: String(parsed.total || 0),
          vendorAmount: '0',
          marginAmount: String(parsed.total || 0),
          status: 'PENDING',
        },
      });

      console.log(`✅ Customer ${customerId.toUpperCase()} uploaded PO, created job ${job.jobNo}`);

      return {
        success: true,
        message: 'PO uploaded and order created',
        job: {
          id: job.id,
          jobNo: job.jobNo,
          status: job.status,
          customerTotal: job.customerTotal,
        },
        parsed: {
          description: parsed.description || null,
          paper: parsed.paper || null,
          flatSize: parsed.flatSize || null,
          foldedSize: parsed.foldedSize || null,
          colors: parsed.colors || null,
          finishing: parsed.finishing || null,
          total: parsed.total || null,
          poNumber: parsed.poNumber || null,
          deliveryDate: parsed.deliveryDate || null,
          samples: parsed.samples || null,
        },
      };
    } catch (error: any) {
      console.error('Customer PO upload failed:', error);
      return reply.code(500).send({ error: error.message || 'Failed to process PO' });
    }
  });

  // Get customer's jobs (filtered by customer ID)
  server.get('/jobs/:customerId', async (request, reply) => {
    const { customerId } = request.params as any;

    const jobs = await prisma.job.findMany({
      where: { customerId },
      include: {
        customer: true,
        proofs: {
          orderBy: { version: 'desc' },
          take: 1,
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { jobs };
  });
};

export default customerRoutes;
