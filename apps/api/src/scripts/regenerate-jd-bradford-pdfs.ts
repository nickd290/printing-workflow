/**
 * Regenerate JD→Bradford Invoice PDFs with Updated Layout
 *
 * This script regenerates PDFs for all JD→Bradford invoices with the finalized
 * layout including paper costs, production costs, and margin breakdowns.
 *
 * Run with: DATABASE_URL="file:./packages/db/prisma/dev.db" npx tsx apps/api/src/scripts/regenerate-jd-bradford-pdfs.ts
 */

import { prisma } from '@printing-workflow/db';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createFile } from '../services/file.service.js';
import { sendEmail } from '../lib/email.js';
import ExcelJS from 'exceljs';

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

  // JD→Bradford invoices use Net 10 Days
  const paymentTermsText = 'Net 10 Days';

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

  // Job Details Section - Boxed layout with clear fields
  y = 595;
  const jobBoxY = y;

  // Calculate box height dynamically based on content
  let estimatedHeight = 85; // Base height for standard fields
  if (po && po.poNumber) estimatedHeight += 13;
  if (job.customerPONumber) estimatedHeight += 13;
  if (job.description) {
    // Estimate description lines
    const words = job.description.split(' ');
    let lineCount = 1;
    let currentLineWidth = 0;
    const maxLineWidth = 482; // Box width minus padding

    for (const word of words) {
      const wordWidth = font.widthOfTextAtSize(word + ' ', 9);
      if (currentLineWidth + wordWidth > maxLineWidth) {
        lineCount++;
        currentLineWidth = wordWidth;
      } else {
        currentLineWidth += wordWidth;
      }
    }
    estimatedHeight += (lineCount * 12) + 20; // Lines + spacing
  }

  const jobBoxHeight = estimatedHeight;

  // Draw Job Details box
  page.drawRectangle({ x: 50, y: jobBoxY - jobBoxHeight, width: 512, height: jobBoxHeight, color: rgb(0.97, 0.97, 0.97) });
  page.drawRectangle({ x: 50, y: jobBoxY - jobBoxHeight, width: 512, height: jobBoxHeight, borderColor: primaryColor, borderWidth: 1.5 });

  // Box header
  page.drawText('JOB DETAILS', { x: 60, y: jobBoxY - 18, size: 10, font: boldFont, color: primaryColor });

  let jobY = jobBoxY - 36;

  // Job number
  page.drawText(`Job #: ${job.jobNo}`, { x: 60, y: jobY, size: 9, font: boldFont, color: darkGray });
  jobY -= 13;

  // Bradford PO
  if (po && po.poNumber) {
    page.drawText(`Bradford PO: ${po.poNumber}`, { x: 60, y: jobY, size: 9, font, color: accentColor });
    jobY -= 13;
  }

  // Customer PO
  if (job.customerPONumber) {
    page.drawText(`Customer PO: ${job.customerPONumber}`, { x: 60, y: jobY, size: 9, font, color: mediumGray });
    jobY -= 13;
  }

  jobY -= 6; // Spacing before description

  // Description with word wrapping
  if (job.description) {
    page.drawText('Description:', { x: 60, y: jobY, size: 9, font: boldFont, color: darkGray });
    jobY -= 13;

    // Word wrap within box
    const maxWidth = 482; // Box width minus padding
    const words = job.description.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, 9);

      if (testWidth > maxWidth && currentLine) {
        page.drawText(currentLine, { x: 60, y: jobY, size: 9, font, color: mediumGray });
        jobY -= 12;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      page.drawText(currentLine, { x: 60, y: jobY, size: 9, font, color: mediumGray });
      jobY -= 13;
    }
  }

  jobY -= 6; // Spacing before specs

  // Specifications - each on its own line
  if (job.sizeName) {
    page.drawText(`Size: ${job.sizeName}`, { x: 60, y: jobY, size: 9, font, color: darkGray });
    jobY -= 13;
  }

  if (job.paperType) {
    page.drawText(`Paper: ${job.paperType}`, { x: 60, y: jobY, size: 9, font, color: darkGray });
    jobY -= 13;
  }

  if (job.quantity) {
    page.drawText(`Quantity: ${job.quantity.toLocaleString()} pcs`, { x: 60, y: jobY, size: 9, font, color: darkGray });
    jobY -= 13;
  }

  jobY -= 8; // Extra spacing before paper/CPM info

  // Paper Usage
  if (job.paperWeightTotal) {
    const paperWeightTotal = parseFloat(job.paperWeightTotal.toString());
    const paperWeightPer1000 = job.paperWeightPer1000 ? parseFloat(job.paperWeightPer1000.toString()) : null;

    let paperText = `Paper Usage: ${paperWeightTotal.toLocaleString()} lbs`;
    if (paperWeightPer1000) {
      paperText += ` (${paperWeightPer1000.toFixed(2)} lbs per 1,000)`;
    }
    page.drawText(paperText, { x: 60, y: jobY, size: 9, font, color: mediumGray });
    jobY -= 13;
  }

  // Print CPM Rate
  if (po && po.vendorCPM) {
    const cpmRate = parseFloat(po.vendorCPM.toString());
    page.drawText(`Print CPM Rate: $${cpmRate.toFixed(2)} per 1,000`, { x: 60, y: jobY, size: 9, font, color: accentColor });
  }

  // Position y below the job details box
  y = jobBoxY - jobBoxHeight - 40;

  // Total Amount Due Section
  const totalAmount = Number(job.jdTotal || 0);

  page.drawRectangle({ x: 380, y: y - 60, width: 182, height: 60, color: rgb(0.97, 0.97, 0.97) });
  page.drawRectangle({ x: 380, y: y - 60, width: 182, height: 60, borderColor: primaryColor, borderWidth: 2 });

  page.drawText('TOTAL AMOUNT DUE', { x: 390, y: y - 18, size: 10, font: boldFont, color: primaryColor });
  page.drawText(`$${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, { x: 390, y: y - 42, size: 16, font: boldFont, color: primaryColor });

  y = y - 70;

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
  console.log('📄 REGENERATING JD→BRADFORD INVOICE PDFs');
  console.log('========================================\n');

  // Find all JD→Bradford invoices
  const jdBradfordInvoices = await prisma.invoice.findMany({
    where: {
      fromCompanyId: COMPANY_IDS.JD_GRAPHIC,
      toCompanyId: COMPANY_IDS.BRADFORD,
    },
    include: {
      job: {
        include: {
          purchaseOrders: true,
        },
      },
      fromCompany: true,
      toCompany: true,
      pdfFile: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${jdBradfordInvoices.length} JD→Bradford invoices\n`);

  let success = 0;
  let failed = 0;
  const pdfAttachments: Array<{ filename: string; content: Buffer }> = [];
  const excelData: Array<{
    invoiceNo: string;
    jobNo: string;
    bradfordPO: string | null;
    invoiceDate: Date;
    dueDate: Date;
    amount: number;
    paperWeightTotal: number | null;
    paperWeightPer1000: number | null;
    vendorCPM: number | null;
    quantity: number | null;
    calculation: string;
  }> = [];

  for (const invoice of jdBradfordInvoices) {
    try {
      console.log(`Processing ${invoice.invoiceNo} for job ${invoice.job.jobNo}...`);

      // Find the relevant PO for this invoice (Bradford→JD PO)
      const po = invoice.job.purchaseOrders.find(
        (p: any) => p.originCompanyId === COMPANY_IDS.BRADFORD && p.targetCompanyId === COMPANY_IDS.JD_GRAPHIC
      );

      // Generate new PDF with updated layout
      const pdfBytes = await generateInvoicePDF(
        invoice,
        invoice.job,
        invoice.fromCompany,
        invoice.toCompany,
        po
      );

      // Collect PDF for email attachment
      pdfAttachments.push({
        filename: `${invoice.invoiceNo}.pdf`,
        content: Buffer.from(pdfBytes),
      });

      // Collect data for Excel summary
      const paperWeightTotal = invoice.job.paperWeightTotal
        ? parseFloat(invoice.job.paperWeightTotal.toString())
        : null;
      const paperWeightPer1000 = invoice.job.paperWeightPer1000
        ? parseFloat(invoice.job.paperWeightPer1000.toString())
        : null;
      const vendorCPM = po && po.vendorCPM ? parseFloat(po.vendorCPM.toString()) : null;
      const quantity = invoice.job.quantity || null;

      let calculation = 'N/A';
      if (quantity && vendorCPM) {
        const thousandUnits = quantity / 1000;
        const calculatedTotal = thousandUnits * vendorCPM;
        calculation = `${quantity.toLocaleString()} pcs ÷ 1,000 × $${vendorCPM.toFixed(2)} = $${calculatedTotal.toFixed(2)}`;
      }

      excelData.push({
        invoiceNo: invoice.invoiceNo,
        jobNo: invoice.job.jobNo,
        bradfordPO: po?.poNumber || null,
        invoiceDate: new Date(invoice.createdAt),
        dueDate: new Date(invoice.dueAt),
        amount: Number(invoice.amount),
        paperWeightTotal,
        paperWeightPer1000,
        vendorCPM,
        quantity,
        calculation,
      });

      // Save new PDF
      const pdfFile = await createFile({
        file: Buffer.from(pdfBytes),
        fileName: `${invoice.invoiceNo}.pdf`,
        mimeType: 'application/pdf',
        kind: 'INVOICE',
        jobId: invoice.jobId,
        uploadedBy: 'system',
      });

      // Update invoice with new PDF reference
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          pdfFileId: pdfFile.id,
          // Update due date to 10 days from issued date
          dueAt: new Date(new Date(invoice.createdAt).getTime() + 10 * 24 * 60 * 60 * 1000),
        },
      });

      console.log(`  ✅ Regenerated PDF with updated layout\n`);
      success++;
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}\n`);
      failed++;
    }
  }

  // Generate Excel summary
  if (excelData.length > 0) {
    console.log('\n========================================');
    console.log('📊 GENERATING EXCEL SUMMARY');
    console.log('========================================\n');

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('JD→Bradford Invoices');

      // Define columns
      worksheet.columns = [
        { header: 'Invoice #', key: 'invoiceNo', width: 18 },
        { header: 'Job #', key: 'jobNo', width: 18 },
        { header: 'Bradford PO', key: 'bradfordPO', width: 18 },
        { header: 'Invoice Date', key: 'invoiceDate', width: 14 },
        { header: 'Due Date', key: 'dueDate', width: 14 },
        { header: 'Amount', key: 'amount', width: 12 },
        { header: 'Paper Total (lbs)', key: 'paperWeightTotal', width: 18 },
        { header: 'Paper Per 1,000 (lbs)', key: 'paperWeightPer1000', width: 20 },
        { header: 'CPM Rate', key: 'vendorCPM', width: 12 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Calculation', key: 'calculation', width: 50 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF254979' }, // Primary color
      };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 20;

      // Add data rows
      excelData.forEach((row) => {
        worksheet.addRow({
          invoiceNo: row.invoiceNo,
          jobNo: row.jobNo,
          bradfordPO: row.bradfordPO,
          invoiceDate: row.invoiceDate,
          dueDate: row.dueDate,
          amount: row.amount,
          paperWeightTotal: row.paperWeightTotal,
          paperWeightPer1000: row.paperWeightPer1000,
          vendorCPM: row.vendorCPM,
          quantity: row.quantity,
          calculation: row.calculation,
        });
      });

      // Format date columns
      worksheet.getColumn('invoiceDate').numFmt = 'mm/dd/yyyy';
      worksheet.getColumn('dueDate').numFmt = 'mm/dd/yyyy';

      // Format currency columns
      worksheet.getColumn('amount').numFmt = '$#,##0.00';
      worksheet.getColumn('vendorCPM').numFmt = '$#,##0.00';

      // Format number columns
      worksheet.getColumn('paperWeightTotal').numFmt = '#,##0.00';
      worksheet.getColumn('paperWeightPer1000').numFmt = '#,##0.00';
      worksheet.getColumn('quantity').numFmt = '#,##0';

      // Add borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          };
        });
      });

      // Generate Excel buffer
      const excelBuffer = await workbook.xlsx.writeBuffer();

      // Add to attachments
      pdfAttachments.push({
        filename: 'JD-Bradford-Invoice-Summary.xlsx',
        content: Buffer.from(excelBuffer),
      });

      console.log(`✅ Excel summary generated with ${excelData.length} invoices\n`);
    } catch (error: any) {
      console.error(`❌ Failed to generate Excel: ${error.message}\n`);
    }
  }

  // Send email with all PDFs attached
  if (pdfAttachments.length > 0) {
    console.log('\n========================================');
    console.log('📧 SENDING EMAIL WITH UPDATED INVOICES');
    console.log('========================================\n');

    try {
      await sendEmail({
        to: 'steve.gustafson@bgeltd.com',
        cc: 'nick@jdgraphic.com',
        subject: `JD→Bradford Invoices (${pdfAttachments.length - 1} invoices) - Updated Layout with Financial Breakdown`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #254979;">JD→Bradford Invoices - Updated</h2>

            <p>Hello Steve,</p>

            <p>All JD→Bradford invoices have been regenerated with an improved layout that provides clear visibility into costs and margins:</p>

            <ul style="line-height: 1.8;">
              <li><strong>Payment Terms:</strong> Net 10 Days</li>
              <li><strong>Paper Costs & Margin:</strong> Clear breakdown of paper costs, what you charge Impact, and your paper margin</li>
              <li><strong>Production Costs & Margin:</strong> Shows what JD charges you, what you charge Impact, and your production margin</li>
              <li><strong>Invoice Summary:</strong> Prominent display of total amounts (JD charges you, You charge Impact, Your total margin)</li>
              <li><strong>Job Details:</strong> Complete job specifications with proper word wrapping</li>
            </ul>

            <div style="background-color: #f0f4f8; padding: 15px; border-left: 4px solid #1074B3; margin: 20px 0;">
              <strong>Summary:</strong><br>
              ✅ ${success} invoices regenerated successfully<br>
              ${failed > 0 ? `❌ ${failed} invoices failed<br>` : ''}
              📎 ${pdfAttachments.length - 1} PDF files attached<br>
              📊 1 Excel summary sheet attached
            </div>

            <p>All updated invoice PDFs are attached to this email, along with an Excel summary spreadsheet.</p>

            <p style="color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              This email was automatically generated by the Printing Workflow system.
            </p>
          </div>
        `,
        attachments: pdfAttachments,
      });

      console.log(`✅ Email sent successfully to steve.gustafson@bgeltd.com`);
      console.log(`   CC: nick@jdgraphic.com`);
      console.log(`   Attachments: ${pdfAttachments.length} files (${pdfAttachments.length - 1} PDFs + 1 Excel)\n`);
    } catch (error: any) {
      console.error(`❌ Failed to send email: ${error.message}\n`);
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
