/**
 * Fix Bradford Waives Paper Margin - Recalculate Totals
 *
 * Issue: Some jobs with bradfordWaivesPaperMargin=true have stale
 * impactMargin and bradfordTotal values from before the paperMarkupCPM bug fix.
 *
 * This script recalculates ALL pricing fields for jobs with the Bradford waives
 * paper margin flag, ensuring list view matches popup calculations.
 */

import { PrismaClient } from '@prisma/client';
import { calculateDynamicPricing, calculateFromCustomerTotal } from '../../shared/src/pricing-calculator';

const prisma = new PrismaClient();

async function main() {
  console.log('\n========================================');
  console.log('🔧 Fixing Bradford Waives Paper Margin Jobs');
  console.log('========================================\n');

  // Find all jobs with Bradford waives paper margin flag
  const jobs = await prisma.job.findMany({
    where: {
      bradfordWaivesPaperMargin: true,
    },
    select: {
      id: true,
      jobNo: true,
      sizeName: true,
      quantity: true,
      customerTotal: true,
      impactMargin: true,
      bradfordTotal: true,
      bradfordPrintMargin: true,
      bradfordPaperMargin: true,
      bradfordTotalMargin: true,
      jdSuppliesPaper: true,
      bradfordWaivesPaperMargin: true,
      invoices: {
        where: {
          fromCompanyId: 'impact-direct',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  console.log(`Found ${jobs.length} jobs with Bradford waives paper margin\n`);

  if (jobs.length === 0) {
    console.log('✅ No jobs to fix!');
    return;
  }

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const job of jobs) {
    try {
      console.log(`\n📋 Processing ${job.jobNo}`);
      console.log(`   Size: ${job.sizeName}, Quantity: ${job.quantity.toLocaleString()}`);

      // Check if there's a customer invoice - if so, use it as source of truth
      const hasCustomerInvoice = job.invoices && job.invoices.length > 0;
      let pricing;

      if (hasCustomerInvoice) {
        const invoiceAmount = Number(job.invoices[0].amount);
        console.log(`   📄 Customer invoice found: ${job.invoices[0].invoiceNo} = $${invoiceAmount.toFixed(2)}`);
        console.log(`   ⚠️  Preserving actual customer price (not using standard pricing)`);

        // Use actual invoiced amount to calculate margins
        pricing = await calculateFromCustomerTotal(
          prisma,
          invoiceAmount,
          Number(job.quantity),
          job.sizeName,
          job.jdSuppliesPaper,
          job.bradfordWaivesPaperMargin
        );
      } else {
        // No invoice - use standard pricing calculator
        console.log(`   📐 No customer invoice - using standard pricing rules`);
        pricing = await calculateDynamicPricing(
          prisma,
          job.sizeName,
          job.quantity,
          undefined, // no overrides
          job.jdSuppliesPaper,
          job.bradfordWaivesPaperMargin
        );
      }

      // Check if values need updating (allow 1 cent tolerance for rounding)
      const customerTotalMatch = Math.abs(Number(job.customerTotal) - pricing.customerTotal) < 0.01;
      const impactMarginMatch = Math.abs(Number(job.impactMargin || 0) - pricing.impactMargin) < 0.01;
      const bradfordTotalMatch = Math.abs(Number(job.bradfordTotal || 0) - pricing.bradfordTotal) < 0.01;

      if (customerTotalMatch && impactMarginMatch && bradfordTotalMatch) {
        console.log(`   ✅ SKIP - Values are already correct`);
        console.log(`      Customer Total: $${Number(job.customerTotal).toFixed(2)}`);
        console.log(`      Impact Margin: $${Number(job.impactMargin || 0).toFixed(2)}`);
        console.log(`      Bradford Total: $${Number(job.bradfordTotal || 0).toFixed(2)}`);
        skipped++;
        continue;
      }

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

      console.log(`   ✅ FIXED`);
      console.log(`      Customer Total: $${Number(job.customerTotal).toFixed(2)} → $${pricing.customerTotal.toFixed(2)}`);
      console.log(`      Impact Margin: $${Number(job.impactMargin || 0).toFixed(2)} → $${pricing.impactMargin.toFixed(2)}`);
      console.log(`      Bradford Total: $${Number(job.bradfordTotal || 0).toFixed(2)} → $${pricing.bradfordTotal.toFixed(2)}`);
      console.log(`      Bradford Paper Margin: $${Number(job.bradfordPaperMargin || 0).toFixed(2)} → $${pricing.bradfordPaperMargin.toFixed(2)}`);
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
}

main()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
