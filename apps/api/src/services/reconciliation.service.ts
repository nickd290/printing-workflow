import { prisma } from '@printing-workflow/db';
import { COMPANY_IDS } from '@printing-workflow/shared/constants';
import { createAutoPurchaseOrder } from './purchase-order.service';
import { completeJobAndGenerateInvoices } from './invoice.service';

/**
 * Job Reconciliation Service
 *
 * Ensures data integrity by:
 * - Auditing jobs for missing POs and invoices
 * - Validating amounts match pricing rules
 * - Auto-fixing missing records
 * - Providing reports for admin review
 */

export interface POStatus {
  exists: boolean;
  poId?: string;
  poNo?: string;
  amount?: number;
  expectedAmount: number;
  isValid: boolean;
  error?: string;
}

export interface InvoiceStatus {
  exists: boolean;
  invoiceId?: string;
  invoiceNo?: string;
  amount?: number;
  expectedAmount: number;
  pdfGenerated?: boolean;
  emailSent?: boolean;
  isValid: boolean;
  error?: string;
}

export interface JobAudit {
  jobId: string;
  jobNo: string;
  customerId: string;
  customerName: string;
  status: string;

  // Pricing from job
  customerTotal: number;
  bradfordTotal: number;
  jdTotal: number;
  impactMargin: number;
  bradfordMargin: number;

  // PO Status
  impactToBradfordPO: POStatus;
  bradfordToJDPO: POStatus;

  // Invoice Status
  jdToBradfordInvoice: InvoiceStatus;
  bradfordToImpactInvoice: InvoiceStatus;
  impactToCustomerInvoice: InvoiceStatus;

