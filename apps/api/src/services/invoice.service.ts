import { prisma } from '@printing-workflow/db';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateInvoiceNumber } from '../lib/utils.js';
import { createFile } from './file.service.js';
import { queueEmail } from '../lib/queue.js';
import { emailTemplates } from '../lib/email.js';
import { COMPANY_IDS } from '@printing-workflow/shared';
import { sendEmail } from '../lib/email.js';
import {
  findRelatedPOForInvoice,
  createSyncLog,
  recalculateJobFromPOs,
} from './purchase-order.service.js';

export async function createInvoiceForJob(data: {
  jobId: string;
  toCompanyId: string;
  fromCompanyId: string;
}) {
  const job = await prisma.job.findUnique({
    where: { id: data.jobId },
    include: {
      customer: true,
    },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  const invoiceNo = await generateInvoiceNumber();

  // Calculate due date (30 days from now)
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 30);

  const invoice = await prisma.invoice.create({
    data: {
      jobId: data.jobId,
      toCompanyId: data.toCompanyId,
      fromCompanyId: data.fromCompanyId,
      invoiceNo,
      amount: job.customerTotal,
      dueAt,
    },
    include: {
      job: {
        include: {
          customer: true,
        },
      },
      toCompany: true,
      fromCompany: true,
    },
  });

  return invoice;
}

/**
 * Generate invoice PDF
 * Called by the PDF worker
 */
export async function generateInvoicePdf(invoiceId: string) {
  console.log(`[Invoice PDF] Starting PDF generation for invoice ${invoiceId}`);

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      job: {
        include: {
          customer: true,
          quote: true,
        },
      },
      toCompany: true,
      fromCompany: true,
    },
  });

  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  console.log(`[Invoice PDF] Found invoice: ${invoice.invoiceNo}`);
  console.log(`[Invoice PDF] Amount: $${invoice.amount}`);
  console.log(`[Invoice PDF] From Company ID: ${invoice.fromCompanyId}`);
  console.log(`[Invoice PDF] To Company ID: ${invoice.toCompanyId}`);
  console.log(`[Invoice PDF] Job ID: ${invoice.jobId || 'N/A'}`);

  // Validate required company information
  if (!invoice.fromCompany) {
    throw new Error(
      `Cannot generate PDF: "From" company is missing for invoice ${invoice.invoiceNo} (ID: ${invoiceId}). ` +
      `Expected company ID "${invoice.fromCompanyId}" was not found in the database. ` +
      `This invoice may reference a deleted company.`
    );
  }

  if (!invoice.toCompany) {
    throw new Error(
      `Cannot generate PDF: "Bill To" company is missing for invoice ${invoice.invoiceNo} (ID: ${invoiceId}). ` +
      `Expected company ID "${invoice.toCompanyId}" was not found in the database. ` +
      `This invoice may reference a deleted company.`
    );
  }

  // Validate invoice amount
  const invoiceAmount = parseFloat(invoice.amount.toString());
  if (invoiceAmount <= 0) {
    throw new Error(
      `Cannot generate PDF: Invoice ${invoice.invoiceNo} has an invalid amount of $${invoiceAmount}. ` +
      `Invoice amount must be greater than $0.`
    );
  }

  console.log(`[Invoice PDF] Validation passed. From: ${invoice.fromCompany.name}, To: ${invoice.toCompany.name}`);

  // Create PDF with professional template
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size (8.5" x 11")
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Define colors
  const headerBlue = rgb(0.117, 0.227, 0.541); // #1e3a8a
  const borderBlue = rgb(0.2, 0.3, 0.6);
  const textGray = rgb(0.4, 0.4, 0.4);
  const white = rgb(1, 1, 1);
  const black = rgb(0, 0, 0);

  // ===== HEADER SECTION =====
  // Blue header background
  page.drawRectangle({
    x: 0,
    y: height - 120,
    width: width,
    height: 120,
    color: headerBlue,
  });

  // "INVOICE" text in white
  page.drawText('INVOICE', {
    x: 50,
    y: height - 70,
    size: 36,
    font: boldFont,
    color: white,
  });

  // Company name under INVOICE
  page.drawText(invoice.fromCompany.name, {
    x: 50,
    y: height - 95,
    size: 14,
    font: boldFont,
    color: white,
  });

  // Invoice details (top right)
  let rightX = width - 220;
  page.drawText(`Invoice #: ${invoice.invoiceNo}`, {
    x: rightX,
    y: height - 50,
    size: 10,
    font: boldFont,
    color: white,
  });

  page.drawText(`Date: ${invoice.createdAt.toLocaleDateString()}`, {
    x: rightX,
    y: height - 68,
    size: 9,
    font,
    color: white,
  });

  page.drawText(`Due: ${invoice.dueAt?.toLocaleDateString() || 'Upon Receipt'}`, {
    x: rightX,
    y: height - 83,
    size: 9,
    font,
    color: white,
  });

  // ===== COMPANY INFORMATION SECTION =====
  let y = height - 150;

  // FROM section
  page.drawText('FROM:', { x: 50, y, size: 11, font: boldFont, color: black });
  y -= 18;

  page.drawText(invoice.fromCompany.name, { x: 50, y, size: 10, font: boldFont });
  y -= 14;

  if (invoice.fromCompany.address) {
    page.drawText(invoice.fromCompany.address, { x: 50, y, size: 9, font, color: textGray });
    y -= 12;
  }

  if (invoice.fromCompany.email) {
    page.drawText(invoice.fromCompany.email, { x: 50, y, size: 9, font, color: textGray });
    y -= 12;
  }

  if (invoice.fromCompany.phone) {
    page.drawText(invoice.fromCompany.phone, { x: 50, y, size: 9, font, color: textGray });
  }

  // BILL TO section (right side)
  y = height - 150;
  const billToX = 320;

  page.drawText('BILL TO:', { x: billToX, y, size: 11, font: boldFont, color: black });
  y -= 18;

  page.drawText(invoice.toCompany.name, { x: billToX, y, size: 10, font: boldFont });
  y -= 14;

  if (invoice.toCompany.address) {
    page.drawText(invoice.toCompany.address, { x: billToX, y, size: 9, font, color: textGray });
    y -= 12;
  }

  if (invoice.toCompany.email) {
    page.drawText(invoice.toCompany.email, { x: billToX, y, size: 9, font, color: textGray });
    y -= 12;
  }

  if (invoice.toCompany.phone) {
    page.drawText(invoice.toCompany.phone, { x: billToX, y, size: 9, font, color: textGray });
  }

  // ===== JOB DETAILS SECTION (BORDERED BOX) =====
  y = height - 280;
  const boxX = 50;
  const boxWidth = width - 100;
  const boxHeight = 180;

  // Draw border
  page.drawRectangle({
    x: boxX,
    y: y - boxHeight,
    width: boxWidth,
    height: boxHeight,
    borderColor: borderBlue,
    borderWidth: 2,
  });

  // Job Details header
  y -= 20;
  page.drawText('JOB DETAILS', { x: boxX + 15, y, size: 11, font: boldFont, color: borderBlue });
  y -= 20;

  // Job number
  const jobNo = invoice.job?.jobNo || 'N/A';
  page.drawText(`Job #: ${jobNo}`, { x: boxX + 15, y, size: 10, font: boldFont, color: black });
  y -= 14;

  // Customer PO number
  const customerPO = invoice.job?.customerPONumber || 'N/A';
  page.drawText(`Customer PO: ${customerPO}`, { x: boxX + 15, y, size: 9, font, color: textGray });
  y -= 18;

  // Description
  if (invoice.job?.description) {
    page.drawText('Description:', { x: boxX + 15, y, size: 9, font: boldFont });
    y -= 12;

    // Word wrap description
    const desc = invoice.job.description;
    const maxWidth = 70;
    const words = desc.split(' ');
    let line = '';

    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      if (testLine.length > maxWidth) {
        page.drawText(line, { x: boxX + 15, y, size: 9, font, color: textGray });
        y -= 12;
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      page.drawText(line, { x: boxX + 15, y, size: 9, font, color: textGray });
      y -= 16;
    }
  }

  // Size
  const sizeName = invoice.job?.sizeName || 'N/A';
  page.drawText(`Size: ${sizeName}`, { x: boxX + 15, y, size: 9, font });
  y -= 14;

  // Paper
  const paperType = invoice.job?.paperType || 'N/A';
  page.drawText(`Paper: ${paperType}`, { x: boxX + 15, y, size: 9, font });
  y -= 14;

  // Quantity
  const quantity = invoice.job?.quantity || 0;
  page.drawText(`Quantity: ${quantity.toLocaleString()} pcs`, { x: boxX + 15, y, size: 9, font });

  // ===== TOTAL AMOUNT SECTION =====
  y = height - 490;
  const totalBoxX = width - 270;

  // Draw total amount box
  page.drawRectangle({
    x: totalBoxX,
    y: y - 50,
    width: 220,
    height: 70,
    borderColor: borderBlue,
    borderWidth: 2,
  });

  page.drawText('TOTAL AMOUNT DUE', {
    x: totalBoxX + 15,
    y: y - 15,
    size: 11,
    font: boldFont,
    color: borderBlue,
  });

  const amountText = `$${parseFloat(invoice.amount.toString()).toFixed(2)}`;
  page.drawText(amountText, {
    x: totalBoxX + 15,
    y: y - 40,
    size: 24,
    font: boldFont,
    color: black,
  });

  // ===== FOOTER SECTION =====
  const footerY = 50;

  page.drawText('Payment Terms: Net 10 Days', {
    x: 50,
    y: footerY + 15,
    size: 9,
    font,
    color: textGray,
  });

  page.drawText('Thank you for your business!', {
    x: 50,
    y: footerY,
    size: 9,
    font,
    color: textGray,
  });

  // Generation timestamp (right aligned)
  const timestamp = new Date().toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  page.drawText(`Generated on ${timestamp}`, {
    x: width - 230,
    y: footerY,
    size: 8,
    font,
    color: textGray,
  });

  // Save PDF
  const pdfBytes = await pdfDoc.save();

  // Upload to S3
  const file = await createFile({
    jobId: invoice.jobId || undefined,
    kind: 'INVOICE',
    file: Buffer.from(pdfBytes),
    fileName: `${invoice.invoiceNo}.pdf`,
    mimeType: 'application/pdf',
  });

  // Update invoice with PDF reference
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      pdfFileId: file.id,
      issuedAt: new Date(),
    },
    include: {
      job: {
        include: {
          customer: true,
        },
      },
      toCompany: true,
      fromCompany: true,
      pdfFile: true,
    },
  });

  // Queue email with PDF attachment
  if (updatedInvoice.job) {
    const template = emailTemplates.invoiceSent(
      invoice.invoiceNo,
      updatedInvoice.job.jobNo,
      parseFloat(invoice.amount.toString())
    );

    await queueEmail({
      to: updatedInvoice.toCompany.email || '',
      subject: template.subject,
      html: template.html,
      attachments: [
        {
          filename: `${invoice.invoiceNo}.pdf`,
          content: Buffer.from(pdfBytes),
        },
      ],
    });

    // Create notification record
    await prisma.notification.create({
      data: {
        type: 'INVOICE_SENT',
        jobId: updatedInvoice.job.id,
        recipient: updatedInvoice.toCompany.email || '',
        subject: template.subject,
        body: template.html,
      },
    });
  }

  return updatedInvoice;
}

