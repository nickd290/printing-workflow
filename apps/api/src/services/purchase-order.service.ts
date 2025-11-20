import { prisma, POStatus } from '@printing-workflow/db';
import { calculatePOAmounts, generateVendorPONumber } from '../lib/utils.js';
import { generateBradfordPOPdf } from './bradford-po.service.js';
import { queueEmail } from '../lib/queue.js';
import { emailTemplates } from '../lib/email.js';
import { createFile } from './file.service.js';
import { extractPONumber, normalizePONumber, validatePONumber } from './pdf-extract.service.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function createPurchaseOrder(data: {
  originCompanyId: string;
  targetCompanyId?: string; // Optional for third-party vendors
  targetVendorId?: string; // Optional for third-party vendors
  jobId?: string;
  originalAmount: number;
  vendorAmount: number;
  marginAmount: number;
  externalRef?: string;
  poNumber?: string;
  referencePONumber?: string;
}) {
  // Validate that either targetCompanyId OR targetVendorId is provided, but not both
  if (!data.targetCompanyId && !data.targetVendorId) {
    throw new Error('Either targetCompanyId or targetVendorId must be provided');
  }
  if (data.targetCompanyId && data.targetVendorId) {
    throw new Error('Cannot specify both targetCompanyId and targetVendorId');
  }

  const po = await prisma.purchaseOrder.create({
    data: {
      originCompanyId: data.originCompanyId,
      targetCompanyId: data.targetCompanyId,
      targetVendorId: data.targetVendorId,
      jobId: data.jobId,
      originalAmount: data.originalAmount,
      vendorAmount: data.vendorAmount,
      marginAmount: data.marginAmount,
      externalRef: data.externalRef,
      poNumber: data.poNumber,
      referencePONumber: data.referencePONumber,
      status: POStatus.PENDING,
    },
    include: {
      originCompany: true,
      targetCompany: true,
      targetVendor: true,
      job: true,
    },
  });

  return po;
}

/**
 * Create auto PO with pricing from the pricing system
 * Called by the purchase order queue
 */
export async function createAutoPurchaseOrder(data: {
  jobId: string;
  originCompanyId: string;
  targetCompanyId: string;
  originalAmount: number;
  vendorAmount?: number; // If provided, use exact amount from pricing system
  customerPONumber?: string; // Customer's PO# for reference
}) {
  let vendorAmount: number;
  let marginAmount: number;

  if (data.vendorAmount !== undefined) {
    // Use exact amounts from pricing system
    vendorAmount = data.vendorAmount;
    marginAmount = data.originalAmount - data.vendorAmount;
  } else {
    // Fall back to old calculation (for backwards compatibility)
    const amounts = calculatePOAmounts(data.originalAmount);
    vendorAmount = amounts.vendorAmount;
    marginAmount = amounts.marginAmount;
  }

  // Get job details to fetch customer PO#
  const job = await prisma.job.findUnique({
    where: { id: data.jobId },
    select: { customerPONumber: true, jobNo: true },
  });

  const customerPONumber = data.customerPONumber || job?.customerPONumber || undefined;

  // Generate PO number: Use customer PO# as reference or generate based on job#
  const poNumber = customerPONumber ? `IMP-${customerPONumber}` : `IMP-${job?.jobNo}`;

  const po = await createPurchaseOrder({
    originCompanyId: data.originCompanyId,
    targetCompanyId: data.targetCompanyId,
    jobId: data.jobId,
    originalAmount: data.originalAmount,
    vendorAmount,
    marginAmount,
    poNumber,
    referencePONumber: customerPONumber,
  });

  console.log(
    `Auto PO created: ${data.originCompanyId} → ${data.targetCompanyId} | PO#: ${poNumber} | Ref: ${customerPONumber || 'N/A'} | Original: $${data.originalAmount}, Vendor: $${vendorAmount}, Margin: $${marginAmount}`
  );

  return po;
}

/**
 * Create PO for third-party vendor routing
 * Impact → Third-Party Vendor (with Bradford cut payment tracking)
 */
