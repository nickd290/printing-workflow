import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@printing-workflow/db';
import XLSX from 'xlsx';
import { sendEmail } from '../lib/email.js';
import { sendDailySummaryEmail } from '../scripts/daily-report-scheduler.js';

const prisma = new PrismaClient();

const COMPANY_IDS = {
  JD_GRAPHIC: 'jd-graphic',
  BRADFORD: 'bradford',
  IMPACT_DIRECT: 'impact-direct',
};

const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/reports/bradford/dashboard-metrics
   * Get overview metrics for Bradford dashboard
   */
  fastify.get('/bradford/dashboard-metrics', async (request, reply) => {
    try {
      // Get all Bradford-related jobs
      const allBradfordJobs = await prisma.job.findMany({
        where: {
          purchaseOrders: {
            some: {
              OR: [
                { targetCompanyId: COMPANY_IDS.BRADFORD },
                { originCompanyId: COMPANY_IDS.BRADFORD },
              ],
            },
          },
        },
        include: {
          purchaseOrders: {
            include: {
              originCompany: true,
              targetCompany: true,
            },
          },
        },
      });

      // Count active jobs (not completed or cancelled)
      const activeJobs = allBradfordJobs.filter(
        (job) => !['COMPLETED', 'CANCELLED'].includes(job.status)
      );

      // Count jobs needing Bradford→JD PO
      const jobsNeedingPO = allBradfordJobs.filter((job) => {
        const hasIncomingPO = job.purchaseOrders.some(
          (po) => po.targetCompanyId === COMPANY_IDS.BRADFORD
        );
        const hasOutgoingPO = job.purchaseOrders.some(
          (po) => po.originCompanyId === COMPANY_IDS.BRADFORD
        );
        return hasIncomingPO && !hasOutgoingPO && !['COMPLETED', 'CANCELLED'].includes(job.status);
      });

      // Calculate current month margin
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);

      const currentMonthJobs = await prisma.job.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: currentMonthStart,
          },
          invoices: {
            some: {
              OR: [
                { fromCompanyId: COMPANY_IDS.BRADFORD },
                { toCompanyId: COMPANY_IDS.BRADFORD },
              ],
            },
          },
        },
      });

      const currentMonthMargin = currentMonthJobs.reduce((sum, job) => {
        const margin = job.bradfordTotalMargin ? parseFloat(job.bradfordTotalMargin.toString()) : 0;
        return sum + margin;
      }, 0);

      // Calculate current month paper usage
      const currentMonthPaperUsage = currentMonthJobs.reduce((sum, job) => {
        const paperWeight = job.paperWeightTotal ? parseFloat(job.paperWeightTotal.toString()) : 0;
        return sum + paperWeight;
      }, 0);

      reply.send({
        activeJobsCount: activeJobs.length,
        jobsNeedingPOCount: jobsNeedingPO.length,
        currentMonthMargin,
        currentMonthPaperUsage,
      });
    } catch (error: any) {
      console.error('Error generating Bradford dashboard metrics:', error);
      reply.status(500).send({
        error: error.message || 'Failed to generate metrics',
      });
    }
  });

  /**
   * GET /api/reports/bradford/paper-margins
   * Get paper usage and margin analysis for Bradford
   */
  fastify.get('/bradford/paper-margins', async (request, reply) => {
    try {
      // Get all completed jobs with invoices
      const jobs = await prisma.job.findMany({
        where: {
          status: 'COMPLETED',
          invoices: {
            some: {
              OR: [
                { fromCompanyId: COMPANY_IDS.BRADFORD },
                { toCompanyId: COMPANY_IDS.BRADFORD },
              ],
            },
          },
        },
        include: {
          invoices: {
            include: {
              fromCompany: true,
              toCompany: true,
            },
          },
        },
      });

      // Calculate paper usage by size
      const paperBySize: Record<string, number> = {};
      let totalPaper = 0;

      jobs.forEach((job) => {
        const size = job.sizeName || 'Unknown';
        const quantity = job.quantity || 0;
        paperBySize[size] = (paperBySize[size] || 0) + quantity;
        totalPaper += quantity;
      });

      // Calculate margins using job fields (includes paper + print margins)
      const margins: any[] = [];
      let totalMargin = 0;
      let totalPaperMargin = 0;
      let totalPrintMargin = 0;

      jobs.forEach((job) => {
        // Use the pre-calculated Bradford margins from job fields
        const bradfordTotalMargin = job.bradfordTotalMargin ? parseFloat(job.bradfordTotalMargin.toString()) : 0;
        const bradfordPaperMargin = job.bradfordPaperMargin ? parseFloat(job.bradfordPaperMargin.toString()) : 0;
        // Calculate print margin if not populated: total - paper
        let bradfordPrintMargin = job.bradfordPrintMargin ? parseFloat(job.bradfordPrintMargin.toString()) : 0;
        if (bradfordPrintMargin === 0 && bradfordTotalMargin > 0 && bradfordPaperMargin > 0) {
          bradfordPrintMargin = bradfordTotalMargin - bradfordPaperMargin;
        }
        const customerTotal = job.customerTotal ? parseFloat(job.customerTotal.toString()) : 0;
        const paperCostTotal = job.paperCostTotal ? parseFloat(job.paperCostTotal.toString()) : 0;
        const paperChargedTotal = job.paperChargedTotal ? parseFloat(job.paperChargedTotal.toString()) : 0;
        const jdTotal = job.jdTotal ? parseFloat(job.jdTotal.toString()) : 0;

        // Only include jobs with valid margin data
        if (bradfordTotalMargin > 0 && customerTotal > 0) {
          const marginPercent = (bradfordTotalMargin / customerTotal) * 100;

          totalMargin += bradfordTotalMargin;
          totalPaperMargin += bradfordPaperMargin;
          totalPrintMargin += bradfordPrintMargin;

          margins.push({
            jobNo: job.jobNo,
            sizeName: job.sizeName,
            quantity: job.quantity,
            customerTotal,
            jdTotal,
            paperCostTotal,
            paperChargedTotal,
            bradfordPaperMargin,
            bradfordPrintMargin,
            bradfordTotalMargin,
            marginPercent,
          });
        }
      });

      const avgMargin = margins.length > 0 ? totalMargin / margins.length : 0;
      const avgMarginPercent = margins.length > 0
        ? margins.reduce((sum, m) => sum + m.marginPercent, 0) / margins.length
        : 0;

      reply.send({
        paperBySize,
        totalPaper,
        totalJobs: jobs.length,
        margins: margins.sort((a, b) => b.bradfordTotalMargin - a.bradfordTotalMargin), // Sort by highest margin first
        totalMargin,
        totalPaperMargin,
        totalPrintMargin,
        avgMargin,
        avgMarginPercent,
      });
    } catch (error: any) {
      console.error('Error generating Bradford paper/margins report:', error);
      reply.status(500).send({
        error: error.message || 'Failed to generate report',
      });
    }
  });

  /**
   * GET /api/reports/bradford/export
   * Download Excel report of all Bradford incoming/outgoing transactions
   */
  fastify.get('/bradford/export', async (request, reply) => {
    console.log('\n========================================');
    console.log('📧 [BRADFORD REPORT] Endpoint hit!');
    console.log('Time:', new Date().toISOString());
    console.log('========================================\n');
    try {
      // Get all invoices involving Bradford
      const [incomingInvoices, outgoingInvoices] = await Promise.all([
        // Incoming: JD → Bradford
        prisma.invoice.findMany({
          where: {
            fromCompanyId: COMPANY_IDS.JD_GRAPHIC,
            toCompanyId: COMPANY_IDS.BRADFORD,
          },
          include: {
            job: true,
            fromCompany: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        // Outgoing: Bradford → Impact
        prisma.invoice.findMany({
          where: {
            fromCompanyId: COMPANY_IDS.BRADFORD,
            toCompanyId: COMPANY_IDS.IMPACT_DIRECT,
          },
          include: {
            job: true,
            toCompany: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // Get all POs involving Bradford
      const [incomingPOs, outgoingPOs] = await Promise.all([
        // Incoming: POs sent TO Bradford
        prisma.purchaseOrder.findMany({
          where: {
            targetCompanyId: COMPANY_IDS.BRADFORD,
          },
          include: {
            job: true,
            originCompany: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        // Outgoing: POs sent FROM Bradford
        prisma.purchaseOrder.findMany({
          where: {
            originCompanyId: COMPANY_IDS.BRADFORD,
          },
          include: {
            job: true,
            targetCompany: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Incoming Invoices (JD → Bradford)
      const incomingInvoicesData = incomingInvoices.map((inv) => ({
        'Invoice Number': inv.invoiceNo,
        'Date': inv.createdAt.toLocaleDateString(),
        'Job Number': inv.job.jobNo,
        'From Company': inv.fromCompany.name,
        'Amount': parseFloat(inv.amount.toString()),
        'Paid': inv.paidAt ? 'Yes' : 'No',
        'PO Number': outgoingPOs.find(po => po.jobId === inv.jobId)?.poNumber || 'N/A',
      }));

      const incomingInvoicesSheet = XLSX.utils.json_to_sheet(incomingInvoicesData);
      XLSX.utils.book_append_sheet(workbook, incomingInvoicesSheet, 'Incoming Invoices');

      // Sheet 2: Outgoing Invoices (Bradford → Impact)
      const outgoingInvoicesData = outgoingInvoices.map((inv) => ({
        'Invoice Number': inv.invoiceNo,
        'Date': inv.createdAt.toLocaleDateString(),
        'Job Number': inv.job.jobNo,
        'To Company': inv.toCompany.name,
        'Amount': parseFloat(inv.amount.toString()),
        'Paid': inv.paidAt ? 'Yes' : 'No',
        'PO Number': incomingPOs.find(po => po.jobId === inv.jobId && po.originCompanyId === COMPANY_IDS.IMPACT_DIRECT)?.poNumber || 'N/A',
      }));

      const outgoingInvoicesSheet = XLSX.utils.json_to_sheet(outgoingInvoicesData);
      XLSX.utils.book_append_sheet(workbook, outgoingInvoicesSheet, 'Outgoing Invoices');

      // Sheet 3: Incoming Purchase Orders
      const incomingPOsData = incomingPOs.map((po) => ({
        'PO Number': po.poNumber,
        'Date': po.createdAt.toLocaleDateString(),
        'Job Number': po.job.jobNo,
        'From Company': po.originCompany.name,
        'Amount': parseFloat(po.vendorAmount.toString()),
        'Status': po.status || 'Active',
      }));

      const incomingPOsSheet = XLSX.utils.json_to_sheet(incomingPOsData);
      XLSX.utils.book_append_sheet(workbook, incomingPOsSheet, 'Incoming POs');

      // Sheet 4: Outgoing Purchase Orders
      const outgoingPOsData = outgoingPOs.map((po) => ({
        'PO Number': po.poNumber,
        'Date': po.createdAt.toLocaleDateString(),
        'Job Number': po.job.jobNo,
        'To Company': po.targetCompany.name,
        'Amount': parseFloat(po.vendorAmount.toString()),
        'Status': po.status || 'Active',
      }));

      const outgoingPOsSheet = XLSX.utils.json_to_sheet(outgoingPOsData);
      XLSX.utils.book_append_sheet(workbook, outgoingPOsSheet, 'Outgoing POs');

      // Sheet 5: Paper & Margins Analysis
      // Get all completed jobs with invoices for margin analysis
      const jobs = await prisma.job.findMany({
        where: {
          status: 'COMPLETED',
          invoices: {
            some: {
              OR: [
                { fromCompanyId: COMPANY_IDS.BRADFORD },
                { toCompanyId: COMPANY_IDS.BRADFORD },
              ],
            },
          },
        },
        include: {
          invoices: {
            include: {
              fromCompany: true,
              toCompany: true,
            },
          },
        },
      });

      // Calculate paper usage by size
      const paperBySize: Record<string, number> = {};
      let totalPaper = 0;

      jobs.forEach((job) => {
        const size = job.sizeName || 'Unknown';
        const quantity = job.quantity || 0;
        paperBySize[size] = (paperBySize[size] || 0) + quantity;
        totalPaper += quantity;
      });

      // Calculate margins using job fields
      const marginData: any[] = [];
      let totalMargin = 0;
      let totalPaperMargin = 0;
      let totalPrintMargin = 0;

      jobs.forEach((job) => {
        const bradfordTotalMargin = job.bradfordTotalMargin ? parseFloat(job.bradfordTotalMargin.toString()) : 0;
        const bradfordPaperMargin = job.bradfordPaperMargin ? parseFloat(job.bradfordPaperMargin.toString()) : 0;
        // Calculate print margin if not populated: total - paper
        let bradfordPrintMargin = job.bradfordPrintMargin ? parseFloat(job.bradfordPrintMargin.toString()) : 0;
        if (bradfordPrintMargin === 0 && bradfordTotalMargin > 0 && bradfordPaperMargin > 0) {
          bradfordPrintMargin = bradfordTotalMargin - bradfordPaperMargin;
        }
        const customerTotal = job.customerTotal ? parseFloat(job.customerTotal.toString()) : 0;
        const paperCostTotal = job.paperCostTotal ? parseFloat(job.paperCostTotal.toString()) : 0;
        const paperChargedTotal = job.paperChargedTotal ? parseFloat(job.paperChargedTotal.toString()) : 0;
        const jdTotal = job.jdTotal ? parseFloat(job.jdTotal.toString()) : 0;

        if (bradfordTotalMargin > 0 && customerTotal > 0) {
          const marginPercent = (bradfordTotalMargin / customerTotal) * 100;

          totalMargin += bradfordTotalMargin;
          totalPaperMargin += bradfordPaperMargin;
          totalPrintMargin += bradfordPrintMargin;

          marginData.push({
            'Job Number': job.jobNo,
            'Size': job.sizeName || 'N/A',
            'Quantity': job.quantity || 0,
            'Customer Total': customerTotal,
            'JD Print Cost': jdTotal,
            'Paper Cost': paperCostTotal,
            'Paper Charged': paperChargedTotal,
            'Paper Margin $': bradfordPaperMargin,
            'Print Margin $': bradfordPrintMargin,
            'Total Margin $': bradfordTotalMargin,
            'Margin %': marginPercent,
          });
        }
      });

      // Add paper usage summary rows
      const paperUsageSummary = Object.entries(paperBySize)
        .sort(([, a]: any, [, b]: any) => b - a)
        .map(([size, quantity]) => ({
          'Job Number': '',
          'Size': size,
          'Quantity': quantity,
          'Customer Total': '',
          'JD Print Cost': '',
          'Paper Cost': '',
          'Paper Charged': '',
          'Paper Margin $': '',
          'Print Margin $': '',
          'Total Margin $': '',
          'Margin %': '',
        }));

      // Combine paper summary and margin data
      const paperMarginsData = [
        { 'Job Number': '=== PAPER USAGE BY SIZE ===', 'Size': '', 'Quantity': '', 'Customer Total': '', 'JD Print Cost': '', 'Paper Cost': '', 'Paper Charged': '', 'Paper Margin $': '', 'Print Margin $': '', 'Total Margin $': '', 'Margin %': '' },
        ...paperUsageSummary,
        { 'Job Number': '', 'Size': '', 'Quantity': '', 'Customer Total': '', 'JD Print Cost': '', 'Paper Cost': '', 'Paper Charged': '', 'Paper Margin $': '', 'Print Margin $': '', 'Total Margin $': '', 'Margin %': '' },
        { 'Job Number': '=== MARGIN ANALYSIS ===', 'Size': '', 'Quantity': '', 'Customer Total': '', 'JD Print Cost': '', 'Paper Cost': '', 'Paper Charged': '', 'Paper Margin $': '', 'Print Margin $': '', 'Total Margin $': '', 'Margin %': '' },
        ...marginData.sort((a, b) => b['Total Margin $'] - a['Total Margin $']),
        { 'Job Number': '', 'Size': '', 'Quantity': '', 'Customer Total': '', 'JD Print Cost': '', 'Paper Cost': '', 'Paper Charged': '', 'Paper Margin $': '', 'Print Margin $': '', 'Total Margin $': '', 'Margin %': '' },
        { 'Job Number': 'TOTALS', 'Size': '', 'Quantity': totalPaper, 'Customer Total': '', 'JD Print Cost': '', 'Paper Cost': '', 'Paper Charged': '', 'Paper Margin $': totalPaperMargin, 'Print Margin $': totalPrintMargin, 'Total Margin $': totalMargin, 'Margin %': '' },
      ];

      const paperMarginsSheet = XLSX.utils.json_to_sheet(paperMarginsData);
      XLSX.utils.book_append_sheet(workbook, paperMarginsSheet, 'Paper & Margins');

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const filename = `Bradford_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Calculate totals for email summary
      const totalIncomingInvoices = incomingInvoices.length;
      const totalOutgoingInvoices = outgoingInvoices.length;
      const totalIncomingPOs = incomingPOs.length;
      const totalOutgoingPOs = outgoingPOs.length;

      console.log('\n[BRADFORD REPORT] About to send email...');
      console.log('[BRADFORD REPORT] Recipients: steve.gustafson@bgeltd.com, nick@jdgraphic.com');
      console.log('[BRADFORD REPORT] Excel file size:', excelBuffer.length, 'bytes');
      console.log('[BRADFORD REPORT] Filename:', filename);

      // Send email to Steve and Nick with Excel attachment
      const emailResult = await sendEmail({
        to: 'steve.gustafson@bgeltd.com, nick@jdgraphic.com',
        subject: `Bradford Financial Report - ${new Date().toLocaleDateString()}`,
        fromName: 'IDP Report',
        html: `
          <h2>Bradford Financial Report</h2>
          <p>Please find attached the Bradford financial report for ${new Date().toLocaleDateString()}.</p>

          <h3>Report Summary:</h3>
          <ul>
            <li><strong>Incoming Invoices (JD → Bradford):</strong> ${totalIncomingInvoices} invoices</li>
            <li><strong>Outgoing Invoices (Bradford → Impact):</strong> ${totalOutgoingInvoices} invoices</li>
            <li><strong>Incoming Purchase Orders:</strong> ${totalIncomingPOs} POs</li>
            <li><strong>Outgoing Purchase Orders:</strong> ${totalOutgoingPOs} POs</li>
          </ul>

          <p>The attached Excel file contains 4 sheets with detailed transaction information.</p>

          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This report was automatically generated from the Bradford dashboard.
          </p>
        `,
        attachments: [
          {
            filename,
            content: Buffer.from(excelBuffer),
          },
        ],
      });

      console.log('[BRADFORD REPORT] Email sent successfully!');
      console.log('[BRADFORD REPORT] Email result:', emailResult);

      reply.send({
        success: true,
        message: 'Report emailed successfully to Steve Gustafson and Nick',
      });
    } catch (error: any) {
      console.error('Error generating Bradford report:', error);
      reply.status(500).send({
        success: false,
        error: error.message || 'Failed to generate report',
      });
    }
  });

  /**
   * GET /api/reports/daily-summary?date=YYYY-MM-DD
   * Download daily summary Excel report showing all jobs and entity profits
   * Date is optional, defaults to today
   */
  fastify.get('/daily-summary', async (request, reply) => {
    try {
      const { date } = request.query as { date?: string };
      const reportDate = date || new Date().toISOString().split('T')[0];

      console.log('\n========================================');
      console.log('📊 [DAILY SUMMARY] Generating report for:', reportDate);
      console.log('========================================\n');

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

      console.log(`[DAILY SUMMARY] Found ${allJobs.length} total jobs`);

      // Create Excel workbook
      const workbook = XLSX.utils.book_new();

      // ============================================
      // SHEET 1: ALL JOBS
      // ============================================
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

      // ============================================
      // SHEET 2: IMPACT DIRECT SUMMARY
      // ============================================
      const impactJobs = allJobs.filter(j => j.customerTotal && Number(j.customerTotal) > 0);
      const totalRevenue = impactJobs.reduce((sum, j) => sum + Number(j.customerTotal || 0), 0);
      const totalCosts = impactJobs.reduce((sum, j) => sum + Number(j.bradfordTotal || 0), 0);
      const totalImpactMargin = impactJobs.reduce((sum, j) => sum + Number(j.impactMargin || 0), 0);
      const marginPercent = totalRevenue > 0 ? ((totalImpactMargin / totalRevenue) * 100).toFixed(2) : '0.00';

      // Count by status
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

      // ============================================
      // SHEET 3: BRADFORD SUMMARY
      // ============================================
      const bradfordJobs = allJobs.filter(j => j.bradfordTotal && Number(j.bradfordTotal) > 0);
      const totalBradfordRevenue = bradfordJobs.reduce((sum, j) => sum + Number(j.bradfordTotal || 0), 0);
      const totalBradfordCosts = bradfordJobs.reduce((sum, j) => sum + Number(j.jdTotal || 0), 0);
      const totalBradfordPrintMargin = bradfordJobs.reduce((sum, j) => sum + Number(j.bradfordPrintMargin || 0), 0);
      const totalBradfordPaperMargin = bradfordJobs.reduce((sum, j) => sum + Number(j.bradfordPaperMargin || 0), 0);
      const totalBradfordMargin = bradfordJobs.reduce((sum, j) => sum + Number(j.bradfordTotalMargin || 0), 0);
      const bradfordMarginPercent = totalBradfordRevenue > 0 ? ((totalBradfordMargin / totalBradfordRevenue) * 100).toFixed(2) : '0.00';
      const totalPaperUsage = allJobs.reduce((sum, j) => sum + Number(j.paperWeightTotal || 0), 0);

      // Paper by type
      const paperByType: any = {};
      allJobs.forEach(job => {
        if (job.paperType && job.paperWeightTotal) {
          paperByType[job.paperType] = (paperByType[job.paperType] || 0) + Number(job.paperWeightTotal);
        }
      });

      // JD Supplies Paper breakdown
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

      // ============================================
      // SHEET 4: JD GRAPHIC SUMMARY
      // ============================================
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

      // ============================================
      // SHEET 5: OVERALL SUMMARY
      // ============================================
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
      const filename = `Daily_Summary_${reportDate}.xlsx`;

      console.log('[DAILY SUMMARY] Excel file generated:', filename);
      console.log('[DAILY SUMMARY] File size:', excelBuffer.length, 'bytes');

      // Set headers for file download
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.send(Buffer.from(excelBuffer));

    } catch (error: any) {
      console.error('Error generating daily summary:', error);
      reply.status(500).send({
        success: false,
        error: error.message || 'Failed to generate daily summary',
      });
    }
  });

  /**
   * POST /api/reports/daily-summary/send-email
   * Manually trigger the daily summary email (for testing)
   */
  fastify.post('/daily-summary/send-email', async (request, reply) => {
    try {
      console.log('[MANUAL TRIGGER] Daily summary email triggered manually');

      // Call the email sending function
      await sendDailySummaryEmail();

      reply.send({
        success: true,
        message: 'Daily summary email sent successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[MANUAL TRIGGER] Error sending daily summary email:', error);
      reply.status(500).send({
        success: false,
        error: error.message || 'Failed to send daily summary email',
      });
    }
  });
};

export default reportsRoutes;
