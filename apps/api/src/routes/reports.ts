import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@printing-workflow/db';
import XLSX from 'xlsx';
import { sendEmail } from '../lib/email.js';

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
        'Status': inv.status,
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
        'Status': inv.status,
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
};

export default reportsRoutes;
