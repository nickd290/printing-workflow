import { prisma, POStatus, InvoiceStatus } from '@printing-workflow/db';
import { COMPANY_IDS } from '@printing-workflow/shared';

export interface RevenueMetrics {
  purchaseOrders: {
    total: number;
    byCompany: {
      impactToBradford: { count: number; total: number };
      bradfordToJD: { count: number; total: number };
    };
  };
  invoices: {
    total: number;
    totalAmount: number;
    paid: number;
    paidAmount: number;
    unpaid: number;
    unpaidAmount: number;
    byCustomer: {
      jjsa: { count: number; total: number; paid: number; unpaid: number };
      ballantine: { count: number; total: number; paid: number; unpaid: number };
    };
  };
  profitMargins: {
    totalRevenue: number; // Total from customer invoices
    totalCosts: number; // Total owed to Bradford
    grossProfit: number;
    profitMargin: number; // Percentage
  };
}

export interface BradfordMetrics {
  jobs: {
    total: number;
    byStatus: Record<string, number>;
  };
  revenue: {
    totalRevenue: number; // Total Bradford received
    totalMargin: number; // Bradford's margins
    marginPercent: number;
  };
  purchaseOrders: {
    total: number;
    totalAmount: number;
  };
  invoices: {
    total: number;
    totalAmount: number;
  };
  paperUsage: {
    totalWeight: number; // Total lbs of paper
    jobCount: number; // Jobs with paper tracking
  };
}

export async function getRevenueMetrics(): Promise<RevenueMetrics> {
  // Get all purchase orders
  const allPOs = await prisma.purchaseOrder.findMany({
    include: {
      originCompany: true,
      targetCompany: true,
    },
  });

  // Get all invoices
  const allInvoices = await prisma.invoice.findMany({
    include: {
      toCompany: true,
      fromCompany: true,
      job: {
        include: {
          customer: true,
        },
      },
    },
  });

  // Calculate PO metrics
  const impactToBradfordPOs = allPOs.filter(
    (po) =>
      po.originCompanyId === COMPANY_IDS.IMPACT_DIRECT &&
      po.targetCompanyId === COMPANY_IDS.BRADFORD
  );

  const bradfordToJDPOs = allPOs.filter(
    (po) =>
      po.originCompanyId === COMPANY_IDS.BRADFORD &&
      po.targetCompanyId === COMPANY_IDS.JD_GRAPHIC
  );

  // Calculate invoice metrics
  const paidInvoices = allInvoices.filter(
    (inv) => inv.status === InvoiceStatus.PAID
  );
  const unpaidInvoices = allInvoices.filter(
    (inv) => inv.status !== InvoiceStatus.PAID
  );

  // Customer invoices (from Impact Direct to customers)
  const customerInvoices = allInvoices.filter(
    (inv) =>
      inv.fromCompanyId === COMPANY_IDS.IMPACT_DIRECT &&
      (inv.toCompanyId === COMPANY_IDS.JJSA ||
        inv.toCompanyId === COMPANY_IDS.BALLANTINE)
  );

  const jjsaInvoices = customerInvoices.filter(
    (inv) => inv.toCompanyId === COMPANY_IDS.JJSA
  );
  const ballantineInvoices = customerInvoices.filter(
    (inv) => inv.toCompanyId === COMPANY_IDS.BALLANTINE
  );

  // Bradford invoices (from Bradford to Impact Direct)
  const bradfordInvoices = allInvoices.filter(
    (inv) =>
      inv.fromCompanyId === COMPANY_IDS.BRADFORD &&
      inv.toCompanyId === COMPANY_IDS.IMPACT_DIRECT
  );

  // Calculate totals
  const totalRevenue = customerInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.amount.toString()),
    0
  );
  const totalCosts = bradfordInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.amount.toString()),
    0
  );
  const grossProfit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    purchaseOrders: {
      total: allPOs.length,
      byCompany: {
        impactToBradford: {
          count: impactToBradfordPOs.length,
          total: impactToBradfordPOs.reduce(
            (sum, po) => sum + parseFloat(po.vendorAmount.toString()),
            0
          ),
        },
        bradfordToJD: {
          count: bradfordToJDPOs.length,
          total: bradfordToJDPOs.reduce(
            (sum, po) => sum + parseFloat(po.vendorAmount.toString()),
            0
          ),
        },
      },
    },
    invoices: {
      total: allInvoices.length,
      totalAmount: allInvoices.reduce(
        (sum, inv) => sum + parseFloat(inv.amount.toString()),
        0
      ),
      paid: paidInvoices.length,
      paidAmount: paidInvoices.reduce(
        (sum, inv) => sum + parseFloat(inv.amount.toString()),
        0
      ),
      unpaid: unpaidInvoices.length,
      unpaidAmount: unpaidInvoices.reduce(
        (sum, inv) => sum + parseFloat(inv.amount.toString()),
        0
      ),
      byCustomer: {
        jjsa: {
          count: jjsaInvoices.length,
          total: jjsaInvoices.reduce(
            (sum, inv) => sum + parseFloat(inv.amount.toString()),
            0
          ),
          paid: jjsaInvoices.filter((inv) => inv.status === InvoiceStatus.PAID)
            .length,
          unpaid: jjsaInvoices.filter((inv) => inv.status !== InvoiceStatus.PAID)
            .length,
        },
        ballantine: {
          count: ballantineInvoices.length,
          total: ballantineInvoices.reduce(
            (sum, inv) => sum + parseFloat(inv.amount.toString()),
            0
          ),
          paid: ballantineInvoices.filter(
            (inv) => inv.status === InvoiceStatus.PAID
          ).length,
          unpaid: ballantineInvoices.filter(
            (inv) => inv.status !== InvoiceStatus.PAID
          ).length,
        },
      },
    },
    profitMargins: {
      totalRevenue,
      totalCosts,
      grossProfit,
      profitMargin,
    },
  };
}

