import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@printing-workflow/db';
import { parseCustomerPO } from '../services/pdf-parser.service.js';
import { checkJobReadiness, updateJobReadiness, getJobFileProgress } from '../services/job.service.js';
import { sendNotification, sendJobReadyNotifications } from '../services/notification.service.js';
import { sendEmail, emailTemplates } from '../lib/email.js';
import { generateVendorPOPdf } from '../services/vendor-po.service.js';
import { createFileSharesForJob, getFileSharesForJob } from '../services/file-share.service.js';
import { generateVendorPONumber } from '../lib/utils.js';

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
          // Job type and conditional fields
          jobType: parsed.jobType || null,
          bleeds: parsed.bleeds || null,
          coverage: parsed.coverage || null,
          stock: parsed.stock || null,
          coating: parsed.coating || null,
          foldType: parsed.foldType || null,
          totalPages: parsed.totalPages || null,
          interiorPages: parsed.interiorPages || null,
          coverPages: parsed.coverPages || null,
          pageSize: parsed.pageSize || null,
          bindingType: parsed.bindingType || null,
          textStock: parsed.textStock || null,
          coverStock: parsed.coverStock || null,
          textBleeds: parsed.textBleeds || null,
          coverBleeds: parsed.coverBleeds || null,
          textCoverage: parsed.textCoverage || null,
          coverCoverage: parsed.coverCoverage || null,
          textCoating: parsed.textCoating || null,
          coverCoating: parsed.coverCoating || null,
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
   * Accepts JSON request body with job details
   * Supports BRADFORD_JD and THIRD_PARTY_VENDOR routing types
   */
  // TypeScript interface for job creation request body
  interface CreateJobBody {
    customerId: string;
    employeeId?: string;
    description?: string;
    paper?: string;
    flatSize?: string;
    foldedSize?: string;
    colors?: string;
    finishing?: string;
    total?: string;
    poNumber?: string;
    deliveryDate?: string;
    orderDate?: string;
    pickupDate?: string;
    poolDate?: string;
    samples?: string;
    sampleInstructions?: string;
    sampleRecipients?: Array<{
      quantity: number;
      recipientName: string;
      address: string;
      city?: string;
      state?: string;
      zip?: string;
    }>;
    requiredArtworkCount?: number;
    requiredDataFileCount?: number;
    notes?: string;
    quantity?: string;
    routingType?: 'BRADFORD_JD' | 'THIRD_PARTY_VENDOR';
    vendorId?: string;
    vendorAmount?: number;
    bradfordCut?: number;
    // Job type for third-party vendor jobs
    jobType?: 'FLAT' | 'FOLDED' | 'BOOKLET_SELF_COVER' | 'BOOKLET_PLUS_COVER';
    // Vendor shipping/payment fields
    vendorShipToName?: string;
    vendorShipToAddress?: string;
    vendorShipToCity?: string;
    vendorShipToState?: string;
    vendorShipToZip?: string;
    vendorShipToPhone?: string;
    vendorPaymentTerms?: string;
    vendorSpecialInstructions?: string;
    // Job type-specific fields
    // Flat pieces
    bleeds?: string;
    coverage?: string;
    stock?: string;
    coating?: string;
    // Folded pieces
    foldType?: string;
    // Booklets
    totalPages?: number;
    interiorPages?: number;
    coverPages?: number;
    pageSize?: string;
    textStock?: string;
    coverStock?: string;
    bindingType?: 'saddle-stitch' | 'perfect-bound';
    textBleeds?: string;
    coverBleeds?: string;
    textCoverage?: string;
    coverCoverage?: string;
    textCoating?: string;
    coverCoating?: string;
  }

  server.post('/jobs', async (request, reply) => {
    try {
      // Parse JSON request body
      const body = request.body as CreateJobBody;

      // Extract fields from body
      const {
        customerId,
        employeeId,
        description,
        paper,
        flatSize,
        foldedSize,
        colors,
        finishing,
        total,
        poNumber,
        deliveryDate,
        orderDate,
        pickupDate,
        poolDate,
        samples,
        sampleInstructions,
        sampleRecipients,
        requiredArtworkCount,
        requiredDataFileCount,
        notes,
        quantity,
        routingType,
        vendorId,
        vendorAmount,
        bradfordCut,
        jobType,
        // Vendor shipping/payment fields
        vendorShipToName,
        vendorShipToAddress,
        vendorShipToCity,
        vendorShipToState,
        vendorShipToZip,
        vendorShipToPhone,
        vendorPaymentTerms,
        vendorSpecialInstructions,
        // Job type-specific fields
        bleeds,
        coverage,
        stock,
        coating,
        foldType,
        totalPages,
        interiorPages,
        coverPages,
        pageSize,
        textStock,
        coverStock,
        bindingType,
        textBleeds,
        coverBleeds,
        textCoverage,
        coverCoverage,
        textCoating,
        coverCoating,
      } = body;

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

      // Build specs object with conditional fields based on jobType
      const specs: any = {
        description: description || 'New customer order',
        paper,
        colors,
        deliveryDate,
        orderDate,
        pickupDate,
        poolDate,
        samples,
        sampleInstructions,
        sampleRecipients,
        notes,
        quantity: quantity ? parseInt(quantity) : undefined,
      };

      // Add jobType if provided (for third-party vendor jobs)
      if (jobType) {
        specs.jobType = jobType;

        // Add job-type-specific fields based on jobType
        switch (jobType) {
          case 'FLAT':
            if (flatSize) specs.flatSize = flatSize;
            if (bleeds) specs.bleeds = bleeds;
            if (coverage) specs.coverage = coverage;
            if (stock) specs.stock = stock;
            if (coating) specs.coating = coating;
            break;

          case 'FOLDED':
            if (flatSize) specs.flatSize = flatSize;
            if (foldedSize) specs.foldedSize = foldedSize;
            if (foldType) specs.foldType = foldType;
            if (bleeds) specs.bleeds = bleeds;
            if (finishing) specs.finishing = finishing;
            if (stock) specs.stock = stock;
            if (coating) specs.coating = coating;
            if (coverage) specs.coverage = coverage;
            break;

          case 'BOOKLET_SELF_COVER':
            if (totalPages) specs.totalPages = totalPages;
            if (pageSize) specs.pageSize = pageSize;
            if (bindingType) specs.bindingType = bindingType;
            if (textStock) specs.textStock = textStock;
            if (bleeds) specs.bleeds = bleeds;
            if (coverage) specs.coverage = coverage;
            if (coating) specs.coating = coating;
            break;

          case 'BOOKLET_PLUS_COVER':
            if (interiorPages) specs.interiorPages = interiorPages;
            if (coverPages) specs.coverPages = coverPages;
            if (pageSize) specs.pageSize = pageSize;
            if (textStock) specs.textStock = textStock;
            if (coverStock) specs.coverStock = coverStock;
            if (bindingType) specs.bindingType = bindingType;
            if (textBleeds) specs.textBleeds = textBleeds;
            if (coverBleeds) specs.coverBleeds = coverBleeds;
            if (textCoverage) specs.textCoverage = textCoverage;
            if (coverCoverage) specs.coverCoverage = coverCoverage;
            if (textCoating) specs.textCoating = textCoating;
            if (coverCoating) specs.coverCoating = coverCoating;
            break;
        }
      } else {
        // Legacy: include all fields for Bradford/JD workflow
        if (flatSize) specs.flatSize = flatSize;
        if (foldedSize) specs.foldedSize = foldedSize;
        if (finishing) specs.finishing = finishing;
      }

      // Extract top-level fields for database indexing and display
      const sizeName = flatSize || foldedSize || null;
      const quantityNum = quantity ? parseInt(quantity) : null;

      // Create job
      // Note: requiredArtworkCount and requiredDataFileCount are optional
      // When not set, user manually marks sections complete after uploading files
      const job = await prisma.job.create({
        data: {
          jobNo,
          customerId,
          employeeId: employeeId || null,
          status: 'PENDING',
          customerTotal: String(total || 0),
          customerPONumber: poNumber || undefined,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
          requiredArtworkCount: requiredArtworkCount || null,
          requiredDataFileCount: requiredDataFileCount || null,
          routingType: routingType || 'BRADFORD_JD',
          // Job type (only for third-party vendor jobs)
          jobType: jobType || null,
          // Third-party vendor fields
          vendorId: vendorId || null,
          vendorAmount: vendorAmount ? String(vendorAmount) : null,
          bradfordCut: bradfordCut !== undefined ? String(bradfordCut) : null,
          // Vendor shipping/payment fields
          vendorShipToName: vendorShipToName || null,
          vendorShipToAddress: vendorShipToAddress || null,
          vendorShipToCity: vendorShipToCity || null,
          vendorShipToState: vendorShipToState || null,
          vendorShipToZip: vendorShipToZip || null,
          vendorShipToPhone: vendorShipToPhone || null,
          vendorPaymentTerms: vendorPaymentTerms || null,
          vendorSpecialInstructions: vendorSpecialInstructions || null,
          specs,
          // Add sizeName and quantity as top-level fields for table display
          sizeName: sizeName,
          quantity: quantityNum,
        },
        include: {
          customer: true,
          vendor: true,
        },
      });

      console.log(`✅ Created job ${job.jobNo} for customer ${customerId}`);

      // Handle third-party vendor routing
      if (routingType === 'THIRD_PARTY_VENDOR') {
        if (!vendorId || !vendorAmount || bradfordCut === undefined) {
          return reply.code(400).send({
            error: 'vendorId, vendorAmount, and bradfordCut are required for THIRD_PARTY_VENDOR routing',
          });
        }

        // Get vendor to check for vendor code
        const vendor = await prisma.vendor.findUnique({
          where: { id: vendorId },
          select: { vendorCode: true, name: true },
        });

        if (!vendor) {
          return reply.code(404).send({ error: 'Vendor not found' });
        }

        // Generate PO number: use vendor code if available, otherwise fallback
        let poNumber: string;
        if (vendor.vendorCode) {
          // New 6-digit format: XXX-YYY (e.g., 001-001)
          poNumber = await generateVendorPONumber(vendor.vendorCode);
          console.log(`✅ Generated vendor PO number: ${poNumber} for vendor ${vendor.name} (code: ${vendor.vendorCode})`);
        } else {
          // Fallback for vendors without codes
          poNumber = `IMP-${job.jobNo}`;
          console.log(`⚠️ Vendor ${vendor.name} has no vendor code, using fallback PO#: ${poNumber}`);
        }

        const createdPO = await prisma.purchaseOrder.create({
          data: {
            jobId: job.id,
            poNumber,
            originCompanyId: 'impact-direct', // Impact Direct (broker) placing the order with vendor
            targetVendorId: vendorId, // Third-party vendor
            targetCompanyId: null, // Not targeting a company, targeting a vendor
            originalAmount: String(total || 0), // Customer's payment
            vendorAmount: String(vendorAmount), // Amount to vendor
            marginAmount: String(bradfordCut), // Bradford's margin/cut
            status: 'PENDING',
          },
        });

        console.log(`✅ Created PO ${poNumber} to vendor ${vendorId} for job ${job.jobNo}`);

        // Send vendor email notification with PO PDF
        try {
          const vendor = await prisma.vendor.findUnique({
            where: { id: vendorId },
            select: {
              name: true,
              email: true,
            },
          });

          if (vendor && vendor.email) {
            const vendorEmail = vendor.email;

            // Get customer name
            const customer = await prisma.company.findUnique({
              where: { id: customerId },
              select: { name: true },
            });

            // Generate vendor PO PDF
            const { pdfBytes, fileName } = await generateVendorPOPdf(createdPO.id);

            // Check if job already has files and generate share links
            let files: Array<{ fileName: string; kind: string; shareUrl: string }> = [];
            try {
              const existingFiles = await prisma.file.findMany({
                where: {
                  jobId: job.id,
                  kind: {
                    in: ['ARTWORK', 'DATA_FILE'],
                  },
                },
              });

              if (existingFiles.length > 0) {
                console.log(`📁 Found ${existingFiles.length} existing files for job ${job.jobNo}, creating share links...`);

                // Create file shares
                await createFileSharesForJob({
                  jobId: job.id,
                  createdFor: 'vendor',
                  expirationDays: 7,
                });

                // Get file shares with URLs
                const fileShares = await getFileSharesForJob(job.id);
                files = fileShares
                  .filter(f => f.share && f.shareUrl)
                  .map(f => ({
                    fileName: f.fileName,
                    kind: f.kind,
                    shareUrl: f.shareUrl!,
                  }));

                console.log(`✅ Generated ${files.length} file share links for vendor email`);
              } else {
                console.log(`📁 No files found for job ${job.jobNo}, vendor will be notified when files are ready`);
              }
            } catch (fileError) {
              console.error('❌ Error generating file shares for vendor email:', fileError);
              // Continue with email even if file shares fail
            }

            // Extract job details from specs
            const specs = job.specs as any;
            const vendorEmailData = {
              jobNo: job.jobNo,
              customerName: customer?.name || customerId,
              vendorName: vendor.name,
              poNumber,
              vendorAmount,
              description: specs?.description,
              quantity: specs?.quantity,
              deliveryDate: specs?.deliveryDate,
              paper: specs?.paper,
              flatSize: specs?.flatSize,
              foldedSize: specs?.foldedSize,
              colors: specs?.colors,
              finishing: specs?.finishing,
              notes: specs?.notes,
              files: files.length > 0 ? files : undefined, // Include files if available
            };

            const vendorEmailContent = emailTemplates.vendorJobCreated(vendorEmailData);

            await sendEmail({
              to: vendorEmail,
              cc: 'nick@jdgraphic.com',
              subject: vendorEmailContent.subject,
              html: vendorEmailContent.html,
              attachments: [
                {
                  filename: fileName,
                  content: pdfBytes,
                },
              ],
            });

            console.log(`✅ Vendor job creation email sent to: ${vendorEmail} (CC: nick@jdgraphic.com) with PO PDF attached${files.length > 0 ? ` and ${files.length} file download links` : ''}`);
          } else {
            console.warn(`⚠️ No primary contact email found for vendor ${vendorId}`);
          }
        } catch (vendorEmailError) {
          // Log email errors but don't fail job creation
          console.error('❌ Failed to send vendor email:', vendorEmailError);
        }
      } else {
        // Default BRADFORD_JD routing: Create PO from Bradford to JD Graphic
        const poNumber = `BRA-${job.jobNo}`;
        await prisma.purchaseOrder.create({
          data: {
            jobId: job.id,
            poNumber,
            originCompanyId: 'bradford',
            targetCompanyId: 'jd-graphic',
            originalAmount: String(total || 0), // Customer's payment
            vendorAmount: String(total || 0), // Full amount goes to JD Graphic
            marginAmount: '0', // No margin for direct JD work
            status: 'PENDING',
          },
        });

        console.log(`✅ Created PO ${poNumber} from Bradford to JD Graphic for job ${job.jobNo}`);
      }

      // Send job creation confirmation email to all stakeholders
      try {
        // Map customer ID to email address
        const customerEmailMap: Record<string, string> = {
          'jjsa': 'Lorie@jjsainc.com',
          'ballantine': 'orders@ballantine.com',
        };

        const customerEmail = customerEmailMap[customerId] || 'nick@jdgraphic.com'; // fallback to internal

        // Set up email recipients: customer as TO, internal team as CC
        const emailTo = customerEmail;
        const emailCc = 'nick@jdgraphic.com,steve.gustafson@bgeltd.com';

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
          to: emailTo,
          cc: emailCc,
          subject: emailContent.subject,
          html: emailContent.html,
        });

        console.log(`✅ Job creation email sent to: ${emailTo} (CC: ${emailCc})`);
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
            cc: 'steve.gustafson@bgeltd.com',
            subject: emailContent.subject,
            html: emailContent.html,
          });

          console.log(`✅ File upload notification sent to nick@jdgraphic.com (CC: steve@bgeltd.com) for job ${job.jobNo}`);
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
