/**
 * Fix CPM Rates for Size "9 3/4 x 26" Jobs
 *
 * Three jobs with size "9 3/4 x 26" have incorrect CPM rates stored in their
 * Purchase Orders. This script fixes them and recalculates all related amounts.
 *
 * Jobs to fix:
 * - J-2025-646183: CPM 61.09 → 49.18
 * - J-2025-216133: CPM 86.09 → 49.18
 * - J-2025-710561: CPM 50.41 → 49.18
 *
 * Usage:
 *   DATABASE_URL="file:/Users/nicholasdeblasio/printing-workflow/packages/db/prisma/dev.db" npx tsx packages/db/scripts/fix-926-cpm-rates.ts
 *
 *   Add --dry-run flag to preview changes:
 *   DATABASE_URL="file:..." npx tsx packages/db/scripts/fix-926-cpm-rates.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { calculateDynamicPricing } from '../../shared/src/pricing-calculator';

const prisma = new PrismaClient();

// Check for dry-run flag
const isDryRun = process.argv.includes('--dry-run');

const CORRECT_CPM = 49.18;
const TARGET_SIZE = '9 3/4 x 26';
const TARGET_JOBS = ['J-2025-646183', 'J-2025-216133', 'J-2025-710561'];

interface FixResult {
  jobNo: string;
  quantity: number;
  status: 'success' | 'error';
  oldCPM: number;
  newCPM: number;
  oldJdTotal: number;
  newJdTotal: number;
  reason?: string;
}

async function fixCPMRates() {
  console.log('🔧 Fixing CPM Rates for Size "9 3/4 x 26"\n');
  console.log('==========================================\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be saved\n');
  }

  console.log(`Target Size: ${TARGET_SIZE}`);
  console.log(`Correct CPM: ${CORRECT_CPM}`);
  console.log(`Jobs to fix: ${TARGET_JOBS.join(', ')}\n`);

  const results: FixResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const jobNo of TARGET_JOBS) {
    console.log(`\n📝 Processing Job: ${jobNo}`);

    try {
      // Find job with its purchase orders
      const job = await prisma.job.findFirst({
        where: { jobNo },
        include: {
          purchaseOrders: {
            include: {
              originCompany: true,
              targetCompany: true,
            },
          },
          invoices: true,
        },
      });

      if (!job) {
        console.error(`   ❌ Job not found: ${jobNo}`);
        results.push({
          jobNo,
          quantity: 0,
          status: 'error',
          oldCPM: 0,
          newCPM: CORRECT_CPM,
          oldJdTotal: 0,
          newJdTotal: 0,
          reason: 'Job not found',
        });
        errorCount++;
        continue;
      }

      console.log(`   Size: ${job.sizeName}`);
      console.log(`   Quantity: ${job.quantity?.toLocaleString()}`);

      // Verify size matches
      if (job.sizeName !== TARGET_SIZE) {
        console.warn(`   ⚠️  Size mismatch: expected "${TARGET_SIZE}", got "${job.sizeName}"`);
      }

      // Find Bradford→JD purchase order (using company IDs)
      const bradfordToJdPO = job.purchaseOrders.find(
        (po) =>
          po.originCompanyId === 'bradford' &&
          po.targetCompanyId === 'jd-graphic'
      );

      if (!bradfordToJdPO) {
        console.error(`   ❌ Bradford→JD PO not found`);
        results.push({
          jobNo,
          quantity: job.quantity || 0,
          status: 'error',
          oldCPM: 0,
          newCPM: CORRECT_CPM,
          oldJdTotal: Number(job.jdTotal || 0),
          newJdTotal: 0,
          reason: 'Bradford→JD PO not found',
        });
        errorCount++;
        continue;
      }

      const oldCPM = Number(bradfordToJdPO.vendorCPM || 0);
      const oldJdTotal = Number(job.jdTotal || 0);

      console.log(`   Old CPM: $${oldCPM.toFixed(2)}`);
      console.log(`   New CPM: $${CORRECT_CPM.toFixed(2)}`);
      console.log(`   Old JD Total: $${oldJdTotal.toFixed(2)}`);

      // Recalculate pricing with correct CPM
      const pricing = await calculateDynamicPricing(
        prisma,
        TARGET_SIZE,
        job.quantity || 0
      );

      console.log(`   New JD Total: $${pricing.jdTotal.toFixed(2)}`);
      console.log(`   New Bradford Total: $${pricing.bradfordTotal.toFixed(2)}`);
      console.log(`   New Bradford Margin: $${pricing.bradfordTotalMargin.toFixed(2)}`);

      if (!isDryRun) {
        // Update Purchase Order CPM
        await prisma.purchaseOrder.update({
          where: { id: bradfordToJdPO.id },
          data: {
            vendorCPM: CORRECT_CPM,
            vendorAmount: pricing.jdTotal,
          },
        });

        // Update Job with recalculated pricing
        await prisma.job.update({
          where: { id: job.id },
          data: {
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

        // Update JD→Bradford invoice if exists
        const jdToBradfordInvoice = job.invoices.find(
          (inv) => inv.fromCompanyId === 'jd-graphic' && inv.toCompanyId === 'bradford'
        );

        if (jdToBradfordInvoice) {
          await prisma.invoice.update({
            where: { id: jdToBradfordInvoice.id },
            data: {
              amount: pricing.jdTotal,
            },
          });
          console.log(`   ✅ Updated invoice amount: $${pricing.jdTotal.toFixed(2)}`);
        }

        console.log(`   ✅ Fixed successfully`);
      } else {
        console.log(`   💾 Would update (dry-run mode)`);
      }

      results.push({
        jobNo,
        quantity: job.quantity || 0,
        status: 'success',
        oldCPM,
        newCPM: CORRECT_CPM,
        oldJdTotal,
        newJdTotal: pricing.jdTotal,
      });
      successCount++;

    } catch (error: any) {
      console.error(`   ❌ ERROR: ${error.message}`);

      results.push({
        jobNo,
        quantity: 0,
        status: 'error',
        oldCPM: 0,
        newCPM: CORRECT_CPM,
        oldJdTotal: 0,
        newJdTotal: 0,
        reason: error.message,
      });
      errorCount++;
    }
  }

  // Print summary report
  console.log('\n\n==========================================');
  console.log('📊 FIX SUMMARY');
  console.log('==========================================\n');

  console.log(`Total Jobs Processed: ${TARGET_JOBS.length}`);
  console.log(`✅ Successfully Fixed: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}\n`);

  if (successCount > 0) {
    console.log('✅ FIXED JOBS:');
    console.log('==========================================');
    results
      .filter((r) => r.status === 'success')
      .forEach((r) => {
        console.log(`\n  ${r.jobNo} (${r.quantity.toLocaleString()} pcs)`);
        console.log(`    CPM: $${r.oldCPM.toFixed(2)} → $${r.newCPM.toFixed(2)}`);
        console.log(`    JD Total: $${r.oldJdTotal.toFixed(2)} → $${r.newJdTotal.toFixed(2)}`);
        const savings = r.newJdTotal - r.oldJdTotal;
        console.log(`    Impact: ${savings >= 0 ? '+' : ''}$${savings.toFixed(2)}`);
      });
  }

  if (errorCount > 0) {
    console.log('\n❌ FAILED JOBS:');
    console.log('==========================================');
    results
      .filter((r) => r.status === 'error')
      .forEach((r) => {
        console.log(`  ${r.jobNo}: ${r.reason}`);
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
fixCPMRates()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