export async function getInvoiceById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      job: {
        include: {
          customer: true,
        },
      },
      toCompany: true,
      fromCompany: true,
      pdfFile: true,
    },
  });
}

export async function listInvoices(filters?: {
  jobId?: string;
  toCompanyId?: string;
}) {
  return prisma.invoice.findMany({
    where: {
      jobId: filters?.jobId,
      toCompanyId: filters?.toCompanyId,
    },
    include: {
      job: true,
      toCompany: true,
      fromCompany: true,
      pdfFile: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function markInvoiceAsPaid(invoiceId: string) {
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAt: new Date(),
    },
  });
}

/**
 * Trigger Bradford invoice chain when Impact Direct invoices customer
 * This is automatically called after customer invoice is created
 */
export async function triggerBradfordInvoiceChain(jobId: string) {
  console.log(`[Invoice Chain] Checking for Bradford PO for job ${jobId}...`);

  // Find the PO from Impact Direct → Bradford for this job
  const impactToBradfordPO = await prisma.purchaseOrder.findFirst({
    where: {
      jobId,
      originCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      targetCompanyId: COMPANY_IDS.BRADFORD,
    },
  });

  if (!impactToBradfordPO) {
    console.log(`[Invoice Chain] No Bradford PO found for job ${jobId}, skipping chain`);
    return null;
  }

  console.log(
    `[Invoice Chain] Found PO: Impact → Bradford ($${impactToBradfordPO.vendorAmount})`
  );

  // Check if Bradford invoice already exists
  const existingBradfordInvoice = await prisma.invoice.findFirst({
    where: {
      jobId,
      fromCompanyId: COMPANY_IDS.BRADFORD,
      toCompanyId: COMPANY_IDS.IMPACT_DIRECT,
    },
  });

  if (existingBradfordInvoice) {
    console.log('[Invoice Chain] Bradford invoice already exists, skipping');
    return existingBradfordInvoice;
  }

  // Create invoice from Bradford → Impact Direct for the vendor amount
  const invoiceNo = await generateInvoiceNumber();
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 30);

  const bradfordInvoice = await prisma.invoice.create({
    data: {
      jobId,
      fromCompanyId: COMPANY_IDS.BRADFORD,
      toCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      invoiceNo,
      amount: impactToBradfordPO.vendorAmount,
      dueAt,
    },
    include: {
      job: true,
      toCompany: true,
      fromCompany: true,
    },
  });

  console.log(
    `[Invoice Chain] Created Bradford invoice: ${bradfordInvoice.invoiceNo} for $${bradfordInvoice.amount}`
  );

  return bradfordInvoice;
}

