/**
 * Fix Paper Margin Bug in Jobs
 *
 * Bug: Jobs with bradfordWaivesPaperMargin or jdSuppliesPaper flags
 * have incorrect bradfordPaperMargin values (should be 0).
 *
 * This script recalculates pricing for affected jobs using the
 * corrected pricing calculator.
 */

import { PrismaClient } from '@prisma/client';
import { calculateDynamicPricing } from '../../shared/src/pricing-calculator';

const prisma = new PrismaClient();

async function main() {
  console.log('\n========================================');
  console.log('🔧 Fixing Paper Margin Bug in Jobs');
  console.log('========================================\n');

  // Find jobs with waiver or JD paper modes (we'll filter non-zero after fetching)
  const candidateJobs = await prisma.job.findMany({
    where: {
      OR: [
        { bradfordWaivesPaperMargin: true },
        { jdSuppliesPaper: true },
      ],
    },
    select: {
      id: true,
      jobNo: true,
      sizeName: true,
      quantity: true,
      customerTotal: true,
      bradfordPaperMargin: true,
      bradfordTotalMargin: true,
      jdSuppliesPaper: true,
      bradfordWaivesPaperMargin: true,
    },
  });

  console.log(`Fetched ${candidateJobs.length} candidate jobs with special modes\n`);

  // Debug: show all candidates
  candidateJobs.forEach((job) => {
    const mode = job.jdSuppliesPaper ? 'JD Supplies' : 'Bradford Waives';
    console.log(`  ${job.jobNo} (${mode}): paperMargin = ${job.bradfordPaperMargin}`);
  });

  // Filter to only jobs with non-zero paper margins (Prisma Decimal comparison doesn't work well in WHERE clause)
  const affectedJobs = candidateJobs.filter((job) => {
    const paperMargin = Number(job.bradfordPaperMargin || 0);
    return paperMargin !== 0;
  });

  console.log(`\nFound ${affectedJobs.length} jobs with incorrect paper margins:\n`);

  if (affectedJobs.length === 0) {
    console.log('✅ No jobs need fixing!');
    return;
  }

  // Display affected jobs
  affectedJobs.forEach((job) => {
    const mode = job.jdSuppliesPaper
      ? 'JD Supplies Paper'
      : 'Bradford Waives Paper';
    console.log(
      `  ${job.jobNo} (${mode}): bradfordPaperMargin = $${job.bradfordPaperMargin.toFixed(2)} (should be $0.00)`
    );
  });

  console.log(`\nRecalculating pricing for ${affectedJobs.length} jobs...\n`);

  let fixed = 0;
  let errors = 0;

  for (const job of affectedJobs) {
    try {
      // Recalculate pricing using the corrected calculator
      const pricing = await calculateDynamicPricing(
        prisma,
        job.sizeName,
        job.quantity,
        undefined, // no overrides
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
          bradfordPaperMargin: pricing.bradfordPaperMargin, // ← This will now be 0
          bradfordTotalMargin: pricing.bradfordTotalMargin,
          jdTotal: pricing.jdTotal,
          paperCostTotal: pricing.paperCostTotal,
          paperChargedTotal: pricing.paperChargedTotal,
        },
      });

      const mode = job.jdSuppliesPaper
        ? 'JD Supplies'
        : 'Waiver';
      console.log(
        `  ✅ ${job.jobNo} (${mode}): $${job.bradfordPaperMargin.toFixed(2)} → $${pricing.bradfordPaperMargin.toFixed(2)}`
      );
      fixed++;
    } catch (error) {
      console.error(`  ❌ ${job.jobNo}: ${error.message}`);
      errors++;
    }
  }

  console.log('\n========================================');
  console.log('📊 Summary');
  console.log('========================================');
  console.log(`Total jobs processed: ${affectedJobs.length}`);
  console.log(`Successfully fixed: ${fixed}`);
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
