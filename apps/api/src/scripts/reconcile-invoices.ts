/**
 * Reconcile Missing Invoices
 *
 * This script generates missing invoices for jobs that have POs but are missing
 * the corresponding invoices. This happened during development when invoices were
 * created manually or partially.
 *
 * Run with: DATABASE_URL="file:./packages/db/prisma/dev.db" npx tsx apps/api/src/scripts/reconcile-invoices.ts
 */

import { prisma } from '@printing-workflow/db';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { generateInvoiceNumber } from '../lib/utils.js';
import { createFile } from '../services/file.service.js';
import { sendEmail } from '../lib/email.js';

const COMPANY_IDS = {
  JD_GRAPHIC: 'jd-graphic',
  BRADFORD: 'bradford',
  IMPACT_DIRECT: 'impact-direct',
};

interface ReconciliationStats {
  jdToBradfordCreated: number;
  bradfordToImpactCreated: number;
  jdToBradfordSkipped: number;
  bradfordToImpactSkipped: number;
  errors: Array<{ jobNo: string; error: string }>;
}

async function generateInvoicePDF(invoice: any, job: any, fromCompany: any, toCompany: any, po: any) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Determine payment terms based on invoice direction
  const isJdToBradford = invoice.fromCompanyId === COMPANY_IDS.JD_GRAPHIC && invoice.toCompanyId === COMPANY_IDS.BRADFORD;
  const paymentDays = isJdToBradford ? 10 : 30;
  const paymentTermsText = isJdToBradford ? 'Net 10 Days' : 'Net 30 Days';

  // Colors
  const primaryColor = rgb(0.145, 0.263, 0.475); // #254979
  const accentColor = rgb(0.063, 0.455, 0.702); // #1074B3
  const lightGray = rgb(0.9, 0.9, 0.9);
  const mediumGray = rgb(0.5, 0.5, 0.5);
  const darkGray = rgb(0.2, 0.2, 0.2);

  let y = 740;

  // Header with company branding
  page.drawRectangle({ x: 0, y: 710, width: 612, height: 82, color: primaryColor });
  page.drawText('INVOICE', { x: 60, y: 750, size: 28, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText(fromCompany.name, { x: 60, y: 725, size: 12, font: boldFont, color: rgb(1, 1, 1) });

  // Invoice details (right side)
  const invoiceDetailsX = 400;
  page.drawText(`Invoice #: ${invoice.invoiceNo}`, { x: invoiceDetailsX, y: 750, size: 10, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, { x: invoiceDetailsX, y: 735, size: 9, font, color: rgb(1, 1, 1) });
  page.drawText(`Due: ${new Date(invoice.dueAt).toLocaleDateString()}`, { x: invoiceDetailsX, y: 720, size: 9, font, color: rgb(1, 1, 1) });

  y = 680;

  // From Company (left)
  page.drawText('FROM:', { x: 60, y, size: 10, font: boldFont, color: darkGray });
  y -= 15;
  page.drawText(fromCompany.name, { x: 60, y, size: 10, font: boldFont, color: darkGray });
  y -= 12;
  if (fromCompany.address) {
    page.drawText(fromCompany.address, { x: 60, y, size: 9, font, color: mediumGray });
    y -= 12;
  }
  if (fromCompany.email) {
    page.drawText(fromCompany.email, { x: 60, y, size: 9, font, color: accentColor });
    y -= 12;
  }
  if (fromCompany.phone) {
    page.drawText(fromCompany.phone, { x: 60, y, size: 9, font, color: mediumGray });
  }

  // To Company (right)
  y = 680;
  page.drawText('BILL TO:', { x: 320, y, size: 10, font: boldFont, color: darkGray });
  y -= 15;
  page.drawText(toCompany.name, { x: 320, y, size: 10, font: boldFont, color: darkGray });
  y -= 12;
  if (toCompany.address) {
    page.drawText(toCompany.address, { x: 320, y, size: 9, font, color: mediumGray });
    y -= 12;
  }
  if (toCompany.email) {
    page.drawText(toCompany.email, { x: 320, y, size: 9, font, color: accentColor });
    y -= 12;
  }
  if (toCompany.phone) {
    page.drawText(toCompany.phone, { x: 320, y, size: 9, font, color: mediumGray });
  }

  // Job Reference
  y = 580;
  page.drawRectangle({ x: 50, y: y - 5, width: 512, height: 50, color: lightGray });
  page.drawText('JOB REFERENCE', { x: 60, y: y + 25, size: 10, font: boldFont, color: primaryColor });

  // Show the PO number from the sender (if available)
  let refY = y + 10;
  if (po && po.poNumber) {
    const poLabel = fromCompany.id === COMPANY_IDS.JD_GRAPHIC ? 'Bradford PO'
      : fromCompany.id === COMPANY_IDS.BRADFORD ? 'Impact PO'
      : 'PO';
    page.drawText(`${poLabel}: ${po.poNumber}`, { x: 60, y: refY, size: 9, font, color: accentColor });
    refY -= 13;
  }

  // Show customer PO number (if available)
  if (job.customerPONumber) {
    page.drawText(`Customer PO: ${job.customerPONumber}`, { x: 60, y: refY, size: 9, font, color: mediumGray });
    refY -= 13;
  }

  // Job details
  page.drawText(`Job #: ${job.jobNo}`, { x: 320, y: y + 25, size: 9, font, color: mediumGray });
  page.drawText(`Description: ${job.description || 'Print Job'}`, { x: 320, y: y + 10, size: 9, font, color: mediumGray });

  // Line items
  y = 510;
  page.drawRectangle({ x: 50, y: y - 30, width: 512, height: 25, color: primaryColor });
  page.drawText('DESCRIPTION', { x: 60, y: y - 15, size: 10, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('QTY', { x: 380, y: y - 15, size: 10, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('AMOUNT', { x: 480, y: y - 15, size: 10, font: boldFont, color: rgb(1, 1, 1) });

  y -= 50;

  // Main line item
  const description = job.description || 'Print Job';
  page.drawText(description.substring(0, 50), { x: 60, y, size: 9, font, color: darkGray });
  page.drawText(job.quantity?.toString() || '1', { x: 380, y, size: 9, font, color: darkGray });
  page.drawText(`$${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, { x: 480, y, size: 9, font: boldFont, color: darkGray });

  // Totals
  y = 200;
  page.drawLine({ start: { x: 380, y: y + 10 }, end: { x: 552, y: y + 10 }, thickness: 1, color: lightGray });

  page.drawText('TOTAL:', { x: 380, y, size: 12, font: boldFont, color: primaryColor });
  page.drawText(
    `$${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    { x: 480, y, size: 14, font: boldFont, color: primaryColor }
  );

  // Footer
  y = 100;
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 80, color: lightGray });
  page.drawText(`Payment Terms: ${paymentTermsText}`, { x: 60, y: y - 20, size: 8, font, color: mediumGray });
  page.drawText('Thank you for your business!', { x: 60, y: y - 35, size: 8, font, color: mediumGray });
  page.drawText(
    `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
    { x: 320, y: y - 35, size: 7, font, color: mediumGray }
  );

  return await pdfDoc.save();
}

async function reconcileJDToBradfordInvoices(stats: ReconciliationStats, sendEmails: boolean = false) {
  console.log('\n========================================');
  console.log('🔍 Finding jobs missing JD→Bradford invoices...');
  console.log('========================================\n');

  // Find all jobs with Bradford→JD PO but missing JD→Bradford invoice
  const jobsNeedingInvoices = await prisma.job.findMany({
    where: {
      purchaseOrders: {
        some: {
          originCompanyId: COMPANY_IDS.BRADFORD,
          targetCompanyId: COMPANY_IDS.JD_GRAPHIC,
        },
      },
      invoices: {
        none: {
          fromCompanyId: COMPANY_IDS.JD_GRAPHIC,
          toCompanyId: COMPANY_IDS.BRADFORD,
        },
      },
    },
    include: {
      purchaseOrders: {
        where: {
          originCompanyId: COMPANY_IDS.BRADFORD,
          targetCompanyId: COMPANY_IDS.JD_GRAPHIC,
        },
      },
      customer: true,
    },
  });

  console.log(`Found ${jobsNeedingInvoices.length} jobs needing JD→Bradford invoices\n`);

  for (const job of jobsNeedingInvoices) {
    const bradfordToJdPO = job.purchaseOrders[0];

    try {
      console.log(`Processing Job ${job.jobNo}...`);
      console.log(`  Bradford PO: ${bradfordToJdPO.poNumber}, Amount: $${bradfordToJdPO.vendorAmount}`);

      // Generate invoice number
      const invoiceNo = await generateInvoiceNumber();

      // Calculate due date (30 days)
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 30);

      // Create invoice
      const invoice = await prisma.invoice.create({
        data: {
          jobId: job.id,
          fromCompanyId: COMPANY_IDS.JD_GRAPHIC,
          toCompanyId: COMPANY_IDS.BRADFORD,
          invoiceNo,
          amount: bradfordToJdPO.vendorAmount,
          status: 'DRAFT',
          dueAt,
        },
        include: {
          job: true,
          fromCompany: true,
          toCompany: true,
        },
      });

      console.log(`  ✅ Created invoice ${invoiceNo} for $${invoice.amount}`);

      // Generate PDF
      const pdfBytes = await generateInvoicePDF(
        invoice,
        job,
        invoice.fromCompany,
        invoice.toCompany,
        bradfordToJdPO
      );

      // Save PDF
      const pdfFile = await createFile({
        file: Buffer.from(pdfBytes),
        fileName: `${invoiceNo}.pdf`,
        mimeType: 'application/pdf',
        kind: 'INVOICE',
        jobId: job.id,
        uploadedBy: 'system',
      });

      await prisma.invoiceFile.create({
        data: {
          invoiceId: invoice.id,
          fileId: pdfFile.id,
        },
      });

      console.log(`  ✅ Generated PDF`);

      // Optionally send email
      if (sendEmails) {
        await sendEmail({
          to: invoice.toCompany.email,
          subject: `Invoice ${invoiceNo} from ${invoice.fromCompany.name}`,
          html: `
            <h2>New Invoice</h2>
            <p>You have received a new invoice from ${invoice.fromCompany.name}.</p>
            <ul>
              <li><strong>Invoice #:</strong> ${invoiceNo}</li>
              <li><strong>Amount:</strong> $${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</li>
              <li><strong>Due Date:</strong> ${new Date(invoice.dueAt).toLocaleDateString()}</li>
              <li><strong>Job #:</strong> ${job.jobNo}</li>
            </ul>
            <p>Please see attached PDF for full invoice details.</p>
          `,
          attachments: [
            {
              filename: `${invoiceNo}.pdf`,
              content: Buffer.from(pdfBytes),
            },
          ],
        });
        console.log(`  ✅ Sent email`);
      }

      stats.jdToBradfordCreated++;
      console.log('');
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}\n`);
      stats.errors.push({ jobNo: job.jobNo, error: error.message });
      stats.jdToBradfordSkipped++;
    }
  }
}

async function reconcileBradfordToImpactInvoices(stats: ReconciliationStats, sendEmails: boolean = false) {
  console.log('\n========================================');
  console.log('🔍 Finding jobs missing Bradford→Impact invoices...');
  console.log('========================================\n');

  // Find all jobs with Impact→Bradford PO but missing Bradford→Impact invoice
  const jobsNeedingInvoices = await prisma.job.findMany({
    where: {
      purchaseOrders: {
        some: {
          originCompanyId: COMPANY_IDS.IMPACT_DIRECT,
          targetCompanyId: COMPANY_IDS.BRADFORD,
        },
      },
      invoices: {
        none: {
          fromCompanyId: COMPANY_IDS.BRADFORD,
          toCompanyId: COMPANY_IDS.IMPACT_DIRECT,
        },
      },
    },
    include: {
      purchaseOrders: {
        where: {
          originCompanyId: COMPANY_IDS.IMPACT_DIRECT,
          targetCompanyId: COMPANY_IDS.BRADFORD,
        },
      },
      customer: true,
    },
  });

  console.log(`Found ${jobsNeedingInvoices.length} jobs needing Bradford→Impact invoices\n`);

  for (const job of jobsNeedingInvoices) {
    const impactToBradfordPO = job.purchaseOrders[0];

    try {
      console.log(`Processing Job ${job.jobNo}...`);
      console.log(`  Impact PO: ${impactToBradfordPO.poNumber}, Amount: $${impactToBradfordPO.vendorAmount}`);

      // Generate invoice number
      const invoiceNo = await generateInvoiceNumber();

      // Calculate due date (30 days)
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 30);

      // Create invoice
      const invoice = await prisma.invoice.create({
        data: {
          jobId: job.id,
          fromCompanyId: COMPANY_IDS.BRADFORD,
          toCompanyId: COMPANY_IDS.IMPACT_DIRECT,
          invoiceNo,
          amount: impactToBradfordPO.vendorAmount,
          status: 'DRAFT',
          dueAt,
        },
        include: {
          job: true,
          fromCompany: true,
          toCompany: true,
        },
      });

      console.log(`  ✅ Created invoice ${invoiceNo} for $${invoice.amount}`);

      // Generate PDF
      const pdfBytes = await generateInvoicePDF(
        invoice,
        job,
        invoice.fromCompany,
        invoice.toCompany,
        impactToBradfordPO
      );

      // Save PDF
      const pdfFile = await createFile({
        file: Buffer.from(pdfBytes),
        fileName: `${invoiceNo}.pdf`,
        mimeType: 'application/pdf',
        kind: 'INVOICE',
        jobId: job.id,
        uploadedBy: 'system',
      });

      await prisma.invoiceFile.create({
        data: {
          invoiceId: invoice.id,
          fileId: pdfFile.id,
        },
      });

      console.log(`  ✅ Generated PDF`);

      // Optionally send email with CC to Steve
      if (sendEmails) {
        await sendEmail({
          to: invoice.toCompany.email,
          cc: 'steve.gustafson@bgeltd.com',
          subject: `Invoice ${invoiceNo} from ${invoice.fromCompany.name}`,
          html: `
            <h2>New Invoice</h2>
            <p>You have received a new invoice from ${invoice.fromCompany.name}.</p>
            <ul>
              <li><strong>Invoice #:</strong> ${invoiceNo}</li>
              <li><strong>Amount:</strong> $${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</li>
              <li><strong>Due Date:</strong> ${new Date(invoice.dueAt).toLocaleDateString()}</li>
              <li><strong>Job #:</strong> ${job.jobNo}</li>
            </ul>
            <p>Please see attached PDF for full invoice details.</p>
          `,
          attachments: [
            {
              filename: `${invoiceNo}.pdf`,
              content: Buffer.from(pdfBytes),
            },
          ],
        });
        console.log(`  ✅ Sent email (CC: steve.gustafson@bgeltd.com)`);
      }

      stats.bradfordToImpactCreated++;
      console.log('');
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}\n`);
      stats.errors.push({ jobNo: job.jobNo, error: error.message });
      stats.bradfordToImpactSkipped++;
    }
  }
}

async function main() {
  console.log('\n========================================');
  console.log('📊 INVOICE RECONCILIATION STARTING');
  console.log('========================================\n');

  const stats: ReconciliationStats = {
    jdToBradfordCreated: 0,
    bradfordToImpactCreated: 0,
    jdToBradfordSkipped: 0,
    bradfordToImpactSkipped: 0,
    errors: [],
  };

  // Ask user if they want to send emails (default: no for bulk reconciliation)
  const sendEmails = process.argv.includes('--send-emails');

  if (!sendEmails) {
    console.log('⚠️  Running in DRY RUN mode (no emails will be sent)');
    console.log('   Add --send-emails flag to send email notifications\n');
  }

  try {
    // Reconcile JD→Bradford invoices
    await reconcileJDToBradfordInvoices(stats, sendEmails);

    // Reconcile Bradford→Impact invoices
    await reconcileBradfordToImpactInvoices(stats, sendEmails);

    // Print summary
    console.log('\n========================================');
    console.log('📊 RECONCILIATION COMPLETE');
    console.log('========================================\n');
    console.log(`JD→Bradford Invoices:`);
    console.log(`  ✅ Created: ${stats.jdToBradfordCreated}`);
    console.log(`  ⏭️  Skipped: ${stats.jdToBradfordSkipped}`);
    console.log('');
    console.log(`Bradford→Impact Invoices:`);
    console.log(`  ✅ Created: ${stats.bradfordToImpactCreated}`);
    console.log(`  ⏭️  Skipped: ${stats.bradfordToImpactSkipped}`);
    console.log('');
    console.log(`Total Invoices Created: ${stats.jdToBradfordCreated + stats.bradfordToImpactCreated}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      stats.errors.forEach((err) => {
        console.log(`  - Job ${err.jobNo}: ${err.error}`);
      });
    }

    console.log('\n========================================\n');
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