/**
 * Create invoice manually (not automatically from job)
 * Allows internal users to create invoices directly
 */
export async function createInvoiceManual(data: {
  jobId?: string;
  toCompanyId: string;
  fromCompanyId: string;
  amount: number;
  dueAt?: Date;
  issuedAt?: Date;
}) {
  const invoiceNo = await generateInvoiceNumber();

  // If no due date provided, default to 30 days from now
  const dueAt = data.dueAt || (() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  })();

  const invoice = await prisma.invoice.create({
    data: {
      jobId: data.jobId,
      toCompanyId: data.toCompanyId,
      fromCompanyId: data.fromCompanyId,
      invoiceNo,
      amount: data.amount,
      dueAt,
      issuedAt: data.issuedAt,
    },
    include: {
      job: {
        include: {
          customer: true,
        },
      },
      toCompany: true,
      fromCompany: true,
      pdfFile: true,
    },
  });

  return invoice;
}

/**
 * Update invoice
 * Allows editing amounts, status, dates
 * Auto-syncs related PO vendorAmount when invoice amount changes
 */
export async function updateInvoice(
  invoiceId: string,
  data: {
    amount?: number;
    dueAt?: Date;
    issuedAt?: Date;
    paidAt?: Date;
  },
  changedBy?: string
) {
  // Get the old invoice to detect amount changes
  const oldInvoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      amount: true,
      jobId: true,
      fromCompanyId: true,
      toCompanyId: true,
      invoiceNo: true,
    },
  });

  if (!oldInvoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data,
    include: {
      job: {
        include: {
          customer: true,
        },
      },
      toCompany: true,
      fromCompany: true,
      pdfFile: true,
    },
  });

  // Auto-sync related PO if invoice amount changed
  if (data.amount !== undefined && data.amount !== Number(oldInvoice.amount)) {
    const relatedPO = await findRelatedPOForInvoice({
      jobId: invoice.jobId,
      fromCompanyId: invoice.fromCompanyId,
      toCompanyId: invoice.toCompanyId,
    });

    if (relatedPO) {
      const oldPOAmount = Number(relatedPO.vendorAmount);

      // Update PO vendorAmount to match new invoice amount
      await prisma.purchaseOrder.update({
        where: { id: relatedPO.id },
        data: { vendorAmount: data.amount },
      });

      // Recalculate job totals since PO vendorAmount changed
      if (relatedPO.jobId) {
        await recalculateJobFromPOs(relatedPO.jobId);
      }

      // Log the sync for invoice update
      await createSyncLog({
        trigger: 'INVOICE_UPDATE',
        invoiceId: invoice.id,
        purchaseOrderId: relatedPO.id,
        jobId: invoice.jobId || undefined,
        field: 'amount',
        oldValue: Number(oldInvoice.amount),
        newValue: data.amount,
        changedBy,
        notes: `Invoice ${oldInvoice.invoiceNo} amount updated from $${oldInvoice.amount} to $${data.amount}, synced PO vendorAmount from $${oldPOAmount} to $${data.amount}`,
      });

      console.log(`✅ Auto-synced PO vendorAmount: $${oldPOAmount} → $${data.amount} (Invoice ${oldInvoice.invoiceNo} amount changed)`);
    }
  }

  return invoice;
}

