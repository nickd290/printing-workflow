import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@printing-workflow/db';

const exportsRoutes: FastifyPluginAsync = async (server) => {
  // Export jobs as CSV
  server.get('/jobs', async (request, reply) => {
    const jobs = await prisma.job.findMany({
      include: {
        customer: true,
        quote: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build CSV
    const headers = [
      'Job Number',
      'Customer',
      'Status',
      'Total Amount',
      'Created Date',
      'Delivery Date',
      'Quantity',
      'Size',
    ];

    const rows = jobs.map((job) => [
      job.jobNo,
      job.customer.name,
      job.status,
      Number(job.customerTotal).toFixed(2),
      new Date(job.createdAt).toLocaleDateString(),
      job.deliveryDate ? new Date(job.deliveryDate).toLocaleDateString() : '',
      job.quantity?.toString() || '',
      job.sizeName || '',
    ]);

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
      'Status',
      'Created Date',
      'Due Date',
    ];

    const rows = invoices.map((inv) => [
      inv.invoiceNo,
      inv.job.jobNo,
      inv.fromCompany.name,
      inv.toCompany?.name || 'Customer',
      Number(inv.amount).toFixed(2),
      inv.status,
      new Date(inv.createdAt).toLocaleDateString(),
      inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '',
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
          (inv) => `${inv.invoiceNo}: $${Number(inv.amount).toFixed(2)} (${inv.status})`
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
