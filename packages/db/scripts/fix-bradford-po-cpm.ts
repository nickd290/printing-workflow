import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fix Bradford→JD POs to use CPM-based pricing
 *
 * Problem: vendorAmount currently contains CPM rates instead of totals
 * Solution: Move vendorAmount to vendorCPM, calculate correct vendorAmount from quantity
 */

interface POFix {
  id: string;
  poNumber: string | null;
  jobNo: string;
  quantity: number;
  currentVendorAmount: Prisma.Decimal;
  printCPM: Prisma.Decimal | null;
  jdTotal: Prisma.Decimal | null;
  newVendorCPM: Prisma.Decimal;
  newVendorAmount: Prisma.Decimal;
  issue: string;
}

async function main() {
  console.log('========================================');
  console.log('Fix Bradford→JD PO CPM Calculations');
  console.log('========================================\n');

  // Step 1: Find all Bradford→JD POs
  console.log('Step 1: Finding Bradford→JD POs...\\n');

  const bradfordPOs = await prisma.purchaseOrder.findMany({
    where: {
      originCompanyId: 'bradford',
      targetCompanyId: 'jd-graphic',
    },
    include: {
      job: {
        select: {
          id: true,
          jobNo: true,
          quantity: true,
          printCPM: true,
          jdTotal: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`Found ${bradfordPOs.length} Bradford→JD POs\\n`);

  // Step 2: Analyze each PO to determine if it needs fixing
  console.log('Step 2: Analyzing POs...\\n');

  const fixes: POFix[] = [];
  const skipped: string[] = [];

  for (const po of bradfordPOs) {
    if (!po.job) {
      skipped.push(`PO ${po.poNumber}: No associated job`);
      continue;
    }

    const { job } = po;
    const quantity = job.quantity || 0;
    const currentVendorAmount = po.vendorAmount;

    // Determine if vendorAmount is actually a CPM rate
    // Heuristic: If vendorAmount is close to printCPM (within $1), it's likely a CPM rate
    // Also check if jdTotal is significantly larger than vendorAmount

    let isCPMRate = false;
    let issue = '';

    if (job.printCPM) {
      const diff = Math.abs(Number(currentVendorAmount) - Number(job.printCPM));

      if (diff < 1.0) {
        // vendorAmount ≈ printCPM, so it's definitely a CPM rate
        isCPMRate = true;
        issue = 'vendorAmount matches printCPM (is CPM rate, not total)';
      }
    }

    if (job.jdTotal) {
      const totalDiff = Math.abs(Number(currentVendorAmount) - Number(job.jdTotal));

      if (totalDiff > 100 && Number(job.jdTotal) > Number(currentVendorAmount) * 2) {
        // jdTotal is much larger than vendorAmount, likely vendorAmount is CPM
        isCPMRate = true;
        issue = 'vendorAmount is much smaller than jdTotal (likely CPM rate)';
      }
    }

    if (!isCPMRate && !job.printCPM) {
      skipped.push(`PO ${po.poNumber} (${job.jobNo}): No printCPM to reference`);
      continue;
    }

    if (isCPMRate) {
      // Use current vendorAmount as CPM, calculate new total
      const cpm = currentVendorAmount;
      const thousands = new Prisma.Decimal(quantity).dividedBy(1000);
      const calculatedTotal = cpm.times(thousands);

      fixes.push({
        id: po.id,
        poNumber: po.poNumber,
        jobNo: job.jobNo,
        quantity,
        currentVendorAmount,
        printCPM: job.printCPM,
        jdTotal: job.jdTotal,
        newVendorCPM: cpm,
        newVendorAmount: calculatedTotal,
        issue,
      });
    } else if (job.printCPM && quantity > 0) {
      // vendorAmount seems correct but missing vendorCPM
      // Calculate CPM from existing vendorAmount and quantity
      const thousands = new Prisma.Decimal(quantity).dividedBy(1000);
      const calculatedCPM = currentVendorAmount.dividedBy(thousands);

      fixes.push({
        id: po.id,
        poNumber: po.poNumber,
        jobNo: job.jobNo,
        quantity,
        currentVendorAmount,
        printCPM: job.printCPM,
        jdTotal: job.jdTotal,
        newVendorCPM: calculatedCPM,
        newVendorAmount: currentVendorAmount, // Keep existing total
        issue: 'Missing vendorCPM field (total appears correct)',
      });
    }
  }

  console.log(`Found ${fixes.length} POs that need fixing`);
  console.log(`Skipped ${skipped.length} POs\\n`);

  if (skipped.length > 0) {
    console.log('Skipped POs:');
    skipped.forEach((msg) => console.log(`  - ${msg}`));
    console.log('');
  }

  // Step 3: Display preview
  if (fixes.length > 0) {
    console.log('Step 3: Preview of fixes:\\n');
    console.log('─'.repeat(140));
    console.log(
      'Job No'.padEnd(18) +
        'PO #'.padEnd(12) +
        'Qty'.padEnd(10) +
        'Current $'.padEnd(12) +
        'New CPM'.padEnd(12) +
        'New Total'.padEnd(12) +
        'Issue'
    );
    console.log('─'.repeat(140));

    for (const fix of fixes) {
      console.log(
        fix.jobNo.padEnd(18) +
          (fix.poNumber || 'N/A').padEnd(12) +
          fix.quantity.toLocaleString().padEnd(10) +
          `$${fix.currentVendorAmount.toFixed(2)}`.padEnd(12) +
          `$${fix.newVendorCPM.toFixed(2)}`.padEnd(12) +
          `$${fix.newVendorAmount.toFixed(2)}`.padEnd(12) +
          fix.issue
      );
    }
    console.log('─'.repeat(140));
    console.log('');
  }

  // Step 4: Ask for confirmation
  console.log('Step 4: Confirmation\\n');
  console.log('DRY RUN - No changes will be made to the database.');
  console.log('To execute, set DRY_RUN=false environment variable.\\n');

  const isDryRun = process.env.DRY_RUN !== 'false';

  if (isDryRun) {
    console.log('✅ Dry run complete. Review the preview above.');
    console.log('\\nTo execute:');
    console.log(
      '  DRY_RUN=false DATABASE_URL="..." npx tsx packages/db/scripts/fix-bradford-po-cpm.ts\\n'
    );
    return;
  }

  // Step 5: Apply fixes in transaction
  console.log('Step 5: Applying fixes...\\n');

  const result = await prisma.$transaction(async (tx) => {
    let updated = 0;

    for (const fix of fixes) {
      await tx.purchaseOrder.update({
        where: { id: fix.id },
        data: {
          vendorCPM: fix.newVendorCPM,
          vendorAmount: fix.newVendorAmount,
        },
      });

      console.log(
        `  ✓ Fixed PO ${fix.poNumber} (${fix.jobNo}): CPM=$${fix.newVendorCPM.toFixed(2)}, Total=$${fix.newVendorAmount.toFixed(2)}`
      );
      updated++;
    }

    return { updated };
  });

  // Step 6: Summary
  console.log('\\n========================================');
  console.log('✅ SUCCESS!');
  console.log('========================================');
  console.log(`Purchase Orders Updated: ${result.updated}`);
  console.log(`Skipped: ${skipped.length}`);
  console.log('========================================\\n');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
