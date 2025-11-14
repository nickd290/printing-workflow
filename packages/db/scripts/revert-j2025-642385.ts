/**
 * Revert J-2025-642385 to Original Customer Total
 *
 * This job was incorrectly updated with a recalculated customerTotal.
 * This script reverts it back to the original price and recalculates
 * Bradford/JD totals based on that price.
 *
 * Usage:
 *   DATABASE_URL="file:/path/to/dev.db" npx tsx packages/db/scripts/revert-j2025-642385.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculateFromCustomerTotal } from '../../shared/src/pricing-calculator';

const prisma = new PrismaClient();

const ORIGINAL_CUSTOMER_TOTAL = 4639.25;
const JOB_NUMBER = 'J-2025-642385';

async function revertJob() {
  console.log('🔄 Reverting J-2025-642385 to Original Customer Total\n');
  console.log('==========================================\n');

  try {
    // Find the job
    const job = await prisma.job.findUnique({
      where: { jobNo: JOB_NUMBER },
    });

    if (!job) {
      console.error(`❌ Job ${JOB_NUMBER} not found`);
      process.exit(1);
    }

    console.log(`✓ Job found (ID: ${job.id})`);
    console.log(`\n📊 Current Values:`);
    console.log(`   Customer Total: $${Number(job.customerTotal).toFixed(2)}`);
    console.log(`   Bradford Total: $${Number(job.bradfordTotal || 0).toFixed(2)}`);
    console.log(`   JD Total: $${Number(job.jdTotal || 0).toFixed(2)}`);
    console.log(`   Impact Margin: $${Number(job.impactMargin || 0).toFixed(2)}`);
    console.log(`   Size: ${job.sizeName}`);
    console.log(`   Quantity: ${job.quantity?.toLocaleString()}`);

    if (!job.sizeName || !job.quantity) {
      console.error(`\n❌ Job is missing size name or quantity`);
      process.exit(1);
    }

    // Calculate new pricing using the original customer total
    console.log(`\n🔄 Recalculating with original customer total ($${ORIGINAL_CUSTOMER_TOTAL})...`);

    const pricing = await calculateFromCustomerTotal(
      prisma,
      ORIGINAL_CUSTOMER_TOTAL,
      job.quantity,
      job.sizeName,
      job.jdSuppliesPaper || false
    );

    console.log(`✓ Pricing calculated successfully\n`);
    console.log(`📊 New Values:`);
    console.log(`   Customer Total: $${pricing.customerTotal.toFixed(2)}`);
    console.log(`   Bradford Total: $${pricing.bradfordTotal.toFixed(2)}`);
    console.log(`   JD Total: $${pricing.jdTotal.toFixed(2)}`);
    console.log(`   Impact Margin: $${pricing.impactMargin.toFixed(2)}`);

    // Update the job
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

    console.log(`\n✅ Job ${JOB_NUMBER} reverted successfully!`);
    console.log(`\n==========================================`);
    console.log(`✅ Revert Complete!\n`);

  } catch (error: any) {
    console.error(`\n❌ Revert failed:`, error.message);
    if (error.stack) {
      console.error(`Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

// Run revert
revertJob()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Revert failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
