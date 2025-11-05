#!/usr/bin/env node
/**
 * Generate and email all customer invoices
 *
 * This script:
 * 1. Finds all jobs from Impact Direct to customers (JJSA + Ballantine) that don't have invoices yet
 * 2. Creates invoice records for these jobs (regardless of completion status)
 * 3. Generates PDF files for each invoice
 * 4. Emails invoices grouped by customer to nick@jdgraphic.com and brandon@impactdirectprinting.com
 */

import { prisma } from '@printing-workflow/db';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateInvoiceNumber } from '../lib/utils.js';
import { createFile } from '../services/file.service.js';
import { sendEmail } from '../lib/email.js';
import { COMPANY_IDS } from '@printing-workflow/shared';

const RECIPIENTS = ['nick@jdgraphic.com', 'brandon@impactdirectprinting.com'];

interface InvoiceData {
  invoiceId: string;
  invoiceNo: string;
  jobNo: string;
  customerPONumber: string | null;
  amount: number;
  customerName: string;
  pdfBuffer: Buffer;
}

async function generateCustomerInvoices() {
  console.log('🚀 Starting customer invoice generation...\n');

  // Find all jobs for JJSA and Ballantine customers
  const jobs = await prisma.job.findMany({
    where: {
      customerId: {
        in: [COMPANY_IDS.JJSA, COMPANY_IDS.BALLANTINE],
      },
    },
    include: {
      customer: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`📋 Found ${jobs.length} total jobs for customers\n`);

  // Filter out jobs that already have Impact→Customer invoices
  const jobsNeedingInvoices = [];
  for (const job of jobs) {
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        jobId: job.id,
        fromCompanyId: COMPANY_IDS.IMPACT_DIRECT,
        toCompanyId: job.customerId,
      },
    });

    if (!existingInvoice) {
      jobsNeedingInvoices.push(job);
    }
  }

  console.log(`✨ Found ${jobsNeedingInvoices.length} jobs without invoices\n`);

  if (jobsNeedingInvoices.length === 0) {
    console.log('✅ All jobs already have invoices. Nothing to do!');
    return;
  }

  // Group by customer for reporting
  const jjsaJobs = jobsNeedingInvoices.filter(j => j.customerId === COMPANY_IDS.JJSA);
  const ballantineJobs = jobsNeedingInvoices.filter(j => j.customerId === COMPANY_IDS.BALLANTINE);

  console.log(`   JJSA: ${jjsaJobs.length} jobs`);
  console.log(`   Ballantine: ${ballantineJobs.length} jobs\n`);

  const generatedInvoices: InvoiceData[] = [];

  // Create invoices and generate PDFs
  console.log('📄 Creating invoice records and generating PDFs...\n');

  for (const job of jobsNeedingInvoices) {
    try {
      // Generate invoice number
      const invoiceNo = await generateInvoiceNumber();

      // Calculate due date (30 days from now)
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 30);

      // Create invoice record
      const invoice = await prisma.invoice.create({
        data: {
          jobId: job.id,
          fromCompanyId: COMPANY_IDS.IMPACT_DIRECT,
          toCompanyId: job.customerId,
          invoiceNo,
          amount: job.customerTotal,
          dueAt,
        },
        include: {
          job: true,
          toCompany: true,
          fromCompany: true,
        },
      });

      console.log(`   ✓ Created invoice ${invoiceNo} for job ${job.jobNo} (${job.customer.name})`);

      // Generate PDF
      const pdfBuffer = await generateInvoicePDF(invoice);

      // Save PDF to file system
      const file = await createFile({
        jobId: job.id,
        kind: 'INVOICE',
        file: pdfBuffer,
        fileName: `${invoiceNo}.pdf`,
        mimeType: 'application/pdf',
      });

      // Update invoice with PDF reference and mark as issued
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          pdfFileId: file.id,
          issuedAt: new Date(),
        },
      });

      console.log(`     📎 Generated PDF for invoice ${invoiceNo}\n`);

      generatedInvoices.push({
        invoiceId: invoice.id,
        invoiceNo,
        jobNo: job.jobNo,
        customerPONumber: job.customerPONumber,
        amount: parseFloat(job.customerTotal.toString()),
        customerName: job.customer.name,
        pdfBuffer,
      });
    } catch (error: any) {
      console.error(`   ❌ Failed to create invoice for job ${job.jobNo}:`, error.message);
    }
  }

  console.log(`\n✅ Generated ${generatedInvoices.length} invoices\n`);

  // Group invoices by customer
  const jjsaInvoices = generatedInvoices.filter(inv => inv.customerName === 'JJSA');
  const ballantineInvoices = generatedInvoices.filter(inv => inv.customerName === 'Ballantine Produce');

  // Send email for JJSA invoices
  if (jjsaInvoices.length > 0) {
    console.log(`📧 Sending email with ${jjsaInvoices.length} JJSA invoices...\n`);
    await sendInvoiceEmail('JJSA', jjsaInvoices);
  }

  // Send email for Ballantine invoices
  if (ballantineInvoices.length > 0) {
    console.log(`📧 Sending email with ${ballantineInvoices.length} Ballantine invoices...\n`);
    await sendInvoiceEmail('Ballantine Produce', ballantineInvoices);
  }

  console.log('🎉 All done! Invoices generated and emailed successfully.\n');
}

