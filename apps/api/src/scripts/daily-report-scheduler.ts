import cron from 'node-cron';
import { PrismaClient } from '@printing-workflow/db';
import XLSX from 'xlsx';
import { sendEmail } from '../lib/email.js';

const prisma = new PrismaClient();

/**
 * Daily Report Scheduler
 * Sends daily summary email at 2PM CST with Excel attachment
 */

const RECIPIENTS = process.env.DAILY_REPORT_RECIPIENTS || 'nick@jdgraphic.com,steve.gustafson@bgeltd.com,john@jdgraphic.com,jim@jdgraphic.com';
const ENABLED = process.env.DAILY_REPORT_ENABLED !== 'false';

/**
 * Generate daily summary Excel report
 * Reuses the same logic as the /daily-summary endpoint
 */
async function generateDailySummaryReport(reportDate: string): Promise<Buffer> {
  console.log(`[DAILY SCHEDULER] Generating report for ${reportDate}...`);

  // Fetch ALL jobs with related data
  const allJobs = await prisma.job.findMany({
    include: {
      customer: true,
      purchaseOrders: {
        include: {
          originCompany: true,
          targetCompany: true,
        },
      },
      invoices: {
        include: {
          fromCompany: true,
          toCompany: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`[DAILY SCHEDULER] Found ${allJobs.length} total jobs`);

  // Create Excel workbook
  const workbook = XLSX.utils.book_new();

  // SHEET 1: ALL JOBS
  const allJobsData = allJobs.map((job) => ({
    'Job Number': job.jobNo,
    'Customer': job.customer.name,
    'Status': job.status,
    'Created Date': job.createdAt.toLocaleDateString(),
    'Completed Date': job.completedAt ? job.completedAt.toLocaleDateString() : 'In Progress',
    'Size': job.sizeName || '',
    'Quantity': job.quantity || 0,
    'Paper Type': job.paperType || '',
    'Paper Weight (lbs)': job.paperWeightTotal ? Number(job.paperWeightTotal).toFixed(2) : '',
    'JD Supplies Paper': job.jdSuppliesPaper ? 'Yes' : 'No',
    'Customer Total': job.customerTotal ? Number(job.customerTotal).toFixed(2) : '',
    'Bradford Total': job.bradfordTotal ? Number(job.bradfordTotal).toFixed(2) : '',
    'JD Total': job.jdTotal ? Number(job.jdTotal).toFixed(2) : '',
    'Impact Margin': job.impactMargin ? Number(job.impactMargin).toFixed(2) : '',
    'Bradford Margin': job.bradfordTotalMargin ? Number(job.bradfordTotalMargin).toFixed(2) : '',
  }));

  const allJobsSheet = XLSX.utils.json_to_sheet(allJobsData);
  XLSX.utils.book_append_sheet(workbook, allJobsSheet, 'All Jobs');

  // SHEET 2: IMPACT DIRECT SUMMARY
  const impactJobs = allJobs.filter(j => j.customerTotal && Number(j.customerTotal) > 0);
  const totalRevenue = impactJobs.reduce((sum, j) => sum + Number(j.customerTotal || 0), 0);
  const totalCosts = impactJobs.reduce((sum, j) => sum + Number(j.bradfordTotal || 0), 0);
  const totalImpactMargin = impactJobs.reduce((sum, j) => sum + Number(j.impactMargin || 0), 0);
  const marginPercent = totalRevenue > 0 ? ((totalImpactMargin / totalRevenue) * 100).toFixed(2) : '0.00';

  const jobsByStatus = allJobs.reduce((acc: any, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});

  const impactSummaryData = [
    { 'Metric': 'IMPACT DIRECT SUMMARY', 'Value': '' },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'Total Revenue (Customer Invoices)', 'Value': `$${totalRevenue.toFixed(2)}` },
    { 'Metric': 'Total Costs (Bradford Invoices)', 'Value': `$${totalCosts.toFixed(2)}` },
    { 'Metric': 'Total Margin', 'Value': `$${totalImpactMargin.toFixed(2)}` },
    { 'Metric': 'Margin %', 'Value': `${marginPercent}%` },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'Jobs with Revenue', 'Value': impactJobs.length },
    { 'Metric': 'Average Margin per Job', 'Value': `$${(totalImpactMargin / (impactJobs.length || 1)).toFixed(2)}` },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'JOB COUNT BY STATUS', 'Value': '' },
    ...Object.entries(jobsByStatus).map(([status, count]) => ({
      'Metric': status,
      'Value': count,
    })),
  ];

  const impactSummarySheet = XLSX.utils.json_to_sheet(impactSummaryData);
  XLSX.utils.book_append_sheet(workbook, impactSummarySheet, 'Impact Direct Summary');

  // SHEET 3: BRADFORD SUMMARY
  const bradfordJobs = allJobs.filter(j => j.bradfordTotal && Number(j.bradfordTotal) > 0);
  const totalBradfordRevenue = bradfordJobs.reduce((sum, j) => sum + Number(j.bradfordTotal || 0), 0);
  const totalBradfordCosts = bradfordJobs.reduce((sum, j) => sum + Number(j.jdTotal || 0), 0);
  const totalBradfordPrintMargin = bradfordJobs.reduce((sum, j) => sum + Number(j.bradfordPrintMargin || 0), 0);
  const totalBradfordPaperMargin = bradfordJobs.reduce((sum, j) => sum + Number(j.bradfordPaperMargin || 0), 0);
  const totalBradfordMargin = bradfordJobs.reduce((sum, j) => sum + Number(j.bradfordTotalMargin || 0), 0);
  const bradfordMarginPercent = totalBradfordRevenue > 0 ? ((totalBradfordMargin / totalBradfordRevenue) * 100).toFixed(2) : '0.00';
  const totalPaperUsage = allJobs.reduce((sum, j) => sum + Number(j.paperWeightTotal || 0), 0);

  const paperByType: any = {};
  allJobs.forEach(job => {
    if (job.paperType && job.paperWeightTotal) {
      paperByType[job.paperType] = (paperByType[job.paperType] || 0) + Number(job.paperWeightTotal);
    }
  });

  const jdSuppliedJobs = allJobs.filter(j => j.jdSuppliesPaper);
  const bradfordSuppliedJobs = allJobs.filter(j => !j.jdSuppliesPaper && j.paperWeightTotal);

  const bradfordSummaryData = [
    { 'Metric': 'BRADFORD SUMMARY', 'Value': '' },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'Total Revenue (Impact Invoices)', 'Value': `$${totalBradfordRevenue.toFixed(2)}` },
    { 'Metric': 'Total Costs (JD Invoices)', 'Value': `$${totalBradfordCosts.toFixed(2)}` },
    { 'Metric': 'Print Margin', 'Value': `$${totalBradfordPrintMargin.toFixed(2)}` },
    { 'Metric': 'Paper Markup', 'Value': `$${totalBradfordPaperMargin.toFixed(2)}` },
    { 'Metric': 'Total Margin', 'Value': `$${totalBradfordMargin.toFixed(2)}` },
    { 'Metric': 'Margin %', 'Value': `${bradfordMarginPercent}%` },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'PAPER USAGE', 'Value': '' },
    { 'Metric': 'Total Paper (lbs)', 'Value': totalPaperUsage.toFixed(2) },
    { 'Metric': 'Jobs with Paper', 'Value': allJobs.filter(j => j.paperWeightTotal).length },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'PAPER SUPPLIER BREAKDOWN', 'Value': '' },
    { 'Metric': 'Bradford Supplied Jobs', 'Value': bradfordSuppliedJobs.length },
    { 'Metric': 'JD Supplied Jobs', 'Value': jdSuppliedJobs.length },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'PAPER BY TYPE', 'Value': '' },
    ...Object.entries(paperByType)
      .sort(([, a]: any, [, b]: any) => b - a)
      .map(([type, weight]) => ({
        'Metric': type,
        'Value': `${Number(weight).toFixed(2)} lbs`,
      })),
  ];

  const bradfordSummarySheet = XLSX.utils.json_to_sheet(bradfordSummaryData);
  XLSX.utils.book_append_sheet(workbook, bradfordSummarySheet, 'Bradford Summary');

  // SHEET 4: JD GRAPHIC SUMMARY
  const jdJobs = allJobs.filter(j => j.jdTotal && Number(j.jdTotal) > 0);
  const totalJDRevenue = jdJobs.reduce((sum, j) => sum + Number(j.jdTotal || 0), 0);

  const jdSummaryData = [
    { 'Metric': 'JD GRAPHIC SUMMARY', 'Value': '' },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'Total Revenue (Bradford POs)', 'Value': `$${totalJDRevenue.toFixed(2)}` },
    { 'Metric': 'Total Jobs', 'Value': jdJobs.length },
    { 'Metric': 'Average per Job', 'Value': `$${(totalJDRevenue / (jdJobs.length || 1)).toFixed(2)}` },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'PAPER SUPPLY', 'Value': '' },
    { 'Metric': 'JD Supplied Paper Jobs', 'Value': jdSuppliedJobs.length },
    { 'Metric': 'Bradford Supplied Paper Jobs', 'Value': bradfordSuppliedJobs.length },
  ];

  const jdSummarySheet = XLSX.utils.json_to_sheet(jdSummaryData);
  XLSX.utils.book_append_sheet(workbook, jdSummarySheet, 'JD Graphic Summary');

  // SHEET 5: OVERALL SUMMARY
  const overallSummaryData = [
    { 'Metric': 'DAILY SUMMARY REPORT', 'Value': reportDate },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'REVENUE FLOW', 'Value': '' },
    { 'Metric': 'Customer → Impact Direct', 'Value': `$${totalRevenue.toFixed(2)}` },
    { 'Metric': 'Impact Direct → Bradford', 'Value': `$${totalBradfordRevenue.toFixed(2)}` },
    { 'Metric': 'Bradford → JD Graphic', 'Value': `$${totalJDRevenue.toFixed(2)}` },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'MARGINS BY ENTITY', 'Value': '' },
    { 'Metric': 'Impact Direct Margin', 'Value': `$${totalImpactMargin.toFixed(2)}` },
    { 'Metric': 'Bradford Margin', 'Value': `$${totalBradfordMargin.toFixed(2)}` },
    { 'Metric': 'Total System Margin', 'Value': `$${(totalImpactMargin + totalBradfordMargin).toFixed(2)}` },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'JOB STATISTICS', 'Value': '' },
    { 'Metric': 'Total Jobs', 'Value': allJobs.length },
    { 'Metric': 'Jobs with Revenue', 'Value': impactJobs.length },
    { 'Metric': 'Completed Jobs', 'Value': allJobs.filter(j => j.status === 'COMPLETED').length },
    { 'Metric': 'Active Jobs', 'Value': allJobs.filter(j => j.status === 'IN_PROGRESS').length },
    { 'Metric': '', 'Value': '' },
    { 'Metric': 'PAPER STATISTICS', 'Value': '' },
    { 'Metric': 'Total Paper Used', 'Value': `${totalPaperUsage.toFixed(2)} lbs` },
    { 'Metric': 'Jobs with Paper', 'Value': allJobs.filter(j => j.paperWeightTotal).length },
    { 'Metric': 'Bradford Supplied', 'Value': bradfordSuppliedJobs.length },
    { 'Metric': 'JD Supplied', 'Value': jdSuppliedJobs.length },
  ];

  const overallSummarySheet = XLSX.utils.json_to_sheet(overallSummaryData);
  XLSX.utils.book_append_sheet(workbook, overallSummarySheet, 'Overall Summary');

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // Return summary stats for email
  return Buffer.from(excelBuffer);
}

