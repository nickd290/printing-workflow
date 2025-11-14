/**
 * Recalculate All Jobs Script
 *
 * This script recalculates pricing for ALL jobs using the CORRECT
 * pricing-calculator.ts formulas. This fixes jobs that were calculated
 * with old buggy formulas or have corrupted data.
 *
 * Run with: DATABASE_URL="file:/path/to/dev.db" npx tsx recalculate-all-jobs.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface JobFix {
  jobNo: string;
  issue: string;
  oldBradfordTotal: number;
  newBradfordTotal: number;
  oldImpactMargin: number;
  newImpactMargin: number;
}

async function recalculateAllJobs() {
  console.log('🔧 Starting Job Recalculation...\n');

  const fixes: JobFix[] = [];
  let totalJobs = 0;
  let fixedJobs = 0;
  let errorJobs = 0;

  // Get all jobs
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 Found ${jobs.length} jobs to recalculate\n`);

  for (const job of jobs) {
    totalJobs++;

    try {
      // Extract pricing parameters from existing job
      const quantity = job.quantity || 0;
      const customerTotal = Number(job.customerTotal);
      const sizeName = job.sizeName || '';
      const jdSuppliesPaper = Boolean(job.jdSuppliesPaper);
      const bradfordWaivesPaperMargin = Boolean(job.bradfordWaivesPaperMargin);

      // Skip jobs without required data
      if (!quantity || !customerTotal || !sizeName) {
        console.log(`⚠️  Skipping ${job.jobNo} - missing required data`);
        continue;
      }

      // Load pricing rule for this size
      const pricingRule = await prisma.pricingRule.findUnique({
        where: { sizeName },
      });

      if (!pricingRule) {
        console.log(`⚠️  Skipping ${job.jobNo} - no pricing rule for size "${sizeName}"`);
        continue;
      }

      // Calculate correct pricing using FIXED formulas
      const quantityInThousands = quantity / 1000;
      const customerCPM = customerTotal / quantityInThousands;

      // Get base values
      const printCPM = Number(pricingRule.jdInvoicePerM || pricingRule.printCPM);
      const paperCostCPM = Number(pricingRule.paperCPM || 0);
      let paperChargedCPM = Number(pricingRule.paperChargedCPM || paperCostCPM);

      // Apply JD Paper mode adjustment
      if (jdSuppliesPaper) {
        paperChargedCPM = paperCostCPM; // No markup when JD supplies
      }

      const paperMarkupCPM = paperChargedCPM - paperCostCPM;

      // Calculate based on margin mode
      let impactMarginCPM: number;
      let bradfordTotalCPM: number;
      let bradfordPrintMarginCPM: number;
      let bradfordTotalMarginCPM: number;
      let jdTotalCPM: number;

      if (jdSuppliesPaper) {
        // JD Supplies Paper: 10/10 split
        impactMarginCPM = customerCPM * 0.10;
        bradfordTotalCPM = customerCPM * 0.90;
        bradfordPrintMarginCPM = customerCPM * 0.10;
        jdTotalCPM = customerCPM * 0.80;
        bradfordTotalMarginCPM = bradfordPrintMarginCPM;
      } else if (bradfordWaivesPaperMargin) {
        // Bradford Waives Paper Margin: 50/50 total margin split
        paperChargedCPM = paperCostCPM; // No markup
        jdTotalCPM = printCPM;
        const totalMarginCPM = customerCPM - printCPM - paperCostCPM;
        impactMarginCPM = totalMarginCPM / 2;
        bradfordPrintMarginCPM = totalMarginCPM / 2;
        const bradfordBaseCostCPM = printCPM + paperCostCPM;
        bradfordTotalCPM = bradfordBaseCostCPM + bradfordPrintMarginCPM;
        bradfordTotalMarginCPM = bradfordPrintMarginCPM; // No paper markup
      } else {
        // Normal: 50/50 print margin split + paper markup
        const bradfordBaseCostCPM = printCPM + paperChargedCPM;
        const marginPoolCPM = customerCPM - bradfordBaseCostCPM;
        impactMarginCPM = marginPoolCPM / 2;
        bradfordPrintMarginCPM = marginPoolCPM / 2;
        bradfordTotalCPM = bradfordBaseCostCPM + bradfordPrintMarginCPM;
        bradfordTotalMarginCPM = bradfordPrintMarginCPM + paperMarkupCPM;
        jdTotalCPM = printCPM;
      }

      // Calculate totals
      const impactMargin = impactMarginCPM * quantityInThousands;
      const bradfordTotal = bradfordTotalCPM * quantityInThousands;
      const bradfordPrintMargin = bradfordPrintMarginCPM * quantityInThousands;
      const bradfordPaperMargin = paperMarkupCPM * quantityInThousands;
      const bradfordTotalMargin = bradfordTotalMarginCPM * quantityInThousands;
      const jdTotal = jdTotalCPM * quantityInThousands;
      const paperCostTotal = paperCostCPM * quantityInThousands;
      const paperChargedTotal = paperChargedCPM * quantityInThousands;

      // Check if values need updating
      const oldBradfordTotal = Number(job.bradfordTotal || 0);
      const oldImpactMargin = Number(job.impactMargin || 0);

      const bradfordDiff = Math.abs(oldBradfordTotal - bradfordTotal);
      const impactDiff = Math.abs(oldImpactMargin - impactMargin);

      // Update if difference is significant (more than 1 cent)
      if (bradfordDiff > 0.01 || impactDiff > 0.01) {
        // Detect what the issue was
        let issue = '';
        if (oldBradfordTotal > customerTotal) {
          issue = '❌ Bradford > Customer (IMPOSSIBLE)';
        } else if (oldImpactMargin < 0) {
          issue = '❌ Negative Impact margin';
        } else {
          issue = '⚠️  Incorrect calculation';
        }

        fixes.push({
          jobNo: job.jobNo,
          issue,
          oldBradfordTotal,
          newBradfordTotal: bradfordTotal,
          oldImpactMargin,
          newImpactMargin: impactMargin,
        });

        // Update job with correct values
        await prisma.job.update({
          where: { id: job.id },
          data: {
            customerCPM,
            impactMarginCPM,
            impactMargin,
            bradfordTotalCPM,
            bradfordTotal,
            bradfordPrintMarginCPM,
            bradfordPrintMargin,
            bradfordPaperMarginCPM: paperMarkupCPM,
            bradfordPaperMargin,
            bradfordTotalMarginCPM,
            bradfordTotalMargin,
            printCPM,
            paperCostCPM,
            paperCostTotal,
            paperChargedCPM,
            paperChargedTotal,
            jdTotal,
          },
        });

        fixedJobs++;
        console.log(`✅ Fixed: ${job.jobNo}`);
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${job.jobNo}:`, error.message);
      errorJobs++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📋 RECALCULATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total jobs processed: ${totalJobs}`);
  console.log(`Jobs fixed: ${fixedJobs}`);
  console.log(`Jobs with errors: ${errorJobs}`);
  console.log(`Jobs unchanged: ${totalJobs - fixedJobs - errorJobs}\n`);

  if (fixes.length > 0) {
    console.log('🔍 Detailed Fixes:\n');
    for (const fix of fixes) {
      console.log(`  📌 ${fix.jobNo}`);
      console.log(`     Issue: ${fix.issue}`);
      console.log(`     Bradford Total: $${fix.oldBradfordTotal.toFixed(2)} → $${fix.newBradfordTotal.toFixed(2)}`);
      console.log(`     Impact Margin: $${fix.oldImpactMargin.toFixed(2)} → $${fix.newImpactMargin.toFixed(2)}`);
      console.log('');
    }
  } else {
    console.log('✨ No fixes needed - all jobs are correct!\n');
  }

  console.log('='.repeat(80));
  console.log('✅ Recalculation completed successfully!\n');
}

// Run recalculation
recalculateAllJobs()
  .catch((error) => {
    console.error('❌ Recalculation failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
