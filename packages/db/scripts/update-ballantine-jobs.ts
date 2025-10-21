import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BallantineJob {
  poNumber: string;
  jobName?: string;
  sizeName?: string;
  quantity: number;
  ppm: number;
  customerTotal: number;
  bradfordTotal: number;
  jdTotal: number;
  paperCostCPM: number;  // What Bradford PAYS for paper per M
  paperChargedCPM: number; // What Bradford CHARGES for paper per M
  paperWeightPer1000?: number; // Paper weight in lbs per thousand pieces
}

const ballantineJobs: BallantineJob[] = [
  {
    poNumber: '34386-51200.24',
    jobName: 'GUILFORD SCHOOL OF PSYCHOLOGY SM [SCHOO-52]',
    quantity: 24668,
    ppm: 112.60,
    customerTotal: 2777.62,
    bradfordTotal: 2594.83,
    jdTotal: 1198.86,
    paperCostCPM: 36.91,
    paperChargedCPM: 43.55,
  },
  {
    poNumber: '34412.51200.23',
    jobName: 'GUILFORD - LITERACY SM',
    quantity: 22318,
    ppm: 112.60,
    customerTotal: 2513.01,
    bradfordTotal: 2347.63,
    jdTotal: 1084.65,
    paperCostCPM: 36.91,
    paperChargedCPM: 43.55,
  },
  {
    poNumber: '34384-51200.32',
    jobName: 'GUILFORD SPECIAL EDUCATION SM [LRDIS-52]',
    quantity: 20342,
    ppm: 112.60,
    customerTotal: 2290.51,
    bradfordTotal: 2139.77,
    jdTotal: 988.62,
    paperCostCPM: 36.91,
    paperChargedCPM: 43.55,
  },
  {
    poNumber: '34385-51200.28',
    jobName: 'GUILFORD AUTISM SM [AUTSM-51]',
    quantity: 14921,
    ppm: 112.60,
    customerTotal: 1680.10,
    bradfordTotal: 1569.54,
    jdTotal: 725.16,
    paperCostCPM: 36.91,
    paperChargedCPM: 43.55,
  },
  {
    poNumber: '34383-51200.30',
    jobName: 'GUILFORD - PSALC SM - P & M',
    quantity: 11748,
    ppm: 112.60,
    customerTotal: 1322.82,
    bradfordTotal: 1235.77,
    jdTotal: 570.95,
    paperCostCPM: 36.91,
    paperChargedCPM: 43.55,
  },
  {
    poNumber: '34419-51200.33',
    jobName: 'GUILDFORD - METHOD SM [M-METHD-52]',
    quantity: 20040,
    ppm: 112.60,
    customerTotal: 2256.50,
    bradfordTotal: 2108.01,
    jdTotal: 973.94,
    paperCostCPM: 36.91,
    paperChargedCPM: 43.55,
  },
  {
    poNumber: '34432-51200.26',
    jobName: 'GUILFORD NEURO SM',
    quantity: 9938,
    ppm: 112.60,
    customerTotal: 1119.02,
    bradfordTotal: 1045.38,
    jdTotal: 482.99,
    paperCostCPM: 36.91,
    paperChargedCPM: 43.55,
  },
  {
    poNumber: '25-14432',
    jobName: 'DBTXX',
    quantity: 15374,
    ppm: 112.60,
    customerTotal: 1731.11,
    bradfordTotal: 1617.19,
    jdTotal: 747.18,
    paperCostCPM: 36.91,
    paperChargedCPM: 43.55,
  },
  {
    poNumber: '34299-51200.31',
    sizeName: '7 1/4 x 16 3/8',
    quantity: 268279,
    ppm: 68.30,
    customerTotal: 18324.93,
    bradfordTotal: 15895.93,
    jdTotal: 9320.01,
    paperCostCPM: 15.46,   // 7 1/4 x 16 3/8 cost
    paperChargedCPM: 18.55, // 7 1/4 x 16 3/8 sell price
    paperWeightPer1000: 22.90, // Usage for this size
  },
  {
    poNumber: '34298-51200.22',
    jobName: 'Life for Life and L95 Mailing',
    sizeName: '9 3/4 x 26',
    quantity: 248081,
    ppm: 95.77,
    customerTotal: 23759.48,
    bradfordTotal: 22558.01,
    jdTotal: 12200.62,
    paperCostCPM: 36.91,   // 9 3/4 x 26 cost
    paperChargedCPM: 43.55, // 9 3/4 x 26 sell price
    paperWeightPer1000: 54.28, // Usage for this size
  },
];

