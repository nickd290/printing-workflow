import { prisma, InvoiceStatus } from '@printing-workflow/db';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateInvoiceNumber } from '../lib/utils.js';
import { createFile } from './file.service.js';
import { queueEmail } from '../lib/queue.js';
import { emailTemplates } from '../lib/email.js';
import { COMPANY_IDS } from '@printing-workflow/shared';

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
      status: InvoiceStatus.DRAFT,
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
    throw new Error('Invoice not found');
  }

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;

  // Header
  page.drawText('INVOICE', {
    x: 50,
    y,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  y -= 30;

  // Invoice details
  page.drawText(`Invoice #: ${invoice.invoiceNo}`, {
    x: 50,
    y,
    size: 12,
    font,
  });

  y -= 20;

  page.drawText(
    `Date: ${invoice.createdAt.toLocaleDateString()}`,
    {
      x: 50,
      y,
      size: 12,
      font,
    }
  );

  y -= 20;

  page.drawText(
    `Due Date: ${invoice.dueAt?.toLocaleDateString() || 'N/A'}`,
    {
      x: 50,
      y,
      size: 12,
      font,
    }
  );

  y -= 40;

  // From/To
  page.drawText('From:', { x: 50, y, size: 12, font: boldFont });
  page.drawText('Bill To:', { x: 300, y, size: 12, font: boldFont });

  y -= 20;

  page.drawText(invoice.fromCompany.name, { x: 50, y, size: 10, font });
  page.drawText(invoice.toCompany.name, { x: 300, y, size: 10, font });

  y -= 15;

  if (invoice.fromCompany.address) {
    page.drawText(invoice.fromCompany.address, { x: 50, y, size: 10, font });
  }
  if (invoice.toCompany.address) {
    page.drawText(invoice.toCompany.address, { x: 300, y, size: 10, font });
  }

  y -= 40;

  // Job details
  page.drawText('Job Details:', { x: 50, y, size: 12, font: boldFont });

  y -= 20;

  if (invoice.job) {
    page.drawText(`Job #: ${invoice.job.jobNo}`, { x: 50, y, size: 10, font });
  }

  y -= 40;

  // Amount
  page.drawText('Amount Due:', { x: 50, y, size: 14, font: boldFont });
  page.drawText(`$${invoice.amount.toFixed(2)}`, {
    x: 300,
    y,
    size: 14,
    font: boldFont,
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
      status: InvoiceStatus.SENT,
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
  status?: InvoiceStatus;
}) {
  return prisma.invoice.findMany({
    where: {
      jobId: filters?.jobId,
      toCompanyId: filters?.toCompanyId,
      status: filters?.status,
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
      status: InvoiceStatus.PAID,
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
      status: InvoiceStatus.DRAFT,
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
