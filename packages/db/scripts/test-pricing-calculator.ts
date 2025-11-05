/**
 * Test Pricing Calculator
 *
 * Verifies the dynamic pricing calculator works correctly with CSV data
 */

import { PrismaClient } from '@prisma/client';
import { calculateDynamicPricing, validatePricing } from '../../shared/src/pricing-calculator';

const prisma = new PrismaClient();

async function testPricingCalculator() {
  console.log('🧪 Testing Dynamic Pricing Calculator\n');
  console.log('========================================\n');

  // Test with the first size from CSV
  const testCases = [
    {
      sizeName: '7 1/4 x 16 3/8',
      quantity: 10000,
      description: 'Standard pricing for 7 1/4 x 16 3/8',
    },
    {
      sizeName: '9 3/4 x 22 1/8',
      quantity: 15000,
      description: 'Standard pricing for 9 3/4 x 22 1/8',
    },
    {
      sizeName: '6 x 9',
      quantity: 25000,
      description: 'Standard pricing for 6 x 9',
    },
  ];

  for (const testCase of testCases) {
    console.log(`📝 ${testCase.description}`);
    console.log(`   Size: ${testCase.sizeName}`);
    console.log(`   Quantity: ${testCase.quantity.toLocaleString()}\n`);

    try {
      const result = await calculateDynamicPricing(
        prisma,
        testCase.sizeName,
        testCase.quantity
      );

      console.log('   💰 Pricing Breakdown:');
      console.log(`   Customer Total: $${result.customerTotal.toFixed(2)}`);
      console.log(`   Customer CPM: $${result.customerCPM.toFixed(2)}\n`);

      console.log(`   Bradford Total: $${result.bradfordTotal.toFixed(2)}`);
      console.log(`   Bradford CPM: $${result.bradfordTotalCPM.toFixed(2)}`);
      console.log(`   Bradford Print Margin: $${result.bradfordPrintMargin.toFixed(2)}`);
      console.log(`   Bradford Paper Margin: $${result.bradfordPaperMargin.toFixed(2)}`);
      console.log(`   Bradford Total Margin: $${result.bradfordTotalMargin.toFixed(2)}\n`);

      console.log(`   Impact Margin: $${result.impactMargin.toFixed(2)}`);
      console.log(`   Impact Margin CPM: $${result.impactMarginCPM.toFixed(2)}\n`);

      console.log(`   JD Total: $${result.jdTotal.toFixed(2)}`);
      console.log(`   JD CPM: $${result.printCPM.toFixed(2)}\n`);

      console.log(`   Paper Cost Total: $${result.paperCostTotal.toFixed(2)}`);
      console.log(`   Paper Charged Total: $${result.paperChargedTotal.toFixed(2)}`);
      console.log(`   Paper Markup: $${result.bradfordPaperMargin.toFixed(2)}\n`);

      // Validate margin split
      const marginDiff = Math.abs(result.impactMargin - result.bradfordPrintMargin);
      const is5050Split = marginDiff < 0.01; // Allow small rounding difference

      console.log(`   ✓ Margin Split: ${is5050Split ? '✓' : '✗'} ${
        is5050Split
          ? 'Correct 50/50 split'
          : `INCORRECT - diff: $${marginDiff.toFixed(2)}`
      }\n`);

      // Validate pricing
      const validation = validatePricing(result);
      console.log(`   ✓ Validation: ${validation.isValid ? '✓ PASS' : '✗ FAIL'}`);

      if (validation.warnings.length > 0) {
        console.log(`   ⚠️  Warnings:`);
        validation.warnings.forEach(w => console.log(`      - ${w}`));
      }

      if (validation.errors.length > 0) {
        console.log(`   ❌ Errors:`);
        validation.errors.forEach(e => console.log(`      - ${e}`));
      }

      console.log('\n========================================\n');
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}\n`);
      console.log('========================================\n');
    }
  }

  // Test with custom pricing (override)
  console.log(`📝 Custom Pricing Test - 7 1/4 x 16 3/8 with $50 CPM`);
  console.log(`   Testing undercharge detection\n`);

  try {
    const result = await calculateDynamicPricing(prisma, '7 1/4 x 16 3/8', 10000, {
      customerCPM: 50.0, // Below standard rate
    });

    console.log(`   Customer Total: $${result.customerTotal.toFixed(2)}`);
    console.log(`   Standard CPM: $${result.standardCustomerCPM.toFixed(2)}`);
    console.log(`   Quoted CPM: $${result.customerCPM.toFixed(2)}`);
    console.log(`   Requires Approval: ${result.requiresApproval ? '✓ YES' : '✗ NO'}`);

    if (result.requiresApproval && result.underchargeAmount) {
      console.log(`   Undercharge Amount: $${result.underchargeAmount.toFixed(2)}`);
    }

    console.log('\n========================================\n');
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}\n`);
  }

  // Test with missing size
  console.log(`📝 Missing Size Test`);
  console.log(`   Testing error handling for unknown size\n`);

  try {
    await calculateDynamicPricing(prisma, '99 x 99', 10000);
    console.log(`   ❌ Should have thrown error!\n`);
  } catch (error: any) {
    console.log(`   ✓ Correctly threw error: ${error.message}\n`);
  }

  console.log('========================================');
  console.log('✅ Testing Complete!\n');
}

// Run tests
testPricingCalculator()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
