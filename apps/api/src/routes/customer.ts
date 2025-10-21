import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@printing-workflow/db';
import { parseCustomerPO } from '../services/pdf-parser.service.js';
import { checkJobReadiness, updateJobReadiness, getJobFileProgress } from '../services/job.service.js';
import { sendNotification, sendJobReadyNotifications } from '../services/notification.service.js';

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

  // ============================================================================
  // New Customer Job Creation Workflow
  // ============================================================================

  /**
   * POST /customer/parse-po
   * Parse PO and return extracted data for review (doesn't create job yet)
   */
  server.post('/parse-po', async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      console.log(`📄 Parsing customer PO: ${data.filename}`);

      // Parse the PO file with AI
      const parsed = await parseCustomerPO(buffer);

      return {
        success: true,
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
          requiredArtworkCount: parsed.requiredArtworkCount || 1,
          requiredDataFileCount: parsed.requiredDataFileCount || 0,
        },
      };
    } catch (error: any) {
      console.error('PO parsing failed:', error);
      return reply.code(500).send({ error: error.message || 'Failed to parse PO' });
    }
  });

  /**
   * POST /customer/jobs
   * Create a new job (from PO data or manual entry)
   */
  server.post('/jobs', async (request, reply) => {
    try {
      const body = request.body as any;
      const {
        customerId,
        description,
        paper,
        flatSize,
        foldedSize,
        colors,
        finishing,
        total,
        poNumber,
        deliveryDate,
        samples,
        requiredArtworkCount,
        requiredDataFileCount,
      } = body;

      if (!customerId) {
        return reply.code(400).send({ error: 'Customer ID is required' });
      }

      // Generate job number
      const { generateJobNumber } = await import('../lib/utils.js');
      const jobNo = await generateJobNumber();

      // Build specs object
      const specs = {
        description: description || 'New customer order',
        paper,
        flatSize,
        foldedSize,
        colors,
        finishing,
        deliveryDate,
        samples,
      };

      // Create job
      const job = await prisma.job.create({
        data: {
          jobNo,
          customerId,
          status: 'PENDING',
          customerTotal: String(total || 0),
          customerPONumber: poNumber || undefined,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
          requiredArtworkCount: requiredArtworkCount ?? 1,
          requiredDataFileCount: requiredDataFileCount ?? 0,
          specs,
        },
        include: {
          customer: true,
        },
      });

      console.log(`✅ Created job ${job.jobNo} for customer ${customerId}`);

      return {
        success: true,
        job: {
          id: job.id,
          jobNo: job.jobNo,
          status: job.status,
          customerTotal: job.customerTotal,
          requiredArtworkCount: job.requiredArtworkCount,
          requiredDataFileCount: job.requiredDataFileCount,
        },
      };
    } catch (error: any) {
      console.error('Job creation failed:', error);
      return reply.code(500).send({ error: error.message || 'Failed to create job' });
    }
  });

  /**
   * POST /customer/jobs/:id/files
   * Upload files to an existing job
   */
  server.post('/jobs/:id/files', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      const fileKind = data.fields.kind?.value as string;
      if (!fileKind || !['ARTWORK', 'DATA_FILE'].includes(fileKind)) {
        return reply.code(400).send({ error: 'Invalid file kind. Must be ARTWORK or DATA_FILE' });
      }

      // Check if job exists
      const job = await prisma.job.findUnique({ where: { id } });
      if (!job) {
        return reply.code(404).send({ error: 'Job not found' });
      }

      const buffer = await data.toBuffer();

      // Create file record (simplified - in production, upload to S3)
      const file = await prisma.file.create({
        data: {
          kind: fileKind as any,
          jobId: id,
          objectKey: `jobs/${id}/${Date.now()}-${data.filename}`,
          fileName: data.filename,
          mimeType: data.mimetype,
          size: buffer.length,
          checksum: 'placeholder', // In production: calculate SHA-256
          uploadedBy: request.user?.id || 'customer',
        },
      });

      // Update job readiness status
      const becameReady = await updateJobReadiness(id);

      // If job just became ready, send notifications
      if (becameReady) {
        console.log(`🎉 Job ${job.jobNo} is now ready for production!`);

        // Fetch full job with customer and files for notification
        const fullJob = await prisma.job.findUnique({
          where: { id },
          include: {
            customer: true,
            files: true,
          },
        });

        if (fullJob) {
          await sendJobReadyNotifications(fullJob);
        }
      }

      // Get current progress
      const progress = await getJobFileProgress(id);

      return {
        success: true,
        file: {
          id: file.id,
          fileName: file.fileName,
          kind: file.kind,
        },
        progress,
        isReady: becameReady,
      };
    } catch (error: any) {
      console.error('File upload failed:', error);
      return reply.code(500).send({ error: error.message || 'Failed to upload file' });
    }
  });

  /**
   * POST /customer/jobs/:id/submit
   * Manually submit job for production
   */
  server.post('/jobs/:id/submit', async (request, reply) => {
    try {
      const { id } = request.params as any;

      // Check job readiness
      const status = await checkJobReadiness(id);

      if (!status.isReady) {
        return reply.code(400).send({
          error: 'Job is not ready for production',
          details: {
            missingArtwork: status.missingArtwork,
            missingDataFiles: status.missingDataFiles,
          },
        });
      }

      // Update job
      const job = await prisma.job.update({
        where: { id },
        data: {
          isReadyForProduction: true,
          submittedForProductionAt: new Date(),
        },
        include: {
          customer: true,
          files: true,
        },
      });

      console.log(`📋 Job ${job.jobNo} manually submitted for production`);

      // Send notifications to both internal team and customer
      await sendJobReadyNotifications(job);

      return {
        success: true,
        message: 'Job submitted for production',
        job: {
          id: job.id,
          jobNo: job.jobNo,
          submittedAt: job.submittedForProductionAt,
        },
      };
    } catch (error: any) {
      console.error('Job submission failed:', error);
      return reply.code(500).send({ error: error.message || 'Failed to submit job' });
    }
  });

  /**
   * GET /customer/jobs/:id/progress
   * Get file upload progress for a job
   */
  server.get('/jobs/:id/progress', async (request, reply) => {
    try {
      const { id } = request.params as any;

      const progress = await getJobFileProgress(id);

      return {
        success: true,
        progress,
      };
    } catch (error: any) {
      console.error('Failed to get progress:', error);
      return reply.code(500).send({ error: error.message || 'Failed to get progress' });
    }
  });
};

export default customerRoutes;
