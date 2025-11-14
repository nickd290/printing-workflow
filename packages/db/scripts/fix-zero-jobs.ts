#!/usr/bin/env tsx
/**
 * Fix Jobs with $0 Bradford Pay and JD Pay
 *
 * This script fixes jobs that have customerTotal and margins set,
 * but are missing bradfordTotal and jdTotal values.
 *
 * Jobs to fix: J-2025-889851, J-2025-889850, J-2025-642385
 *
 * Since these jobs don't have size information, we can't calculate
 * the full breakdown of JD cost vs paper cost. However, we can:
 * - Set bradfordTotal = customerTotal - impactMargin
 * - Leave jdTotal and paper fields NULL (indicates incomplete data)
 */

import { PrismaClient } from '@printing-workflow/db';

const prisma = new PrismaClient();

async function fixZeroJobs() {
  console.log('========================================');
  console.log('🔧 FIXING JOBS WITH $0 BRADFORD/JD PAY');
  console.log('========================================\n');

  try {
    // Find jobs where bradfordTotal is 0 or NULL but customerTotal exists
    const jobsToFix = await prisma.job.findMany({
      where: {
        OR: [
          { bradfordTotal: null },
          { bradfordTotal: 0 },
        ],
        customerTotal: {
          not: null,
        },
      },
      select: {
        id: true,
        jobNo: true,
        customerTotal: true,
        impactMargin: true,
        bradfordTotalMargin: true,
        bradfordTotal: true,
        jdTotal: true,
        sizeId: true,
        sizeName: true,
      },
    });

    console.log(`Found ${jobsToFix.length} jobs to fix:\n`);

    for (const job of jobsToFix) {
      const customerTotal = Number(job.customerTotal || 0);
      const impactMargin = Number(job.impactMargin || 0);
      const bradfordTotalMargin = Number(job.bradfordTotalMargin || 0);
      const oldBradfordTotal = Number(job.bradfordTotal || 0);

      // Calculate Bradford Total = what Bradford bills Impact
      // This should be customerTotal - impactMargin
      const newBradfordTotal = customerTotal - impactMargin;

      // Update the job
      await prisma.job.update({
        where: { id: job.id },
        data: {
          bradfordTotal: newBradfordTotal,
          // NOTE: We're not setting jdTotal or paper fields because
          // without size information, we can't accurately break down
          // the costs. These will remain NULL to indicate incomplete data.
        },
      });

      console.log(`✅ Updated Job ${job.jobNo}:`);
      console.log(`   Customer Total: $${customerTotal.toFixed(2)}`);
      console.log(`   Impact Margin: $${impactMargin.toFixed(2)}`);
      console.log(`   Old Bradford Total: $${oldBradfordTotal.toFixed(2)}`);
      console.log(`   New Bradford Total: $${newBradfordTotal.toFixed(2)}`);
      console.log(`   Bradford Margin: $${bradfordTotalMargin.toFixed(2)}`);
      console.log(`   Size: ${job.sizeName || 'N/A'} (sizeId: ${job.sizeId || 'NULL'})`);
      console.log(`   Note: jdTotal and paper fields remain NULL (no size data)`);
      console.log('');
    }

    console.log('\n========================================');
    console.log('📊 SUMMARY');
    console.log('========================================');
    console.log(`Total Jobs Updated: ${jobsToFix.length}`);
    console.log(`Bradford Total calculated as: customerTotal - impactMargin`);
    console.log(`JD Total and paper fields: Not updated (requires size data)`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error fixing zero jobs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixZeroJobs()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
