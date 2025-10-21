import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PricingData {
  sizeName: string;
  rollSize: number;
  printCPM: number;
  paperWeightPer1000: number;
  paperCostPerLb?: number;
  paperChargedCPM: number;
  baseCPM: number;
  notes?: string;
}

const pricingRules: PricingData[] = [
  // Self Mailers - Contract Rates
  {
    sizeName: '7 1/4 x 16 3/8',
    rollSize: 15,
    printCPM: 34.74,
    paperWeightPer1000: 22.90,
    paperCostPerLb: 0.675,
    paperChargedCPM: 15.46,
    baseCPM: 50.20,
    notes: 'Self Mailer - Contract Rate',
  },
  {
    sizeName: '8 1/2 x 17 1/2',
    rollSize: 18,
    printCPM: 38.41,
    paperWeightPer1000: 30.16,
    paperCostPerLb: 0.675,
    paperChargedCPM: 20.36,
    baseCPM: 58.77,
    notes: 'Self Mailer - Contract Rate',
  },
  {
    sizeName: '9 3/4 x 22 1/8',
    rollSize: 20,
    printCPM: 49.18,
    paperWeightPer1000: 52.98,
    paperCostPerLb: 0.675,
    paperChargedCPM: 35.76,
    baseCPM: 84.94,
    notes: 'Self Mailer - Contract Rate',
  },
  {
    sizeName: '9 3/4 x 26',
    rollSize: 20,
    printCPM: 49.18,
    paperWeightPer1000: 54.28,
    paperCostPerLb: 0.675,
    paperChargedCPM: 43.55,
    baseCPM: 86.09,
    notes: 'Self Mailer - Contract Rate',
  },

  // Postcards - Coated Gloss 7pt (162# Stock) - Contract Rates
  {
    sizeName: '6 x 9',
    rollSize: 20,
    printCPM: 10.00,
    paperWeightPer1000: 17.10,
    paperChargedCPM: 13.60,
    baseCPM: 23.60,
    notes: 'Postcard - Coated Gloss 7pt - Contract Rate',
  },
  {
    sizeName: '6 x 11',
    rollSize: 20,
    printCPM: 10.00,
    paperWeightPer1000: 20.00,
    paperChargedCPM: 15.90,
    baseCPM: 25.90,
    notes: 'Postcard - Coated Gloss 7pt - Contract Rate',
  },

  // Self Mailers - Coated Matte 7pt (98# Stock) - Third Party Rates
  {
    sizeName: '7 1/4 x 16 3/8 (Matte)',
    rollSize: 15,
    printCPM: 49.01,
    paperWeightPer1000: 22.90,
    paperCostPerLb: 0.675,
    paperChargedCPM: 18.55,
    baseCPM: 67.56,
    notes: 'Self Mailer - Coated Matte 7pt - Third Party Rate',
  },
  {
    sizeName: '8 1/2 x 17 1/2 (Matte)',
    rollSize: 18,
    printCPM: 56.57,
    paperWeightPer1000: 30.16,
    paperCostPerLb: 0.675,
    paperChargedCPM: 24.43,
    baseCPM: 81.00,
    notes: 'Self Mailer - Coated Matte 7pt - Third Party Rate',
  },
  {
    sizeName: '9 3/4 x 22 1/8 (Matte)',
    rollSize: 20,
    printCPM: 64.00,
    paperWeightPer1000: 52.98,
    paperCostPerLb: 0.675,
    paperChargedCPM: 42.91,
    baseCPM: 106.91,
    notes: 'Self Mailer - Coated Matte 7pt - Third Party Rate',
  },
  {
    sizeName: '9 3/4 x 26 (Matte)',
    rollSize: 20,
    printCPM: 64.00,
    paperWeightPer1000: 60.00,
    paperChargedCPM: 48.60,
    baseCPM: 112.60,
    notes: 'Self Mailer - Coated Matte 7pt - Third Party Rate',
  },

  // Postcards - Coated Gloss 7pt (162# Stock) - Third Party Rates
  {
    sizeName: '6 x 9 (Third Party)',
    rollSize: 20,
    printCPM: 18.38,
    paperWeightPer1000: 17.10,
    paperChargedCPM: 16.32,
    baseCPM: 34.70,
    notes: 'Postcard - Coated Gloss 7pt - Third Party Rate',
  },
  {
    sizeName: '6 x 11 (Third Party)',
    rollSize: 20,
    printCPM: 18.38,
    paperWeightPer1000: 20.00,
    paperChargedCPM: 19.08,
    baseCPM: 37.46,
    notes: 'Postcard - Coated Gloss 7pt - Third Party Rate',
  },
];

async function importPricingRules() {
  console.log('📋 Importing Pricing Rules...\n');

  let successCount = 0;
  let updateCount = 0;
  let errorCount = 0;

  for (const rule of pricingRules) {
    try {
      // Calculate paper cost if paperCostPerLb is provided
      const paperCPM = rule.paperCostPerLb
        ? rule.paperWeightPer1000 * rule.paperCostPerLb
        : rule.paperChargedCPM; // If no cost provided, assume no markup

      // Check if rule exists
      const existing = await prisma.pricingRule.findUnique({
        where: { sizeName: rule.sizeName },
      });

      if (existing) {
        // Update existing rule
        await prisma.pricingRule.update({
          where: { sizeName: rule.sizeName },
          data: {
            baseCPM: rule.baseCPM,
            printCPM: rule.printCPM,
            paperWeightPer1000: rule.paperWeightPer1000,
            paperCostPerLb: rule.paperCostPerLb || null,
            paperCPM: paperCPM,
            paperChargedCPM: rule.paperChargedCPM,
            rollSize: rule.rollSize,
            notes: rule.notes,
          },
        });
        console.log(`✏️  Updated: ${rule.sizeName}`);
        updateCount++;
      } else {
        // Create new rule
        await prisma.pricingRule.create({
          data: {
            sizeName: rule.sizeName,
            baseCPM: rule.baseCPM,
            printCPM: rule.printCPM,
            paperWeightPer1000: rule.paperWeightPer1000,
            paperCostPerLb: rule.paperCostPerLb || null,
            paperCPM: paperCPM,
            paperChargedCPM: rule.paperChargedCPM,
            rollSize: rule.rollSize,
            notes: rule.notes,
          },
        });
        console.log(`✅ Created: ${rule.sizeName}`);
        successCount++;
      }

      // Show pricing breakdown
      const paperMargin = rule.paperChargedCPM - paperCPM;
      console.log(`   Print: $${rule.printCPM.toFixed(2)}/M`);
      console.log(`   Paper Cost: $${paperCPM.toFixed(2)}/M`);
      console.log(`   Paper Charged: $${rule.paperChargedCPM.toFixed(2)}/M`);
      console.log(`   Paper Margin: $${paperMargin.toFixed(2)}/M`);
      console.log(`   Base Total: $${rule.baseCPM.toFixed(2)}/M`);
      console.log('');
    } catch (error: any) {
      console.error(`❌ Error processing ${rule.sizeName}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n📊 Import Summary:');
  console.log(`   ✅ Created: ${successCount}`);
  console.log(`   ✏️  Updated: ${updateCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📦 Total: ${pricingRules.length}`);
}

importPricingRules()
  .then(() => {
    console.log('\n✅ Pricing rules import complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
