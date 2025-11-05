/**
 * Generate Missing Invoice PDFs
 *
 * This script generates PDFs for invoices that don't have them yet.
 *
 * Run with: DATABASE_URL="file:./packages/db/prisma/dev.db" npx tsx apps/api/src/scripts/generate-missing-pdfs.ts
 */

import { prisma } from '@printing-workflow/db';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createFile } from '../services/file.service.js';

const COMPANY_IDS = {
  JD_GRAPHIC: 'jd-graphic',
  BRADFORD: 'bradford',
  IMPACT_DIRECT: 'impact-direct',
};

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

async function main() {
  console.log('\n========================================');
  console.log('📄 GENERATING MISSING INVOICE PDFs');
  console.log('========================================\n');

  // Find all invoices without PDFs (check pdfFileId field)
  const invoicesWithoutPDFs = await prisma.invoice.findMany({
    where: {
      pdfFileId: null,
    },
    include: {
      job: {
        include: {
          purchaseOrders: true,
        },
      },
      fromCompany: true,
      toCompany: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${invoicesWithoutPDFs.length} invoices without PDFs\n`);

  let success = 0;
  let failed = 0;

  for (const invoice of invoicesWithoutPDFs) {
    try {
      console.log(`Processing ${invoice.invoiceNo} (${invoice.fromCompany.name} → ${invoice.toCompany.name})...`);

      // Find the relevant PO for this invoice
      let po = null;
      if (invoice.fromCompanyId === COMPANY_IDS.JD_GRAPHIC && invoice.toCompanyId === COMPANY_IDS.BRADFORD) {
        po = invoice.job.purchaseOrders.find(
          (p: any) => p.originCompanyId === COMPANY_IDS.BRADFORD && p.targetCompanyId === COMPANY_IDS.JD_GRAPHIC
        );
      } else if (invoice.fromCompanyId === COMPANY_IDS.BRADFORD && invoice.toCompanyId === COMPANY_IDS.IMPACT_DIRECT) {
        po = invoice.job.purchaseOrders.find(
          (p: any) => p.originCompanyId === COMPANY_IDS.IMPACT_DIRECT && p.targetCompanyId === COMPANY_IDS.BRADFORD
        );
      }

      // Generate PDF
      const pdfBytes = await generateInvoicePDF(
        invoice,
        invoice.job,
        invoice.fromCompany,
        invoice.toCompany,
        po
      );

      // Save PDF
      const pdfFile = await createFile({
        file: Buffer.from(pdfBytes),
        fileName: `${invoice.invoiceNo}.pdf`,
        mimeType: 'application/pdf',
        kind: 'INVOICE',
        jobId: invoice.jobId,
        uploadedBy: 'system',
      });

      // Link the PDF to the invoice
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { pdfFileId: pdfFile.id },
      });

      console.log(`  ✅ Generated PDF\n`);
      success++;
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n========================================');
  console.log('📊 SUMMARY');
  console.log('========================================');
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('========================================\n');

  await prisma.$disconnect();
}

main();
