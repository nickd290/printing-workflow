#!/usr/bin/env tsx
/**
 * Fix Impact Direct margins - Recalculate to use 50/50 split
 *
 * This script recalculates the impactMargin field for all jobs to correctly
 * reflect the 50/50 split (or 10/10 for JD-supplied paper jobs).
 *
 * Before: impactMargin = customerTotal - bradfordTotal (FULL margin)
 * After:  impactMargin = (customerTotal - bradfordTotal) / 2 (50% of margin)
 *         OR impactMargin = customerTotal * 0.10 (for JD supplies paper)
 */

import { PrismaClient } from '@printing-workflow/db';

const prisma = new PrismaClient();

async function fixImpactMargins() {
  console.log('========================================');
  console.log('🔧 FIXING IMPACT DIRECT MARGINS');
  console.log('========================================\n');

  try {
    // Get all jobs with revenue
    const jobs = await prisma.job.findMany({
      where: {
        customerTotal: {
          gt: 0,
        },
      },
      select: {
        id: true,
        jobNo: true,
        customerTotal: true,
        bradfordTotal: true,
        jdTotal: true,
        jdSuppliesPaper: true,
        impactMargin: true,
        bradfordTotalMargin: true,
        paperChargedTotal: true,
        paperCostTotal: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`Found ${jobs.length} jobs with revenue\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const job of jobs) {
      const customerTotal = Number(job.customerTotal || 0);
      const bradfordTotal = Number(job.bradfordTotal || 0);
      const jdTotal = Number(job.jdTotal || 0);
      const paperChargedTotal = Number(job.paperChargedTotal || 0);
      const paperCostTotal = Number(job.paperCostTotal || 0);
      const oldImpactMargin = Number(job.impactMargin || 0);
      const oldBradfordMargin = Number(job.bradfordTotalMargin || 0);

      // Calculate correct margins based on paper supplier
      let newImpactMargin: number;
      let newBradfordMargin: number;

      if (job.jdSuppliesPaper) {
        // JD supplies paper: Impact gets 10% of customer total
        newImpactMargin = customerTotal * 0.10;
        newBradfordMargin = bradfordTotal - jdTotal;
      } else {
        // Bradford supplies paper:
        // Total Margin = customerTotal - jdTotal - paperChargedTotal
        // Impact Margin = totalMargin / 2
        // Bradford Margin = customerTotal - jdTotal - paperCostTotal - (totalMargin / 2)
        const totalMargin = customerTotal - jdTotal - paperChargedTotal;
        newImpactMargin = totalMargin / 2;
        newBradfordMargin = customerTotal - jdTotal - paperCostTotal - (totalMargin / 2);
      }

      // Round to 2 decimal places for comparison
      const roundedOldImpact = Math.round(oldImpactMargin * 100) / 100;
      const roundedNewImpact = Math.round(newImpactMargin * 100) / 100;
      const roundedOldBradford = Math.round(oldBradfordMargin * 100) / 100;
      const roundedNewBradford = Math.round(newBradfordMargin * 100) / 100;

      const impactChanged = Math.abs(roundedOldImpact - roundedNewImpact) > 0.01;
      const bradfordChanged = Math.abs(roundedOldBradford - roundedNewBradford) > 0.01;

      if (impactChanged || bradfordChanged) {
        // Update the job
        await prisma.job.update({
          where: { id: job.id },
          data: {
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
        console.log(`   Paper Supplier: ${job.jdSuppliesPaper ? 'JD (10/10)' : 'Bradford (50/50)'}`);
        console.log('');

        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log('\n========================================');
    console.log('📊 SUMMARY');
    console.log('========================================');
    console.log(`Total Jobs Processed: ${jobs.length}`);
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`⏭️  Skipped (already correct): ${skippedCount}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error fixing margins:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixImpactMargins()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