export async function createThirdPartyVendorPO(data: {
  jobId: string;
  vendorId: string;
  vendorAmount: number;
  bradfordCut: number;
  customerPONumber: string;
}) {
  // Get job and vendor details
  const job = await prisma.job.findUnique({
    where: { id: data.jobId },
    select: { jobNo: true, customerTotal: true },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: data.vendorId },
    select: { id: true, name: true, vendorCode: true },
  });

  if (!vendor) {
    throw new Error('Vendor not found');
  }

  // Calculate Impact's margin (what they keep)
  const impactMargin = Number(job.customerTotal) - data.vendorAmount - data.bradfordCut;

  if (impactMargin < 0) {
    throw new Error(
      `Invalid pricing: Total cost (vendor: $${data.vendorAmount} + Bradford cut: $${data.bradfordCut}) ` +
      `exceeds customer total ($${job.customerTotal}). Impact margin would be negative ($${impactMargin}).`
    );
  }

  // Generate PO number: Use vendor code if available, otherwise fallback to old format
  let poNumber: string;
  if (vendor.vendorCode) {
    // New format: XXX-YYY (e.g., 001-001)
    poNumber = await generateVendorPONumber(vendor.vendorCode);
  } else {
    // Fallback for vendors without vendor codes (old format)
    poNumber = `IMP-${data.customerPONumber}`;
  }

  const po = await createPurchaseOrder({
    originCompanyId: 'impact-direct', // Impact Direct
    targetVendorId: data.vendorId, // Third-party vendor (not a company)
    jobId: data.jobId,
    originalAmount: Number(job.customerTotal),
    vendorAmount: data.vendorAmount,
    marginAmount: impactMargin,
    poNumber,
    referencePONumber: data.customerPONumber,
  });

  console.log(
    `Third-party vendor PO created: Impact → ${vendor.name} | PO#: ${poNumber} | ` +
    `Customer Total: $${job.customerTotal}, Vendor: $${data.vendorAmount}, ` +
    `Bradford Cut: $${data.bradfordCut}, Impact Margin: $${impactMargin}`
  );

  // Create PO #2: Impact → Bradford (Bradford's cut)
  if (data.bradfordCut > 0) {
    const bradfordCutPO = await createPurchaseOrder({
      originCompanyId: 'impact-direct',
      targetCompanyId: 'bradford',
      jobId: data.jobId,
      originalAmount: data.bradfordCut,
      vendorAmount: data.bradfordCut,
      marginAmount: 0,
      poNumber: `IMP-BRD-${data.customerPONumber}`,
      referencePONumber: data.customerPONumber,
    });

    console.log(
      `Bradford cut PO created: Impact → Bradford | PO#: IMP-BRD-${data.customerPONumber} | ` +
      `Amount: ${data.bradfordCut}`
    );
  }

  return po;
}

/**
 * Create PO from Bradford webhook (Bradford → JD Graphic)
 */
export async function createPOFromWebhook(data: {
  componentId: string;
  estimateNumber: string;
  amount: number;
  jobId?: string;
  originCompanyId: string;
  targetCompanyId: string;
}) {
  const po = await createPurchaseOrder({
    originCompanyId: data.originCompanyId,
    targetCompanyId: data.targetCompanyId,
    jobId: data.jobId,
    originalAmount: data.amount,
    vendorAmount: data.amount,
    marginAmount: 0, // Bradford keeps the margin
    externalRef: `${data.componentId}-${data.estimateNumber}`,
  });

  // Generate Bradford PO PDF and send to JD Graphic
  try {
    const { pdfBytes, fileName } = await generateBradfordPOPdf(po.id);

    const poWithDetails = await getPOById(po.id);

    if (poWithDetails && poWithDetails.job) {
      const poNumber = po.externalRef?.split('-')[0] || `PO-${po.id.slice(0, 7)}`;

      const template = emailTemplates.bradfordPOToJD(
        data.componentId,
        poWithDetails.job.jobNo,
        poNumber,
        parseFloat(po.vendorAmount.toString())
      );

      // Send email to both JD Graphic production and Nick
      const jdEmails = ['production@jdgraphic.com', 'nick@jdgraphic.com'];

      for (const email of jdEmails) {
        await queueEmail({
          to: email,
          subject: template.subject,
          html: template.html,
          attachments: [
            {
              filename: fileName,
              content: pdfBytes,
            },
          ],
        });

        // Create notification record
        await prisma.notification.create({
          data: {
            type: 'PO_CREATED',
            jobId: poWithDetails.job.id,
            recipient: email,
            subject: template.subject,
            body: template.html,
          },
        });
      }

      console.log(`✅ Bradford PO PDF generated and emailed to JD Graphic (${jdEmails.join(', ')}): ${fileName}`);
    }
  } catch (error) {
    console.error('Failed to generate/send Bradford PO PDF:', error);
    // Don't fail the entire PO creation if PDF generation fails
  }

  return po;
}

