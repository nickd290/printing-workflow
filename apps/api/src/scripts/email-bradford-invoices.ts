/**
 * Email JD→Bradford Invoices to Steve
 *
 * This script emails all JD→Bradford invoices (with Net 10 payment terms)
 * to Steve Gustafson with PDF attachments.
 *
 * Run with: DATABASE_URL="file:/Users/nicholasdeblasio/printing-workflow/packages/db/prisma/dev.db" npx tsx apps/api/src/scripts/email-bradford-invoices.ts
 */

import { prisma } from '@printing-workflow/db';
import { sendEmail } from '../lib/email.js';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../env.js';

const COMPANY_IDS = {
  JD_GRAPHIC: 'jd-graphic',
  BRADFORD: 'bradford',
  IMPACT_DIRECT: 'impact-direct',
};

interface InvoiceData {
  jobNo: string;
  jobId: string;
  customerPO: string | null;
  invoiceNo: string;
  amount: string;
  pdfPath: string;
  fileName: string;
}

async function main() {
  console.log('\n========================================');
  console.log('📧 EMAILING JD→BRADFORD INVOICES TO STEVE');
  console.log('========================================\n');

  // Fetch all JD→Bradford invoices
  const jdToBradfordInvoices = await prisma.invoice.findMany({
    where: {
      fromCompanyId: COMPANY_IDS.JD_GRAPHIC,
      toCompanyId: COMPANY_IDS.BRADFORD,
    },
    include: {
      job: true,
      pdfFile: true,
    },
    orderBy: { job: { jobNo: 'asc' } },
  });

  console.log(`Found ${jdToBradfordInvoices.length} JD→Bradford invoices\n`);

  // Process invoices
  const invoices: InvoiceData[] = [];
  const uploadDir = env.UPLOAD_DIR || './uploads';

  for (const invoice of jdToBradfordInvoices) {
    const pdfPath = invoice.pdfFile ? path.join(uploadDir, invoice.pdfFile.objectKey) : '';

    invoices.push({
      jobNo: invoice.job.jobNo,
      jobId: invoice.jobId || '',
      customerPO: invoice.job.customerPONumber,
      invoiceNo: invoice.invoiceNo,
      amount: invoice.amount.toString(),
      pdfPath,
      fileName: `${invoice.invoiceNo}.pdf`,
    });
  }

  // Build email content
  let htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <h2 style="color: #254979;">JD→Bradford Invoice Summary</h2>
      <p>Hi Steve,</p>
      <p>Please find attached all <strong>JD Graphic → Bradford</strong> invoices with <strong>Net 10 payment terms</strong>.</p>
      <p style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0;">
        <strong>Note:</strong> These invoices have been updated to reflect <strong>Net 10 Days</strong> payment terms instead of Net 30.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #254979; color: white;">
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Job #</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Customer PO</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Invoice #</th>
            <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Amount</th>
          </tr>
        </thead>
        <tbody>
  `;

  // Collect attachments
  const attachments: Array<{ filename: string; content: Buffer }> = [];
  let totalAmount = 0;

  for (const invoice of invoices) {
    htmlContent += `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${invoice.jobNo}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${invoice.customerPO || 'N/A'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${invoice.invoiceNo}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${parseFloat(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
    `;

    // Load PDF file as attachment
    try {
      if (invoice.pdfPath) {
        const pdfBuffer = await fs.readFile(invoice.pdfPath);
        attachments.push({
          filename: invoice.fileName,
          content: pdfBuffer,
        });
        totalAmount += parseFloat(invoice.amount);
      }
    } catch (error: any) {
      console.error(`⚠️  Could not load PDF for job ${invoice.jobNo}: ${error.message}`);
    }
  }

  htmlContent += `
        </tbody>
      </table>

      <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
        <h3 style="margin-top: 0; color: #254979;">Summary</h3>
        <p><strong>Total Invoices:</strong> ${invoices.length}</p>
        <p><strong>Total Amount:</strong> $${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        <p><strong>Payment Terms:</strong> Net 10 Days</p>
      </div>

      <p>All invoice PDFs are attached to this email.</p>

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        This email was generated automatically by the Printing Workflow system.
      </p>
    </div>
  `;

  // Send email
  console.log(`Preparing to send email with ${attachments.length} PDF attachments...`);
  console.log(`Total email size: ${(attachments.reduce((sum, att) => sum + att.content.length, 0) / 1024 / 1024).toFixed(2)} MB\n`);

  try {
    await sendEmail({
      to: 'steve.gustafson@bgeltd.com',
      cc: 'nick@jdgraphic.com',
      subject: `JD→Bradford Invoice Summary - ${invoices.length} Invoices (Net 10 Days)`,
      html: htmlContent,
      attachments,
    });

    console.log('✅ Email sent successfully!\n');
  } catch (error: any) {
    console.error(`❌ Failed to send email: ${error.message}\n`);
    throw error;
  }

  console.log('========================================');
  console.log('📊 SUMMARY');
  console.log('========================================');
  console.log(`Total Invoices: ${invoices.length}`);
  console.log(`PDFs Attached: ${attachments.length}`);
  console.log(`Total Amount: $${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log('========================================\n');

  await prisma.$disconnect();
}

main();
