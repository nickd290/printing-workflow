/**
 * Data Migration Script: Fix Pricing Rules
 *
 * This script fixes critical pricing data issues:
 * 1. Fixes baseCPM = 0 for "7 1/4 x 16 3/8"
 * 2. Populates missing impactInvoicePerM (customer rate) values
 * 3. Fixes backwards pricing where impactInvoicePerM < bradfordInvoicePerM
 * 4. Ensures all rules have proper jdInvoicePerM (copies from printCPM if missing)
 *
 * Run with: DATABASE_URL="file:./dev.db" npx tsx fix-pricing-rules.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PricingRuleFix {
  sizeName: string;
  issue: string;
  oldValue: any;
  newValue: any;
}

async function fixPricingRules() {
  console.log('🔧 Starting Pricing Rules Migration...\n');

  const fixes: PricingRuleFix[] = [];

  // Get all pricing rules
  const rules = await prisma.pricingRule.findMany({
    orderBy: { sizeName: 'asc' },
  });

  console.log(`📊 Found ${rules.length} pricing rules\n`);

  for (const rule of rules) {
    const updates: any = {};
    let needsUpdate = false;

    // Fix 1: baseCPM = 0
    if (Number(rule.baseCPM) === 0 && rule.impactInvoicePerM) {
      updates.baseCPM = rule.impactInvoicePerM;
      needsUpdate = true;
      fixes.push({
        sizeName: rule.sizeName,
        issue: 'baseCPM was 0',
        oldValue: 0,
        newValue: Number(rule.impactInvoicePerM),
      });
    }

    // Fix 2: Missing impactInvoicePerM - use baseCPM as fallback if it's reasonable
    if (!rule.impactInvoicePerM && Number(rule.baseCPM) > 0) {
      updates.impactInvoicePerM = rule.baseCPM;
      needsUpdate = true;
      fixes.push({
        sizeName: rule.sizeName,
        issue: 'Missing impactInvoicePerM',
        oldValue: null,
        newValue: Number(rule.baseCPM),
      });
    }

    // Fix 3: Populate missing jdInvoicePerM from printCPM
    if (!rule.jdInvoicePerM && Number(rule.printCPM) > 0) {
      updates.jdInvoicePerM = rule.printCPM;
      needsUpdate = true;
      fixes.push({
        sizeName: rule.sizeName,
        issue: 'Missing jdInvoicePerM',
        oldValue: null,
        newValue: Number(rule.printCPM),
      });
    }

    // Fix 4: Backwards pricing (impactInvoicePerM < bradfordInvoicePerM)
    if (
      rule.impactInvoicePerM &&
      rule.bradfordInvoicePerM &&
      Number(rule.impactInvoicePerM) < Number(rule.bradfordInvoicePerM)
    ) {
      // Swap them - the higher value should be the customer rate
      const temp = rule.impactInvoicePerM;
      updates.impactInvoicePerM = rule.bradfordInvoicePerM;
      updates.bradfordInvoicePerM = temp;
      needsUpdate = true;
      fixes.push({
        sizeName: rule.sizeName,
        issue: 'Backwards pricing (customer < bradford)',
        oldValue: `customer=${Number(rule.impactInvoicePerM)}, bradford=${Number(rule.bradfordInvoicePerM)}`,
        newValue: `customer=${Number(rule.bradfordInvoicePerM)}, bradford=${Number(temp)}`,
      });
    }

    // Apply updates if needed
    if (needsUpdate) {
      await prisma.pricingRule.update({
        where: { id: rule.id },
        data: updates,
      });
      console.log(`✅ Fixed: ${rule.sizeName}`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📋 MIGRATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total rules processed: ${rules.length}`);
  console.log(`Rules fixed: ${fixes.length > 0 ? new Set(fixes.map(f => f.sizeName)).size : 0}`);
  console.log(`Total fixes applied: ${fixes.length}\n`);

  if (fixes.length > 0) {
    console.log('🔍 Detailed Fixes:\n');
    for (const fix of fixes) {
      console.log(`  📌 ${fix.sizeName}`);
      console.log(`     Issue: ${fix.issue}`);
      console.log(`     Old: ${JSON.stringify(fix.oldValue)}`);
      console.log(`     New: ${JSON.stringify(fix.newValue)}`);
      console.log('');
    }
  } else {
    console.log('✨ No fixes needed - all pricing rules are correct!\n');
  }

  console.log('='.repeat(80));
  console.log('✅ Migration completed successfully!\n');
}

// Run migration
fixPricingRules()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