async function updateBallantineJobs() {
  console.log('📋 Updating Ballantine Jobs with Manual Pricing...\n');

  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;

  for (const jobData of ballantineJobs) {
    try {
      // Find job by customer PO number
      const job = await prisma.job.findFirst({
        where: {
          customerPONumber: {
            contains: jobData.poNumber,
          },
        },
        include: {
          customer: true,
          invoices: {
            include: {
              fromCompany: true,
              toCompany: true,
            },
          },
        },
      });

      if (!job) {
        console.log(`❌ Not found: ${jobData.poNumber}`);
        notFoundCount++;
        continue;
      }

      // Calculate derived values
      const quantityInThousands = jobData.quantity / 1000;
      const customerCPM = jobData.customerTotal / quantityInThousands;
      const bradfordTotalCPM = jobData.bradfordTotal / quantityInThousands;
      const printCPM = jobData.jdTotal / quantityInThousands;

      // Calculate paper costs
      const paperCostTotal = jobData.paperCostCPM * quantityInThousands;
      const paperChargedTotal = jobData.paperChargedCPM * quantityInThousands;
      const bradfordPaperMargin = paperChargedTotal - paperCostTotal;

      // Calculate paper weight if available
      const paperWeightTotal = jobData.paperWeightPer1000
        ? jobData.paperWeightPer1000 * quantityInThousands
        : null;

      // Calculate margins (Bradford must pay for paper!)
      const impactMargin = jobData.customerTotal - jobData.bradfordTotal;
      const bradfordTotalMargin = jobData.bradfordTotal - jobData.jdTotal - paperCostTotal;
      const impactMarginCPM = impactMargin / quantityInThousands;

      console.log(`✅ Updating: ${job.jobNo} (PO: ${jobData.poNumber})`);
      console.log(`   Customer: ${job.customer?.name || 'Unknown'}`);
      console.log(`   Quantity: ${jobData.quantity.toLocaleString()}`);

      // Update job record
      await prisma.job.update({
        where: { id: job.id },
        data: {
          ...(jobData.sizeName && { sizeName: jobData.sizeName }),
          quantity: jobData.quantity,
          customerTotal: jobData.customerTotal,
          bradfordTotal: jobData.bradfordTotal,
          jdTotal: jobData.jdTotal,
          impactMargin: impactMargin,
          bradfordTotalMargin: bradfordTotalMargin,
          bradfordPaperMargin: bradfordPaperMargin,
          paperCostTotal: paperCostTotal,
          paperChargedTotal: paperChargedTotal,
          paperCostCPM: jobData.paperCostCPM,
          paperChargedCPM: jobData.paperChargedCPM,
          ...(jobData.paperWeightPer1000 && { paperWeightPer1000: jobData.paperWeightPer1000 }),
          ...(paperWeightTotal !== null && { paperWeightTotal: paperWeightTotal }),
          customerCPM: customerCPM,
          bradfordTotalCPM: bradfordTotalCPM,
          printCPM: printCPM,
          impactMarginCPM: impactMarginCPM,
        },
      });

      console.log(`   📊 Pricing:`);
      console.log(`      Customer Total: $${jobData.customerTotal.toFixed(2)} ($${customerCPM.toFixed(2)}/M)`);
      console.log(`      Bradford Invoice: $${jobData.bradfordTotal.toFixed(2)} ($${bradfordTotalCPM.toFixed(2)}/M)`);
      console.log(`      JD Print Cost: $${jobData.jdTotal.toFixed(2)} ($${printCPM.toFixed(2)}/M)`);
      console.log(`      Paper Cost: $${paperCostTotal.toFixed(2)} ($${jobData.paperCostCPM.toFixed(2)}/M)`);
      console.log(`      Paper Charged: $${paperChargedTotal.toFixed(2)} ($${jobData.paperChargedCPM.toFixed(2)}/M)`);
      console.log(`      Paper Markup: $${bradfordPaperMargin.toFixed(2)}`);
      if (paperWeightTotal !== null) {
        console.log(`      Paper Weight: ${paperWeightTotal.toFixed(2)} lbs (${jobData.paperWeightPer1000!.toFixed(2)} lbs/M)`);
      }
      console.log(`      Impact Margin: $${impactMargin.toFixed(2)} ($${impactMarginCPM.toFixed(2)}/M)`);
      console.log(`      Bradford Margin (after paper cost): $${bradfordTotalMargin.toFixed(2)}`);

      // Update or create invoices
      // 1. Invoice from Impact to Customer
      const impactToCustomerInvoice = job.invoices.find(
        (inv) => inv.fromCompany.id === 'impact-direct' && inv.toCompany.id === job.customerId
      );

      if (impactToCustomerInvoice) {
        await prisma.invoice.update({
          where: { id: impactToCustomerInvoice.id },
          data: {
            amount: jobData.customerTotal,
          },
        });
        console.log(`   ✏️  Updated invoice: Impact → Customer ($${jobData.customerTotal.toFixed(2)})`);
      } else {
        console.log(`   ⚠️  No Impact → Customer invoice found`);
      }

      // 2. Invoice from Bradford to Impact
      const bradfordToImpactInvoice = job.invoices.find(
        (inv) => inv.fromCompany.id === 'bradford' && inv.toCompany.id === 'impact-direct'
      );

      if (bradfordToImpactInvoice) {
        await prisma.invoice.update({
          where: { id: bradfordToImpactInvoice.id },
          data: {
            amount: jobData.bradfordTotal,
          },
        });
        console.log(`   ✏️  Updated invoice: Bradford → Impact ($${jobData.bradfordTotal.toFixed(2)})`);
      } else {
        console.log(`   ⚠️  No Bradford → Impact invoice found`);
      }

      console.log('');
      successCount++;
    } catch (error: any) {
      console.error(`❌ Error processing ${jobData.poNumber}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n📊 Update Summary:');
  console.log(`   ✅ Successfully updated: ${successCount}`);
  console.log(`   ❌ Not found: ${notFoundCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📦 Total jobs: ${ballantineJobs.length}`);
}

updateBallantineJobs()
  .then(() => {
    console.log('\n✅ Ballantine jobs update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Update failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