async function generateInvoicePDF(invoice: any): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Colors
  const accentColor = rgb(0.4, 0.49, 0.91); // Blue
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

  // Company name (Impact Direct)
  page.drawText('IMPACT DIRECT PRINTING', {
    x: 50,
    y: height - 55,
    size: 20,
    font: boldFont,
    color: accentColor,
  });

  page.drawText('Direct Mail Solutions', {
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

  const dueDate = new Date(invoice.dueAt);
  page.drawText('Due Date:', { x: metaX, y, size: 10, font, color: mediumGray });
  page.drawText(dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    { x: metaX + 65, y, size: 10, font, color: darkGray });
  y -= 18;

  page.drawText('Terms:', { x: metaX, y, size: 10, font, color: mediumGray });
  page.drawText('Net 30', { x: metaX + 65, y, size: 10, font: boldFont, color: accentColor });

  // From company (left column)
  y = height - 110;
  page.drawText('FROM', { x: 50, y, size: 10, font: boldFont, color: mediumGray });
  y -= 18;
  page.drawText(invoice.fromCompany.name, { x: 50, y, size: 12, font: boldFont, color: darkGray });
  y -= 16;
  if (invoice.fromCompany.address) {
    page.drawText(invoice.fromCompany.address, { x: 50, y, size: 9, font, color: mediumGray });
    y -= 14;
  }
  if (invoice.fromCompany.phone) {
    page.drawText(`Phone: ${invoice.fromCompany.phone}`, { x: 50, y, size: 9, font, color: mediumGray });
    y -= 14;
  }
  if (invoice.fromCompany.email) {
    page.drawText(`Email: ${invoice.fromCompany.email}`, { x: 50, y, size: 9, font, color: mediumGray });
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
  page.drawText(invoice.toCompany.name, { x: 60, y: y - 28, size: 12, font: boldFont, color: darkGray });
  if (invoice.toCompany.address) {
    page.drawText(invoice.toCompany.address, { x: 60, y: y - 42, size: 9, font, color: mediumGray });
  }
  if (invoice.toCompany.email) {
    page.drawText(`Email: ${invoice.toCompany.email}`, { x: 60, y: y - 56, size: 9, font, color: mediumGray });
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
  page.drawText(`Job #: ${invoice.job.jobNo}`, { x: 60, y: y - 30, size: 10, font: boldFont, color: darkGray });

  // Show customer PO number (if available)
  if (invoice.job.customerPONumber) {
    page.drawText(`Customer PO: ${invoice.job.customerPONumber}`, { x: 60, y: y - 43, size: 9, font, color: accentColor });
  }

  // Line items table
  y -= 70;
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
  const quantity = invoice.job.quantity || 1;
  const unitPrice = parseFloat(invoice.amount.toString()) / quantity;

  // Table row
  const rowHeight = invoice.job.sizeName || invoice.job.paperType ? 50 : 25;
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
  page.drawText(`Printing Services - Job ${invoice.job.jobNo}`, { x: tableLeft + 10, y: lineY, size: 10, font: boldFont, color: darkGray });
  page.drawText(quantity.toLocaleString(), { x: tableLeft + 320, y: lineY, size: 10, font, color: darkGray });
  page.drawText(`$${unitPrice.toFixed(4)}`, { x: tableLeft + 370, y: lineY, size: 9, font, color: darkGray });
  page.drawText(`$${invoice.amount.toFixed(2)}`, { x: tableLeft + 455, y: lineY, size: 10, font: boldFont, color: darkGray });

  // Line 2: Product specifications (if available)
  if (invoice.job.sizeName || invoice.job.paperType) {
    lineY -= 14;
    const specs = [];
    if (invoice.job.sizeName) specs.push(`Size: ${invoice.job.sizeName}`);
    if (invoice.job.paperType) specs.push(`Paper: ${invoice.job.paperType}`);
    page.drawText(specs.join(', '), { x: tableLeft + 10, y: lineY, size: 9, font, color: mediumGray });
  }

  // Line 3: Finishing details (if available)
  if (invoice.job.specs && typeof invoice.job.specs === 'object' && 'finishing' in invoice.job.specs && invoice.job.specs.finishing) {
    lineY -= 12;
    const finishingText = `Finishing: ${invoice.job.specs.finishing}`;
    const maxLength = 65;
    const displayText = finishingText.length > maxLength
      ? finishingText.substring(0, maxLength) + '...'
      : finishingText;
    page.drawText(displayText, { x: tableLeft + 10, y: lineY, size: 8, font, color: mediumGray });
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
  page.drawText('Payment is due within 30 days of invoice date.', { x: 50, y, size: 8, font, color: mediumGray });
  y -= 12;
  page.drawText('Please include invoice number with your payment.', { x: 50, y, size: 8, font, color: mediumGray });

  y -= 24;
  page.drawText('Thank you for your business!', { x: 50, y, size: 10, font: boldFont, color: accentColor });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function sendInvoiceEmail(customerName: string, invoices: InvoiceData[]) {
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Build invoice list for email body
  const invoiceList = invoices.map(inv => {
    const poText = inv.customerPONumber ? ` (PO: ${inv.customerPONumber})` : '';
    return `    • Invoice ${inv.invoiceNo} - Job ${inv.jobNo}${poText} - $${inv.amount.toFixed(2)}`;
  }).join('\n');

  const subject = `${customerName} - ${invoices.length} New Invoice${invoices.length > 1 ? 's' : ''} from Impact Direct Printing`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Impact Direct Printing</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Customer Invoices</p>
      </div>

      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb;">
        <h2 style="color: #1f2937; margin-top: 0;">New Invoices for ${customerName}</h2>

        <p style="color: #4b5563; line-height: 1.6;">
          Please find attached ${invoices.length} invoice${invoices.length > 1 ? 's' : ''} for ${customerName}.
        </p>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #374151; margin-top: 0; font-size: 16px;">Invoice Summary</h3>
          <div style="color: #6b7280; font-family: monospace; font-size: 13px; line-height: 1.8;">
${invoiceList}
          </div>
          <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #d1d5db;">
            <strong style="color: #1f2937; font-size: 16px;">Total Amount: $${totalAmount.toFixed(2)}</strong>
          </div>
        </div>

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
          <p style="color: #1e40af; margin: 0; font-size: 14px;">
            <strong>Payment Terms:</strong> Net 30 days from invoice date
          </p>
        </div>

        <p style="color: #4b5563; line-height: 1.6;">
          If you have any questions about these invoices, please don't hesitate to reach out.
        </p>

        <p style="color: #6b7280; margin-top: 30px;">
          Best regards,<br>
          <strong style="color: #1f2937;">Impact Direct Printing</strong>
        </p>
      </div>

      <div style="background: #f9fafb; padding: 20px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          This is an automated message from the printing workflow system.
        </p>
      </div>
    </div>
  `;

  // Build attachments array
  const attachments = invoices.map(inv => ({
    filename: `${inv.invoiceNo}.pdf`,
    content: inv.pdfBuffer,
  }));

  try {
    await sendEmail({
      to: RECIPIENTS.join(', '),
      subject,
      html,
      attachments,
    });

    console.log(`   ✓ Sent email to ${RECIPIENTS.join(', ')}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to send email:`, error.message);
    throw error;
  }
}

// Run the script
generateCustomerInvoices()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
