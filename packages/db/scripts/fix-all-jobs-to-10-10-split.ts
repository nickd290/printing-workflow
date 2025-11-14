/**
 * Fix All Jobs to Use 10/10 Margin Split
 *
 * This script updates ALL jobs in the database to use the 10/10 split:
 * - Impact gets 10% of customer total
 * - Bradford gets 10% of customer total
 * - JD gets remaining 80% of customer total
 *
 * It sets jdSuppliesPaper=true for all jobs and recalculates pricing.
 *
 * Usage:
 *   DATABASE_URL="file:/path/to/dev.db" npx tsx packages/db/scripts/fix-all-jobs-to-10-10-split.ts
 *
 *   Add --dry-run flag to preview changes:
 *   DATABASE_URL="file:..." npx tsx packages/db/scripts/fix-all-jobs-to-10-10-split.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { calculateFromCustomerTotal } from '../../shared/src/pricing-calculator';

const prisma = new PrismaClient();

// Check for dry-run flag
const isDryRun = process.argv.includes('--dry-run');

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
  oldJdSuppliesPaper?: boolean;
  newJdSuppliesPaper?: boolean;
}

async function fixAllJobs() {
  console.log('🔧 Fix All Jobs to Use 10/10 Margin Split\n');
  console.log('==========================================\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be saved\n');
  }

  // Find all jobs with financial data
  const jobs = await prisma.job.findMany({
    where: {
      AND: [
        {
          customerTotal: {
            not: 0,
          },
        },
        {
          quantity: {
            not: null,
          },
        },
        {
          sizeName: {
            not: null,
          },
        },
      ],
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`🎯 Found ${jobs.length} jobs with financial data\n`);

  const results: FixResult[] = [];
  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const job of jobs) {
    console.log(`\n📝 Processing Job: ${job.jobNo}`);
    console.log('==========================================');

    try {
      console.log(`   ✓ Job found (ID: ${job.id})`);
      console.log(`   Quantity: ${job.quantity?.toLocaleString() || 'NOT FOUND'}`);
      console.log(`   Size: ${job.sizeName}`);
      console.log(`   Old jdSuppliesPaper: ${job.jdSuppliesPaper ?? 'null'}`);

      // Validate quantity
      if (!job.quantity) {
        console.log(`   ⚠️  SKIPPED - Missing quantity`);
        results.push({
          jobNo: job.jobNo,
          status: 'skipped',
          reason: 'Missing quantity',
        });
        skippedCount++;
        continue;
      }

      // Validate size
      if (!job.sizeName) {
        console.log(`   ⚠️  SKIPPED - Missing size name`);
        results.push({
          jobNo: job.jobNo,
          status: 'skipped',
          reason: 'Missing size name',
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

      // Calculate pricing using 10/10 split (jdSuppliesPaper = true)
      console.log(`\n   🔄 Calculating with 10/10 split...`);

      const pricing = await calculateFromCustomerTotal(
        prisma,
        Number(job.customerTotal),
        job.quantity,
        job.sizeName,
        true  // Force 10/10 split
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
            // Set jdSuppliesPaper to true
            jdSuppliesPaper: true,

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
        jobNo: job.jobNo,
        status: 'success',
        oldJdSuppliesPaper: job.jdSuppliesPaper ?? undefined,
        newJdSuppliesPaper: true,
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
        jobNo: job.jobNo,
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

  console.log(`Total Jobs Processed: ${jobs.length}`);
  console.log(`✅ Successfully Fixed: ${successCount}`);
  console.log(`⚠️  Skipped: ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}\n`);

  if (skippedCount > 0) {
    console.log('\n⚠️  SKIPPED JOBS:');
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
      .slice(0, 10)  // Show first 10 to avoid overwhelming output
      .forEach(r => {
        console.log(`\n  ${r.jobNo}:`);
        console.log(`    jdSuppliesPaper: ${r.oldJdSuppliesPaper} → ${r.newJdSuppliesPaper}`);
        console.log(`    Customer Total: ${r.oldCustomerTotal} → ${r.newCustomerTotal}`);
        console.log(`    Bradford Total: ${r.oldBradfordTotal} → ${r.newBradfordTotal}`);
        console.log(`    JD Total: ${r.oldJdTotal} → ${r.newJdTotal}`);
        console.log(`    Impact Margin: ${r.oldImpactMargin} → ${r.newImpactMargin}`);
      });

    if (successCount > 10) {
      console.log(`\n  ... and ${successCount - 10} more jobs`);
    }
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN COMPLETE - No changes were saved');
    console.log('   Run without --dry-run flag to apply changes');
  }

  console.log('\n==========================================');
  console.log('✅ Fix Complete!\n');
}

// Run fix
fixAllJobs()
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
