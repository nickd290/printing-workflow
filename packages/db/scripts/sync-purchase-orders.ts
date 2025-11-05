/**
 * Sync Purchase Orders with Recalculated Job Amounts
 *
 * After recalculating job financials with CSV pricing, this script updates
 * all existing purchase orders to match the new job amounts.
 *
 * Usage:
 *   DATABASE_URL="file:/Users/nicholasdeblasio/printing-workflow/packages/db/prisma/dev.db" npx tsx packages/db/scripts/sync-purchase-orders.ts
 *
 *   Add --dry-run flag to preview changes without applying:
 *   DATABASE_URL="file:..." npx tsx packages/db/scripts/sync-purchase-orders.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Check for dry-run flag
const isDryRun = process.argv.includes('--dry-run');

interface POUpdateResult {
  poId: string;
  poNumber: string | null;
  jobNo: string;
  type: 'Impact→Bradford' | 'Bradford→JD';
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  changes?: {
    originalAmount: { old: number; new: number };
    vendorAmount: { old: number; new: number };
    marginAmount: { old: number; new: number };
  };
}

async function syncPurchaseOrders() {
  console.log('🔄 Syncing Purchase Orders with Recalculated Jobs\n');
  console.log('==========================================\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be saved\n');
  }

  // Find all jobs with purchase orders
  const jobs = await prisma.job.findMany({
    where: {
      purchaseOrders: {
        some: {},
      },
    },
    include: {
      purchaseOrders: {
        include: {
          originCompany: true,
          targetCompany: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📊 Found ${jobs.length} jobs with purchase orders\n`);

  const results: POUpdateResult[] = [];
  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const job of jobs) {
    console.log(`\n📝 Processing Job: ${job.jobNo}`);
    console.log(`   POs: ${job.purchaseOrders.length}`);

    for (const po of job.purchaseOrders) {
      const poLabel = `${po.originCompany.name} → ${po.targetCompany.name}`;
      console.log(`\n   📦 PO: ${poLabel}`);
      console.log(`      PO#: ${po.poNumber || 'N/A'}`);

      try {
        // Determine PO type and calculate correct amounts
        let newOriginalAmount: number;
        let newVendorAmount: number;
        let newMarginAmount: number;
        let poType: 'Impact→Bradford' | 'Bradford→JD';

        // Check if this is Impact→Bradford PO
        // Company names: "Impact Direct" → "BGE Ltd.co" (Bradford)
        if (
          po.originCompany.name.toLowerCase().includes('impact') &&
          (po.targetCompany.name.toLowerCase().includes('bradford') ||
            po.targetCompany.name.toLowerCase().includes('bge'))
        ) {
          poType = 'Impact→Bradford';
          newOriginalAmount = Number(job.customerTotal);
          newVendorAmount = Number(job.bradfordTotal || 0);
          newMarginAmount = Number(job.impactMargin || 0);
        }
        // Check if this is Bradford→JD PO
        // Company names: "BGE Ltd.co" (Bradford) → "JD Graphic"
        else if (
          (po.originCompany.name.toLowerCase().includes('bradford') ||
            po.originCompany.name.toLowerCase().includes('bge')) &&
          po.targetCompany.name.toLowerCase().includes('jd')
        ) {
          poType = 'Bradford→JD';
          newOriginalAmount = Number(job.bradfordTotal || 0);
          newVendorAmount = Number(job.jdTotal || 0);
          newMarginAmount = Number(job.bradfordTotalMargin || 0);
        }
        // Unknown PO type - skip
        else {
          console.log(`      ⚠️  SKIPPED - Unknown PO type: ${poLabel}`);
          results.push({
            poId: po.id,
            poNumber: po.poNumber,
            jobNo: job.jobNo,
            type: 'Impact→Bradford', // default
            status: 'skipped',
            reason: `Unknown PO type: ${poLabel}`,
          });
          skippedCount++;
          continue;
        }

        // Check if amounts need updating
        const oldOriginalAmount = Number(po.originalAmount || 0);
        const oldVendorAmount = Number(po.vendorAmount);
        const oldMarginAmount = Number(po.marginAmount);

        const needsUpdate =
          Math.abs(oldOriginalAmount - newOriginalAmount) > 0.01 ||
          Math.abs(oldVendorAmount - newVendorAmount) > 0.01 ||
          Math.abs(oldMarginAmount - newMarginAmount) > 0.01;

        if (!needsUpdate) {
          console.log(`      ✓ Already up to date`);
          results.push({
            poId: po.id,
            poNumber: po.poNumber,
            jobNo: job.jobNo,
            type: poType,
            status: 'skipped',
            reason: 'Already up to date',
          });
          skippedCount++;
          continue;
        }

        // Log changes
        console.log(`      Changes needed:`);
        console.log(`        Original: $${oldOriginalAmount.toFixed(2)} → $${newOriginalAmount.toFixed(2)}`);
        console.log(`        Vendor:   $${oldVendorAmount.toFixed(2)} → $${newVendorAmount.toFixed(2)}`);
        console.log(`        Margin:   $${oldMarginAmount.toFixed(2)} → $${newMarginAmount.toFixed(2)}`);

        if (!isDryRun) {
          // Update purchase order
          await prisma.purchaseOrder.update({
            where: { id: po.id },
            data: {
              originalAmount: newOriginalAmount,
              vendorAmount: newVendorAmount,
              marginAmount: newMarginAmount,
            },
          });
          console.log(`      ✅ Updated successfully`);
        } else {
          console.log(`      💾 Would update (dry-run mode)`);
        }

        results.push({
          poId: po.id,
          poNumber: po.poNumber,
          jobNo: job.jobNo,
          type: poType,
          status: 'success',
          changes: {
            originalAmount: { old: oldOriginalAmount, new: newOriginalAmount },
            vendorAmount: { old: oldVendorAmount, new: newVendorAmount },
            marginAmount: { old: oldMarginAmount, new: newMarginAmount },
          },
        });
        successCount++;
      } catch (error: any) {
        console.error(`      ❌ ERROR: ${error.message}`);

        results.push({
          poId: po.id,
          poNumber: po.poNumber,
          jobNo: job.jobNo,
          type: 'Impact→Bradford', // default
          status: 'error',
          reason: error.message,
        });
        errorCount++;
      }
    }
  }

  // Print summary report
  console.log('\n\n==========================================');
  console.log('📊 SYNC SUMMARY');
  console.log('==========================================\n');

  console.log(`Total POs Processed: ${results.length}`);
  console.log(`✅ Successfully Updated: ${successCount}`);
  console.log(`⚠️  Skipped: ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}\n`);

  if (skippedCount > 0) {
    console.log('\n⚠️  SKIPPED POs:');
    console.log('==========================================');
    results
      .filter(r => r.status === 'skipped')
      .forEach(r => {
        console.log(`  ${r.jobNo} | ${r.type}: ${r.reason}`);
      });
  }

  if (errorCount > 0) {
    console.log('\n❌ FAILED POs:');
    console.log('==========================================');
    results
      .filter(r => r.status === 'error')
      .forEach(r => {
        console.log(`  ${r.jobNo} | ${r.type}: ${r.reason}`);
      });
  }

  if (successCount > 0) {
    console.log('\n✅ SUCCESSFULLY UPDATED POs:');
    console.log('==========================================');

    // Group by type
    const impactToBradford = results.filter(
      r => r.status === 'success' && r.type === 'Impact→Bradford'
    );
    const bradfordToJd = results.filter(
      r => r.status === 'success' && r.type === 'Bradford→JD'
    );

    if (impactToBradford.length > 0) {
      console.log('\n  Impact→Bradford POs:');
      impactToBradford.forEach(r => {
        if (r.changes) {
          console.log(
            `    ${r.jobNo}: Vendor $${r.changes.vendorAmount.old.toFixed(2)} → $${r.changes.vendorAmount.new.toFixed(2)}`
          );
        }
      });
    }

    if (bradfordToJd.length > 0) {
      console.log('\n  Bradford→JD POs:');
      bradfordToJd.forEach(r => {
        if (r.changes) {
          console.log(
            `    ${r.jobNo}: Vendor $${r.changes.vendorAmount.old.toFixed(2)} → $${r.changes.vendorAmount.new.toFixed(2)}`
          );
        }
      });
    }

    // Calculate total differences
    let totalOriginalDiff = 0;
    let totalVendorDiff = 0;
    let totalMarginDiff = 0;

    results
      .filter(r => r.status === 'success')
      .forEach(r => {
        if (r.changes) {
          totalOriginalDiff += r.changes.originalAmount.new - r.changes.originalAmount.old;
          totalVendorDiff += r.changes.vendorAmount.new - r.changes.vendorAmount.old;
          totalMarginDiff += r.changes.marginAmount.new - r.changes.marginAmount.old;
        }
      });

    console.log('\n📈 TOTAL ADJUSTMENTS:');
    console.log(`  Original Amount: ${totalOriginalDiff >= 0 ? '+' : ''}$${totalOriginalDiff.toFixed(2)}`);
    console.log(`  Vendor Amount:   ${totalVendorDiff >= 0 ? '+' : ''}$${totalVendorDiff.toFixed(2)}`);
    console.log(`  Margin Amount:   ${totalMarginDiff >= 0 ? '+' : ''}$${totalMarginDiff.toFixed(2)}`);
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN COMPLETE - No changes were saved');
    console.log('   Run without --dry-run flag to apply changes');
  }

  console.log('\n==========================================');
  console.log('✅ Sync Complete!\n');
}

// Run sync
syncPurchaseOrders()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