/**
 * Send daily summary email with Excel attachment
 */
export async function sendDailySummaryEmail() {
  try {
    const reportDate = new Date().toISOString().split('T')[0];
    const filename = `Daily_Summary_${reportDate}.xlsx`;

    console.log('\n========================================');
    console.log('📧 [DAILY SCHEDULER] Starting daily summary email');
    console.log('Time:', new Date().toISOString());
    console.log('Recipients:', RECIPIENTS);
    console.log('========================================\n');

    // Generate report
    const excelBuffer = await generateDailySummaryReport(reportDate);

    console.log('[DAILY SCHEDULER] Excel file generated:', filename);
    console.log('[DAILY SCHEDULER] File size:', excelBuffer.length, 'bytes');

    // Get quick stats for email body
    const allJobs = await prisma.job.findMany({
      select: {
        status: true,
        customerTotal: true,
        impactMargin: true,
        bradfordTotalMargin: true,
      },
    });

    const totalJobs = allJobs.length;
    const completedJobs = allJobs.filter(j => j.status === 'COMPLETED').length;
    const totalRevenue = allJobs.reduce((sum, j) => sum + Number(j.customerTotal || 0), 0);
    const totalImpactMargin = allJobs.reduce((sum, j) => sum + Number(j.impactMargin || 0), 0);
    const totalBradfordMargin = allJobs.reduce((sum, j) => sum + Number(j.bradfordTotalMargin || 0), 0);

    // Send email to all recipients
    const emailResult = await sendEmail({
      to: RECIPIENTS,
      subject: `Daily Summary Report - ${new Date().toLocaleDateString()}`,
      fromName: 'IDP Report System',
      html: `
        <h2>Daily Summary Report</h2>
        <p>Please find attached the daily summary report for <strong>${new Date().toLocaleDateString()}</strong>.</p>

        <h3>Quick Summary:</h3>
        <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Jobs</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${totalJobs}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Completed Jobs</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${completedJobs}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Revenue</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">$${totalRevenue.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Impact Direct Margin</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">$${totalImpactMargin.toFixed(2)}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Bradford Margin</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">$${totalBradfordMargin.toFixed(2)}</td>
          </tr>
        </table>

        <h3>Report Contents:</h3>
        <p>The attached Excel file contains 5 detailed sheets:</p>
        <ul>
          <li><strong>All Jobs:</strong> Complete list of all jobs with financials</li>
          <li><strong>Impact Direct Summary:</strong> Revenue, costs, and margins</li>
          <li><strong>Bradford Summary:</strong> Margins, paper usage, and breakdown</li>
          <li><strong>JD Graphic Summary:</strong> Revenue and paper supply details</li>
          <li><strong>Overall Summary:</strong> System-wide totals and statistics</li>
        </ul>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This report is automatically generated daily at 2PM CST.
          For questions or issues, please contact your system administrator.
        </p>
      `,
      attachments: [
        {
          filename,
          content: excelBuffer,
        },
      ],
    });

    console.log('[DAILY SCHEDULER] ✅ Email sent successfully!');
    console.log('[DAILY SCHEDULER] Email result:', emailResult);

  } catch (error: any) {
    console.error('[DAILY SCHEDULER] ❌ Error sending daily summary email:', error);
    console.error('[DAILY SCHEDULER] Error stack:', error.stack);
  }
}