  // Issues Summary
  hasIssues: boolean;
  issueCount: number;
  issues: string[];

  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface ValidationError {
  field: string;
  expected: number;
  actual: number;
  difference: number;
  severity: 'error' | 'warning';
}

/**
 * Audit a single job for missing POs, invoices, and amount discrepancies
 */
export async function auditJob(jobId: string): Promise<JobAudit> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
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
          pdfFile: true,
        },
      },
    },
  });

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const issues: string[] = [];

  // Check Impact → Bradford PO
  const impactToBradfordPO = job.purchaseOrders.find(
    (po) => po.originCompanyId === COMPANY_IDS.IMPACT_DIRECT && po.targetCompanyId === COMPANY_IDS.BRADFORD
  );

  const impactToBradfordStatus: POStatus = {
    exists: !!impactToBradfordPO,
    poId: impactToBradfordPO?.id,
    poNo: impactToBradfordPO?.poNo || undefined,
    amount: impactToBradfordPO ? Number(impactToBradfordPO.vendorAmount) : undefined,
    expectedAmount: Number(job.bradfordTotal),
    isValid: false,
    error: undefined,
  };

  if (!impactToBradfordPO) {
    issues.push('Missing Impact Direct → Bradford PO');
    impactToBradfordStatus.error = 'PO does not exist';
  } else if (Math.abs(Number(impactToBradfordPO.vendorAmount) - Number(job.bradfordTotal)) > 0.01) {
    issues.push('Impact → Bradford PO amount mismatch');
    impactToBradfordStatus.isValid = false;
    impactToBradfordStatus.error = `Amount mismatch: $${Number(impactToBradfordPO.vendorAmount).toFixed(2)} vs expected $${Number(job.bradfordTotal).toFixed(2)}`;
  } else {
    impactToBradfordStatus.isValid = true;
  }

  // Check Bradford → JD PO
  const bradfordToJDPO = job.purchaseOrders.find(
    (po) => po.originCompanyId === COMPANY_IDS.BRADFORD && po.targetCompanyId === COMPANY_IDS.JD_GRAPHIC
  );

  const bradfordToJDStatus: POStatus = {
    exists: !!bradfordToJDPO,
    poId: bradfordToJDPO?.id,
    poNo: bradfordToJDPO?.poNo || undefined,
    amount: bradfordToJDPO ? Number(bradfordToJDPO.vendorAmount) : undefined,
    expectedAmount: Number(job.jdTotal || 0),
    isValid: false,
    error: undefined,
  };

  if (!bradfordToJDPO) {
    // Only flag as issue if job is in production or completed
    if (['IN_PRODUCTION', 'READY_FOR_PROOF', 'PROOF_APPROVED', 'COMPLETED'].includes(job.status)) {
      issues.push('Missing Bradford → JD Graphic PO');
      bradfordToJDStatus.error = 'PO does not exist (expected for jobs in production)';
    } else {
      bradfordToJDStatus.error = 'PO not yet created (expected for pending jobs)';
    }
  } else if (job.jdTotal && Math.abs(Number(bradfordToJDPO.vendorAmount) - Number(job.jdTotal)) > 0.01) {
    issues.push('Bradford → JD PO amount mismatch');
    bradfordToJDStatus.isValid = false;
    bradfordToJDStatus.error = `Amount mismatch: $${Number(bradfordToJDPO.vendorAmount).toFixed(2)} vs expected $${Number(job.jdTotal).toFixed(2)}`;
  } else {
    bradfordToJDStatus.isValid = true;
  }

  // Check Invoices (only for COMPLETED jobs)
  const invoiceIssues = {
    jdToBradford: { exists: false } as InvoiceStatus,
    bradfordToImpact: { exists: false } as InvoiceStatus,
    impactToCustomer: { exists: false } as InvoiceStatus,
  };

  if (job.status === 'COMPLETED') {
    // JD → Bradford Invoice
    const jdToBradfordInv = job.invoices.find(
      (inv) => inv.fromCompanyId === COMPANY_IDS.JD_GRAPHIC && inv.toCompanyId === COMPANY_IDS.BRADFORD
    );

    invoiceIssues.jdToBradford = {
      exists: !!jdToBradfordInv,
      invoiceId: jdToBradfordInv?.id,
      invoiceNo: jdToBradfordInv?.invoiceNo || undefined,
      amount: jdToBradfordInv ? Number(jdToBradfordInv.amount) : undefined,
      expectedAmount: Number(job.jdTotal || 0),
      pdfGenerated: !!jdToBradfordInv?.pdfFileId,
      emailSent: !!jdToBradfordInv?.createdAt, // Assuming email sent on creation
      isValid: false,
      error: undefined,
    };

    if (!jdToBradfordInv) {
      issues.push('Missing JD → Bradford invoice (job is COMPLETED)');
      invoiceIssues.jdToBradford.error = 'Invoice not created for completed job';
    } else {
      invoiceIssues.jdToBradford.isValid = true;
    }

    // Bradford → Impact Invoice
    const bradfordToImpactInv = job.invoices.find(
      (inv) => inv.fromCompanyId === COMPANY_IDS.BRADFORD && inv.toCompanyId === COMPANY_IDS.IMPACT_DIRECT
    );

    invoiceIssues.bradfordToImpact = {
      exists: !!bradfordToImpactInv,
      invoiceId: bradfordToImpactInv?.id,
      invoiceNo: bradfordToImpactInv?.invoiceNo || undefined,
      amount: bradfordToImpactInv ? Number(bradfordToImpactInv.amount) : undefined,
      expectedAmount: Number(job.bradfordTotal),
      pdfGenerated: !!bradfordToImpactInv?.pdfFileId,
      emailSent: !!bradfordToImpactInv?.createdAt,
      isValid: false,
      error: undefined,
    };

    if (!bradfordToImpactInv) {
      issues.push('Missing Bradford → Impact invoice (job is COMPLETED)');
      invoiceIssues.bradfordToImpact.error = 'Invoice not created for completed job';
    } else {
      invoiceIssues.bradfordToImpact.isValid = true;
    }

    // Impact → Customer Invoice
    const impactToCustomerInv = job.invoices.find(
      (inv) => inv.fromCompanyId === COMPANY_IDS.IMPACT_DIRECT && inv.toCompanyId === job.customerId
    );

    invoiceIssues.impactToCustomer = {
      exists: !!impactToCustomerInv,
      invoiceId: impactToCustomerInv?.id,
      invoiceNo: impactToCustomerInv?.invoiceNo || undefined,
      amount: impactToCustomerInv ? Number(impactToCustomerInv.amount) : undefined,
      expectedAmount: Number(job.customerTotal),
      pdfGenerated: !!impactToCustomerInv?.pdfFileId,
      emailSent: !!impactToCustomerInv?.createdAt,
      isValid: false,
      error: undefined,
    };

    if (!impactToCustomerInv) {
      issues.push('Missing Impact → Customer invoice (job is COMPLETED)');
      invoiceIssues.impactToCustomer.error = 'Invoice not created for completed job';
    } else {
      invoiceIssues.impactToCustomer.isValid = true;
    }
  } else {
    // Job not completed, invoices not expected
    invoiceIssues.jdToBradford = {
      exists: false,
      expectedAmount: Number(job.jdTotal || 0),
      isValid: true, // Valid to not have invoices for non-completed jobs
      error: 'Invoices not expected until job is COMPLETED',
    };
    invoiceIssues.bradfordToImpact = {
      exists: false,
      expectedAmount: Number(job.bradfordTotal),
      isValid: true,
      error: 'Invoices not expected until job is COMPLETED',
    };
    invoiceIssues.impactToCustomer = {
      exists: false,
      expectedAmount: Number(job.customerTotal),
      isValid: true,
      error: 'Invoices not expected until job is COMPLETED',
    };
  }

  return {
    jobId: job.id,
    jobNo: job.jobNo,
    customerId: job.customerId,
    customerName: job.customer.name,
    status: job.status,

    customerTotal: Number(job.customerTotal),
    bradfordTotal: Number(job.bradfordTotal || 0),
    jdTotal: Number(job.jdTotal || 0),
    impactMargin: Number(job.impactMargin || 0),
    bradfordMargin: Number(job.bradfordPrintMargin || 0),

    impactToBradfordPO: impactToBradfordStatus,
    bradfordToJDPO: bradfordToJDStatus,

    jdToBradfordInvoice: invoiceIssues.jdToBradford,
    bradfordToImpactInvoice: invoiceIssues.bradfordToImpact,
    impactToCustomerInvoice: invoiceIssues.impactToCustomer,

    hasIssues: issues.length > 0,
    issueCount: issues.length,
    issues,

    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
  };
}

