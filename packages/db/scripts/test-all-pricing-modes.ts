/**
 * Integration Test: Verify All 3 Pricing Modes
 *
 * Tests real jobs in the database to ensure all pricing calculations
 * are correct after the paperMarkupCPM bug fix.
 */

import { PrismaClient } from '@prisma/client';
import { calculateDynamicPricing } from '../../shared/src/pricing-calculator';

const prisma = new PrismaClient();

interface TestResult {
  jobNo: string;
  mode: string;
  pass: boolean;
  issues: string[];
  details: {
    customerTotal: { expected: number; actual: number };
    impactMargin: { expected: number; actual: number };
    bradfordPrintMargin: { expected: number; actual: number };
    bradfordPaperMargin: { expected: number; actual: number };
    bradfordTotalMargin: { expected: number; actual: number };
  };
}

async function main() {
  console.log('\n========================================');
  console.log('🧪 Integration Test: All 3 Pricing Modes');
  console.log('========================================\n');

  const results: TestResult[] = [];

  // Find jobs with special modes
  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { jdSuppliesPaper: true },
        { bradfordWaivesPaperMargin: true },
      ],
    },
    select: {
      id: true,
      jobNo: true,
      sizeName: true,
      quantity: true,
      jdSuppliesPaper: true,
      bradfordWaivesPaperMargin: true,
      customerTotal: true,
      impactMargin: true,
      bradfordPrintMargin: true,
      bradfordPaperMargin: true,
      bradfordTotalMargin: true,
    },
  });

  console.log(`Found ${jobs.length} jobs with special pricing modes\n`);

  for (const job of jobs) {
    const mode = job.jdSuppliesPaper
      ? 'JD Supplies Paper (10/10/80)'
      : 'Bradford Waives Paper (50/50)';

    console.log(`\n📋 Testing ${job.jobNo} (${mode})`);
    console.log(`   Size: ${job.sizeName}`);
    console.log(`   Quantity: ${job.quantity.toLocaleString()}`);

    const issues: string[] = [];

    try {
      // Recalculate pricing
      const calculated = await calculateDynamicPricing(
        prisma,
        job.sizeName,
        job.quantity,
        undefined,
        job.jdSuppliesPaper,
        job.bradfordWaivesPaperMargin
      );

      // Compare stored vs calculated values
      const customerTotalMatch = Math.abs(Number(job.customerTotal) - calculated.customerTotal) < 0.01;
      const impactMarginMatch = Math.abs(Number(job.impactMargin || 0) - calculated.impactMargin) < 0.01;
      const bradfordPrintMarginMatch = Math.abs(Number(job.bradfordPrintMargin || 0) - calculated.bradfordPrintMargin) < 0.01;
      const bradfordPaperMarginMatch = Math.abs(Number(job.bradfordPaperMargin || 0) - calculated.bradfordPaperMargin) < 0.01;
      const bradfordTotalMarginMatch = Math.abs(Number(job.bradfordTotalMargin || 0) - calculated.bradfordTotalMargin) < 0.01;

      // Check for issues
      if (!customerTotalMatch) {
        issues.push(`Customer total mismatch: stored=$${Number(job.customerTotal).toFixed(2)} vs calculated=$${calculated.customerTotal.toFixed(2)}`);
      }
      if (!impactMarginMatch) {
        issues.push(`Impact margin mismatch: stored=$${Number(job.impactMargin || 0).toFixed(2)} vs calculated=$${calculated.impactMargin.toFixed(2)}`);
      }
      if (!bradfordPrintMarginMatch) {
        issues.push(`Bradford print margin mismatch: stored=$${Number(job.bradfordPrintMargin || 0).toFixed(2)} vs calculated=$${calculated.bradfordPrintMargin.toFixed(2)}`);
      }
      if (!bradfordPaperMarginMatch) {
        issues.push(`Bradford paper margin mismatch: stored=$${Number(job.bradfordPaperMargin || 0).toFixed(2)} vs calculated=$${calculated.bradfordPaperMargin.toFixed(2)}`);
      }
      if (!bradfordTotalMarginMatch) {
        issues.push(`Bradford total margin mismatch: stored=$${Number(job.bradfordTotalMargin || 0).toFixed(2)} vs calculated=$${calculated.bradfordTotalMargin.toFixed(2)}`);
      }

      // Special checks for the bug fix
      if (job.jdSuppliesPaper || job.bradfordWaivesPaperMargin) {
        if (calculated.bradfordPaperMargin !== 0) {
          issues.push(`❌ BUG: Bradford paper margin should be $0 but is $${calculated.bradfordPaperMargin.toFixed(2)}`);
        }
        if (calculated.bradfordPaperMarginCPM !== 0) {
          issues.push(`❌ BUG: Bradford paper margin CPM should be $0 but is $${calculated.bradfordPaperMarginCPM.toFixed(2)}`);
        }
      }

      const pass = issues.length === 0;

      results.push({
        jobNo: job.jobNo,
        mode,
        pass,
        issues,
        details: {
          customerTotal: { expected: Number(job.customerTotal), actual: calculated.customerTotal },
          impactMargin: { expected: Number(job.impactMargin || 0), actual: calculated.impactMargin },
          bradfordPrintMargin: { expected: Number(job.bradfordPrintMargin || 0), actual: calculated.bradfordPrintMargin },
          bradfordPaperMargin: { expected: Number(job.bradfordPaperMargin || 0), actual: calculated.bradfordPaperMargin },
          bradfordTotalMargin: { expected: Number(job.bradfordTotalMargin || 0), actual: calculated.bradfordTotalMargin },
        },
      });

      if (pass) {
        console.log(`   ✅ PASS - All calculations match`);
        console.log(`      Customer Total: $${calculated.customerTotal.toFixed(2)}`);
        console.log(`      Impact Margin: $${calculated.impactMargin.toFixed(2)}`);
        console.log(`      Bradford Print Margin: $${calculated.bradfordPrintMargin.toFixed(2)}`);
        console.log(`      Bradford Paper Margin: $${calculated.bradfordPaperMargin.toFixed(2)} ✓`);
        console.log(`      Bradford Total Margin: $${calculated.bradfordTotalMargin.toFixed(2)}`);
      } else {
        console.log(`   ❌ FAIL - ${issues.length} issue(s) found:`);
        issues.forEach(issue => console.log(`      - ${issue}`));
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.push({
        jobNo: job.jobNo,
        mode,
        pass: false,
        issues: [`Fatal error: ${error.message}`],
        details: {
          customerTotal: { expected: Number(job.customerTotal), actual: 0 },
          impactMargin: { expected: Number(job.impactMargin || 0), actual: 0 },
          bradfordPrintMargin: { expected: Number(job.bradfordPrintMargin || 0), actual: 0 },
          bradfordPaperMargin: { expected: Number(job.bradfordPaperMargin || 0), actual: 0 },
          bradfordTotalMargin: { expected: Number(job.bradfordTotalMargin || 0), actual: 0 },
        },
      });
    }
  }

  // Test one normal mode job for comparison
  console.log(`\n\n📋 Testing Normal Mode (50/50 split) for comparison`);
  const normalJob = await prisma.job.findFirst({
    where: {
      jdSuppliesPaper: false,
      bradfordWaivesPaperMargin: false,
    },
    select: {
      id: true,
      jobNo: true,
      sizeName: true,
      quantity: true,
      jdSuppliesPaper: true,
      bradfordWaivesPaperMargin: true,
      customerTotal: true,
      impactMargin: true,
      bradfordPrintMargin: true,
      bradfordPaperMargin: true,
      bradfordTotalMargin: true,
    },
  });

  if (normalJob) {
    console.log(`   Job: ${normalJob.jobNo}`);
    console.log(`   Size: ${normalJob.sizeName}`);
    console.log(`   Quantity: ${normalJob.quantity.toLocaleString()}`);

    const calculated = await calculateDynamicPricing(
      prisma,
      normalJob.sizeName,
      normalJob.quantity,
      undefined,
      false,
      false
    );

    const normalIssues: string[] = [];

    // In normal mode, Bradford should have paper markup
    if (calculated.bradfordPaperMargin === 0) {
      normalIssues.push(`Normal mode should have paper markup but it's $0`);
    }
    if (calculated.bradfordTotalMargin <= calculated.bradfordPrintMargin) {
      normalIssues.push(`Bradford total margin should be > print margin (includes paper markup)`);
    }

    const normalPass = normalIssues.length === 0;
    results.push({
      jobNo: normalJob.jobNo,
      mode: 'Normal (50/50)',
      pass: normalPass,
      issues: normalIssues,
      details: {
        customerTotal: { expected: Number(normalJob.customerTotal), actual: calculated.customerTotal },
        impactMargin: { expected: Number(normalJob.impactMargin || 0), actual: calculated.impactMargin },
        bradfordPrintMargin: { expected: Number(normalJob.bradfordPrintMargin || 0), actual: calculated.bradfordPrintMargin },
        bradfordPaperMargin: { expected: Number(normalJob.bradfordPaperMargin || 0), actual: calculated.bradfordPaperMargin },
        bradfordTotalMargin: { expected: Number(normalJob.bradfordTotalMargin || 0), actual: calculated.bradfordTotalMargin },
      },
    });

    if (normalPass) {
      console.log(`   ✅ PASS - Normal mode has paper markup as expected`);
      console.log(`      Bradford Paper Margin: $${calculated.bradfordPaperMargin.toFixed(2)} ✓`);
      console.log(`      Bradford Total Margin: $${calculated.bradfordTotalMargin.toFixed(2)}`);
    } else {
      console.log(`   ❌ FAIL - ${normalIssues.length} issue(s) found:`);
      normalIssues.forEach(issue => console.log(`      - ${issue}`));
    }
  }

  // Summary
  console.log('\n\n========================================');
  console.log('📊 Test Summary');
  console.log('========================================');

  const totalTests = results.length;
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success rate: ${((passed / totalTests) * 100).toFixed(1)}%`);

  console.log('\n========================================');
  console.log('🎯 Mode Breakdown');
  console.log('========================================');

  const modes = ['Normal (50/50)', 'JD Supplies Paper (10/10/80)', 'Bradford Waives Paper (50/50)'];
  modes.forEach(mode => {
    const modeResults = results.filter(r => r.mode === mode);
    if (modeResults.length > 0) {
      const modePassed = modeResults.filter(r => r.pass).length;
      console.log(`${mode}: ${modePassed}/${modeResults.length} passed`);
    }
  });

  console.log('\n========================================\n');

  // Exit with error code if any tests failed
  if (failed > 0) {
    console.error('❌ Some tests failed. Review the issues above.');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
    process.exit(0);
  }
}

main()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