export async function updatePOStatus(id: string, status: POStatus) {
  return prisma.purchaseOrder.update({
    where: { id },
    data: { status },
  });
}

export async function getPOById(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      originCompany: true,
      targetCompany: true,
      job: {
        include: {
          customer: true,
        },
      },
    },
  });
}

export async function listPurchaseOrders(filters?: {
  jobId?: string;
  originCompanyId?: string;
  targetCompanyId?: string;
  status?: POStatus;
}) {
  return prisma.purchaseOrder.findMany({
    where: {
      jobId: filters?.jobId,
      originCompanyId: filters?.originCompanyId,
      targetCompanyId: filters?.targetCompanyId,
      status: filters?.status,
    },
    include: {
      originCompany: true,
      targetCompany: true,
      job: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function findPOByExternalRef(externalRef: string) {
  return prisma.purchaseOrder.findFirst({
    where: { externalRef },
    include: {
      originCompany: true,
      targetCompany: true,
      job: true,
    },
  });
}

/**
 * Find the related invoice for a given purchase order
 * The invoice direction is the OPPOSITE of the PO direction
 * E.g., Impact→Bradford PO corresponds to Bradford→Impact Invoice
 */
export async function findRelatedInvoiceForPO(po: {
  jobId: string | null;
  originCompanyId: string;
  targetCompanyId: string;
}) {
  if (!po.jobId) {
    return null; // PO not linked to a job
  }

  // Invoice direction is opposite: from = PO target, to = PO origin
  const invoice = await prisma.invoice.findFirst({
    where: {
      jobId: po.jobId,
      fromCompanyId: po.targetCompanyId,  // Invoice FROM = PO TO
      toCompanyId: po.originCompanyId,    // Invoice TO = PO FROM
    },
  });

  return invoice;
}

/**
 * Find the related purchase order for a given invoice
 * The PO direction is the OPPOSITE of the invoice direction
 * E.g., Bradford→Impact Invoice corresponds to Impact→Bradford PO
 */
export async function findRelatedPOForInvoice(invoice: {
  jobId: string | null;
  fromCompanyId: string;
  toCompanyId: string;
}) {
  if (!invoice.jobId) {
    return null; // Invoice not linked to a job
  }

  // PO direction is opposite: origin = Invoice to, target = Invoice from
  const po = await prisma.purchaseOrder.findFirst({
    where: {
      jobId: invoice.jobId,
      originCompanyId: invoice.toCompanyId,      // PO FROM = Invoice TO
      targetCompanyId: invoice.fromCompanyId,    // PO TO = Invoice FROM
    },
  });

  return po;
}

/**
 * Create a sync log entry to track PO-Invoice synchronization
 */
export async function createSyncLog(data: {
  trigger: 'PO_UPDATE' | 'INVOICE_UPDATE';
  purchaseOrderId?: string;
  invoiceId?: string;
  jobId?: string;
  field: string;
  oldValue?: number;
  newValue: number;
  changedBy?: string;
  notes?: string;
}) {
  await prisma.syncLog.create({
    data: {
      trigger: data.trigger,
      purchaseOrderId: data.purchaseOrderId,
      invoiceId: data.invoiceId,
      jobId: data.jobId,
      field: data.field,
      oldValue: data.oldValue,
      newValue: data.newValue,
      changedBy: data.changedBy,
      notes: data.notes,
    },
  });
}

/**
 * Recalculate job financial totals from all related purchase orders
 * Called after PO updates to keep Job totals in sync
 * (Exported for use in invoice.service.ts)
 */
export async function recalculateJobFromPOs(jobId: string) {
  // Fetch all POs for this job
  const allPOs = await prisma.purchaseOrder.findMany({
    where: { jobId },
    include: {
      originCompany: true,
      targetCompany: true,
    },
  });

  // Calculate bradfordTotal: sum of all Impact→Bradford POs
  const bradfordTotal = allPOs
    .filter(po =>
      po.originCompany.id === 'impact-direct' &&
      po.targetCompany.id === 'bradford'
    )
    .reduce((sum, po) => sum + Number(po.vendorAmount || 0), 0);

  // Calculate jdTotal: sum of all Bradford→JD POs
  const jdTotal = allPOs
    .filter(po =>
      po.originCompany.id === 'bradford' &&
      po.targetCompany.id === 'jd-graphic'
    )
    .reduce((sum, po) => sum + Number(po.vendorAmount || 0), 0);

  // Fetch job to get necessary fields for margin calculation
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      customerTotal: true,
      jdSuppliesPaper: true,
      bradfordWaivesPaperMargin: true,
      paperChargedTotal: true,
      paperCostTotal: true,
    },
  });

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  // Calculate margins based on paper supplier and margin waiver
  let impactMargin: number;
  let bradfordTotalMargin: number;
  const customerTotal = Number(job.customerTotal || 0);
  const paperChargedTotal = Number(job.paperChargedTotal || 0);
  const paperCostTotal = Number(job.paperCostTotal || 0);

  if (job.jdSuppliesPaper) {
    // JD supplies paper: Impact gets 10% of customer total, Bradford gets 10%
    impactMargin = customerTotal * 0.10;
    bradfordTotalMargin = bradfordTotal - jdTotal; // Bradford keeps all margin when JD supplies paper
  } else if (job.bradfordWaivesPaperMargin) {
    // Bradford waives paper margin: 50/50 split of total margin
    const totalMargin = customerTotal - jdTotal - paperChargedTotal;
    impactMargin = totalMargin / 2;
    bradfordTotalMargin = totalMargin / 2;
  } else {
    // Bradford supplies paper normally:
    // Total Margin = customerTotal - jdTotal - paperChargedTotal
    // Impact Margin = totalMargin / 2
    // Bradford Margin = customerTotal - jdTotal - paperCostTotal - (totalMargin / 2)
    const totalMargin = customerTotal - jdTotal - paperChargedTotal;
    impactMargin = totalMargin / 2;
    bradfordTotalMargin = customerTotal - jdTotal - paperCostTotal - (totalMargin / 2);
  }

  // Update job with recalculated totals
  await prisma.job.update({
    where: { id: jobId },
    data: {
      bradfordTotal,
      jdTotal,
      bradfordTotalMargin,
      impactMargin,
    },
  });

  console.log(`✅ Recalculated Job ${jobId}:`, {
    bradfordTotal,
    jdTotal,
    bradfordTotalMargin,
    impactMargin,
  });
}

/**
 * Update purchase order
 * Allows editing amounts, status, and other fields
 * Automatically recalculates linked Job totals
 * Auto-syncs related invoice amounts when vendorAmount changes
 */
export async function updatePurchaseOrder(
  poId: string,
  data: {
    originalAmount?: number;
    vendorAmount?: number;
    marginAmount?: number;
    status?: POStatus;
    externalRef?: string;
  },
  changedBy?: string
) {
  // Get the old PO to detect vendorAmount changes
  const oldPO = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: {
      vendorAmount: true,
      jobId: true,
      originCompanyId: true,
      targetCompanyId: true,
    },
  });

  if (!oldPO) {
    throw new Error(`Purchase order ${poId} not found`);
  }

  const po = await prisma.purchaseOrder.update({
    where: { id: poId },
    data,
    include: {
      originCompany: true,
      targetCompany: true,
      job: {
        include: {
          customer: true,
        },
      },
    },
  });

  // Auto-sync related invoice if vendorAmount changed
  if (data.vendorAmount !== undefined && data.vendorAmount !== Number(oldPO.vendorAmount)) {
    const relatedInvoice = await findRelatedInvoiceForPO({
      jobId: po.jobId,
      originCompanyId: po.originCompanyId,
      targetCompanyId: po.targetCompanyId,
    });

    if (relatedInvoice) {
      const oldInvoiceAmount = Number(relatedInvoice.amount);

      // Update invoice amount to match new PO vendorAmount
      await prisma.invoice.update({
        where: { id: relatedInvoice.id },
        data: { amount: data.vendorAmount },
      });

      // Log the sync for PO update
      await createSyncLog({
        trigger: 'PO_UPDATE',
        purchaseOrderId: po.id,
        invoiceId: relatedInvoice.id,
        jobId: po.jobId || undefined,
        field: 'vendorAmount',
        oldValue: Number(oldPO.vendorAmount),
        newValue: data.vendorAmount,
        changedBy,
        notes: `PO vendorAmount updated from $${oldPO.vendorAmount} to $${data.vendorAmount}, synced Invoice ${relatedInvoice.invoiceNo} from $${oldInvoiceAmount} to $${data.vendorAmount}`,
      });

      console.log(`✅ Auto-synced Invoice ${relatedInvoice.invoiceNo}: $${oldInvoiceAmount} → $${data.vendorAmount} (PO vendorAmount changed)`);
    }
  }

  // Recalculate job totals if PO is linked to a job
  if (po.jobId) {
    await recalculateJobFromPOs(po.jobId);
  }

  return po;
}

