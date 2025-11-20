/**
 * Migration Script: Assign Vendor Codes
 *
 * Assigns sequential 3-digit vendor codes to existing vendors that don't have one.
 * Run this script once to migrate existing vendors to the new vendor code system.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx packages/db/scripts/assign-vendor-codes.ts
 */

import { prisma } from '../index.js';

async function assignVendorCodes() {
  console.log('🔍 Finding vendors without vendor codes...');

  // Find all vendors without codes, ordered by creation date
  const vendorsWithoutCodes = await prisma.vendor.findMany({
    where: { vendorCode: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, createdAt: true },
  });

  if (vendorsWithoutCodes.length === 0) {
    console.log('✅ All vendors already have vendor codes!');
    return;
  }

  console.log(`📝 Found ${vendorsWithoutCodes.length} vendor(s) without codes`);

  // Find the highest existing vendor code to start from
  const latestVendor = await prisma.vendor.findFirst({
    where: { vendorCode: { not: null } },
    orderBy: { vendorCode: 'desc' },
    select: { vendorCode: true },
  });

  let nextCode = 1;
  if (latestVendor && latestVendor.vendorCode) {
    nextCode = parseInt(latestVendor.vendorCode, 10) + 1;
    console.log(`📊 Highest existing vendor code: ${latestVendor.vendorCode}`);
    console.log(`➡️  Starting assignment from: ${nextCode.toString().padStart(3, '0')}`);
  } else {
    console.log(`➡️  No existing vendor codes found. Starting from: 001`);
  }

  console.log('\n🔄 Assigning vendor codes...\n');

  // Assign codes sequentially
  for (const vendor of vendorsWithoutCodes) {
    const code = nextCode.toString().padStart(3, '0');

    try {
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { vendorCode: code },
      });

      console.log(`✅ Assigned code ${code} to vendor: ${vendor.name} (ID: ${vendor.id})`);
      nextCode++;

      // Check if we're approaching the limit
      if (nextCode > 999) {
        console.error('❌ ERROR: Reached maximum vendor code limit (999)!');
        console.error('   Remaining vendors will not receive codes.');
        break;
      }
    } catch (error: any) {
      console.error(`❌ Error assigning code ${code} to vendor ${vendor.name}:`, error.message);
    }
  }

  console.log('\n✅ Migration complete!');
  console.log(`📊 Total vendors processed: ${vendorsWithoutCodes.length}`);
  console.log(`📊 Next available vendor code: ${nextCode.toString().padStart(3, '0')}`);
}

// Run the migration
assignVendorCodes()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
