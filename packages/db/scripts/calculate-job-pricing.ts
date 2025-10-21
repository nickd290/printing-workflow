import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PricingBreakdown {
  jobNo: string;
  customerPO: string | null;
  customerTotal: number;
  jdPrintCost: number;
  bradfordPaperMargin: number;
  totalCosts: number;
  remainingProfit: number;
  impactMargin: number;
  bradfordTotalMargin: number;
  bradfordTotal: number;
  quantity: number;
  // CPM values
  customerCPM: number;
  impactMarginCPM: number;
  bradfordTotalCPM: number;
  jdPrintCPM: number;
}

async function calculateJobPricing() {
  console.log('💰 Starting Job Pricing Calculation...\n');

  try {
    // Get all jobs with related data
    const jobs = await prisma.job.findMany({
      include: {
        customer: true,
        invoices: {
          include: {
            fromCompany: true,
            toCompany: true,
          },
        },
        purchaseOrders: {
          include: {
            originCompany: true,
            targetCompany: true,
          },
        },
      },
      orderBy: {
        jobNo: 'asc',
      },
    });

    console.log(`Found ${jobs.length} jobs to process\n`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const breakdowns: PricingBreakdown[] = [];

    for (const job of jobs) {
      try {
        // Skip if no quantity or size
        if (!job.quantity || job.quantity === 0) {
          console.log(`⏭️  ${job.jobNo}: No quantity - skipping`);
          skippedCount++;
          continue;
        }

        if (!job.sizeName) {
          console.log(`⏭️  ${job.jobNo}: No size name - skipping`);
          skippedCount++;
          continue;
        }

        // Find customer invoice (from Impact to Customer or from Bradford to Impact)
        // The customer total should be the final price charged to end customer
        const customerInvoice = job.invoices.find(
          inv => inv.fromCompany.id === 'impact-direct' || inv.fromCompany.id === 'bradford'
        );

        if (!customerInvoice) {
          console.log(`⚠️  ${job.jobNo}: No customer invoice found - skipping`);
          skippedCount++;
          continue;
        }

        const customerTotal = Number(customerInvoice.amount);

        // Look up pricing rule for this size
        const pricingRule = await prisma.pricingRule.findUnique({
          where: { sizeName: job.sizeName },
        });

        if (!pricingRule) {
          console.log(`⚠️  ${job.jobNo}: No pricing rule for size "${job.sizeName}" - skipping`);
          skippedCount++;
          continue;
        }

        // Calculate costs from pricing rule
        const quantityInThousands = job.quantity / 1000;
        const jdPrintCost = Number(pricingRule.printCPM) * quantityInThousands;

        // Calculate paper costs from pricing rule if available, otherwise use job data
        let paperCostTotal = 0;
        let paperChargedTotal = 0;
        let bradfordPaperMargin = 0;

        if (pricingRule.paperCPM && pricingRule.paperWeightPer1000) {
          // Use pricing rule data for paper costs
          paperCostTotal = Number(pricingRule.paperCPM) * quantityInThousands;
          // Bradford charges a markup on paper
          paperChargedTotal = pricingRule.paperChargedCPM
            ? Number(pricingRule.paperChargedCPM) * quantityInThousands
            : paperCostTotal;
          bradfordPaperMargin = paperChargedTotal - paperCostTotal;
        } else {
          // Fall back to job data
          paperCostTotal = Number(job.paperCostTotal || 0);
          paperChargedTotal = Number(job.paperChargedTotal || 0);
          bradfordPaperMargin = paperChargedTotal - paperCostTotal;
        }

        // Calculate total costs
        const totalCosts = jdPrintCost + paperChargedTotal;

        // Calculate remaining profit
        const remainingProfit = customerTotal - totalCosts;

        // 50/50 split
        const impactMargin = remainingProfit * 0.5;
        const bradfordTotalMargin = remainingProfit * 0.5;

        // Bradford total = JD cost + paper charged + their share of profit
        const bradfordTotal = jdPrintCost + paperChargedTotal + bradfordTotalMargin;

        // Calculate CPM values (Cost Per Thousand)
        const customerCPM = customerTotal / quantityInThousands;
        const impactMarginCPM = impactMargin / quantityInThousands;
        const bradfordTotalCPM = bradfordTotal / quantityInThousands;
        const jdPrintCPM = Number(pricingRule.printCPM);

        // Calculate paper weight if available from pricing rule
        const paperWeightTotal = pricingRule.paperWeightPer1000
          ? Number(pricingRule.paperWeightPer1000) * quantityInThousands
          : null;
        const paperWeightPer1000 = pricingRule.paperWeightPer1000
          ? Number(pricingRule.paperWeightPer1000)
          : null;

        // Update job record
        await prisma.job.update({
          where: { id: job.id },
          data: {
            customerTotal,
            impactMargin,
            bradfordTotal,
            bradfordPaperMargin,
            bradfordTotalMargin,
            jdTotal: jdPrintCost,
            paperCostTotal,
            paperChargedTotal,
            paperWeightTotal,
            paperWeightPer1000,
            // CPM values
            customerCPM,
            impactMarginCPM,
            bradfordTotalCPM,
            printCPM: jdPrintCPM,
            paperCostCPM: paperCostTotal / quantityInThousands,
            paperChargedCPM: paperChargedTotal / quantityInThousands,
          },
        });

        const breakdown: PricingBreakdown = {
          jobNo: job.jobNo,
          customerPO: job.customerPONumber,
          customerTotal,
          jdPrintCost,
          bradfordPaperMargin,
          totalCosts,
          remainingProfit,
          impactMargin,
          bradfordTotalMargin,
          bradfordTotal,
          quantity: job.quantity,
          customerCPM,
          impactMarginCPM,
          bradfordTotalCPM,
          jdPrintCPM,
        };

        breakdowns.push(breakdown);

        console.log(`✅ ${job.jobNo} (PO: ${job.customerPONumber || 'N/A'})`);
        console.log(`   Customer: $${customerTotal.toFixed(2)} ($${customerCPM.toFixed(2)}/M)`);
        console.log(`   JD Print: $${jdPrintCost.toFixed(2)} ($${jdPrintCPM.toFixed(2)}/M)`);
        console.log(`   Bradford Paper Margin: $${bradfordPaperMargin.toFixed(2)}`);
        console.log(`   Remaining Profit: $${remainingProfit.toFixed(2)}`);
        console.log(`   Impact Margin (50%): $${impactMargin.toFixed(2)} ($${impactMarginCPM.toFixed(2)}/M)`);
        console.log(`   Bradford Margin (50%): $${bradfordTotalMargin.toFixed(2)}`);
        console.log(`   Bradford Total: $${bradfordTotal.toFixed(2)} ($${bradfordTotalCPM.toFixed(2)}/M)`);
        console.log('');

        successCount++;
      } catch (error: any) {
        console.error(`❌ Error processing ${job.jobNo}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Pricing Calculation Summary:');
    console.log(`   ✅ Successfully calculated: ${successCount}`);
    console.log(`   ⏭️  Skipped (missing data): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total jobs: ${jobs.length}`);

    if (breakdowns.length > 0) {
      console.log('\n📈 Pricing Summary by Job:');
      console.log('─'.repeat(120));
      console.log(
        'Job Number'.padEnd(18) +
        'Customer'.padEnd(12) +
        'JD Cost'.padEnd(12) +
        'Paper Mrgn'.padEnd(12) +
        'Profit'.padEnd(12) +
        'Impact'.padEnd(12) +
        'Bradford'.padEnd(12) +
        'Qty'
      );
      console.log('─'.repeat(120));

      for (const b of breakdowns) {
        console.log(
          b.jobNo.padEnd(18) +
          `$${b.customerTotal.toFixed(0)}`.padEnd(12) +
          `$${b.jdPrintCost.toFixed(0)}`.padEnd(12) +
          `$${b.bradfordPaperMargin.toFixed(0)}`.padEnd(12) +
          `$${b.remainingProfit.toFixed(0)}`.padEnd(12) +
          `$${b.impactMargin.toFixed(0)}`.padEnd(12) +
          `$${b.bradfordTotalMargin.toFixed(0)}`.padEnd(12) +
          b.quantity.toLocaleString()
        );
      }
      console.log('─'.repeat(120));

      // Grand totals
      const totals = breakdowns.reduce(
        (acc, b) => ({
          customerTotal: acc.customerTotal + b.customerTotal,
          jdPrintCost: acc.jdPrintCost + b.jdPrintCost,
          bradfordPaperMargin: acc.bradfordPaperMargin + b.bradfordPaperMargin,
          remainingProfit: acc.remainingProfit + b.remainingProfit,
          impactMargin: acc.impactMargin + b.impactMargin,
          bradfordTotalMargin: acc.bradfordTotalMargin + b.bradfordTotalMargin,
        }),
        {
          customerTotal: 0,
          jdPrintCost: 0,
          bradfordPaperMargin: 0,
          remainingProfit: 0,
          impactMargin: 0,
          bradfordTotalMargin: 0,
        }
      );

      console.log('\n💵 Grand Totals:');
      console.log(`   Customer Revenue: $${totals.customerTotal.toFixed(2)}`);
      console.log(`   JD Print Costs: $${totals.jdPrintCost.toFixed(2)}`);
      console.log(`   Bradford Paper Margin: $${totals.bradfordPaperMargin.toFixed(2)}`);
      console.log(`   Total Profit to Split: $${totals.remainingProfit.toFixed(2)}`);
      console.log(`   Impact Margin (50%): $${totals.impactMargin.toFixed(2)}`);
      console.log(`   Bradford Margin (50%): $${totals.bradfordTotalMargin.toFixed(2)}`);
    }

  } catch (error) {
    console.error('💥 Pricing calculation failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

calculateJobPricing()
  .then(() => {
    console.log('\n✅ Pricing calculation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Pricing calculation failed:', error);
    process.exit(1);
  });