/**
 * Upload PDF for purchase order
 * Stores PDF as a file attachment
 */
export async function uploadPOPdf(
  poId: string,
  pdfBuffer: Buffer,
  fileName: string
) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { job: true },
  });

  if (!po) {
    throw new Error('Purchase order not found');
  }

  // Create file record
  const file = await createFile({
    jobId: po.jobId || undefined,
    kind: 'PO_PDF',
    file: pdfBuffer,
    fileName,
    mimeType: 'application/pdf',
  });

  // Update PO with file reference
  const updatedPO = await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { pdfFileId: file.id },
    include: {
      originCompany: true,
      targetCompany: true,
      job: true,
      pdfFile: true,
    },
  });

  return { po: updatedPO, file };
}

/**
 * Upload Bradford PO PDF and extract PO number
 * Creates Bradford → JD Graphic purchase order
 */
export async function uploadBradfordPOPdf(
  jobId: string,
  pdfBuffer: Buffer,
  fileName: string,
  manualPONumber?: string
): Promise<{
  po: any;
  file: any;
  extractedPONumber: string | null;
  poNumber: string;
}> {
  // Get job and validate
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
      purchaseOrders: {
        include: {
          originCompany: true,
          targetCompany: true,
        },
      },
    },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  // Extract PO# from PDF
  const extractedPONumber = await extractPONumber(pdfBuffer);

  // Use manual PO# if provided and valid, otherwise use extracted
  let poNumber: string;
  if (manualPONumber && validatePONumber(manualPONumber)) {
    poNumber = normalizePONumber(manualPONumber);
    console.log(`✅ Using manual Bradford PO#: ${poNumber}`);
  } else if (extractedPONumber && validatePONumber(extractedPONumber)) {
    poNumber = normalizePONumber(extractedPONumber);
    console.log(`✅ Using extracted Bradford PO#: ${poNumber}`);
  } else {
    // Fallback: generate PO# based on job number
    poNumber = `BRA-${job.jobNo}`;
    console.log(`⚠️ No valid PO# found, using generated: ${poNumber}`);
  }

  // Create file record
  const file = await createFile({
    jobId: job.id,
    kind: 'PO_PDF',
    file: pdfBuffer,
    fileName,
    mimeType: 'application/pdf',
  });

  // Find Bradford and JD Graphic companies
  const bradfordCompany = await prisma.company.findFirst({
    where: { name: { contains: 'Bradford' } },
  });

  const jdCompany = await prisma.company.findFirst({
    where: { name: { contains: 'JD Graphic' } },
  });

  if (!bradfordCompany || !jdCompany) {
    throw new Error('Bradford or JD Graphic company not found');
  }

  // Get customer PO# from job for reference
  const customerPONumber = job.customerPONumber || undefined;

  // Create Bradford → JD Graphic PO
  const po = await createPurchaseOrder({
    originCompanyId: bradfordCompany.id,
    targetCompanyId: jdCompany.id,
    jobId: job.id,
    originalAmount: parseFloat(job.bradfordTotal?.toString() || '0'),
    vendorAmount: parseFloat(job.jdTotal?.toString() || '0'),
    marginAmount: parseFloat(job.bradfordTotalMargin?.toString() || '0'),
    poNumber,
    referencePONumber: customerPONumber,
  });

  // Update PO with PDF file reference
  const updatedPO = await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: { pdfFileId: file.id },
    include: {
      originCompany: true,
      targetCompany: true,
      job: {
        include: {
          customer: true,
        },
      },
      pdfFile: true,
    },
  });

  console.log(
    `✅ Bradford PO created: ${poNumber} (${bradfordCompany.name} → ${jdCompany.name}) | Ref: ${customerPONumber || 'N/A'} | Amount: $${job.jdTotal}`
  );

  // Create notification for Impact admin
  await prisma.notification.create({
    data: {
      type: 'BRADFORD_PO_CREATED',
      jobId: job.id,
      recipient: 'admin@impactdirect.com',
      subject: `Bradford created JD PO for Job ${job.jobNo}`,
      body: `Bradford has created a PO to JD Graphic for job ${job.jobNo}. The job is now in production.`,
    },
  });

  // Update job status to IN_PRODUCTION
  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'IN_PRODUCTION' },
  });

  console.log(`✅ Impact notified of Bradford → JD PO creation for job ${job.jobNo}`);

  // Send email to JD Graphic with PO PDF
  try {
    const template = emailTemplates.bradfordPOToJD(
      job.jobNo,
      job.jobNo,
      poNumber,
      parseFloat(job.jdTotal?.toString() || '0')
    );

    const jdEmails = ['production@jdgraphic.com', 'nick@jdgraphic.com'];

    for (const email of jdEmails) {
      await queueEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        attachments: [
          {
            filename: fileName,
            content: pdfBuffer,
          },
        ],
      });

      await prisma.notification.create({
        data: {
          type: 'PO_CREATED',
          jobId: job.id,
          recipient: email,
          subject: template.subject,
          body: template.html,
        },
      });
    }

    console.log(`✅ Bradford PO PDF emailed to JD Graphic: ${jdEmails.join(', ')}`);
  } catch (error) {
    console.error('Failed to send Bradford PO email:', error);
    // Don't fail the entire operation if email fails
  }

  return {
    po: updatedPO,
    file,
    extractedPONumber,
    poNumber,
  };
}

