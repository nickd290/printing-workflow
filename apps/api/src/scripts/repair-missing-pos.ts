/**
 * Repair Missing Impact → Bradford Purchase Orders
 *
 * This script finds jobs that are missing Impact → Bradford POs and creates them.
 *
 * Problem: Some jobs were created before auto PO creation was implemented,
 * resulting in jobs with Bradford → JD POs but no Impact → Bradford POs.
 *
 * Run with:
 * DATABASE_URL="postgresql://nicholasdeblasio@localhost:5432/printing_workflow" \
 *   npx tsx apps/api/src/scripts/repair-missing-pos.ts
 */

import { prisma, POStatus, RoutingType } from '@printing-workflow/db';
import { COMPANY_IDS } from '@printing-workflow/shared';
import { createAutoPurchaseOrder } from '../services/purchase-order.service.js';

/**
 * Main repair function
 */
async function main() {
  console.log('🔧 Starting PO Repair Script');
  console.log('=' .repeat(60));
  console.log('Finding jobs with missing Impact → Bradford POs...\n');

  // Find all Bradford route jobs (not third-party vendor jobs)
  const allJobs = await prisma.job.findMany({
    where: {
      deletedAt: null, // Exclude soft-deleted jobs
      routingType: RoutingType.BRADFORD_JD, // Only Bradford route jobs
    },
    include: {
      purchaseOrders: {
        include: {
          originCompany: true,
          targetCompany: true,
        },
      },
      customer: true,
    },
    orderBy: {
      jobNo: 'asc',
    },
  });

  console.log(`📊 Found ${allJobs.length} Bradford route jobs\n`);

  let repairedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const needsManualReview: string[] = [];

  for (const job of allJobs) {
    // Check if Impact → Bradford PO already exists
    const impactToBradfordPO = job.purchaseOrders.find(
      (po) =>
        po.originCompanyId === COMPANY_IDS.IMPACT_DIRECT &&
        po.targetCompanyId === COMPANY_IDS.BRADFORD
    );

    if (impactToBradfordPO) {
      console.log(`✅ ${job.jobNo}: Already has Impact → Bradford PO (${impactToBradfordPO.poNumber})`);
      skippedCount++;
      continue;
    }

    // Missing Impact → Bradford PO - need to create it
    console.log(`\n❌ ${job.jobNo}: Missing Impact → Bradford PO`);
    console.log(`   Customer: ${job.customer?.name || 'Unknown'}`);
    console.log(`   Customer PO: ${job.customerPONumber || 'N/A'}`);
    console.log(`   Customer Total: $${job.customerTotal}`);
    console.log(`   Bradford Total: $${job.bradfordTotal || 0}`);
    console.log(`   Impact Margin: $${job.impactMargin || 0}`);

    // Check if job has valid pricing
    if (!job.bradfordTotal || parseFloat(job.bradfordTotal.toString()) === 0) {
      console.log(`   ⚠️  WARNING: Job has no Bradford total - cannot create PO`);
      console.log(`   This job needs manual pricing review`);
      needsManualReview.push(job.jobNo);
      errorCount++;
      continue;
    }

    // Create the missing Impact → Bradford PO
    try {
      const po = await createAutoPurchaseOrder({
        jobId: job.id,
        originCompanyId: COMPANY_IDS.IMPACT_DIRECT,
        targetCompanyId: COMPANY_IDS.BRADFORD,
        originalAmount: parseFloat(job.customerTotal.toString()),
        vendorAmount: parseFloat(job.bradfordTotal.toString()),
        customerPONumber: job.customerPONumber || undefined,
      });

      console.log(`   ✅ Created Impact → Bradford PO: ${po.poNumber}`);
      console.log(`      Amount: $${po.vendorAmount}`);
      console.log(`      Margin: $${po.marginAmount}`);
      repairedCount++;
    } catch (error) {
      console.error(`   ❌ Failed to create PO:`, error);
      needsManualReview.push(job.jobNo);
      errorCount++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 REPAIR SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Jobs Scanned:        ${allJobs.length}`);
  console.log(`Already OK (skipped):      ${skippedCount}`);
  console.log(`Successfully Repaired:     ${repairedCount}`);
  console.log(`Errors/Needs Review:       ${errorCount}`);
  console.log('='.repeat(60));

  if (needsManualReview.length > 0) {
    console.log('\n⚠️  JOBS REQUIRING MANUAL REVIEW:');
    console.log('These jobs could not be repaired automatically.');
    console.log('They need proper pricing set before POs can be created.\n');
    needsManualReview.forEach((jobNo) => {
      console.log(`   - ${jobNo}`);
    });
  }

  if (repairedCount > 0) {
    console.log('\n✅ Repair Complete!');
    console.log(`Created ${repairedCount} missing Impact → Bradford POs.`);
    console.log('Please verify the results in the dashboard.');
  } else if (skippedCount === allJobs.length) {
    console.log('\n✅ All jobs already have proper POs!');
    console.log('No repairs were necessary.');
  }

  console.log('\n');
}

// Run the script
main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('\n❌ Script failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
