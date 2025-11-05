/**
 * Recalculate All Jobs with CSV Pricing
 *
 * Updates all existing jobs with new pricing from CSV-based pricing rules.
 * Handles size name normalization and reports results.
 *
 * Usage:
 *   DATABASE_URL="file:/Users/nicholasdeblasio/printing-workflow/packages/db/prisma/dev.db" npx tsx packages/db/scripts/recalculate-jobs.ts
 *
 *   Add --dry-run flag to preview changes without applying:
 *   DATABASE_URL="file:..." npx tsx packages/db/scripts/recalculate-jobs.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { calculateDynamicPricing } from '../../shared/src/pricing-calculator';

const prisma = new PrismaClient();

// Check for dry-run flag
const isDryRun = process.argv.includes('--dry-run');

/**
 * Normalize size names to match pricing rule format
 */
function normalizeSizeName(sizeName: string): string {
  const cleaned = sizeName.trim();

  // Handle reversed dimensions (26 x 9.75 → 9 3/4 x 26)
  if (cleaned === '26 x 9.75') return '9 3/4 x 26';

  // Handle spacing differences (6 x 11 → 6 x11)
  if (cleaned === '6 x 11') return '6 x11';

  return cleaned;
}

interface RecalculationResult {
  jobNo: string;
  sizeName: string;
  quantity: number;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  oldCustomerTotal?: number;
  newCustomerTotal?: number;
  oldImpactMargin?: number;
  newImpactMargin?: number;
}

