import { prisma, POStatus } from '@printing-workflow/db';
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
  // Get all purchase orders (including vendor POs)
  const allPOs = await prisma.purchaseOrder.findMany({
    include: {
      originCompany: true,
      targetCompany: true,
      targetVendor: true,  // Include third-party vendor POs
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

  // Third-party vendor POs (Impact → Vendor, not Company)
  const impactToVendorPOs = allPOs.filter(
    (po) =>
      po.originCompanyId === COMPANY_IDS.IMPACT_DIRECT &&
      po.targetVendorId != null  // Has vendor target, not company
  );

  // Calculate invoice metrics
  const paidInvoices = allInvoices.filter(
    (inv) => inv.paidAt != null
  );
  const unpaidInvoices = allInvoices.filter(
    (inv) => inv.paidAt == null
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

  // Calculate revenue and costs from Job PO-based fields (not invoices)
  // Get all jobs to calculate revenue from actual Job data
  const allJobs = await prisma.job.findMany({
    where: {
      deletedAt: null, // Exclude soft-deleted jobs
      bradfordTotal: { not: null, gt: 0 }, // Only complete jobs
    },
    select: {
      customerTotal: true,
      impactMargin: true,
      bradfordTotal: true,
    },
  });

  const totalRevenue = allJobs.reduce(
    (sum, job) => sum + parseFloat(job.customerTotal.toString()),
    0
  );
  const totalCosts = allJobs.reduce(
    (sum, job) => {
      if (job.bradfordTotal) {
        return sum + parseFloat(job.bradfordTotal.toString());
      }
      return sum;
    },
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
        impactToVendor: {
          count: impactToVendorPOs.length,
          total: impactToVendorPOs.reduce(
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
          paid: jjsaInvoices.filter((inv) => inv.paidAt != null)
            .length,
          unpaid: jjsaInvoices.filter((inv) => inv.paidAt == null)
            .length,
        },
        ballantine: {
          count: ballantineInvoices.length,
          total: ballantineInvoices.reduce(
            (sum, inv) => sum + parseFloat(inv.amount.toString()),
            0
          ),
          paid: ballantineInvoices.filter(
            (inv) => inv.paidAt != null
          ).length,
          unpaid: ballantineInvoices.filter(
            (inv) => inv.paidAt == null
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
    where: {
      deletedAt: null, // Exclude soft-deleted jobs
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

/**
 * Get PO flow metrics showing the chain from Customer → Impact → Bradford → JD
 */
export interface POFlowMetrics {
  stages: {
    customerToImpact: {
      count: number;
      totalAmount: number;
      byStatus: Record<POStatus, number>;
    };
    impactToBradford: {
      count: number;
      totalAmount: number;
      marginAmount: number;
      byStatus: Record<POStatus, number>;
    };
    bradfordToJD: {
      count: number;
      totalAmount: number;
      marginAmount: number;
      byStatus: Record<POStatus, number>;
    };
    impactToVendor: {
      count: number;
      totalAmount: number;
      marginAmount: number;
      byStatus: Record<POStatus, number>;
    };
  };
  summary: {
    totalPOs: number;
    totalRevenue: number; // From customers
    totalCosts: number; // To Bradford
    impactMargin: number;
    bradfordMargin: number;
  };
}

export async function getPOFlowMetrics(): Promise<POFlowMetrics> {
  // Get all purchase orders with relationships (including vendor POs)
  const allPOs = await prisma.purchaseOrder.findMany({
    include: {
      originCompany: true,
      targetCompany: true,
      targetVendor: true,  // Include third-party vendor POs
      job: true,
    },
  });

  // Get all jobs to calculate customer POs
  const allJobs = await prisma.job.findMany({
    where: {
      deletedAt: null, // Exclude soft-deleted jobs
    },
    select: {
      id: true,
      customerTotal: true,
      customerId: true,
      status: true,
    },
  });

  // Stage 1: Customer → Impact Direct (represented by jobs with customer totals)
  const customerToImpactCount = allJobs.length;
  const customerToImpactTotal = allJobs.reduce((sum, job) => {
    return sum + parseFloat(job.customerTotal?.toString() || '0');
  }, 0);

  // Create status breakdown for customer POs (use job status as proxy)
  const customerToImpactByStatus: Record<string, number> = {};
  allJobs.forEach((job) => {
    const status = job.status || 'PENDING';
    customerToImpactByStatus[status] = (customerToImpactByStatus[status] || 0) + 1;
  });

  // Stage 2: Impact Direct → Bradford
  const impactToBradfordPOs = allPOs.filter(
    (po) =>
      po.originCompanyId === COMPANY_IDS.IMPACT_DIRECT &&
      po.targetCompanyId === COMPANY_IDS.BRADFORD
  );

  const impactToBradfordTotal = impactToBradfordPOs.reduce((sum, po) => {
    return sum + parseFloat(po.vendorAmount?.toString() || '0');
  }, 0);

  const impactToBradfordMargin = impactToBradfordPOs.reduce((sum, po) => {
    return sum + parseFloat(po.marginAmount?.toString() || '0');
  }, 0);

  const impactToBradfordByStatus: Record<string, number> = {};
  impactToBradfordPOs.forEach((po) => {
    impactToBradfordByStatus[po.status] = (impactToBradfordByStatus[po.status] || 0) + 1;
  });

  // Stage 3: Bradford → JD Graphic
  const bradfordToJDPOs = allPOs.filter(
    (po) =>
      po.originCompanyId === COMPANY_IDS.BRADFORD &&
      po.targetCompanyId === COMPANY_IDS.JD_GRAPHIC
  );

  const bradfordToJDTotal = bradfordToJDPOs.reduce((sum, po) => {
    return sum + parseFloat(po.vendorAmount?.toString() || '0');
  }, 0);

  const bradfordToJDMargin = bradfordToJDPOs.reduce((sum, po) => {
    return sum + parseFloat(po.marginAmount?.toString() || '0');
  }, 0);

  const bradfordToJDByStatus: Record<string, number> = {};
  bradfordToJDPOs.forEach((po) => {
    bradfordToJDByStatus[po.status] = (bradfordToJDByStatus[po.status] || 0) + 1;
  });

  // Stage 2B: Impact Direct → Third-Party Vendor (alternative to Bradford route)
  const impactToVendorPOs = allPOs.filter(
    (po) =>
      po.originCompanyId === COMPANY_IDS.IMPACT_DIRECT &&
      po.targetVendorId != null  // Has vendor target
  );

  const impactToVendorTotal = impactToVendorPOs.reduce((sum, po) => {
    return sum + parseFloat(po.vendorAmount?.toString() || '0');
  }, 0);

  const impactToVendorMargin = impactToVendorPOs.reduce((sum, po) => {
    return sum + parseFloat(po.marginAmount?.toString() || '0');
  }, 0);

  const impactToVendorByStatus: Record<string, number> = {};
  impactToVendorPOs.forEach((po) => {
    impactToVendorByStatus[po.status] = (impactToVendorByStatus[po.status] || 0) + 1;
  });

  return {
    stages: {
      customerToImpact: {
        count: customerToImpactCount,
        totalAmount: customerToImpactTotal,
        byStatus: customerToImpactByStatus as Record<POStatus, number>,
      },
      impactToBradford: {
        count: impactToBradfordPOs.length,
        totalAmount: impactToBradfordTotal,
        marginAmount: impactToBradfordMargin,
        byStatus: impactToBradfordByStatus as Record<POStatus, number>,
      },
      bradfordToJD: {
        count: bradfordToJDPOs.length,
        totalAmount: bradfordToJDTotal,
        marginAmount: bradfordToJDMargin,
        byStatus: bradfordToJDByStatus as Record<POStatus, number>,
      },
      impactToVendor: {
        count: impactToVendorPOs.length,
        totalAmount: impactToVendorTotal,
        marginAmount: impactToVendorMargin,
        byStatus: impactToVendorByStatus as Record<POStatus, number>,
      },
    },
    summary: {
      totalPOs: allPOs.length,
      totalRevenue: customerToImpactTotal,
      totalCosts: impactToBradfordTotal,
      impactMargin: impactToBradfordMargin,
      bradfordMargin: bradfordToJDMargin,
    },
  };
}