/**
 * Find all jobs with data integrity issues
 */
export async function findJobsWithIssues() {
  const allJobs = await prisma.job.findMany({
    include: {
      customer: true,
      purchaseOrders: true,
      invoices: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const jobsWithIssues: JobAudit[] = [];

  for (const job of allJobs) {
    const audit = await auditJob(job.id);
    if (audit.hasIssues) {
      jobsWithIssues.push(audit);
    }
  }

  return {
    total: allJobs.length,
    withIssues: jobsWithIssues.length,
    jobs: jobsWithIssues,
    summary: {
      missingImpactToBradfordPOs: jobsWithIssues.filter(j => !j.impactToBradfordPO.exists).length,
      missingBradfordToJDPOs: jobsWithIssues.filter(j => !j.bradfordToJDPO.exists && ['IN_PRODUCTION', 'COMPLETED'].includes(j.status)).length,
      missingInvoices: jobsWithIssues.filter(j => j.status === 'COMPLETED' && (!j.jdToBradfordInvoice.exists || !j.bradfordToImpactInvoice.exists || !j.impactToCustomerInvoice.exists)).length,
      amountMismatches: jobsWithIssues.filter(j => !j.impactToBradfordPO.isValid || !j.bradfordToJDPO.isValid).length,
    },
  };
}

/**
 * Auto-fix missing POs for a job using pricing rules
 */
export async function autoFixMissingPOs(jobId: string): Promise<{ created: string[] }> {
  const audit = await auditJob(jobId);
  const created: string[] = [];

  // Fix missing Impact → Bradford PO
  if (!audit.impactToBradfordPO.exists) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error(`Job ${jobId} not found`);

    await createAutoPurchaseOrder({
      jobId: job.id,
      originCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      targetCompanyId: COMPANY_IDS.BRADFORD,
      originalAmount: Number(job.customerTotal),
      vendorAmount: Number(job.bradfordTotal),
      customerPONumber: job.customerPONumber || undefined,
    });

    created.push('Impact Direct → Bradford PO');
  }

  // Note: Bradford → JD PO is created manually with PO# entry
  // We don't auto-create it here

  return { created };
}

/**
 * Auto-fix missing invoices for a COMPLETED job
 */
export async function autoFixMissingInvoices(jobId: string): Promise<{ created: string[] }> {
  const audit = await auditJob(jobId);

  if (audit.status !== 'COMPLETED') {
    throw new Error(`Job ${audit.jobNo} is not COMPLETED (status: ${audit.status})`);
  }

  const missingInvoices = [];
  if (!audit.jdToBradfordInvoice.exists) missingInvoices.push('JD → Bradford');
  if (!audit.bradfordToImpactInvoice.exists) missingInvoices.push('Bradford → Impact');
  if (!audit.impactToCustomerInvoice.exists) missingInvoices.push('Impact → Customer');

  if (missingInvoices.length === 0) {
    return { created: [] };
  }

  // Use existing invoice generation service
  await completeJobAndGenerateInvoices(jobId);

  return { created: missingInvoices };
}

/**
 * Validate amounts with strict checking
 */
export async function validateAmounts(jobId: string): Promise<ValidationError[]> {
  const audit = await auditJob(jobId);
  const errors: ValidationError[] = [];

  // Validate Impact → Bradford PO
  if (audit.impactToBradfordPO.exists && audit.impactToBradfordPO.amount) {
    const diff = Math.abs(audit.impactToBradfordPO.amount - audit.impactToBradfordPO.expectedAmount);
    if (diff > 0.01) {
      errors.push({
        field: 'Impact → Bradford PO (vendorAmount)',
        expected: audit.impactToBradfordPO.expectedAmount,
        actual: audit.impactToBradfordPO.amount,
        difference: diff,
        severity: 'error',
      });
    }
  }

  // Validate Bradford → JD PO
  if (audit.bradfordToJDPO.exists && audit.bradfordToJDPO.amount) {
    const diff = Math.abs(audit.bradfordToJDPO.amount - audit.bradfordToJDPO.expectedAmount);
    if (diff > 0.01) {
      errors.push({
        field: 'Bradford → JD PO (vendorAmount)',
        expected: audit.bradfordToJDPO.expectedAmount,
        actual: audit.bradfordToJDPO.amount,
        difference: diff,
        severity: 'error',
      });
    }
  }

  // Validate invoices (only if they exist)
  if (audit.jdToBradfordInvoice.exists && audit.jdToBradfordInvoice.amount) {
    const diff = Math.abs(audit.jdToBradfordInvoice.amount - audit.jdToBradfordInvoice.expectedAmount);
    if (diff > 0.01) {
      errors.push({
        field: 'JD → Bradford Invoice',
        expected: audit.jdToBradfordInvoice.expectedAmount,
        actual: audit.jdToBradfordInvoice.amount,
        difference: diff,
        severity: 'error',
      });
    }
  }

  if (audit.bradfordToImpactInvoice.exists && audit.bradfordToImpactInvoice.amount) {
    const diff = Math.abs(audit.bradfordToImpactInvoice.amount - audit.bradfordToImpactInvoice.expectedAmount);
    if (diff > 0.01) {
      errors.push({
        field: 'Bradford → Impact Invoice',
        expected: audit.bradfordToImpactInvoice.expectedAmount,
        actual: audit.bradfordToImpactInvoice.amount,
        difference: diff,
        severity: 'error',
      });
    }
  }

  if (audit.impactToCustomerInvoice.exists && audit.impactToCustomerInvoice.amount) {
    const diff = Math.abs(audit.impactToCustomerInvoice.amount - audit.impactToCustomerInvoice.expectedAmount);
    if (diff > 0.01) {
      errors.push({
        field: 'Impact → Customer Invoice',
        expected: audit.impactToCustomerInvoice.expectedAmount,
        actual: audit.impactToCustomerInvoice.amount,
        difference: diff,
        severity: 'error',
      });
    }
  }

  return errors;
}