async function recalculateJobs() {
  console.log('🔄 Recalculating All Jobs with CSV Pricing\n');
  console.log('==========================================\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be saved\n');
  }

  // Load all jobs
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📊 Found ${jobs.length} jobs to process\n`);

  const results: RecalculationResult[] = [];
  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const job of jobs) {
    console.log(`\n📝 Processing Job: ${job.jobNo}`);
    console.log(`   Original Size: "${job.sizeName}"`);
    console.log(`   Quantity: ${job.quantity?.toLocaleString() || 'N/A'}`);

    try {
      // Skip if no size name or quantity
      if (!job.sizeName || !job.quantity) {
        console.log(`   ⚠️  SKIPPED - Missing size name or quantity`);
        results.push({
          jobNo: job.jobNo,
          sizeName: job.sizeName || 'N/A',
          quantity: job.quantity || 0,
          status: 'skipped',
          reason: 'Missing size name or quantity',
        });
        skippedCount++;
        continue;
      }

      // Normalize size name
      const normalizedSize = normalizeSizeName(job.sizeName);
      console.log(`   Normalized Size: "${normalizedSize}"`);

      // Check if pricing rule has CSV data before calculating
      const pricingRule = await prisma.pricingRule.findUnique({
        where: { sizeName: normalizedSize, isActive: true },
      });

      if (!pricingRule || !pricingRule.bradfordInvoicePerM || !pricingRule.jdInvoicePerM) {
        console.log(`   ⚠️  SKIPPED - No CSV pricing data available for this size`);
        results.push({
          jobNo: job.jobNo,
          sizeName: job.sizeName,
          quantity: job.quantity,
          status: 'skipped',
          reason: `No CSV pricing rule for size "${normalizedSize}"`,
        });
        skippedCount++;
        continue;
      }

      // Calculate new pricing
      const pricing = await calculateDynamicPricing(
        prisma,
        normalizedSize,
        job.quantity
      );

      console.log(`   ✓ Pricing calculated successfully`);
      console.log(`   Customer Total: $${Number(job.customerTotal || 0).toFixed(2)} → $${pricing.customerTotal.toFixed(2)}`);
      console.log(`   Impact Margin: $${Number(job.impactMargin || 0).toFixed(2)} → $${pricing.impactMargin.toFixed(2)}`);
      console.log(`   Bradford Total: $${Number(job.bradfordTotal || 0).toFixed(2)} → $${pricing.bradfordTotal.toFixed(2)}`);

      if (!isDryRun) {
        // Update job with new pricing
        await prisma.job.update({
          where: { id: job.id },
          data: {
            // Update size name to normalized version
            sizeName: normalizedSize,

            // Total amounts
            customerTotal: pricing.customerTotal,
            impactMargin: pricing.impactMargin,
            bradfordTotal: pricing.bradfordTotal,
            bradfordPrintMargin: pricing.bradfordPrintMargin,
            bradfordPaperMargin: pricing.bradfordPaperMargin,
            bradfordTotalMargin: pricing.bradfordTotalMargin,
            jdTotal: pricing.jdTotal,
            paperCostTotal: pricing.paperCostTotal,
            paperChargedTotal: pricing.paperChargedTotal,

            // CPM rates
            customerCPM: pricing.customerCPM,
            impactMarginCPM: pricing.impactMarginCPM,
            bradfordTotalCPM: pricing.bradfordTotalCPM,
            bradfordPrintMarginCPM: pricing.bradfordPrintMarginCPM,
            bradfordPaperMarginCPM: pricing.bradfordPaperMarginCPM,
            bradfordTotalMarginCPM: pricing.bradfordTotalMarginCPM,
            printCPM: pricing.printCPM,
            paperCostCPM: pricing.paperCostCPM,
            paperChargedCPM: pricing.paperChargedCPM,

            // Paper details
            paperWeightPer1000: pricing.paperWeightPer1000,
            paperWeightTotal: pricing.paperWeightTotal,
          },
        });
        console.log(`   ✅ Updated successfully`);
      } else {
        console.log(`   💾 Would update (dry-run mode)`);
      }

      results.push({
        jobNo: job.jobNo,
        sizeName: job.sizeName,
        quantity: job.quantity,
        status: 'success',
        oldCustomerTotal: Number(job.customerTotal || 0),
        newCustomerTotal: pricing.customerTotal,
        oldImpactMargin: Number(job.impactMargin || 0),
        newImpactMargin: pricing.impactMargin,
      });
      successCount++;

    } catch (error: any) {
      console.error(`   ❌ ERROR: ${error.message}`);

      results.push({
        jobNo: job.jobNo,
        sizeName: job.sizeName || 'N/A',
        quantity: job.quantity || 0,
        status: 'error',
        reason: error.message,
      });
      errorCount++;
    }
  }

  // Print summary report
  console.log('\n\n==========================================');
  console.log('📊 RECALCULATION SUMMARY');
  console.log('==========================================\n');

  console.log(`Total Jobs Processed: ${jobs.length}`);
  console.log(`✅ Successfully Recalculated: ${successCount}`);
  console.log(`⚠️  Skipped: ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}\n`);

  if (skippedCount > 0) {
    console.log('\n⚠️  SKIPPED JOBS (Need Manual Review):');
    console.log('==========================================');
    results
      .filter(r => r.status === 'skipped')
      .forEach(r => {
        console.log(`  ${r.jobNo}: ${r.reason}`);
      });
  }

  if (errorCount > 0) {
    console.log('\n❌ FAILED JOBS:');
    console.log('==========================================');
    results
      .filter(r => r.status === 'error')
      .forEach(r => {
        console.log(`  ${r.jobNo} (${r.sizeName}): ${r.reason}`);
      });
  }

  if (successCount > 0) {
    console.log('\n✅ SUCCESSFULLY RECALCULATED JOBS:');
    console.log('==========================================');

    let totalOldCustomer = 0;
    let totalNewCustomer = 0;
    let totalOldMargin = 0;
    let totalNewMargin = 0;

    results
      .filter(r => r.status === 'success')
      .forEach(r => {
        console.log(`  ${r.jobNo}: $${r.oldCustomerTotal?.toFixed(2)} → $${r.newCustomerTotal?.toFixed(2)}`);
        totalOldCustomer += r.oldCustomerTotal || 0;
        totalNewCustomer += r.newCustomerTotal || 0;
        totalOldMargin += r.oldImpactMargin || 0;
        totalNewMargin += r.newImpactMargin || 0;
      });

    console.log('\n📈 TOTALS:');
    console.log(`  Total Customer Revenue: $${totalOldCustomer.toFixed(2)} → $${totalNewCustomer.toFixed(2)}`);
    console.log(`  Total Impact Margin: $${totalOldMargin.toFixed(2)} → $${totalNewMargin.toFixed(2)}`);
    console.log(`  Difference: ${totalNewCustomer > totalOldCustomer ? '+' : ''}$${(totalNewCustomer - totalOldCustomer).toFixed(2)}`);
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN COMPLETE - No changes were saved');
    console.log('   Run without --dry-run flag to apply changes');
  }

  console.log('\n==========================================');
  console.log('✅ Recalculation Complete!\n');
}

// Run recalculation
recalculateJobs()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Recalculation failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
