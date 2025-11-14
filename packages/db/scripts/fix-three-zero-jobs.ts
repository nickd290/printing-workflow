/**
 * Fix Three Jobs with $0 Financial Fields (CORRECTED VERSION)
 *
 * This script fixes 3 jobs that have customerTotal set but missing Bradford/JD totals.
 * It PRESERVES the existing customerTotal and calculates Bradford/JD split based on pricing rules.
 *
 * Special handling:
 * - J-2025-889850 & J-2025-889851: Set customerTotal to $450 (15,000 × $30/M), use 6x9 rules
 * - J-2025-642385: Already fixed by revert script (skipped here)
 *
 * Usage:
 *   DATABASE_URL="file:/path/to/dev.db" npx tsx packages/db/scripts/fix-three-zero-jobs.ts
 *
 *   Add --dry-run flag to preview changes:
 *   DATABASE_URL="file:..." npx tsx packages/db/scripts/fix-three-zero-jobs.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { calculateFromCustomerTotal } from '../../shared/src/pricing-calculator';

const prisma = new PrismaClient();

// Check for dry-run flag
const isDryRun = process.argv.includes('--dry-run');

// Job-specific configuration
const JOB_CONFIG = {
  'J-2025-889851': {
    customerTotal: 450,  // 15,000 × $30/M
    pricingSize: '6 x 9',  // Use 6x9 rules per user specification
  },
  'J-2025-889850': {
    customerTotal: 450,  // 15,000 × $30/M
    pricingSize: '6 x 9',  // Use 6x9 rules per user specification
  },
  'J-2025-642385': {
    // Skip - already handled by revert script
    skip: true,
    reason: 'Already fixed by revert-j2025-642385.ts script',
  },
};

interface FixResult {
  jobNo: string;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  oldCustomerTotal?: string;
  newCustomerTotal?: string;
  oldBradfordTotal?: string;
  newBradfordTotal?: string;
  oldJdTotal?: string;
  newJdTotal?: string;
  oldImpactMargin?: string;
  newImpactMargin?: string;
}

async function fixThreeJobs() {
  console.log('🔧 Fix Three Jobs with $0 Financial Fields (CORRECTED)\n');
  console.log('==========================================\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be saved\n');
  }

  const jobNumbers = Object.keys(JOB_CONFIG);
  console.log(`🎯 Target Jobs: ${jobNumbers.join(', ')}\n`);

  const results: FixResult[] = [];
  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const jobNo of jobNumbers) {
    console.log(`\n📝 Processing Job: ${jobNo}`);
    console.log('==========================================');

    const config = JOB_CONFIG[jobNo as keyof typeof JOB_CONFIG];

    // Check if job should be skipped
    if ('skip' in config && config.skip) {
      console.log(`   ⚠️  SKIPPED - ${config.reason}`);
      results.push({
        jobNo,
        status: 'skipped',
        reason: config.reason,
      });
      skippedCount++;
      continue;
    }

    try {
      // Find the job
      const job = await prisma.job.findUnique({
        where: { jobNo },
      });

      if (!job) {
        console.log(`   ❌ Job not found in database`);
        results.push({
          jobNo,
          status: 'error',
          reason: 'Job not found in database',
        });
        errorCount++;
        continue;
      }

      console.log(`   ✓ Job found (ID: ${job.id})`);
      console.log(`   Quantity: ${job.quantity?.toLocaleString() || 'NOT FOUND'}`);

      // Validate quantity
      if (!job.quantity) {
        console.log(`   ⚠️  SKIPPED - Missing quantity`);
        results.push({
          jobNo,
          status: 'skipped',
          reason: 'Missing quantity',
        });
        skippedCount++;
        continue;
      }

      // Get config for this job
      const customerTotal = 'customerTotal' in config ? config.customerTotal : Number(job.customerTotal);
      const pricingSize = 'pricingSize' in config ? config.pricingSize : job.sizeName;

      if (!pricingSize) {
        console.log(`   ⚠️  SKIPPED - No pricing size available`);
        results.push({
          jobNo,
          status: 'skipped',
          reason: 'No pricing size available',
        });
        skippedCount++;
        continue;
      }

      // Display current values
      console.log(`\n   Current Financial Values:`);
      console.log(`   - Customer Total: $${Number(job.customerTotal || 0).toFixed(2)}`);
      console.log(`   - Bradford Total: $${Number(job.bradfordTotal || 0).toFixed(2)}`);
      console.log(`   - JD Total: $${Number(job.jdTotal || 0).toFixed(2)}`);
      console.log(`   - Impact Margin: $${Number(job.impactMargin || 0).toFixed(2)}`);

      // Calculate pricing using REVERSE calculation (preserve customerTotal)
      console.log(`\n   🔄 Calculating Bradford/JD split...`);
      console.log(`   - Customer Total (input): $${customerTotal.toFixed(2)}`);
      console.log(`   - Pricing Size (for rules): ${pricingSize}`);

      const pricing = await calculateFromCustomerTotal(
        prisma,
        customerTotal,
        job.quantity,
        pricingSize,
        job.jdSuppliesPaper || false
      );

      console.log(`   ✓ Pricing calculated successfully\n`);
      console.log(`   New Financial Values:`);
      console.log(`   - Customer Total: $${pricing.customerTotal.toFixed(2)}`);
      console.log(`   - Bradford Total: $${pricing.bradfordTotal.toFixed(2)}`);
      console.log(`   - JD Total: $${pricing.jdTotal.toFixed(2)}`);
      console.log(`   - Impact Margin: $${pricing.impactMargin.toFixed(2)}`);

      if (!isDryRun) {
        // Update job with new pricing
        await prisma.job.update({
          where: { id: job.id },
          data: {
            // Update size name to the one used for pricing
            sizeName: pricingSize,
            quantity: job.quantity,

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
        console.log(`\n   ✅ Job updated successfully`);
      } else {
        console.log(`\n   💾 Would update (dry-run mode)`);
      }

      results.push({
        jobNo,
        status: 'success',
        oldCustomerTotal: `$${Number(job.customerTotal || 0).toFixed(2)}`,
        newCustomerTotal: `$${pricing.customerTotal.toFixed(2)}`,
        oldBradfordTotal: `$${Number(job.bradfordTotal || 0).toFixed(2)}`,
        newBradfordTotal: `$${pricing.bradfordTotal.toFixed(2)}`,
        oldJdTotal: `$${Number(job.jdTotal || 0).toFixed(2)}`,
        newJdTotal: `$${pricing.jdTotal.toFixed(2)}`,
        oldImpactMargin: `$${Number(job.impactMargin || 0).toFixed(2)}`,
        newImpactMargin: `$${pricing.impactMargin.toFixed(2)}`,
      });
      successCount++;

    } catch (error: any) {
      console.error(`\n   ❌ ERROR: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`);
      }

      results.push({
        jobNo,
        status: 'error',
        reason: error.message,
      });
      errorCount++;
    }
  }

  // Print summary report
  console.log('\n\n==========================================');
  console.log('📊 FIX SUMMARY');
  console.log('==========================================\n');

  console.log(`Total Jobs Targeted: ${jobNumbers.length}`);
  console.log(`✅ Successfully Fixed: ${successCount}`);
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
        console.log(`  ${r.jobNo}: ${r.reason}`);
      });
  }

  if (successCount > 0) {
    console.log('\n✅ SUCCESSFULLY FIXED JOBS:');
    console.log('==========================================');

    results
      .filter(r => r.status === 'success')
      .forEach(r => {
        console.log(`\n  ${r.jobNo}:`);
        console.log(`    Customer Total: ${r.oldCustomerTotal} → ${r.newCustomerTotal}`);
        console.log(`    Bradford Total: ${r.oldBradfordTotal} → ${r.newBradfordTotal}`);
        console.log(`    JD Total: ${r.oldJdTotal} → ${r.newJdTotal}`);
        console.log(`    Impact Margin: ${r.oldImpactMargin} → ${r.newImpactMargin}`);
      });
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN COMPLETE - No changes were saved');
    console.log('   Run without --dry-run flag to apply changes');
  }

  console.log('\n==========================================');
  console.log('✅ Fix Complete!\n');
}

// Run fix
fixThreeJobs()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
