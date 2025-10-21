import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Bradford's Contracted Rates with JD Graphic
 *
 * Self Mailer Size | Roll Size | Print 4/4 CPM | Paper Lbs/m | Paper Cost/lb | Paper CPM
 * 7 1/4 x 16 3/8   | 15"       | $34.74        | 22.90       | $0.675        | $15.46
 * 8 1/2 x 17 1/2   | 18"       | $38.41        | 30.16       | $0.675        | $20.36
 * 9 3/4 x 22 1/8   | 20"       | $49.18        | 52.98       | $0.675        | $35.76
 * 9 3/4 x 26       | 20"       | $49.18        | 54.28       | $0.675        | $36.91
 */

const bradfordRates = [
  {
    sizeName: '16.375 x 7.25',
    printCPM: 34.74,
    paperWeightPer1000: 22.90,
    paperCostPerLb: 0.675,
    paperCPM: 15.46,
    rollSize: 15,
    notes: 'Bradford contracted rate for 7 1/4 x 16 3/8 self-mailer',
  },
  {
    sizeName: '17.5 x 8.5',
    printCPM: 38.41,
    paperWeightPer1000: 30.16,
    paperCostPerLb: 0.675,
    paperCPM: 20.36,
    rollSize: 18,
    notes: 'Bradford contracted rate for 8 1/2 x 17 1/2 self-mailer',
  },
  {
    sizeName: '22.125 x 9.75',
    printCPM: 49.18,
    paperWeightPer1000: 52.98,
    paperCostPerLb: 0.675,
    paperCPM: 35.76,
    rollSize: 20,
    notes: 'Bradford contracted rate for 9 3/4 x 22 1/8 self-mailer',
  },
  {
    sizeName: '26 x 9.75',
    printCPM: 49.18,
    paperWeightPer1000: 54.28,
    paperCostPerLb: 0.675,
    paperCPM: 36.91,
    rollSize: 20,
    notes: 'Bradford contracted rate for 9 3/4 x 26 self-mailer',
  },
];

async function updateBradfordPricing() {
  console.log('📊 Updating Pricing Rules with Bradford Contracted Rates...\n');

  let updated = 0;
  let created = 0;

  try {
    for (const rate of bradfordRates) {
      const existing = await prisma.pricingRule.findUnique({
        where: { sizeName: rate.sizeName },
      });

      if (existing) {
        await prisma.pricingRule.update({
          where: { sizeName: rate.sizeName },
          data: {
            printCPM: rate.printCPM,
            paperWeightPer1000: rate.paperWeightPer1000,
            paperCostPerLb: rate.paperCostPerLb,
            paperCPM: rate.paperCPM,
            rollSize: rate.rollSize,
            notes: rate.notes,
          },
        });
        console.log(`🔄 Updated: ${rate.sizeName}`);
        updated++;
      } else {
        await prisma.pricingRule.create({
          data: {
            sizeName: rate.sizeName,
            baseCPM: rate.printCPM + rate.paperCPM, // Initial baseCPM = cost
            printCPM: rate.printCPM,
            paperWeightPer1000: rate.paperWeightPer1000,
            paperCostPerLb: rate.paperCostPerLb,
            paperCPM: rate.paperCPM,
            rollSize: rate.rollSize,
            notes: rate.notes,
            isActive: true,
          },
        });
        console.log(`✨ Created: ${rate.sizeName}`);
        created++;
      }

      console.log(`   Print CPM: $${rate.printCPM.toFixed(2)}/M`);
      console.log(`   Paper: ${rate.paperWeightPer1000} lbs/M @ $${rate.paperCostPerLb}/lb = $${rate.paperCPM.toFixed(2)}/M`);
      console.log(`   Roll Size: ${rate.rollSize}"`);
      console.log('');
    }

    console.log('\n📊 Summary:');
    console.log(`   ✨ Created: ${created} pricing rules`);
    console.log(`   🔄 Updated: ${updated} pricing rules`);
    console.log(`   📏 Total Bradford rates: ${bradfordRates.length}`);

    // Show all pricing rules
    console.log('\n📋 Current Pricing Rules:');
    console.log('─'.repeat(120));
    console.log(
      'Size'.padEnd(20) +
      'Print CPM'.padEnd(15) +
      'Paper CPM'.padEnd(15) +
      'Paper lbs/M'.padEnd(15) +
      'Roll Size'.padEnd(12) +
      'Active'
    );
    console.log('─'.repeat(120));

    const allRules = await prisma.pricingRule.findMany({
      orderBy: { sizeName: 'asc' },
    });

    for (const rule of allRules) {
      console.log(
        rule.sizeName.padEnd(20) +
        `$${Number(rule.printCPM).toFixed(2)}/M`.padEnd(15) +
        (rule.paperCPM ? `$${Number(rule.paperCPM).toFixed(2)}/M`.padEnd(15) : '-'.padEnd(15)) +
        (rule.paperWeightPer1000 ? `${Number(rule.paperWeightPer1000).toFixed(2)} lbs`.padEnd(15) : '-'.padEnd(15)) +
        (rule.rollSize ? `${rule.rollSize}"`.padEnd(12) : '-'.padEnd(12)) +
        (rule.isActive ? '✅' : '❌')
      );
    }
    console.log('─'.repeat(120));

  } catch (error) {
    console.error('💥 Update failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateBradfordPricing()
  .then(() => {
    console.log('\n✅ Bradford pricing update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Bradford pricing update failed:', error);
    process.exit(1);
  });
