/**
 * Fix Custom Pricing from Customer Invoices
 *
 * Issue: The fix-bradford-waives-totals.ts script incorrectly overwrote actual
 * customer quoted prices with standard pricing calculations. This script restores
 * the correct values using actual customer invoices as the source of truth.
 *
 * Root Cause: Impact Direct sometimes quotes customers below standard pricing.
 * This reduces the total margin pool, which is split 50/50 between Impact and Bradford.
 * The previous fix script used calculateDynamicPricing() which applies standard rates,
 * but it should have used calculateFromCustomerTotal() to preserve actual quotes.
 *
 * Solution: Use customer invoice amounts as source of truth and recalculate all
 * pricing fields while preserving the actual customer price.
 */

import { PrismaClient } from '@prisma/client';
import { calculateFromCustomerTotal } from '../../shared/src/pricing-calculator';

const prisma = new PrismaClient();

async function main() {
  console.log('\n========================================');
  console.log('🔧 Fixing Custom Pricing from Customer Invoices');
  console.log('========================================\n');

  // Find jobs with bradfordWaivesPaperMargin that have customer invoices
  const jobs = await prisma.job.findMany({
    where: {
      bradfordWaivesPaperMargin: true,
    },
    include: {
      invoices: {
        where: {
          fromCompanyId: 'impact-direct',
          // This is the invoice TO the customer FROM Impact
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1, // Get the most recent invoice
      },
    },
  });

  console.log(`Found ${jobs.length} jobs with Bradford waives paper margin\n`);

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const job of jobs) {
    try {
      // Check if there's a customer invoice
      if (!job.invoices || job.invoices.length === 0) {
        console.log(`⚠️  ${job.jobNo}: No customer invoice found, skipping`);
        skipped++;
        continue;
      }

      const customerInvoice = job.invoices[0];
      const actualCustomerTotal = Number(customerInvoice.amount);

      console.log(`\n📋 Processing ${job.jobNo}`);
      console.log(`   Size: ${job.sizeName}, Quantity: ${job.quantity.toLocaleString()}`);
      console.log(`   Customer Invoice: ${customerInvoice.invoiceNo} → $${actualCustomerTotal.toFixed(2)}`);

      // Check if the current customerTotal matches the invoice
      const currentCustomerTotal = Number(job.customerTotal);
      if (Math.abs(currentCustomerTotal - actualCustomerTotal) < 0.01) {
        console.log(`   ✅ SKIP - Customer total already matches invoice`);
        console.log(`      Current: $${currentCustomerTotal.toFixed(2)}`);
        console.log(`      Invoice: $${actualCustomerTotal.toFixed(2)}`);
        skipped++;
        continue;
      }

      console.log(`   Current DB Customer Total: $${currentCustomerTotal.toFixed(2)}`);
      console.log(`   Actual Invoice Amount: $${actualCustomerTotal.toFixed(2)}`);
      console.log(`   Difference: $${(actualCustomerTotal - currentCustomerTotal).toFixed(2)}`);

      // Recalculate pricing using the ACTUAL customer invoice amount
      const pricing = await calculateFromCustomerTotal(
        prisma,
        actualCustomerTotal,
        Number(job.quantity),
        job.sizeName,
        job.jdSuppliesPaper,
        job.bradfordWaivesPaperMargin
      );

      // Update job with corrected pricing
      await prisma.job.update({
        where: { id: job.id },
        data: {
          // CPM fields
          customerCPM: pricing.customerCPM,
          impactMarginCPM: pricing.impactMarginCPM,
          bradfordTotalCPM: pricing.bradfordTotalCPM,
          bradfordPrintMarginCPM: pricing.bradfordPrintMarginCPM,
          bradfordPaperMarginCPM: pricing.bradfordPaperMarginCPM,
          bradfordTotalMarginCPM: pricing.bradfordTotalMarginCPM,
          printCPM: pricing.printCPM,
          paperCostCPM: pricing.paperCostCPM,
          paperChargedCPM: pricing.paperChargedCPM,

          // Total fields
          customerTotal: pricing.customerTotal,
          impactMargin: pricing.impactMargin,
          bradfordTotal: pricing.bradfordTotal,
          bradfordPrintMargin: pricing.bradfordPrintMargin,
          bradfordPaperMargin: pricing.bradfordPaperMargin,
          bradfordTotalMargin: pricing.bradfordTotalMargin,
          jdTotal: pricing.jdTotal,
          paperCostTotal: pricing.paperCostTotal,
          paperChargedTotal: pricing.paperChargedTotal,
        },
      });

      // Log the activity
      await prisma.jobActivity.create({
        data: {
          jobId: job.id,
          action: 'update',
          field: 'customerTotal',
          oldValue: `$${currentCustomerTotal.toFixed(2)}`,
          newValue: `$${actualCustomerTotal.toFixed(2)} (from invoice ${customerInvoice.invoiceNo})`,
          changedBy: 'system-fix-script',
          changedByRole: 'system',
        },
      });

      console.log(`   ✅ FIXED`);
      console.log(`      Customer Total: $${currentCustomerTotal.toFixed(2)} → $${pricing.customerTotal.toFixed(2)}`);
      console.log(`      Impact Margin: $${Number(job.impactMargin || 0).toFixed(2)} → $${pricing.impactMargin.toFixed(2)}`);
      console.log(`      Bradford Total: $${Number(job.bradfordTotal || 0).toFixed(2)} → $${pricing.bradfordTotal.toFixed(2)}`);
      console.log(`      Bradford Margin: $${Number(job.bradfordPrintMargin || 0).toFixed(2)} → $${pricing.bradfordPrintMargin.toFixed(2)}`);
      fixed++;
    } catch (error) {
      console.error(`   ❌ ${job.jobNo}: ${error.message}`);
      errors++;
    }
  }

  console.log('\n========================================');
  console.log('📊 Summary');
  console.log('========================================');
  console.log(`Total jobs checked: ${jobs.length}`);
  console.log(`Successfully fixed: ${fixed}`);
  console.log(`Already correct (skipped): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log('========================================\n');

  if (fixed > 0) {
    console.log('✅ Next steps:');
    console.log('   1. Run fix-po-vendor-amounts.ts to update PO amounts');
    console.log('   2. Verify data matches customer invoices\n');
  }
}

main()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
