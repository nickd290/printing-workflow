/**
 * Complete Invoice Reconciliation Report
 * Run: DATABASE_URL="file:../../packages/db/prisma/dev.db" npx tsx src/scripts/send-complete-invoice-report.ts
 *
 * Generates a comprehensive report of ALL invoices (paid and unpaid) grouped by customer PO,
 * showing the full invoice chain (JD→Bradford, Bradford→Impact, Impact→Customer).
 */

import { prisma } from '@printing-workflow/db';
import ExcelJS from 'exceljs';
import { sendEmail } from '../lib/email.js';

interface InvoiceSummary {
  totalInvoices: number;
  totalPaid: number;
  totalUnpaid: number;
  totalAmountPaid: number;
  totalAmountUnpaid: number;
  byType: {
    jdToBradford: { count: number; amount: number; paid: number; unpaid: number };
    bradfordToImpact: { count: number; amount: number; paid: number; unpaid: number };
    impactToCustomer: { count: number; amount: number; paid: number; unpaid: number };
    other: { count: number; amount: number; paid: number; unpaid: number };
  };
}

async function main() {
  console.log('Starting complete invoice report generation...');
  console.log('Querying ALL invoices from database...\n');

  // Get all invoices with related data
  const invoices = await prisma.invoice.findMany({
    include: {
      job: {
        include: {
          customer: true,
        },
      },
      fromCompany: true,
      toCompany: true,
    },
    orderBy: [
      { job: { customerPONumber: 'asc' } },
      { issuedAt: 'asc' },
    ],
  });

  console.log(`Found ${invoices.length} total invoices\n`);

  // Deduplicate: Keep only the most recent invoice for each job+type combination
  // This prevents duplicate rows when a job has multiple invoices of the same type (e.g., multiple Impact→Customer invoices)
  const invoiceMap = new Map<string, typeof invoices[0]>();

  for (const inv of invoices) {
    // Determine invoice type key
    let typeKey = 'other';
    if (inv.fromCompany?.id === 'jd-graphic' && inv.toCompany?.id === 'bradford') {
      typeKey = 'jd-bradford';
    } else if (inv.fromCompany?.id === 'bradford' && inv.toCompany?.id === 'impact-direct') {
      typeKey = 'bradford-impact';
    } else if (inv.fromCompany?.id === 'impact-direct') {
      typeKey = 'impact-customer';
    }

    // Create unique key: jobId + typeKey
    const uniqueKey = `${inv.jobId}:${typeKey}`;
    const existing = invoiceMap.get(uniqueKey);

    // Keep the invoice with the latest createdAt
    if (!existing || new Date(inv.createdAt) > new Date(existing.createdAt)) {
      invoiceMap.set(uniqueKey, inv);
    }
  }

  // Convert map back to array and sort by PO and issued date
  const deduplicatedInvoices = Array.from(invoiceMap.values()).sort((a, b) => {
    const poCompare = (a.job?.customerPONumber || '').localeCompare(b.job?.customerPONumber || '');
    if (poCompare !== 0) return poCompare;
    return new Date(a.issuedAt || 0).getTime() - new Date(b.issuedAt || 0).getTime();
  });
  console.log(`After deduplication: ${deduplicatedInvoices.length} unique invoices (removed ${invoices.length - deduplicatedInvoices.length} duplicates)\n`);

  // Calculate summary statistics
  const summary: InvoiceSummary = {
    totalInvoices: deduplicatedInvoices.length,
    totalPaid: 0,
    totalUnpaid: 0,
    totalAmountPaid: 0,
    totalAmountUnpaid: 0,
    byType: {
      jdToBradford: { count: 0, amount: 0, paid: 0, unpaid: 0 },
      bradfordToImpact: { count: 0, amount: 0, paid: 0, unpaid: 0 },
      impactToCustomer: { count: 0, amount: 0, paid: 0, unpaid: 0 },
      other: { count: 0, amount: 0, paid: 0, unpaid: 0 },
    },
  };

  // Process invoices and categorize
  for (const inv of deduplicatedInvoices) {
    const amount = parseFloat(inv.amount.toString());
    const isPaid = !!inv.paidAt;

    if (isPaid) {
      summary.totalPaid++;
      summary.totalAmountPaid += amount;
    } else {
      summary.totalUnpaid++;
      summary.totalAmountUnpaid += amount;
    }

    // Determine invoice type
    let typeKey: keyof typeof summary.byType = 'other';
    if (inv.fromCompany?.id === 'jd-graphic' && inv.toCompany?.id === 'bradford') {
      typeKey = 'jdToBradford';
    } else if (inv.fromCompany?.id === 'bradford' && inv.toCompany?.id === 'impact-direct') {
      typeKey = 'bradfordToImpact';
    } else if (inv.fromCompany?.id === 'impact-direct') {
      typeKey = 'impactToCustomer';
    }

    summary.byType[typeKey].count++;
    summary.byType[typeKey].amount += amount;
    if (isPaid) {
      summary.byType[typeKey].paid++;
    } else {
      summary.byType[typeKey].unpaid++;
    }
  }

  console.log('Summary Statistics:');
  console.log(`  Total Invoices: ${summary.totalInvoices}`);
  console.log(`  Paid: ${summary.totalPaid} ($${summary.totalAmountPaid.toFixed(2)})`);
  console.log(`  Unpaid: ${summary.totalUnpaid} ($${summary.totalAmountUnpaid.toFixed(2)})`);
  console.log(`  JD→Bradford: ${summary.byType.jdToBradford.count}`);
  console.log(`  Bradford→Impact: ${summary.byType.bradfordToImpact.count}`);
  console.log(`  Impact→Customer: ${summary.byType.impactToCustomer.count}\n`);

  // Create Excel workbook
  console.log('Generating Excel spreadsheet...');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Invoice Report');

  // Define columns
  worksheet.columns = [
    { header: 'Customer PO #', key: 'po', width: 20 },
    { header: 'Job Number', key: 'job', width: 18 },
    // Job Specifications
    { header: 'Size', key: 'size', width: 18 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Customer CPM', key: 'customerCPM', width: 14 },
    { header: 'Print CPM', key: 'printCPM', width: 12 },
    { header: 'Paper Cost CPM', key: 'paperCostCPM', width: 15 },
    { header: 'Bradford Total CPM', key: 'bradfordTotalCPM', width: 17 },
    { header: 'Paper Type', key: 'paperType', width: 20 },
    { header: 'Total Weight (lbs)', key: 'paperWeightTotal', width: 16 },
    { header: 'Weight per 1000', key: 'paperWeightPer1000', width: 15 },
    // Invoice Details
    { header: 'Invoice Type', key: 'type', width: 22 },
    { header: 'Invoice Number', key: 'invoice', width: 20 },
    { header: 'From Company', key: 'from', width: 22 },
    { header: 'To Company', key: 'to', width: 22 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Issued Date', key: 'issued', width: 15 },
    { header: 'Due Date', key: 'due', width: 15 },
    { header: 'Paid Date', key: 'paid', width: 15 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' }, // Indigo
  };
  headerRow.height = 30;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add invoice data
  let currentRow = 2;
  for (const inv of deduplicatedInvoices) {
    let type = 'Other';
    if (inv.fromCompany?.id === 'jd-graphic' && inv.toCompany?.id === 'bradford') {
      type = 'JD → Bradford';
    } else if (inv.fromCompany?.id === 'bradford' && inv.toCompany?.id === 'impact-direct') {
      type = 'Bradford → Impact';
    } else if (inv.fromCompany?.id === 'impact-direct') {
      type = 'Impact → Customer';
    }

    const isPaid = !!inv.paidAt;

    worksheet.addRow({
      po: inv.job?.customerPONumber || 'NO PO',
      job: inv.job?.jobNo || 'N/A',
      // Job Specifications
      size: inv.job?.sizeName || '',
      quantity: inv.job?.quantity || null,
      customerCPM: inv.job?.customerCPM ? parseFloat(inv.job.customerCPM.toString()) : null,
      printCPM: inv.job?.printCPM ? parseFloat(inv.job.printCPM.toString()) : null,
      paperCostCPM: inv.job?.paperCostCPM ? parseFloat(inv.job.paperCostCPM.toString()) : null,
      bradfordTotalCPM: inv.job?.bradfordTotalCPM ? parseFloat(inv.job.bradfordTotalCPM.toString()) : null,
      paperType: inv.job?.paperType || '',
      paperWeightTotal: inv.job?.paperWeightTotal ? parseFloat(inv.job.paperWeightTotal.toString()) : null,
      paperWeightPer1000: inv.job?.paperWeightPer1000 ? parseFloat(inv.job.paperWeightPer1000.toString()) : null,
      // Invoice Details
      type,
      invoice: inv.invoiceNo,
      from: inv.fromCompany?.name || 'Unknown',
      to: inv.toCompany?.name || 'Unknown',
      amount: parseFloat(inv.amount.toString()),
      status: isPaid ? 'PAID' : 'UNPAID',
      issued: inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : '',
      due: inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : '',
      paid: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '',
    });

    // Style status cell based on paid/unpaid (now column Q after adding 9 job spec columns)
    const statusCell = worksheet.getCell(`Q${currentRow}`);
    statusCell.font = { bold: true, color: { argb: isPaid ? 'FF059669' : 'FFDC2626' } };
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isPaid ? 'FFD1FAE5' : 'FFFEE2E2' }, // Light green or light red
    };
    statusCell.alignment = { horizontal: 'center' };

    currentRow++;
  }

  // Format CPM columns as currency
  ['customerCPM', 'printCPM', 'paperCostCPM', 'bradfordTotalCPM'].forEach((colKey) => {
    worksheet.getColumn(colKey).eachCell((cell, rowNumber) => {
      if (rowNumber > 1 && cell.value !== null) {
        cell.numFmt = '$#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  // Format weight columns as numbers with 2 decimal places
  ['paperWeightTotal', 'paperWeightPer1000'].forEach((colKey) => {
    worksheet.getColumn(colKey).eachCell((cell, rowNumber) => {
      if (rowNumber > 1 && cell.value !== null) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  // Format quantity column as integer
  worksheet.getColumn('quantity').eachCell((cell, rowNumber) => {
    if (rowNumber > 1 && cell.value !== null) {
      cell.numFmt = '#,##0';
      cell.alignment = { horizontal: 'right' };
    }
  });

  // Format amount column as currency
  worksheet.getColumn('amount').eachCell((cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.numFmt = '$#,##0.00';
      cell.alignment = { horizontal: 'right' };
    }
  });

  // Add auto-filter (now extends to column T - 20 columns total)
  worksheet.autoFilter = {
    from: 'A1',
    to: 'T1',
  };

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Generate Excel buffer
  const buffer = await workbook.xlsx.writeBuffer();
  console.log(`Excel created: ${(buffer.length / 1024).toFixed(2)} KB\n`);

  // Create HTML email content
  const htmlContent = `
    <h2>Invoice Reconciliation Report</h2>
    <p>Complete report of all invoices in the system, grouped by customer PO number.</p>

    <div class="info-box" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; margin-top: 25px;">
      <div style="text-align: center;">
        <p style="font-size: 16px; font-weight: bold; color: #ffffff; margin: 0;">Total Invoices</p>
        <p style="font-size: 32px; font-weight: bold; color: #ffffff; margin: 10px 0;">${summary.totalInvoices}</p>
      </div>
    </div>

    <h3 style="margin-top: 30px; color: #1a1a1a; font-size: 20px;">Payment Status</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
      <thead>
        <tr style="background-color: #f7fafc; border-bottom: 2px solid #e2e8f0;">
          <th style="padding: 12px; text-align: left;">Status</th>
          <th style="padding: 12px; text-align: center;">Count</th>
          <th style="padding: 12px; text-align: right;">Total Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #e2e8f0; background-color: #d1fae5;">
          <td style="padding: 12px; font-weight: 600; color: #059669;">✅ Paid</td>
          <td style="padding: 12px; text-align: center; font-weight: 600;">${summary.totalPaid}</td>
          <td style="padding: 12px; text-align: right; font-weight: 600; color: #059669;">$${summary.totalAmountPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fee2e2;">
          <td style="padding: 12px; font-weight: 600; color: #dc2626;">⚠️ Unpaid</td>
          <td style="padding: 12px; text-align: center; font-weight: 600;">${summary.totalUnpaid}</td>
          <td style="padding: 12px; text-align: right; font-weight: 600; color: #dc2626;">$${summary.totalAmountUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr style="background-color: #f7fafc; border-top: 2px solid #4f46e5;">
          <td style="padding: 12px; font-weight: bold; color: #1a1a1a;">Total</td>
          <td style="padding: 12px; text-align: center; font-weight: bold;">${summary.totalInvoices}</td>
          <td style="padding: 12px; text-align: right; font-weight: bold; color: #4f46e5;">$${(summary.totalAmountPaid + summary.totalAmountUnpaid).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>

    <h3 style="margin-top: 30px; color: #1a1a1a; font-size: 20px;">Breakdown by Invoice Type</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
      <thead>
        <tr style="background-color: #f7fafc; border-bottom: 2px solid #e2e8f0;">
          <th style="padding: 12px; text-align: left;">Invoice Type</th>
          <th style="padding: 12px; text-align: center;">Total</th>
          <th style="padding: 12px; text-align: center;">Paid</th>
          <th style="padding: 12px; text-align: center;">Unpaid</th>
          <th style="padding: 12px; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px; font-weight: 600;">JD Graphic → Bradford</td>
          <td style="padding: 12px; text-align: center;">${summary.byType.jdToBradford.count}</td>
          <td style="padding: 12px; text-align: center; color: #059669;">${summary.byType.jdToBradford.paid}</td>
          <td style="padding: 12px; text-align: center; color: #dc2626;">${summary.byType.jdToBradford.unpaid}</td>
          <td style="padding: 12px; text-align: right; font-weight: 600;">$${summary.byType.jdToBradford.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px; font-weight: 600;">Bradford → Impact Direct</td>
          <td style="padding: 12px; text-align: center;">${summary.byType.bradfordToImpact.count}</td>
          <td style="padding: 12px; text-align: center; color: #059669;">${summary.byType.bradfordToImpact.paid}</td>
          <td style="padding: 12px; text-align: center; color: #dc2626;">${summary.byType.bradfordToImpact.unpaid}</td>
          <td style="padding: 12px; text-align: right; font-weight: 600;">$${summary.byType.bradfordToImpact.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px; font-weight: 600;">Impact → Customer</td>
          <td style="padding: 12px; text-align: center;">${summary.byType.impactToCustomer.count}</td>
          <td style="padding: 12px; text-align: center; color: #059669;">${summary.byType.impactToCustomer.paid}</td>
          <td style="padding: 12px; text-align: center; color: #dc2626;">${summary.byType.impactToCustomer.unpaid}</td>
          <td style="padding: 12px; text-align: right; font-weight: 600;">$${summary.byType.impactToCustomer.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        ${summary.byType.other.count > 0 ? `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px; font-weight: 600;">Other</td>
          <td style="padding: 12px; text-align: center;">${summary.byType.other.count}</td>
          <td style="padding: 12px; text-align: center; color: #059669;">${summary.byType.other.paid}</td>
          <td style="padding: 12px; text-align: center; color: #dc2626;">${summary.byType.other.unpaid}</td>
          <td style="padding: 12px; text-align: right; font-weight: 600;">$${summary.byType.other.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        </tr>
        ` : ''}
      </tbody>
    </table>

    <div class="divider"></div>

    <p style="color: #718096; font-size: 14px; margin-top: 25px;">
      <strong>📎 Attachment:</strong> Complete invoice details with job specifications (size, quantity, CPM values, and paper usage)
      are included in the attached Excel spreadsheet, grouped by customer PO number for easy reconciliation and accuracy verification.
    </p>

    <p style="color: #718096; font-size: 14px;">
      <strong>📊 Report Date:</strong> ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}
    </p>
  `;

  // Send email to both recipients
  console.log('Sending email...');
  const today = new Date().toISOString().split('T')[0];

  await sendEmail({
    to: 'nick@jdgraphic.com',
    cc: 'brandon@impactdirectprinting.com',
    subject: 'Invoice Reconciliation Report',
    html: htmlContent,
    attachments: [
      {
        filename: `Invoice-Report-${today}.xlsx`,
        content: Buffer.from(buffer),
      },
    ],
  });

  console.log('\n✅ Complete invoice report sent successfully!');
  console.log(`   Recipients: nick@jdgraphic.com, brandon@impactdirectprinting.com`);
  console.log(`   Attachment: Invoice-Report-${today}.xlsx`);
}

main()
  .catch((error) => {
    console.error('\n❌ Error generating invoice report:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
