import { FastifyPluginAsync } from 'fastify';
import { createJobSchema } from '@printing-workflow/shared';
import { JobStatus } from '@printing-workflow/db';
import {
  createJobFromQuote,
  createDirectJob,
  updateJobStatus,
  getJobById,
  getJobByJobNo,
  listJobs,
} from '../services/job.service.js';
import { parseCustomerPO } from '../services/pdf-parser.service.js';

export const jobRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/jobs/from-quote/:quoteId - Create job from quote
  fastify.post('/from-quote/:quoteId', async (request, reply) => {
    const { quoteId } = request.params as { quoteId: string };
    const job = await createJobFromQuote(quoteId);
    return job;
  });

  // POST /api/jobs/direct - Create direct job (no quote)
  fastify.post('/direct', async (request, reply) => {
    const body = createJobSchema.parse(request.body);
    const job = await createDirectJob(body);
    return job;
  });

  // POST /api/jobs/from-pdf - Parse PO file (PDF or text) and create job
  fastify.post('/from-pdf', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    try {
      // Read file buffer
      const buffer = await data.toBuffer();

      // Get customerId from form fields
      const fields = data.fields as any;
      const customerId = fields?.customerId?.value;

      if (!customerId) {
        return reply.status(400).send({ error: 'customerId is required' });
      }

      console.log('📄 Parsing PO file to create job...');
      console.log('  - Customer ID:', customerId);
      console.log('  - File name:', data.filename);
      console.log('  - MIME type:', data.mimetype);
      console.log('  - File size:', buffer.length, 'bytes');

      // Parse PO (handles both PDF and text files)
      const parsed = await parseCustomerPO(buffer);

      console.log('✅ PO file parsed');
      console.log('  - Raw text length:', parsed.rawText?.length || 0);
      console.log('  - Description:', parsed.description || 'N/A');
      console.log('  - Paper:', parsed.paper || 'N/A');
      console.log('  - Flat Size:', parsed.flatSize || 'N/A');
      console.log('  - Folded Size:', parsed.foldedSize || 'N/A');
      console.log('  - Colors:', parsed.colors || 'N/A');
      console.log('  - Finishing:', parsed.finishing || 'N/A');
      console.log('  - Total:', parsed.total || 'N/A');
      console.log('  - PO Number:', parsed.poNumber || 'N/A');
      console.log('  - Delivery Date:', parsed.deliveryDate || 'N/A');
      console.log('  - Samples:', parsed.samples || 'N/A');

      // Build specs from parsed data - keep all fields even if null
      const specs = {
        description: parsed.description || 'Job from parsed PO',
        paper: parsed.paper || undefined,
        flatSize: parsed.flatSize || undefined,
        foldedSize: parsed.foldedSize || undefined,
        colors: parsed.colors || undefined,
        finishing: parsed.finishing || undefined,
        deliveryDate: parsed.deliveryDate || undefined,
        samples: parsed.samples || undefined,
        // Include raw text for reference
        rawPOText: parsed.rawText?.substring(0, 1000) || undefined,
      };

      // Create job
      console.log('📝 Creating job with specs:', JSON.stringify(specs, null, 2));
      const job = await createDirectJob({
        customerId,
        specs,
        customerTotal: parsed.total || 0,
      });

      // Update job with PO number and delivery date if available
      if (parsed.poNumber || parsed.deliveryDate) {
        const { prisma } = await import('@printing-workflow/db');
        await prisma.job.update({
          where: { id: job.id },
          data: {
            customerPONumber: parsed.poNumber || undefined,
            deliveryDate: parsed.deliveryDate ? new Date(parsed.deliveryDate) : undefined,
          },
        });
      }

      console.log('✅ Job created successfully:', job.jobNo);

      return {
        success: true,
        job,
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
          rawTextPreview: parsed.rawText?.substring(0, 500) || null,
        },
      };
    } catch (error: any) {
      console.error('❌ Error creating job from PO file:', error);
      console.error('Stack trace:', error.stack);
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to create job from PO file',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  });

  // PATCH /api/jobs/:id/status - Update job status
  fastify.patch('/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: JobStatus };

    const job = await updateJobStatus(id, status);
    return job;
  });

  // GET /api/jobs/:id - Get job by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await getJobById(id);

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return job;
  });

  // GET /api/jobs/by-number/:jobNo - Get job by job number
  fastify.get('/by-number/:jobNo', async (request, reply) => {
    const { jobNo } = request.params as { jobNo: string };
    const job = await getJobByJobNo(jobNo);

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return job;
  });

  // GET /api/jobs - List jobs with role-based filtering
  fastify.get('/', async (request, reply) => {
    const { customerId, status, companyId, userRole } = request.query as {
      customerId?: string;
      status?: JobStatus;
      companyId?: string;
      userRole?: string;
    };

    const jobs = await listJobs({ customerId, status, companyId, userRole });
    return { jobs };
  });

  // PATCH /api/jobs/:id - Update job details
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      deliveryDate?: string;
      packingSlipNotes?: string;
      customerPONumber?: string;
    };

    const { prisma } = await import('@printing-workflow/db');

    const job = await prisma.job.update({
      where: { id },
      data: {
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : undefined,
        packingSlipNotes: body.packingSlipNotes,
        customerPONumber: body.customerPONumber,
      },
      include: {
        customer: true,
        files: true,
        proofs: {
          include: {
            file: true,
            approvals: true,
          },
        },
        purchaseOrders: {
          include: {
            originCompany: true,
            targetCompany: true,
          },
        },
        invoices: {
          include: {
            fromCompany: true,
            toCompany: true,
          },
        },
        shipments: true,
        sampleShipments: true,
      },
    });

    return { job };
  });

  // POST /api/jobs/:id/sample-shipments - Add sample shipment
  fastify.post('/:id/sample-shipments', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      recipientName: string;
      recipientEmail: string;
      recipientAddress?: string;
      carrier: string;
      trackingNo?: string;
    };

    const { prisma } = await import('@printing-workflow/db');

    const sampleShipment = await prisma.sampleShipment.create({
      data: {
        jobId: id,
        recipientName: body.recipientName,
        recipientEmail: body.recipientEmail,
        recipientAddress: body.recipientAddress,
        carrier: body.carrier,
        trackingNo: body.trackingNo,
        description: `Sample for ${body.recipientName}`,
      },
    });

    return { sampleShipment };
  });
};
