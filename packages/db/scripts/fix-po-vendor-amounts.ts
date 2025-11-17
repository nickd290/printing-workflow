/**
 * Fix Purchase Order Vendor Amounts for Bradford Waive Jobs
 *
 * Issue: POs created before the waive paper margin fix have incorrect vendorAmount.
 * The vendorAmount should equal job.bradfordTotal but was incorrectly calculated as
 * just jdTotal + paperCostTotal (excluding Bradford's margin share).
 *
 * This script updates Impact→Bradford POs for jobs with bradfordWaivesPaperMargin=true
 * to have the correct vendorAmount matching the job's bradfordTotal.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n========================================');
  console.log('🔧 Fixing Purchase Order Vendor Amounts');
  console.log('========================================\n');

  // Find all POs from Impact to Bradford where job has waive paper margin flag
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      originCompanyId: 'impact-direct',
      targetCompanyId: 'bradford',
      job: {
        bradfordWaivesPaperMargin: true,
      },
    },
    include: {
      job: {
        select: {
          jobNo: true,
          bradfordTotal: true,
          customerTotal: true,
          bradfordWaivesPaperMargin: true,
        },
      },
    },
  });

  console.log(`Found ${pos.length} Impact→Bradford POs for Bradford waive jobs\n`);

  if (pos.length === 0) {
    console.log('✅ No POs to fix!');
    return;
  }

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const po of pos) {
    try {
      if (!po.job) {
        console.log(`⚠️  PO ${po.poNumber}: No associated job, skipping`);
        skipped++;
        continue;
      }

      const expectedOriginalAmount = Number(po.job.customerTotal || 0);
      const expectedVendorAmount = Number(po.job.bradfordTotal || 0);
      const currentOriginalAmount = Number(po.originalAmount);
      const currentVendorAmount = Number(po.vendorAmount);
      const currentMarginAmount = Number(po.marginAmount);

      // Calculate expected margin
      const expectedMarginAmount = expectedOriginalAmount - expectedVendorAmount;

      // Check if PO amounts match expected (allow 1 cent tolerance for rounding)
      const originalAmountMatch = Math.abs(currentOriginalAmount - expectedOriginalAmount) < 0.01;
      const vendorAmountMatch = Math.abs(currentVendorAmount - expectedVendorAmount) < 0.01;
      const marginAmountMatch = Math.abs(currentMarginAmount - expectedMarginAmount) < 0.01;

      if (originalAmountMatch && vendorAmountMatch && marginAmountMatch) {
        console.log(`✅ SKIP - PO ${po.poNumber} (${po.job.jobNo}): Already correct`);
        console.log(`   Customer Total (original): $${currentOriginalAmount.toFixed(2)}`);
        console.log(`   Vendor Amount (to Bradford): $${currentVendorAmount.toFixed(2)}`);
        console.log(`   Margin Amount (Impact): $${currentMarginAmount.toFixed(2)}`);
        skipped++;
        continue;
      }

      // Update the PO with correct amounts
      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: {
          originalAmount: expectedOriginalAmount,
          vendorAmount: expectedVendorAmount,
          marginAmount: expectedMarginAmount,
        },
      });

      console.log(`✅ FIXED - PO ${po.poNumber} (${po.job.jobNo})`);
      console.log(`   Customer Total: $${currentOriginalAmount.toFixed(2)} → $${expectedOriginalAmount.toFixed(2)}`);
      console.log(`   Vendor Amount (to Bradford): $${currentVendorAmount.toFixed(2)} → $${expectedVendorAmount.toFixed(2)}`);
      console.log(`   Margin Amount (Impact): $${currentMarginAmount.toFixed(2)} → $${expectedMarginAmount.toFixed(2)}`);
      fixed++;
    } catch (error) {
      console.error(`❌ PO ${po.poNumber}: ${error.message}`);
      errors++;
    }
  }

  console.log('\n========================================');
  console.log('📊 Summary');
  console.log('========================================');
  console.log(`Total POs checked: ${pos.length}`);
  console.log(`Successfully fixed: ${fixed}`);
  console.log(`Already correct (skipped): ${skipped}`);
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
