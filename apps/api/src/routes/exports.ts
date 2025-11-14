import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@printing-workflow/db';

/**
 * Compute payment status from invoice data
 */
function getInvoicePaymentStatus(invoice: {
  paidAt: Date | null;
  dueAt: Date | null;
}): string {
  if (invoice.paidAt) return 'paid';
  if (invoice.dueAt && new Date(invoice.dueAt) < new Date()) return 'overdue';
  return 'unpaid';
}

/**
 * Compute job payment status from all invoices
 */
function getJobPaymentStatus(invoices: Array<{ paidAt: Date | null; dueAt: Date | null }>): string {
  if (invoices.length === 0) return 'no invoices';

  const paidCount = invoices.filter((inv) => inv.paidAt).length;

  if (paidCount === invoices.length) return 'all paid';
  if (paidCount > 0) return 'partially paid';

  const hasOverdue = invoices.some((inv) => inv.dueAt && new Date(inv.dueAt) < new Date() && !inv.paidAt);
  if (hasOverdue) return 'overdue';

  return 'unpaid';
}

const exportsRoutes: FastifyPluginAsync = async (server) => {
  // Export jobs as CSV
  server.get('/jobs', async (request, reply) => {
    const jobs = await prisma.job.findMany({
      include: {
        customer: true,
        quote: true,
        invoices: true,
        purchaseOrders: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV - matches UI "All Jobs" table columns + CPMs + Paper Usage
    const headers = [
      'Job Number',
      'Customer PO Number',
      'Customer',
      'Size',
      'Quantity',
      'Paper Type',
      'Paper Weight Per 1000 (lbs)',
      'Paper Weight Total (lbs)',
      'Impact Charge ($)',
      'Impact CPM ($/M)',
      'Bradford Pay ($)',
      'Bradford CPM ($/M)',
      'Bradford Print Margin CPM ($/M)',
      'Bradford Paper Margin CPM ($/M)',
      'Bradford Total Margin CPM ($/M)',
      'JD Pay ($)',
      'JD CPM ($/M)',
      'Paper Cost CPM ($/M)',
      'Paper Charged CPM ($/M)',
      'Impact Profit ($)',
      'Impact Profit CPM ($/M)',
      'Margin %',
      'Job Status',
      'Payment Status',
      'Created Date',
      'Delivery Date',
      'Invoice Count',
      'PO Count',
    ];

    const rows = jobs.map((job) => {
      const customerTotal = Number(job.customerTotal || 0);
      const bradfordTotal = Number(job.bradfordTotal || 0);
      const jdTotal = Number(job.jdTotal || 0);
      const impactMargin = Number(job.impactMargin || 0);
      const marginPercent = customerTotal > 0 ? (impactMargin / customerTotal) * 100 : 0;

      // Extract all CPM values
      const customerCPM = Number(job.customerCPM || 0);
      const bradfordTotalCPM = Number(job.bradfordTotalCPM || 0);
      const bradfordPrintMarginCPM = Number(job.bradfordPrintMarginCPM || 0);
      const bradfordPaperMarginCPM = Number(job.bradfordPaperMarginCPM || 0);
      const bradfordTotalMarginCPM = Number(job.bradfordTotalMarginCPM || 0);
      const printCPM = Number(job.printCPM || 0);
      const paperCostCPM = Number(job.paperCostCPM || 0);
      const paperChargedCPM = Number(job.paperChargedCPM || 0);
      const impactMarginCPM = Number(job.impactMarginCPM || 0);

      // Extract paper usage values
      const paperType = job.paperType || '';
      const paperWeightPer1000 = Number(job.paperWeightPer1000 || 0);
      const paperWeightTotal = Number(job.paperWeightTotal || 0);

      return [
        job.jobNo,
        job.customerPONumber || '',
        job.customer.name,
        job.sizeName || '',
        job.quantity?.toString() || '',
        paperType,
        paperWeightPer1000.toFixed(2),
        paperWeightTotal.toFixed(2),
        customerTotal.toFixed(2),
        customerCPM.toFixed(2),
        bradfordTotal.toFixed(2),
        bradfordTotalCPM.toFixed(2),
        bradfordPrintMarginCPM.toFixed(2),
        bradfordPaperMarginCPM.toFixed(2),
        bradfordTotalMarginCPM.toFixed(2),
        jdTotal.toFixed(2),
        printCPM.toFixed(2),
        paperCostCPM.toFixed(2),
        paperChargedCPM.toFixed(2),
        impactMargin.toFixed(2),
        impactMarginCPM.toFixed(2),
        marginPercent.toFixed(1),
        job.status,
        getJobPaymentStatus(job.invoices),
        new Date(job.createdAt).toLocaleDateString(),
        job.deliveryDate ? new Date(job.deliveryDate).toLocaleDateString() : '',
        job.invoices?.length.toString() || '0',
        job.purchaseOrders?.length.toString() || '0',
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="jobs-export.csv"');
    return csv;
  });

  // Export invoices as CSV
  server.get('/invoices', async (request, reply) => {
    const invoices = await prisma.invoice.findMany({
      include: {
        job: true,
        fromCompany: true,
        toCompany: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'Invoice Number',
      'Job Number',
      'From Company',
      'To Company',
      'Amount',
      'Payment Status',
      'Paid Date',
      'Created Date',
      'Due Date',
    ];

    const rows = invoices.map((inv) => [
      inv.invoiceNo,
      inv.job.jobNo,
      inv.fromCompany.name,
      inv.toCompany?.name || 'Customer',
      Number(inv.amount).toFixed(2),
      getInvoicePaymentStatus(inv),
      inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '',
      new Date(inv.createdAt).toLocaleDateString(),
      inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="invoices-export.csv"');
    return csv;
  });

  // Export purchase orders as CSV
  server.get('/purchase-orders', async (request, reply) => {
    const pos = await prisma.purchaseOrder.findMany({
      include: {
        job: true,
        originCompany: true,
        targetCompany: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'PO Number',
      'Job Number',
      'From Company',
      'To Company',
      'Vendor Amount',
      'Original Amount',
      'Margin',
      'Status',
      'Created Date',
    ];

    const rows = pos.map((po) => {
      const vendorAmount = Number(po.vendorAmount);
      const originalAmount = Number(po.originalAmount);
      const margin = originalAmount - vendorAmount;

      return [
        po.poNo || 'N/A',
        po.job.jobNo,
        po.originCompany.name,
        po.targetCompany.name,
        vendorAmount.toFixed(2),
        originalAmount.toFixed(2),
        margin.toFixed(2),
        po.status,
        new Date(po.createdAt).toLocaleDateString(),
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="purchase-orders-export.csv"');
    return csv;
  });

  // Export revenue summary as CSV
  server.get('/revenue', async (request, reply) => {
    const jobs = await prisma.job.findMany({
      include: {
        customer: true,
        invoices: true,
        purchaseOrders: true,
      },
    });

    const headers = [
      'Job Number',
      'Customer',
      'Customer Total',
      'Costs',
      'Gross Profit',
      'Margin %',
      'Status',
      'Date',
    ];

    const rows = jobs.map((job) => {
      const customerTotal = Number(job.customerTotal);
      const costs = job.purchaseOrders.reduce(
        (sum, po) => sum + Number(po.vendorAmount),
        0
      );
      const profit = customerTotal - costs;
      const marginPercent = customerTotal > 0 ? (profit / customerTotal) * 100 : 0;

      return [
        job.jobNo,
        job.customer.name,
        customerTotal.toFixed(2),
        costs.toFixed(2),
        profit.toFixed(2),
        marginPercent.toFixed(1),
        job.status,
        new Date(job.createdAt).toLocaleDateString(),
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="revenue-export.csv"');
    return csv;
  });

  // Export job details with full breakdown
  server.get('/job/:jobId', async (request, reply) => {
      const { jobId } = request.params as any;
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          customer: true,
          quote: true,
          files: true,
          proofs: {
            include: {
              approvals: true,
            },
          },
          purchaseOrders: {
            include: {
              originCompany: true,
              targetCompany: true,
            },
          },
          invoices: true,
          shipments: true,
        },
      });

      if (!job) {
        return reply.code(404).send({ error: 'Job not found' });
      }

      // Build detailed report
      const sections = [
        '=== JOB DETAILS ===',
        `Job Number: ${job.jobNo}`,
        `Customer: ${job.customer.name}`,
        `Status: ${job.status}`,
        `Total: $${Number(job.customerTotal).toFixed(2)}`,
        `Created: ${new Date(job.createdAt).toLocaleString()}`,
        '',
        '=== FILES ===',
        ...job.files.map((f) => `${f.kind}: ${f.fileName}`),
        '',
        '=== PROOFS ===',
        ...job.proofs.map(
          (p) => `Version ${p.version}: ${p.approvals.length} approval(s)`
        ),
        '',
        '=== PURCHASE ORDERS ===',
        ...job.purchaseOrders.map(
          (po) =>
            `${po.originCompany.name} → ${po.targetCompany.name}: $${Number(
              po.vendorAmount
            ).toFixed(2)} (${po.status})`
        ),
        '',
        '=== INVOICES ===',
        ...job.invoices.map(
          (inv) => `${inv.invoiceNo}: $${Number(inv.amount).toFixed(2)} (${getInvoicePaymentStatus(inv)}${inv.paidAt ? ` - Paid ${new Date(inv.paidAt).toLocaleDateString()}` : ''})`
        ),
        '',
        '=== SHIPMENTS ===',
        ...job.shipments.map(
          (ship) => `${ship.carrier}: ${ship.trackingNo || 'No tracking'}`
        ),
      ];

      const report = sections.join('\n');

      reply.header('Content-Type', 'text/plain');
      reply.header(
        'Content-Disposition',
        `attachment; filename="${job.jobNo}-report.txt"`
      );
      return report;
    }
  );
};

export default exportsRoutes;
