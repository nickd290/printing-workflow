import { FastifyPluginAsync } from 'fastify';
import { createJobSchema } from '@printing-workflow/shared';
import { JobStatus } from '@printing-workflow/db';
import {
  createJobFromQuote,
  createDirectJob,
  updateJobStatus,
  updateJob,
  getJobById,
  getJobByJobNo,
  listJobs,
} from '../services/job.service.js';
import { parseCustomerPO } from '../services/pdf-parser.service.js';

export const jobRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/jobs/from-quote/:quoteId - Create job from quote
  fastify.post('/from-quote/:quoteId', async (request, reply) => {
    const { quoteId } = request.params as { quoteId: string };
    const { customerPONumber } = request.body as { customerPONumber: string };

    if (!customerPONumber || customerPONumber.trim() === '') {
      return reply.status(400).send({ error: 'Customer PO number is required' });
    }

    const job = await createJobFromQuote(quoteId, customerPONumber);
    return job;
  });

  // POST /api/jobs/direct - Create direct job (no quote)
  fastify.post('/direct', async (request, reply) => {
    try {
      const body = createJobSchema.parse(request.body);

      // Validate customerPONumber is provided
      if (!body.customerPONumber || body.customerPONumber.trim() === '') {
        return reply.status(400).send({ error: 'Customer PO number is required' });
      }

      const job = await createDirectJob(body);
      return job;
    } catch (error: any) {
      return reply.status(400).send({
        error: error.message || 'Failed to create job',
        details: error.issues || undefined,
      });
    }
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

      // Parse PO (handles both PDF and text files, with filename parsing)
      const parsed = await parseCustomerPO(buffer, data.filename);

      console.log('✅ PO file parsed');
      console.log('  - Raw text length:', parsed.rawText?.length || 0);
      console.log('  - Description:', parsed.description || 'N/A');
      console.log('  - Paper:', parsed.paper || 'N/A');
      console.log('  - Flat Size:', parsed.flatSize || 'N/A');
      console.log('  - Folded Size:', parsed.foldedSize || 'N/A');
      console.log('  - Colors:', parsed.colors || 'N/A');
      console.log('  - Finishing:', parsed.finishing || 'N/A');
      console.log('  - Quantity:', parsed.quantity || 'N/A');
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

      // Validate customer PO number was extracted
      if (!parsed.poNumber || parsed.poNumber.trim() === '') {
        return reply.status(400).send({
          error: 'Could not extract customer PO number from PDF. Please provide it manually.',
          parsed: {
            description: parsed.description || null,
            rawTextPreview: parsed.rawText?.substring(0, 500) || null,
          },
        });
      }

      // Create job with extracted customer PO number
      console.log('📝 Creating job with specs:', JSON.stringify(specs, null, 2));
      const job = await createDirectJob({
        customerId,
        sizeId: 'SM_7_25_16_375', // Default size - should be extracted or provided
        quantity: parsed.quantity || 1000, // Default quantity
        customerPONumber: parsed.poNumber,
        specs,
        description: parsed.description,
      });

      // Update job with delivery date if available
      if (parsed.deliveryDate) {
        const { prisma } = await import('@printing-workflow/db');
        await prisma.job.update({
          where: { id: job.id },
          data: {
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

  // GET /api/jobs/grouped - List jobs grouped by customer company
  fastify.get('/grouped', async (request, reply) => {
    const { prisma } = await import('@printing-workflow/db');

    // Get all jobs with their customer company
    const jobs = await prisma.job.findMany({
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            type: true,
            email: true,
          },
        },
      },
      orderBy: {
        jobNo: 'asc',
      },
    });

    // Group jobs by customer
    const customerMap = new Map<string, {
      id: string;
      name: string;
      type: string;
      email: string | null;
      jobs: any[];
      jobCount: number;
      totalRevenue: number;
    }>();

    for (const job of jobs) {
      const customerId = job.customer.id;

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          id: job.customer.id,
          name: job.customer.name,
          type: job.customer.type,
          email: job.customer.email,
          jobs: [],
          jobCount: 0,
          totalRevenue: 0,
        });
      }

      const customer = customerMap.get(customerId)!;
      customer.jobs.push(job);
      customer.jobCount++;
      customer.totalRevenue += Number(job.customerTotal || 0);
    }

    // Convert map to array and sort by name
    const customers = Array.from(customerMap.values())
      .filter(c => c.type === 'customer') // Only include actual customers
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      customers: customers.map(c => ({
        ...c,
        totalRevenue: c.totalRevenue.toFixed(2),
      })),
      summary: {
        totalCustomers: customers.length,
        totalJobs: customers.reduce((sum, c) => sum + c.jobCount, 0),
        totalRevenue: customers.reduce((sum, c) => sum + c.totalRevenue, 0).toFixed(2),
      },
    };
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

  // PATCH /api/jobs/:id - Update job details with activity tracking
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      quantity?: number;
      deliveryDate?: string;
      packingSlipNotes?: string;
      customerPONumber?: string;
      specs?: any;
      // User context for activity tracking
      changedBy?: string;
      changedByRole?: string;
    };

    // Extract user context (from auth middleware or request body)
    const changedBy = body.changedBy || 'Unknown User';
    const changedByRole = body.changedByRole || 'CUSTOMER';

    // Build updates object (exclude context fields)
    const updates: any = {};
    if (body.quantity !== undefined) updates.quantity = body.quantity;
    if (body.deliveryDate !== undefined) updates.deliveryDate = body.deliveryDate;
    if (body.packingSlipNotes !== undefined) updates.packingSlipNotes = body.packingSlipNotes;
    if (body.customerPONumber !== undefined) updates.customerPONumber = body.customerPONumber;
    if (body.specs !== undefined) updates.specs = body.specs;

    const job = await updateJob(id, updates, {
      changedBy,
      changedByRole,
    });

    return { job };
  });

  // GET /api/jobs/:id/activities - Get job activity history
  fastify.get('/:id/activities', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { prisma } = await import('@printing-workflow/db');

    const activities = await prisma.jobActivity.findMany({
      where: { jobId: id },
      orderBy: { createdAt: 'desc' },
    });

    return { activities };
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