/**
 * Generate formal Purchase Order PDF
 * Creates a professional PO document with company letterhead and terms
 * Can be used for any PO (Customer→Impact, Impact→Bradford, etc.)
 */
export async function generatePurchaseOrderPdf(purchaseOrderId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      originCompany: true,
      targetCompany: true,
      job: {
        include: {
          customer: true,
          quote: true,
        },
      },
    },
  });

  if (!po) {
    throw new Error('Purchase Order not found');
  }

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;

  // Header - Company Letterhead
  page.drawText(po.originCompany.name.toUpperCase(), {
    x: 50,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.8),
  });

  y -= 25;

  // Company Address (if available)
  if (po.originCompany.address) {
    page.drawText(po.originCompany.address, {
      x: 50,
      y,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 15;
  }

  // Company Contact Info
  if (po.originCompany.email || po.originCompany.phone) {
    const contact = [
      po.originCompany.email,
      po.originCompany.phone,
    ]
      .filter(Boolean)
      .join(' | ');
    page.drawText(contact, {
      x: 50,
      y,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 15;
  }

  y -= 20;

  // Document Title
  page.drawText('Purchase Order', {
    x: 50,
    y,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  y -= 35;

  // PO Number and Date (on same line)
  const poNumber = po.poNumber || `PO-${po.id.slice(0, 8).toUpperCase()}`;
  page.drawText(`PO #: ${poNumber}`, {
    x: 50,
    y,
    size: 12,
    font: boldFont,
  });

  page.drawText(`Date: ${po.createdAt.toLocaleDateString()}`, {
    x: width - 200,
    y,
    size: 12,
    font,
  });

  y -= 25;

  // Reference PO Number if available
  if (po.referencePONumber) {
    page.drawText(`Reference: Customer PO# ${po.referencePONumber}`, {
      x: 50,
      y,
      size: 10,
      font: boldFont,
      color: rgb(0, 0, 0.6),
    });
    y -= 20;
  }

  y -= 10;

  // Horizontal separator line
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 20;

  // Vendor (To) Information
  page.drawText('To:', { x: 50, y, size: 12, font: boldFont });
  y -= 20;

  page.drawText(po.targetCompany.name, { x: 50, y, size: 11, font: boldFont });
  y -= 15;

  if (po.targetCompany.address) {
    page.drawText(po.targetCompany.address, { x: 50, y, size: 10, font });
    y -= 15;
  }

  if (po.targetCompany.email) {
    page.drawText(po.targetCompany.email, { x: 50, y, size: 10, font });
    y -= 15;
  }

  if (po.targetCompany.phone) {
    page.drawText(po.targetCompany.phone, { x: 50, y, size: 10, font });
    y -= 15;
  }

  y -= 20;

  // Horizontal separator line
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 20;

  // Shipping Information Section (if shipping details exist)
  if (po.job && (po.job.vendorShipToName || po.job.vendorShipToAddress || po.job.deliveryDate)) {
    page.drawText('Ship To:', { x: 50, y, size: 12, font: boldFont });
    y -= 20;

    if (po.job.vendorShipToName) {
      page.drawText(po.job.vendorShipToName, { x: 50, y, size: 11, font: boldFont });
      y -= 15;
    }

    // Build complete address line
    const addressParts = [];
    if (po.job.vendorShipToAddress) addressParts.push(po.job.vendorShipToAddress);

    const cityStateZip = [
      po.job.vendorShipToCity,
      po.job.vendorShipToState,
      po.job.vendorShipToZip
    ].filter(Boolean).join(', ');

    if (cityStateZip) addressParts.push(cityStateZip);

    addressParts.forEach(line => {
      page.drawText(line, { x: 50, y, size: 10, font });
      y -= 15;
    });

    if (po.job.vendorShipToPhone) {
      page.drawText(po.job.vendorShipToPhone, { x: 50, y, size: 10, font });
      y -= 15;
    }

    // Delivery Date (highlight in red if within 7 days)
    if (po.job.deliveryDate) {
      const deliveryDate = new Date(po.job.deliveryDate);
      const today = new Date();
      const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const isUrgent = daysUntilDelivery <= 7 && daysUntilDelivery >= 0;

      page.drawText('Required Delivery Date:', {
        x: 50,
        y,
        size: 10,
        font: boldFont,
        color: isUrgent ? rgb(0.8, 0, 0) : rgb(0, 0, 0)
      });
      y -= 15;

      const formattedDate = deliveryDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

      page.drawText(formattedDate, {
        x: 50,
        y,
        size: 10,
        font,
        color: isUrgent ? rgb(0.8, 0, 0) : rgb(0, 0, 0)
      });
      y -= 15;

      if (isUrgent) {
        page.drawText('⚠ URGENT DELIVERY', {
          x: 50,
          y,
          size: 9,
          font: boldFont,
          color: rgb(0.8, 0, 0)
        });
        y -= 15;
      }
    }

    y -= 20;

    // Horizontal separator line
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 20;
  } else {
    // If no shipping info, still add separator before Job Specifications
    // Horizontal separator line
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 20;
  }

  // Job Details Section (if job is linked)
  if (po.job) {
    page.drawText('Job Specifications', { x: 50, y, size: 12, font: boldFont });
    y -= 20;

    // Draw a box around job details
    const boxY = y - 70;
    page.drawRectangle({
      x: 50,
      y: boxY,
      width: width - 100,
      height: 85,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
    });

    page.drawText(`Job #: ${po.job.jobNo}`, { x: 60, y: y - 5, size: 10, font });
    y -= 18;

    if (po.job.customerPONumber) {
      page.drawText(`Customer PO: ${po.job.customerPONumber}`, {
        x: 60,
        y: y - 5,
        size: 10,
        font,
      });
      y -= 18;
    }

    if (po.job.title) {
      const title = po.job.title.length > 60 ? po.job.title.substring(0, 60) + '...' : po.job.title;
      page.drawText(`Description: ${title}`, { x: 60, y: y - 5, size: 10, font });
      y -= 18;
    }

    // Production Specifications
    if (po.job.quote) {
      // Quantity
      if (po.job.quote.quantity) {
        page.drawText(`Quantity: ${po.job.quote.quantity.toLocaleString()} pieces`, {
          x: 60,
          y: y - 5,
          size: 10,
          font
        });
        y -= 15;
      }

      // Paper Stock
      if (po.job.quote.paperType) {
        page.drawText(`Paper Stock: ${po.job.quote.paperType}`, {
          x: 60,
          y: y - 5,
          size: 10,
          font
        });
        y -= 15;
      }

      // Dimensions (Flat | Folded)
      if (po.job.quote.flatSize || po.job.quote.foldedSize) {
        const flatSize = po.job.quote.flatSize ? `Flat: ${po.job.quote.flatSize}` : '';
        const foldedSize = po.job.quote.foldedSize ? `Folded: ${po.job.quote.foldedSize}` : '';
        const dimensions = [flatSize, foldedSize].filter(Boolean).join(' | ');
        page.drawText(`Dimensions: ${dimensions}`, {
          x: 60,
          y: y - 5,
          size: 10,
          font
        });
        y -= 15;
      }

      // Colors
      if (po.job.quote.colors) {
        page.drawText(`Colors: ${po.job.quote.colors}`, {
          x: 60,
          y: y - 5,
          size: 10,
          font
        });
        y -= 15;
      }

      // Finishing
      if (po.job.quote.finishing) {
        page.drawText(`Finishing: ${po.job.quote.finishing}`, {
          x: 60,
          y: y - 5,
          size: 10,
          font
        });
        y -= 15;
      }
    }

    y -= 15;
  }

  y -= 20;

  // Horizontal separator line
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 20;

  // Financial Details Section
  page.drawText('Pricing', { x: 50, y, size: 12, font: boldFont });
  y -= 25;

  // Draw table header
  page.drawRectangle({
    x: 50,
    y: y - 70,
    width: width - 100,
    height: 85,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
  });

  // Table rows
  const drawRow = (label: string, amount: number, yPos: number, isBold = false) => {
    page.drawText(label, {
      x: 60,
      y: yPos,
      size: 11,
      font: isBold ? boldFont : font,
    });
    page.drawText(`$${amount.toFixed(2)}`, {
      x: width - 160,
      y: yPos,
      size: 11,
      font: isBold ? boldFont : font,
    });
  };

  drawRow('Vendor Amount (Payment Due):', parseFloat(po.vendorAmount.toString()), y - 5, true);
  y -= 20;

  if (po.originalAmount && parseFloat(po.originalAmount.toString()) !== parseFloat(po.vendorAmount.toString())) {
    drawRow('Original Amount:', parseFloat(po.originalAmount.toString()), y - 5);
    y -= 20;
  }

  if (po.marginAmount && parseFloat(po.marginAmount.toString()) > 0) {
    drawRow('Margin Amount:', parseFloat(po.marginAmount.toString()), y - 5);
    y -= 20;
  }

  y -= 30;

  // Status
  const statusColor = po.status === POStatus.COMPLETED ? rgb(0, 0.6, 0) :
                      po.status === POStatus.CANCELLED ? rgb(0.8, 0, 0) :
                      rgb(0.8, 0.6, 0);

  page.drawText(`Status: ${po.status}`, {
    x: 50,
    y: y - 5,
    size: 11,
    font: boldFont,
    color: statusColor,
  });

  y -= 40;

  // Horizontal separator line
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 20;

  // Terms and Conditions
  page.drawText('Terms & Conditions', { x: 50, y, size: 10, font: boldFont });
  y -= 15;

  const terms = [
    'Payment terms as specified above. Late deliveries may result in invoice adjustment.',
    'All work must meet SWOP/G7 color specifications and industry quality standards.',
    'Changes to specifications require written authorization and may affect pricing and delivery.',
    'Vendor responsible for notification of any delays, material shortages, or quality issues.',
    'Packing slips must accompany all shipments with PO number clearly marked.',
  ];

  terms.forEach((term) => {
    page.drawText(term, { x: 50, y, size: 8, font });
    y -= 12;
  });

  // Footer
  page.drawText(
    'This is a computer-generated purchase order and is valid without signature.',
    {
      x: 50,
      y: 50,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
    }
  );

  // Save PDF
  const pdfBytes = await pdfDoc.save();

  // Upload to S3
  const file = await createFile({
    jobId: po.jobId || undefined,
    kind: 'PO_PDF',
    file: Buffer.from(pdfBytes),
    fileName: `${poNumber}.pdf`,
    mimeType: 'application/pdf',
  });

  // Update PO with PDF reference
  const updatedPO = await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: {
      pdfFileId: file.id,
    },
    include: {
      originCompany: true,
      targetCompany: true,
      job: {
        include: {
          customer: true,
        },
      },
      pdfFile: true,
    },
  });

  return updatedPO;
}