/**
 * Complete job and generate invoice chain
 * Creates all 3 invoices (JD→Bradford, Bradford→Impact, Impact→Customer)
 * and updates job status to COMPLETED
 */
export async function completeJobAndGenerateInvoices(jobId: string) {
  console.log(`[Invoice Chain] Starting invoice generation for job ${jobId}...`);

  // Get job with customer
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: true,
    },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status === 'COMPLETED') {
    throw new Error('Job is already completed');
  }

  console.log(`[Invoice Chain] Job ${job.jobNo} found, customer: ${job.customer.name}`);

  // Find all required POs
  const bradfordToJdPO = await prisma.purchaseOrder.findFirst({
    where: {
      jobId,
      originCompanyId: COMPANY_IDS.BRADFORD,
      targetCompanyId: COMPANY_IDS.JD_GRAPHIC,
    },
  });

  const impactToBradfordPO = await prisma.purchaseOrder.findFirst({
    where: {
      jobId,
      originCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      targetCompanyId: COMPANY_IDS.BRADFORD,
    },
  });

  // Validate POs exist
  if (!bradfordToJdPO) {
    throw new Error('Bradford→JD purchase order not found for this job');
  }

  if (!impactToBradfordPO) {
    throw new Error('Impact→Bradford purchase order not found for this job');
  }

  console.log('[Invoice Chain] All POs found:');
  console.log(`  - Bradford→JD: $${bradfordToJdPO.vendorAmount}`);
  console.log(`  - Impact→Bradford: $${impactToBradfordPO.vendorAmount}`);
  console.log(`  - Customer total: $${job.customerTotal}`);

  // Check if invoices already exist
  const existingJdInvoice = await prisma.invoice.findFirst({
    where: {
      jobId,
      fromCompanyId: COMPANY_IDS.JD_GRAPHIC,
      toCompanyId: COMPANY_IDS.BRADFORD,
    },
  });

  const existingBradfordInvoice = await prisma.invoice.findFirst({
    where: {
      jobId,
      fromCompanyId: COMPANY_IDS.BRADFORD,
      toCompanyId: COMPANY_IDS.IMPACT_DIRECT,
    },
  });

  const existingImpactInvoice = await prisma.invoice.findFirst({
    where: {
      jobId,
      fromCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      toCompanyId: job.customerId,
    },
  });

  if (existingJdInvoice || existingBradfordInvoice || existingImpactInvoice) {
    throw new Error('Invoices already exist for this job');
  }

  // Create all invoices sequentially (not in parallel transaction)
  // This ensures invoice numbers are generated correctly
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 30);

  // 1. Create JD→Bradford invoice
  const jdInvoiceNo = await generateInvoiceNumber();
  const jdInvoice = await prisma.invoice.create({
    data: {
      jobId,
      fromCompanyId: COMPANY_IDS.JD_GRAPHIC,
      toCompanyId: COMPANY_IDS.BRADFORD,
      invoiceNo: jdInvoiceNo,
      amount: bradfordToJdPO.vendorAmount,
      dueAt,
    },
  });

  console.log(`[Invoice Chain] Created JD→Bradford invoice: ${jdInvoice.invoiceNo} for $${jdInvoice.amount}`);

  // 2. Create Bradford→Impact invoice
  const bradfordInvoiceNo = await generateInvoiceNumber();
  const bradfordInvoice = await prisma.invoice.create({
    data: {
      jobId,
      fromCompanyId: COMPANY_IDS.BRADFORD,
      toCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      invoiceNo: bradfordInvoiceNo,
      amount: impactToBradfordPO.vendorAmount,
      dueAt,
    },
  });

  console.log(`[Invoice Chain] Created Bradford→Impact invoice: ${bradfordInvoice.invoiceNo} for $${bradfordInvoice.amount}`);

  // 3. Create Impact→Customer invoice
  const impactInvoiceNo = await generateInvoiceNumber();
  const impactInvoice = await prisma.invoice.create({
    data: {
      jobId,
      fromCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      toCompanyId: job.customerId,
      invoiceNo: impactInvoiceNo,
      amount: job.customerTotal,
      dueAt,
    },
  });

  console.log(`[Invoice Chain] Created Impact→Customer invoice: ${impactInvoice.invoiceNo} for $${impactInvoice.amount}`);

  // 4. Update job status to COMPLETED
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'COMPLETED' },
  });

  console.log(`[Invoice Chain] Updated job ${job.jobNo} status to COMPLETED`);
  console.log('[Invoice Chain] ✅ Successfully generated all invoices!');

  // Email all invoices with PDFs (blocking customer emails)
  console.log('\n[Invoice Chain] 📧 Sending invoice emails...');

  const invoicesToEmail = [
    { invoice: jdInvoice, fromId: COMPANY_IDS.JD_GRAPHIC, toId: COMPANY_IDS.BRADFORD, label: 'JD→Bradford', po: bradfordToJdPO },
    { invoice: bradfordInvoice, fromId: COMPANY_IDS.BRADFORD, toId: COMPANY_IDS.IMPACT_DIRECT, label: 'Bradford→Impact', po: impactToBradfordPO },
    { invoice: impactInvoice, fromId: COMPANY_IDS.IMPACT_DIRECT, toId: job.customerId, label: 'Impact→Customer', po: null },
  ];

  for (const { invoice, fromId, toId, label, po } of invoicesToEmail) {
    try {
      // Get company details
      const toCompany = await prisma.company.findUnique({ where: { id: toId } });
      const fromCompany = await prisma.company.findUnique({ where: { id: fromId } });

      if (!toCompany || !fromCompany) {
        console.error(`[Invoice Chain] ❌ Missing company data for ${label}`);
        continue;
      }

      // Generate professional PDF for this invoice
      console.log(`[Invoice Chain] 📄 Generating PDF for ${label} invoice...`);
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Colors
      const accentColor = rgb(0.4, 0.49, 0.91); // #667eea
      const darkGray = rgb(0.18, 0.22, 0.28);
      const mediumGray = rgb(0.4, 0.45, 0.5);
      const lightGray = rgb(0.95, 0.96, 0.97);
      const borderGray = rgb(0.89, 0.91, 0.94);

      let y = height - 40;

      // Header with accent bar
      page.drawRectangle({
        x: 0,
        y: height - 80,
        width: width,
        height: 80,
        color: lightGray,
      });

      // Company name/branding (left) - Use FROM company
      page.drawText(fromCompany.name.toUpperCase(), {
        x: 50,
        y: height - 55,
        size: 20,
        font: boldFont,
        color: accentColor,
      });

      // Company tagline based on type
      const tagline = fromCompany.id === 'jd-graphic'
        ? 'Professional Printing & Manufacturing'
        : fromCompany.id === 'bradford'
        ? 'Print Brokerage Services'
        : 'Direct Mail Solutions';

      page.drawText(tagline, {
        x: 50,
        y: height - 72,
        size: 9,
        font,
        color: mediumGray,
      });

      // INVOICE title (right)
      page.drawText('INVOICE', {
        x: width - 150,
        y: height - 55,
        size: 28,
        font: boldFont,
        color: darkGray,
      });

      y = height - 110;

      // Invoice metadata (right column)
      const metaX = width - 200;
      page.drawText('Invoice #:', { x: metaX, y, size: 10, font, color: mediumGray });
      page.drawText(invoice.invoiceNo, { x: metaX + 65, y, size: 10, font: boldFont, color: darkGray });
      y -= 18;

      const invoiceDate = new Date();
      page.drawText('Date:', { x: metaX, y, size: 10, font, color: mediumGray });
      page.drawText(invoiceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        { x: metaX + 65, y, size: 10, font, color: darkGray });
      y -= 18;

      // Use Net 10 for JD→Bradford, Net 30 for others
      const isJdToBradford = fromId === COMPANY_IDS.JD_GRAPHIC && toId === COMPANY_IDS.BRADFORD;
      const paymentDays = isJdToBradford ? 10 : 30;
      const paymentTerms = isJdToBradford ? 'Net 10' : 'Net 30';

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentDays);
      page.drawText('Due Date:', { x: metaX, y, size: 10, font, color: mediumGray });
      page.drawText(dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        { x: metaX + 65, y, size: 10, font, color: darkGray });
      y -= 18;

      page.drawText('Terms:', { x: metaX, y, size: 10, font, color: mediumGray });
      page.drawText(paymentTerms, { x: metaX + 65, y, size: 10, font: boldFont, color: accentColor });

      // From company (left column)
      y = height - 110;
      page.drawText('FROM', { x: 50, y, size: 10, font: boldFont, color: mediumGray });
      y -= 18;
      page.drawText(fromCompany.name, { x: 50, y, size: 12, font: boldFont, color: darkGray });
      y -= 16;
      if (fromCompany.address) {
        page.drawText(fromCompany.address, { x: 50, y, size: 9, font, color: mediumGray });
        y -= 14;
      }
      if (fromCompany.phone) {
        page.drawText(`Phone: ${fromCompany.phone}`, { x: 50, y, size: 9, font, color: mediumGray });
        y -= 14;
      }
      if (fromCompany.email) {
        page.drawText(`Email: ${fromCompany.email}`, { x: 50, y, size: 9, font, color: mediumGray });
      }

      // Bill To section
      y = height - 260;
      page.drawRectangle({
        x: 50,
        y: y - 65,
        width: width - 100,
        height: 70,
        borderColor: borderGray,
        borderWidth: 1,
      });

      page.drawText('BILL TO', { x: 60, y: y - 12, size: 10, font: boldFont, color: mediumGray });
      page.drawText(toCompany.name, { x: 60, y: y - 28, size: 12, font: boldFont, color: darkGray });
      if (toCompany.address) {
        page.drawText(toCompany.address, { x: 60, y: y - 42, size: 9, font, color: mediumGray });
      }
      if (toCompany.email) {
        page.drawText(`Email: ${toCompany.email}`, { x: 60, y: y - 56, size: 9, font, color: mediumGray });
      }

      // Job reference section
      y -= 90;
      page.drawRectangle({
        x: 50,
        y: y - 45,
        width: width - 100,
        height: 50,
        color: lightGray,
      });

      page.drawText('JOB REFERENCE', { x: 60, y: y - 15, size: 9, font: boldFont, color: mediumGray });
      page.drawText(`Job #: ${job.jobNo}`, { x: 60, y: y - 30, size: 10, font: boldFont, color: darkGray });

      // Show the PO number from the sender (if available)
      let refY = y - 43;
      if (po && po.poNumber) {
        const poLabel = fromId === COMPANY_IDS.JD_GRAPHIC ? 'Bradford PO'
          : fromId === COMPANY_IDS.BRADFORD ? 'Impact PO'
          : 'PO';
        page.drawText(`${poLabel}: ${po.poNumber}`, { x: 60, y: refY, size: 9, font, color: accentColor });
        refY -= 13;
      }

      // Show customer PO number (if available)
      if (job.customerPONumber) {
        page.drawText(`Customer PO: ${job.customerPONumber}`, { x: 60, y: refY, size: 9, font, color: mediumGray });
      }

      // Line items table
      y -= 70;
      const tableTop = y;
      const tableLeft = 50;
      const tableWidth = width - 100;

      // Table header
      page.drawRectangle({
        x: tableLeft,
        y: y - 20,
        width: tableWidth,
        height: 20,
        color: darkGray,
      });

      page.drawText('DESCRIPTION', { x: tableLeft + 10, y: y - 13, size: 9, font: boldFont, color: rgb(1, 1, 1) });
      page.drawText('QTY', { x: tableLeft + 320, y: y - 13, size: 9, font: boldFont, color: rgb(1, 1, 1) });
      page.drawText('UNIT PRICE', { x: tableLeft + 370, y: y - 13, size: 9, font: boldFont, color: rgb(1, 1, 1) });
      page.drawText('AMOUNT', { x: tableLeft + 455, y: y - 13, size: 9, font: boldFont, color: rgb(1, 1, 1) });

      y -= 20;

      // Calculate unit price
      const quantity = job.quantity || 1;
      const unitPrice = parseFloat(invoice.amount.toString()) / quantity;

      // Table rows - Calculate row height dynamically
      let rowHeight = 25; // Base height for main description
      if (job.sizeName || job.paperType) rowHeight += 14; // Product specs
      if (job.specs && typeof job.specs === 'object' && 'finishing' in job.specs && job.specs.finishing) rowHeight += 12; // Finishing

      // Add height for JD→Bradford specific fields
      if (fromId === COMPANY_IDS.JD_GRAPHIC && toId === COMPANY_IDS.BRADFORD) {
        if (job.paperWeightTotal) rowHeight += 12; // Paper usage
        if (po && po.vendorCPM) {
          rowHeight += 12; // CPM rate
          if (quantity) rowHeight += 12; // Calculation
        }
      }
      page.drawRectangle({
        x: tableLeft,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        borderColor: borderGray,
        borderWidth: 0.5,
      });

      // Line 1: Job description
      let lineY = y - 14;
      page.drawText(`Printing Services - Job ${job.jobNo}`, { x: tableLeft + 10, y: lineY, size: 10, font: boldFont, color: darkGray });
      page.drawText(quantity.toLocaleString(), { x: tableLeft + 320, y: lineY, size: 10, font, color: darkGray });
      page.drawText(`$${unitPrice.toFixed(4)}`, { x: tableLeft + 370, y: lineY, size: 9, font, color: darkGray });
      page.drawText(`$${invoice.amount.toFixed(2)}`, { x: tableLeft + 455, y: lineY, size: 10, font: boldFont, color: darkGray });

      // Line 2: Product specifications (if available)
      if (job.sizeName || job.paperType) {
        lineY -= 14;
        const specs = [];
        if (job.sizeName) specs.push(`Size: ${job.sizeName}`);
        if (job.paperType) specs.push(`Paper: ${job.paperType}`);
        page.drawText(specs.join(', '), { x: tableLeft + 10, y: lineY, size: 9, font, color: mediumGray });
      }

      // Line 3: Finishing details (if available)
      if (job.specs && typeof job.specs === 'object' && 'finishing' in job.specs && job.specs.finishing) {
        lineY -= 12;
        const finishingText = `Finishing: ${job.specs.finishing}`;
        // Truncate if too long
        const maxLength = 65;
        const displayText = finishingText.length > maxLength
          ? finishingText.substring(0, maxLength) + '...'
          : finishingText;
        page.drawText(displayText, { x: tableLeft + 10, y: lineY, size: 8, font, color: mediumGray });
      }

      // Line 4: Paper Usage (for JD→Bradford invoices)
      if (fromId === COMPANY_IDS.JD_GRAPHIC && toId === COMPANY_IDS.BRADFORD) {
        if (job.paperWeightTotal) {
          lineY -= 12;
          const paperWeightTotal = parseFloat(job.paperWeightTotal.toString());
          const paperWeightPer1000 = job.paperWeightPer1000
            ? parseFloat(job.paperWeightPer1000.toString())
            : null;

          let paperText = `Paper Usage: ${paperWeightTotal.toLocaleString()} lbs`;
          if (paperWeightPer1000) {
            paperText += ` (${paperWeightPer1000.toFixed(2)} lbs per 1,000)`;
          }
          page.drawText(paperText, { x: tableLeft + 10, y: lineY, size: 8, font, color: mediumGray });
        }

        // Line 5: CPM Rate (for JD→Bradford invoices)
        if (po && po.vendorCPM) {
          lineY -= 12;
          const cpmRate = parseFloat(po.vendorCPM.toString());
          page.drawText(`CPM Rate: $${cpmRate.toFixed(2)} per 1,000`, {
            x: tableLeft + 10,
            y: lineY,
            size: 8,
            font,
            color: accentColor
          });

          // Line 6: CPM Calculation breakdown
          if (quantity) {
            lineY -= 12;
            const thousandUnits = quantity / 1000;
            const calculatedTotal = thousandUnits * cpmRate;
            const calcText = `Calculation: ${quantity.toLocaleString()} pcs \u00F7 1,000 \u00D7 $${cpmRate.toFixed(2)} = $${calculatedTotal.toFixed(2)}`;
            page.drawText(calcText, {
              x: tableLeft + 10,
              y: lineY,
              size: 8,
              font,
              color: mediumGray
            });
          }
        }
      }

      y -= rowHeight;

      // Totals section
      y -= 50;
      const totalsX = width - 250;

      // Subtotal
      page.drawText('Subtotal:', { x: totalsX, y, size: 10, font, color: mediumGray });
      page.drawText(`$${invoice.amount.toFixed(2)}`, { x: totalsX + 120, y, size: 10, font, color: darkGray });
      y -= 18;

      // Tax
      page.drawText('Tax (0%):', { x: totalsX, y, size: 10, font, color: mediumGray });
      page.drawText('$0.00', { x: totalsX + 120, y, size: 10, font, color: darkGray });
      y -= 25;

      // Total box
      page.drawRectangle({
        x: totalsX - 10,
        y: y - 22,
        width: 200,
        height: 28,
        color: lightGray,
        borderColor: accentColor,
        borderWidth: 2,
      });

      page.drawText('TOTAL DUE:', { x: totalsX, y: y - 14, size: 12, font: boldFont, color: darkGray });
      page.drawText(`$${invoice.amount.toFixed(2)}`, { x: totalsX + 120, y: y - 14, size: 14, font: boldFont, color: accentColor });

      // Footer
      y = 80;
      page.drawLine({
        start: { x: 50, y: y + 20 },
        end: { x: width - 50, y: y + 20 },
        thickness: 0.5,
        color: borderGray,
      });

      page.drawText('PAYMENT TERMS', { x: 50, y, size: 9, font: boldFont, color: darkGray });
      y -= 14;
      page.drawText(`Payment is due within ${paymentDays} days of invoice date.`, { x: 50, y, size: 8, font, color: mediumGray });
      y -= 12;
      page.drawText('Please include invoice number with your payment.', { x: 50, y, size: 8, font, color: mediumGray });

      y -= 24;
      page.drawText('Questions? Contact us anytime.', { x: 50, y, size: 10, font: boldFont, color: accentColor });

      const pdfBytes = await pdfDoc.save();

      // Send email with PDF attachment
      if (!toCompany.email) {
        console.log(`[Invoice Chain] ⚠️  No email for ${toCompany.name} - skipping`);
        continue;
      }

      const template = emailTemplates.invoiceChainGenerated(
        invoice.invoiceNo,
        job.jobNo,
        parseFloat(invoice.amount.toString()),
        fromCompany.name,
        toCompany.name,
        job.customerPONumber || undefined
      );

      // Add CC for Bradford→Impact invoices (so Steve knows they were sent)
      const emailParams: any = {
        to: toCompany.email,
        subject: template.subject,
        html: template.html,
        attachments: [
          {
            filename: `${invoice.invoiceNo}.pdf`,
            content: Buffer.from(pdfBytes),
          },
        ],
      };

      // CC Steve Gustafson on Bradford→Impact invoices
      if (fromId === COMPANY_IDS.BRADFORD && toId === COMPANY_IDS.IMPACT_DIRECT) {
        emailParams.cc = 'steve.gustafson@bgeltd.com';
      }

      await sendEmail(emailParams);

      console.log(`[Invoice Chain] ✅ Sent ${label} invoice email to ${toCompany.email}`);

    } catch (error: any) {
      console.error(`[Invoice Chain] ❌ Failed to send ${label} email:`, error.message);
      // Continue with other emails even if one fails
    }
  }

  console.log('[Invoice Chain] 📧 Email sending complete!\n');

  return {
    jdInvoice,
    bradfordInvoice,
    impactInvoice,
  };
}

/**
 * Upload PDF for invoice
 * Allows replacing or adding a PDF file to an invoice
 */
export async function uploadInvoicePdf(
  invoiceId: string,
  pdfBuffer: Buffer,
  fileName: string
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { job: true },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Create file record
  const file = await createFile({
    jobId: invoice.jobId || undefined,
    kind: 'INVOICE',
    file: pdfBuffer,
    fileName,
    mimeType: 'application/pdf',
  });

  // Update invoice with new PDF reference
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      pdfFileId: file.id,
      issuedAt: invoice.issuedAt || new Date(),
    },
    include: {
      job: {
        include: {
          customer: true,
        },
      },
      toCompany: true,
      fromCompany: true,
      pdfFile: true,
    },
  });

  return updatedInvoice;
}
