/**
 * Invoice Reconciliation Summary - Simple Version
 * Run: DATABASE_URL="file:../../packages/db/prisma/dev.db" npx tsx src/scripts/send-invoice-reconciliation-summary.ts
 */

import { prisma } from '@printing-workflow/db';
import ExcelJS from 'exceljs';
import { sendEmail } from '../lib/email.js';

async function main() {
  console.log('Starting invoice reconciliation...');

  // Get all invoices
  const invoices = await prisma.invoice.findMany({
    include: {
      job: true,
      fromCompany: true,
      toCompany: true,
    },
    orderBy: [
      { job: { customerPONumber: 'asc' } },
      { issuedAt: 'asc' },
    ],
  });

  console.log(`Found ${invoices.length} invoices`);

  // Create Excel
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Invoices');

  // Headers
  worksheet.columns = [
    { header: 'Customer PO', key: 'po', width: 18 },
    { header: 'Job #', key: 'job', width: 15 },
    { header: 'Type', key: 'type', width: 20 },
    { header: 'Invoice #', key: 'invoice', width: 18 },
    { header: 'From', key: 'from', width: 20 },
    { header: 'To', key: 'to', width: 20 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Issued', key: 'issued', width: 15 },
    { header: 'Due', key: 'due', width: 15 },
    { header: 'Paid', key: 'paid', width: 15 },
  ];

  // Style header
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  worksheet.getRow(1).height = 25;

  // Add data
  for (const inv of invoices) {
    let type = 'Other';
    if (inv.fromCompany?.id === 'jd-graphic' && inv.toCompany?.id === 'bradford') type = 'JD → Bradford';
    else if (inv.fromCompany?.id === 'bradford' && inv.toCompany?.id === 'impact-direct') type = 'Bradford → Impact';
    else if (inv.fromCompany?.id === 'impact-direct') type = 'Impact → Customer';

    worksheet.addRow({
      po: inv.job?.customerPONumber || 'NO PO',
      job: inv.job?.jobNo || 'N/A',
      type,
      invoice: inv.invoiceNo,
      from: inv.fromCompany?.name || 'Unknown',
      to: inv.toCompany?.name || 'Unknown',
      amount: parseFloat(inv.amount.toString()),
      status: inv.paidAt ? 'PAID' : 'UNPAID',
      issued: inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : '',
      due: inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : '',
      paid: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '',
    });
  }

  // Format amounts
  worksheet.getColumn('amount').eachCell((cell, rowNumber) => {
    if (rowNumber > 1) cell.numFmt = '$#,##0.00';
  });

  // Auto-filter
  worksheet.autoFilter = { from: 'A1', to: 'K1' };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  console.log(`Excel created: ${(buffer.length / 1024).toFixed(2)} KB`);

  // Send email
  await sendEmail({
    to: 'nick@jdgraphic.com',
    cc: 'brandon@impactdirectprinting.com',
    subject: `Invoice Reconciliation - ${new Date().toLocaleDateString()}`,
    html: `
      <h2>Invoice Reconciliation Report</h2>
      <p>Please find attached the complete invoice reconciliation grouped by customer PO number.</p>
      <p><strong>Total Invoices:</strong> ${invoices.length}</p>
      <p>The Excel file contains all invoice details for easy reconciliation.</p>
    `,
    attachments: [{
      filename: `Invoice-Reconciliation-${new Date().toISOString().split('T')[0]}.xlsx`,
      content: Buffer.from(buffer),
    }],
  });

  console.log('✅ Email sent!');
}

main().catch(console.error);
