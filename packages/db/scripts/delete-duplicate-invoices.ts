#!/usr/bin/env tsx
/**
 * Delete duplicate customer invoices
 *
 * This script removes invoices where the toCompanyId doesn't match the job's customerId.
 * These are duplicate invoices created in error.
 */

import { prisma } from '@printing-workflow/db';

async function deleteDuplicateInvoices() {
  console.log('🔍 Finding incorrect customer invoices...\n');

  // Use raw SQL to find invoices where toCompanyId doesn't match the job's customerId
  const incorrectInvoices = await prisma.$queryRaw<
    Array<{
      id: string;
      invoiceNo: string;
      jobNo: string;
      jobCustomerName: string;
      invoiceCustomerName: string;
    }>
  >`
    SELECT
      i.id,
      i."invoiceNo",
      j."jobNo",
      c1.name as "jobCustomerName",
      c2.name as "invoiceCustomerName"
    FROM "Invoice" i
    JOIN "Job" j ON i."jobId" = j.id
    JOIN "Company" c1 ON j."customerId" = c1.id
    JOIN "Company" c2 ON i."toCompanyId" = c2.id
    JOIN "Company" c3 ON i."fromCompanyId" = c3.id
    WHERE c3.name = 'Impact Direct'
      AND i."toCompanyId" != j."customerId"
    ORDER BY j."jobNo", i."invoiceNo"
  `;

  console.log(`Found ${incorrectInvoices.length} incorrect invoices:\n`);

  incorrectInvoices.forEach((inv) => {
    console.log(
      `  ❌ ${inv.invoiceNo} - Job ${inv.jobNo} (customer: ${inv.jobCustomerName}) incorrectly invoiced to ${inv.invoiceCustomerName}`
    );
  });

  if (incorrectInvoices.length === 0) {
    console.log('\n✅ No incorrect invoices found!');
    return;
  }

  console.log(`\n🗑️  Deleting ${incorrectInvoices.length} incorrect invoices...\n`);

  // Delete each invoice
  for (const inv of incorrectInvoices) {
    await prisma.invoice.delete({
      where: { id: inv.id },
    });
    console.log(`  ✓ Deleted ${inv.invoiceNo}`);
  }

  console.log(`\n✅ Successfully deleted ${incorrectInvoices.length} incorrect invoices!`);

  // Verify results
  console.log('\n📊 Verification:');

  const totalInvoices = await prisma.invoice.count();
  const totalPOs = await prisma.purchaseOrder.count();

  console.log(`  Total Invoices: ${totalInvoices}`);
  console.log(`  Total POs: ${totalPOs}`);

  // Check for any remaining jobs with multiple customer invoices
  const jobsWithMultipleInvoices = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(DISTINCT j.id) as count
    FROM "Job" j
    INNER JOIN "Invoice" i ON j.id = i."jobId"
    INNER JOIN "Company" c ON c.id = i."fromCompanyId"
    WHERE c.name = 'Impact Direct'
    GROUP BY j.id
    HAVING COUNT(i.id) > 1
  `;

  const jobCount = jobsWithMultipleInvoices[0]?.count || 0;

  if (jobCount > 0) {
    console.log(`  ⚠️  ${jobCount} jobs still have multiple customer invoices`);
  } else {
    console.log(`  ✅ All jobs now have exactly one customer invoice`);
  }
}

deleteDuplicateInvoices()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