/**
 * Start the daily report scheduler
 * Runs daily at 2PM CST (14:00 America/Chicago timezone)
 */
export function startDailyReportScheduler() {
  if (!ENABLED) {
    console.log('[DAILY SCHEDULER] Daily report scheduler is DISABLED');
    return;
  }

  console.log('\n========================================');
  console.log('📅 [DAILY SCHEDULER] Initializing...');
  console.log('Schedule: Daily at 2PM CST');
  console.log('Recipients:', RECIPIENTS);
  console.log('========================================\n');

  // Schedule: Daily at 2PM CST
  // Cron: '0 14 * * *' = At 14:00 (2PM) every day
  // Timezone: America/Chicago (CST/CDT)
  const task = cron.schedule(
    '0 14 * * *',
    () => {
      console.log('[DAILY SCHEDULER] Triggering scheduled daily summary email...');
      sendDailySummaryEmail();
    },
    {
      scheduled: true,
      timezone: 'America/Chicago',
    }
  );

  console.log('[DAILY SCHEDULER] ✅ Scheduler started successfully');
  console.log('[DAILY SCHEDULER] Next run: Tomorrow at 2PM CST\n');

  // Allow manual triggering for testing
  return {
    task,
    sendNow: sendDailySummaryEmail,
  };
}
