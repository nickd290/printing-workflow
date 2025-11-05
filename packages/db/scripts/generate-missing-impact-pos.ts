import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface POCalculation {
  jobId: string;
  jobNo: string;
  customerPONumber: string | null;
  customerTotal: Prisma.Decimal;
  jdTotal: Prisma.Decimal | null;
  paperChargedTotal: Prisma.Decimal | null;
  impactMargin: Prisma.Decimal | null;
  bradfordTotal: Prisma.Decimal | null;
  calculatedImpactMargin: Prisma.Decimal;
  calculatedBradfordTotal: Prisma.Decimal;
  profitPool: Prisma.Decimal;
  isEstimated: boolean;
  estimationNotes?: string;
}

async function main() {
  console.log('========================================');
  console.log('Generate Missing Impact→Bradford POs');
  console.log('========================================\n');

  // Step 1: Find all jobs missing Impact→Bradford POs
  console.log('Step 1: Finding jobs without Impact→Bradford POs...\n');

  const jobsWithoutImpactPO = await prisma.job.findMany({
    where: {
      NOT: {
        purchaseOrders: {
          some: {
            originCompanyId: 'impact-direct',
            targetCompanyId: 'bradford',
          },
        },
      },
    },
    include: {
      purchaseOrders: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`Found ${jobsWithoutImpactPO.length} jobs missing Impact→Bradford POs\n`);

  if (jobsWithoutImpactPO.length === 0) {
    console.log('✅ All jobs already have Impact→Bradford POs!');
    return;
  }

  // Step 2: Calculate PO amounts for each job
  console.log('Step 2: Calculating PO amounts...\n');

  const poCalculations: POCalculation[] = [];
  const jobsNeedingUpdates: Array<{
    jobId: string;
    jobNo: string;
    updates: Prisma.JobUpdateInput;
  }> = [];

  for (const job of jobsWithoutImpactPO) {
    let calculation: POCalculation;

    // Check if job has complete cost data
    const hasCompleteCostData =
      job.jdTotal !== null &&
      job.paperChargedTotal !== null &&
      job.jdTotal.toString() !== '0' &&
      job.paperChargedTotal.toString() !== '0';

    if (hasCompleteCostData && job.impactMargin !== null && job.bradfordTotal !== null) {
      // Use existing calculations
      const profitPool = new Prisma.Decimal(job.customerTotal)
        .minus(job.paperChargedTotal!)
        .minus(job.jdTotal!);

      calculation = {
        jobId: job.id,
        jobNo: job.jobNo,
        customerPONumber: job.customerPONumber,
        customerTotal: job.customerTotal,
        jdTotal: job.jdTotal,
        paperChargedTotal: job.paperChargedTotal,
        impactMargin: job.impactMargin,
        bradfordTotal: job.bradfordTotal,
        calculatedImpactMargin: job.impactMargin,
        calculatedBradfordTotal: job.bradfordTotal,
        profitPool,
        isEstimated: false,
      };
    } else {
      // Need to estimate costs from pricing rules
      const pricingRule = await prisma.pricingRule.findFirst({
        where: {
          sizeName: job.sizeName || '',
          isActive: true,
        },
      });

      if (!pricingRule) {
        console.warn(
          `⚠️  SKIPPING ${job.jobNo}: No pricing rule found for size "${job.sizeName}"`
        );
        continue;
      }

      const quantity = job.quantity || 0;
      const thousands = quantity / 1000.0;

      // Estimate costs
      const estimatedJD = new Prisma.Decimal(pricingRule.printCPM).times(thousands);
      const estimatedPaper = new Prisma.Decimal(
        pricingRule.paperChargedCPM || pricingRule.paperCPM || 0
      ).times(thousands);

      const profitPool = new Prisma.Decimal(job.customerTotal)
        .minus(estimatedPaper)
        .minus(estimatedJD);

      const impactMargin = profitPool.dividedBy(2);
      const bradfordTotal = profitPool.dividedBy(2).plus(estimatedPaper).plus(estimatedJD);

      // Skip if profit pool is negative or suspiciously wrong
      if (profitPool.lessThan(0)) {
        console.warn(
          `⚠️  SKIPPING ${job.jobNo}: Negative profit pool ($${profitPool.toFixed(2)}) - pricing may be incorrect`
        );
        continue;
      }

      calculation = {
        jobId: job.id,
        jobNo: job.jobNo,
        customerPONumber: job.customerPONumber,
        customerTotal: job.customerTotal,
        jdTotal: estimatedJD,
        paperChargedTotal: estimatedPaper,
        impactMargin,
        bradfordTotal,
        calculatedImpactMargin: impactMargin,
        calculatedBradfordTotal: bradfordTotal,
        profitPool,
        isEstimated: true,
        estimationNotes: `Estimated using pricing rule: ${pricingRule.sizeName}`,
      };

      // Queue this job for cost data updates
      jobsNeedingUpdates.push({
        jobId: job.id,
        jobNo: job.jobNo,
        updates: {
          jdTotal: estimatedJD,
          paperChargedTotal: estimatedPaper,
          impactMargin,
          bradfordTotal,
          // Also calculate CPM values
          printCPM: pricingRule.printCPM,
          paperChargedCPM: pricingRule.paperChargedCPM || pricingRule.paperCPM,
          impactMarginCPM: impactMargin.dividedBy(thousands),
          bradfordTotalCPM: bradfordTotal.dividedBy(thousands),
        },
      });
    }

    poCalculations.push(calculation);
  }

  // Step 3: Display preview
  console.log('Step 3: Preview of POs to be created:\n');
  console.log('─'.repeat(120));
  console.log(
    'Job No'.padEnd(18) +
      'Customer'.padEnd(12) +
      'Impact↓'.padEnd(12) +
      'Bradford↓'.padEnd(12) +
      'Profit Pool'.padEnd(12) +
      'Status'
  );
  console.log('─'.repeat(120));

  let totalCustomer = new Prisma.Decimal(0);
  let totalImpact = new Prisma.Decimal(0);
  let totalBradford = new Prisma.Decimal(0);
  let estimatedCount = 0;

  for (const calc of poCalculations) {
    const status = calc.isEstimated ? '(estimated)' : '';
    console.log(
      calc.jobNo.padEnd(18) +
        `$${calc.customerTotal.toFixed(2)}`.padEnd(12) +
        `$${calc.calculatedImpactMargin.toFixed(2)}`.padEnd(12) +
        `$${calc.calculatedBradfordTotal.toFixed(2)}`.padEnd(12) +
        `$${calc.profitPool.toFixed(2)}`.padEnd(12) +
        status
    );

    totalCustomer = totalCustomer.plus(calc.customerTotal);
    totalImpact = totalImpact.plus(calc.calculatedImpactMargin);
    totalBradford = totalBradford.plus(calc.calculatedBradfordTotal);
    if (calc.isEstimated) estimatedCount++;
  }

  console.log('─'.repeat(120));
  console.log(
    'TOTAL'.padEnd(18) +
      `$${totalCustomer.toFixed(2)}`.padEnd(12) +
      `$${totalImpact.toFixed(2)}`.padEnd(12) +
      `$${totalBradford.toFixed(2)}`.padEnd(12)
  );
  console.log('─'.repeat(120));
  const skippedCount = jobsWithoutImpactPO.length - poCalculations.length;
  console.log(
    `\nSummary: ${poCalculations.length} POs to create (${estimatedCount} with estimated costs)`
  );
  if (skippedCount > 0) {
    console.log(`         ${skippedCount} jobs skipped due to issues\n`);
  } else {
    console.log('');
  }

  // Step 4: Ask for confirmation
  console.log('Step 4: Confirmation\n');
  console.log('DRY RUN - No changes will be made to the database.');
  console.log('To execute, set DRY_RUN=false environment variable.\n');

  const isDryRun = process.env.DRY_RUN !== 'false';

  if (isDryRun) {
    console.log('✅ Dry run complete. Review the preview above.');
    console.log('\nTo execute:');
    console.log('  DRY_RUN=false DATABASE_URL="..." npx tsx packages/db/scripts/generate-missing-impact-pos.ts\n');
    return;
  }

  // Step 5: Create POs in transaction
  console.log('Step 5: Creating Purchase Orders...\n');

  const result = await prisma.$transaction(async (tx) => {
    const createdPOs = [];

    // Update jobs with estimated costs
    for (const jobUpdate of jobsNeedingUpdates) {
      await tx.job.update({
        where: { id: jobUpdate.jobId },
        data: jobUpdate.updates,
      });
      console.log(`  ✓ Updated cost estimates for ${jobUpdate.jobNo}`);
    }

    // Create POs
    for (const calc of poCalculations) {
      const poNumber = calc.customerPONumber
        ? `IMP-${calc.customerPONumber}`
        : `IMP-${calc.jobNo}`;

      const po = await tx.purchaseOrder.create({
        data: {
          originCompanyId: 'impact-direct',
          targetCompanyId: 'bradford',
          jobId: calc.jobId,
          originalAmount: calc.customerTotal,
          vendorAmount: calc.calculatedBradfordTotal,
          marginAmount: calc.calculatedImpactMargin,
          poNumber,
          referencePONumber: calc.customerPONumber,
          status: 'PENDING',
        },
      });

      createdPOs.push(po);
      console.log(
        `  ✓ Created PO ${poNumber} for ${calc.jobNo} - Bradford: $${calc.calculatedBradfordTotal.toFixed(2)}, Impact: $${calc.calculatedImpactMargin.toFixed(2)}`
      );
    }

    return { createdPOs, updatedJobs: jobsNeedingUpdates.length };
  });

  // Step 6: Summary
  console.log('\n========================================');
  console.log('✅ SUCCESS!');
  console.log('========================================');
  console.log(`Purchase Orders Created: ${result.createdPOs.length}`);
  console.log(`Jobs Updated with Estimates: ${result.updatedJobs}`);
  console.log(`Total Customer Revenue: $${totalCustomer.toFixed(2)}`);
  console.log(`Total Impact Margins: $${totalImpact.toFixed(2)}`);
  console.log(`Total Bradford Amounts: $${totalBradford.toFixed(2)}`);
  console.log('========================================\n');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
