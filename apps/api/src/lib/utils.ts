import { prisma } from '@printing-workflow/db';
import { JOB_NUMBER_PREFIX, INVOICE_NUMBER_PREFIX } from '@printing-workflow/shared';

/**
 * Generate job number in format J-YYYY-NNNNNN
 */
export async function generateJobNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${JOB_NUMBER_PREFIX}${year}-`;

  // Find the highest job number for this year
  const latestJob = await prisma.job.findFirst({
    where: {
      jobNo: {
        startsWith: prefix,
      },
    },
    orderBy: {
      jobNo: 'desc',
    },
  });

  let nextNumber = 1;
  if (latestJob) {
    // Extract number from J-YYYY-NNNNNN
    const parts = latestJob.jobNo.split('-');
    const currentNumber = parseInt(parts[2], 10);
    nextNumber = currentNumber + 1;
  }

  // Pad with zeros to 6 digits
  const paddedNumber = nextNumber.toString().padStart(6, '0');
  return `${prefix}${paddedNumber}`;
}

/**
 * Generate invoice number in format INV-YYYY-NNNNNN
 */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${INVOICE_NUMBER_PREFIX}${year}-`;

  const latestInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNo: {
        startsWith: prefix,
      },
    },
    orderBy: {
      invoiceNo: 'desc',
    },
  });

  let nextNumber = 1;
  if (latestInvoice) {
    const parts = latestInvoice.invoiceNo.split('-');
    const currentNumber = parseInt(parts[2], 10);
    nextNumber = currentNumber + 1;
  }

  const paddedNumber = nextNumber.toString().padStart(6, '0');
  return `${prefix}${paddedNumber}`;
}

/**
 * Calculate amounts for auto-PO creation
 */
export function calculatePOAmounts(customerTotal: number) {
  const vendorAmount = customerTotal * 0.8; // 80% to vendor
  const marginAmount = customerTotal * 0.2; // 20% margin

  return {
    vendorAmount: parseFloat(vendorAmount.toFixed(2)),
    marginAmount: parseFloat(marginAmount.toFixed(2)),
  };
}