export async function getBradfordMetrics(): Promise<BradfordMetrics> {
  // Get all jobs that involve Bradford (have Bradford POs)
  const allJobs = await prisma.job.findMany({
    include: {
      purchaseOrders: {
        include: {
          originCompany: true,
          targetCompany: true,
        },
      },
    },
  });

  // Filter jobs that involve Bradford
  const bradfordJobs = allJobs.filter((job) =>
    job.purchaseOrders.some(
      (po) =>
        po.targetCompanyId === COMPANY_IDS.BRADFORD ||
        po.originCompanyId === COMPANY_IDS.BRADFORD
    )
  );

  // Count jobs by status
  const jobsByStatus: Record<string, number> = {};
  bradfordJobs.forEach((job) => {
    jobsByStatus[job.status] = (jobsByStatus[job.status] || 0) + 1;
  });

  // Calculate Bradford revenue and margins
  let totalRevenue = 0;
  let totalMargin = 0;
  bradfordJobs.forEach((job) => {
    if (job.bradfordTotal) {
      totalRevenue += parseFloat(job.bradfordTotal.toString());
    }
    if (job.bradfordTotalMargin) {
      totalMargin += parseFloat(job.bradfordTotalMargin.toString());
    }
  });
  const marginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  // Get Bradford POs
  const bradfordPOs = await prisma.purchaseOrder.findMany({
    where: {
      OR: [
        { originCompanyId: COMPANY_IDS.BRADFORD },
        { targetCompanyId: COMPANY_IDS.BRADFORD },
      ],
    },
  });

  const totalPOAmount = bradfordPOs.reduce(
    (sum, po) => sum + parseFloat(po.vendorAmount.toString()),
    0
  );

  // Get Bradford invoices
  const bradfordInvoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { fromCompanyId: COMPANY_IDS.BRADFORD },
        { toCompanyId: COMPANY_IDS.BRADFORD },
      ],
    },
  });

  const totalInvoiceAmount = bradfordInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.amount.toString()),
    0
  );

  // Calculate paper usage
  let totalPaperWeight = 0;
  let jobsWithPaper = 0;
  bradfordJobs.forEach((job) => {
    if (job.paperWeightTotal) {
      totalPaperWeight += parseFloat(job.paperWeightTotal.toString());
      jobsWithPaper++;
    }
  });

  return {
    jobs: {
      total: bradfordJobs.length,
      byStatus: jobsByStatus,
    },
    revenue: {
      totalRevenue,
      totalMargin,
      marginPercent,
    },
    purchaseOrders: {
      total: bradfordPOs.length,
      totalAmount: totalPOAmount,
    },
    invoices: {
      total: bradfordInvoices.length,
      totalAmount: totalInvoiceAmount,
    },
    paperUsage: {
      totalWeight: totalPaperWeight,
      jobCount: jobsWithPaper,
    },
  };
}
