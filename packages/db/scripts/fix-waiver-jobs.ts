#!/usr/bin/env tsx
/**
 * Fix Jobs Where Bradford Waives Paper Margin
 *
 * This script sets bradfordWaivesPaperMargin = true for the 2 specific jobs
 * where Bradford waived the paper margin as a token of goodwill.
 *
 * Jobs to fix:
 * - J-2025-216133
 * - J-2025-119173
 *
 * In these cases, Bradford doesn't take the paper markup, so:
 * - Paper Charged is set to Paper Cost (no markup)
 * - Total margin (customerTotal - jdTotal - paperCostTotal) is split 50/50
 *   between Impact and Bradford.
 */

import { PrismaClient } from '@printing-workflow/db';

const prisma = new PrismaClient();

const WAIVER_JOBS = ['J-2025-216133', 'J-2025-119173'];

async function fixWaiverJobs() {
  console.log('========================================');
  console.log('🔧 FIXING BRADFORD WAIVER JOBS');
  console.log('========================================\n');

  try {
    // Get the jobs before update
    const jobsBefore = await prisma.job.findMany({
      where: {
        jobNo: {
          in: WAIVER_JOBS,
        },
      },
      select: {
        id: true,
        jobNo: true,
        customerTotal: true,
        bradfordTotal: true,
        jdTotal: true,
        impactMargin: true,
        bradfordTotalMargin: true,
        paperChargedTotal: true,
        paperCostTotal: true,
        jdSuppliesPaper: true,
        bradfordWaivesPaperMargin: true,
      },
    });

    console.log(`Found ${jobsBefore.length} jobs to update:\n`);

    // Update the jobs to set bradfordWaivesPaperMargin = true
    const updateResult = await prisma.job.updateMany({
      where: {
        jobNo: {
          in: WAIVER_JOBS,
        },
      },
      data: {
        bradfordWaivesPaperMargin: true,
      },
    });

    console.log(`✅ Updated ${updateResult.count} jobs to bradfordWaivesPaperMargin = true\n`);

    // Now recalculate margins for each job
    for (const job of jobsBefore) {
      const customerTotal = Number(job.customerTotal || 0);
      const jdTotal = Number(job.jdTotal || 0);
      const paperChargedTotal = Number(job.paperChargedTotal || 0);
      const paperCostTotal = Number(job.paperCostTotal || 0);
      const oldImpactMargin = Number(job.impactMargin || 0);
      const oldBradfordMargin = Number(job.bradfordTotalMargin || 0);

      // Calculate new margins with 50/50 split
      // When Bradford waives, use paperCostTotal (no markup)
      const totalMargin = customerTotal - jdTotal - paperCostTotal;
      const newImpactMargin = totalMargin / 2;
      const newBradfordMargin = totalMargin / 2;

      // Update the job with recalculated margins
      await prisma.job.update({
        where: { id: job.id },
        data: {
          paperChargedTotal: paperCostTotal, // Set paper charged = paper cost (no markup)
          impactMargin: newImpactMargin,
          bradfordTotalMargin: newBradfordMargin,
        },
      });

      console.log(`✅ Updated Job ${job.jobNo}:`);
      console.log(`   Old Impact Margin: $${oldImpactMargin.toFixed(2)}`);
      console.log(`   New Impact Margin: $${newImpactMargin.toFixed(2)}`);
      console.log(`   Old Bradford Margin: $${oldBradfordMargin.toFixed(2)}`);
      console.log(`   New Bradford Margin: $${newBradfordMargin.toFixed(2)}`);
      console.log(`   Customer Total: $${customerTotal.toFixed(2)}`);
      console.log(`   JD Total: $${jdTotal.toFixed(2)}`);
      console.log(`   Paper Charged: $${paperChargedTotal.toFixed(2)}`);
      console.log(`   Paper Cost: $${paperCostTotal.toFixed(2)}`);
      console.log(`   Total Margin: $${totalMargin.toFixed(2)}`);
      console.log(`   Split: 50/50 (Bradford waived paper margin)`);
      console.log('');
    }

    console.log('\n========================================');
    console.log('📊 SUMMARY');
    console.log('========================================');
    console.log(`Total Jobs Updated: ${jobsBefore.length}`);
    console.log(`Jobs: ${WAIVER_JOBS.join(', ')}`);
    console.log(`bradfordWaivesPaperMargin: true`);
    console.log(`Margins recalculated with 50/50 split`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error fixing waiver jobs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixWaiverJobs()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
