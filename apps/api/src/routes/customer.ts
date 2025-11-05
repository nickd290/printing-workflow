import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@printing-workflow/db';
import { parseCustomerPO } from '../services/pdf-parser.service.js';
import { checkJobReadiness, updateJobReadiness, getJobFileProgress } from '../services/job.service.js';
import { sendNotification, sendJobReadyNotifications } from '../services/notification.service.js';
import { sendEmail, emailTemplates } from '../lib/email.js';

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

      // Parse the PO file with AI (pass filename for additional context)
      const parsed = await parseCustomerPO(buffer, data.filename);

      // Debug log to track data flow
      console.log('📊 API Response Data:', JSON.stringify({
        quantity: parsed.quantity,
        orderDate: parsed.orderDate,
        pickupDate: parsed.pickupDate,
        poolDate: parsed.poolDate,
        sampleInstructions: parsed.sampleInstructions?.substring(0, 50) + '...',
        sampleRecipientsCount: parsed.sampleRecipients?.length || 0
      }, null, 2));

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
          quantity: parsed.quantity || null,
          orderDate: parsed.orderDate || null,
          pickupDate: parsed.pickupDate || null,
          poolDate: parsed.poolDate || null,
          sampleInstructions: parsed.sampleInstructions || null,
          sampleRecipients: parsed.sampleRecipients || null,
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
   * Accepts multipart form data with optional PO file
   */
  server.post('/jobs', async (request, reply) => {
    try {
      // Parse multipart form data with request.parts() for better field handling
      const parts = request.parts();
      const fields: Record<string, string> = {};
      let fileData: { buffer: Buffer; filename: string; mimetype: string } | null = null;

      // Iterate through all parts of the multipart request
      for await (const part of parts) {
        if (part.type === 'file') {
          // Handle file upload
          const buffer = await part.toBuffer();
          fileData = {
            buffer,
            filename: part.filename,
            mimetype: part.mimetype,
          };
        } else {
          // Handle form field
          fields[part.fieldname] = part.value as string;
        }
      }

      // Extract fields from collected data
      const customerId = fields.customerId;
      const description = fields.description;
      const paper = fields.paper;
      const flatSize = fields.flatSize;
      const foldedSize = fields.foldedSize;
      const colors = fields.colors;
      const finishing = fields.finishing;
      const total = fields.total;
      const poNumber = fields.poNumber;
      const deliveryDate = fields.deliveryDate;
      const samples = fields.samples;
      const requiredArtworkCount = fields.requiredArtworkCount;
      const requiredDataFileCount = fields.requiredDataFileCount;
      const notes = fields.notes;
      const quantity = fields.quantity;

      if (!customerId) {
        return reply.code(400).send({ error: 'Customer ID is required' });
      }

      // Validate price/total - warn about suspicious values
      if (total) {
        const totalNum = parseFloat(total);

        // Check for negative prices
        if (totalNum < 0) {
          console.warn('⚠️ WARNING: Negative price detected:', totalNum);
          return reply.code(400).send({
            error: 'Total cannot be negative',
            field: 'total',
            value: totalNum
          });
        }

        // Check for suspiciously low prices (less than $1)
        if (totalNum < 1) {
          console.warn('⚠️ WARNING: Very low price detected:', totalNum);
        }

        // If quantity is available, check price per unit
        if (quantity) {
          const quantityNum = parseInt(quantity);
          if (quantityNum > 0) {
            const pricePerUnit = totalNum / quantityNum;

            // Warn if price per unit is very low (less than 1 cent)
            if (pricePerUnit < 0.01) {
              console.warn('⚠️ WARNING: Price per unit is very low:', {
                total: totalNum,
                quantity: quantityNum,
                pricePerUnit: pricePerUnit.toFixed(4),
                warning: 'This might be a unit price ($/M) instead of total'
              });
            }
          }
        }
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
        notes,
        quantity: quantity ? parseInt(quantity) : undefined,
      };

      // Create job
      // Note: requiredArtworkCount and requiredDataFileCount are optional
      // When not set, user manually marks sections complete after uploading files
      const job = await prisma.job.create({
        data: {
          jobNo,
          customerId,
          status: 'PENDING',
          customerTotal: String(total || 0),
          customerPONumber: poNumber || undefined,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
          requiredArtworkCount: requiredArtworkCount ? parseInt(requiredArtworkCount) : null,
          requiredDataFileCount: requiredDataFileCount ? parseInt(requiredDataFileCount) : null,
          specs,
        },
        include: {
          customer: true,
        },
      });

      console.log(`✅ Created job ${job.jobNo} for customer ${customerId}`);

      // If a PO file was uploaded, save it
      let poFile = null;
      if (fileData) {
        // Create file record for the original PO
        poFile = await prisma.file.create({
          data: {
            kind: 'PO_PDF',
            jobId: job.id,
            objectKey: `jobs/${job.id}/po-${Date.now()}.pdf`,
            fileName: fileData.filename,
            mimeType: fileData.mimetype,
            size: fileData.buffer.length,
            checksum: 'placeholder', // In production: calculate SHA-256
            uploadedBy: customerId,
          },
        });

        console.log(`📄 Stored original PO file for job ${job.jobNo}: ${fileData.filename}`);
      }

      // Send job creation confirmation email to all stakeholders
      try {
        // Map customer ID to email address
        const customerEmailMap: Record<string, string> = {
          'jjsa': 'Lorie@jjsainc.com',
          'ballantine': 'orders@ballantine.com',
        };

        const customerEmail = customerEmailMap[customerId] || 'nick@jdgraphic.com'; // fallback to internal

        // Build recipient list (all will be in TO field so everyone sees who received it)
        const recipients = [
          'nick@jdgraphic.com',
          customerEmail,
          'steve.gustafson@bgeltd.com'
        ].join(',');

        // Get customer company name
        const customer = await prisma.company.findUnique({
          where: { id: customerId }
        });

        // Extract job details from specs JSON
        const specs = job.specs as any;
        const emailData = {
          jobNo: job.jobNo,
          customerName: customer?.name || customerId,
          description: specs?.description,
          quantity: specs?.quantity,
          total: job.customerTotal || undefined,
          orderDate: specs?.orderDate,
          pickupDate: specs?.pickupDate,
          poolDate: specs?.poolDate,
          deliveryDate: specs?.deliveryDate,
          paper: specs?.paper,
          flatSize: specs?.flatSize,
          foldedSize: specs?.foldedSize,
          colors: specs?.colors,
          finishing: specs?.finishing,
          sampleRecipients: specs?.sampleRecipients,
          notes: specs?.notes,
        };

        const emailContent = emailTemplates.jobCreatedWithDetails(emailData);

        await sendEmail({
          to: recipients,
          subject: emailContent.subject,
          html: emailContent.html,
        });

        console.log(`✅ Job creation email sent to: ${recipients}`);
      } catch (emailError) {
        // Log email errors but don't fail job creation
        console.error('❌ Failed to send job creation email:', emailError);
      }

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
        poFile: poFile ? {
          id: poFile.id,
          fileName: poFile.fileName,
        } : null,
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

      // Create file record (uses disk storage)
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

      console.log(`📎 File uploaded for job ${job.jobNo}: ${data.filename} (${fileKind})`);

      // Send immediate email notification to Nick for every file upload
      try {
        // Get current progress after this file upload
        const progress = await getJobFileProgress(id);

        // Get customer info
        const jobWithCustomer = await prisma.job.findUnique({
          where: { id },
          include: { customer: true },
        });

        if (jobWithCustomer) {
          const emailContent = emailTemplates.fileUploaded({
            jobNo: job.jobNo,
            customerName: jobWithCustomer.customer?.name || job.customerId,
            fileName: data.filename,
            fileType: fileKind as 'ARTWORK' | 'DATA_FILE',
            uploadedArtwork: progress.uploadedArtwork,
            requiredArtwork: progress.requiredArtwork,
            uploadedDataFiles: progress.uploadedDataFiles,
            requiredDataFiles: progress.requiredDataFiles,
          });

          await sendEmail({
            to: 'nick@jdgraphic.com',
            subject: emailContent.subject,
            html: emailContent.html,
          });

          console.log(`✅ File upload notification sent to nick@jdgraphic.com for job ${job.jobNo}`);
        }
      } catch (emailError) {
        // Log email errors but don't fail the file upload
        console.error('❌ Failed to send file upload notification:', emailError);
      }

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
