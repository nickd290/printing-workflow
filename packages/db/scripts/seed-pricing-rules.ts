import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPricingRules() {
  console.log('📊 Analyzing existing jobs to create pricing rules...\n');

  try {
    // Get all jobs with complete data (size, invoices, POs)
    const jobs = await prisma.job.findMany({
      where: {
        AND: [
          { sizeName: { not: null } },
          { sizeName: { not: '' } },
          { quantity: { not: null } },
          { quantity: { gt: 0 } },
        ],
      },
      include: {
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
    });

    console.log(`Found ${jobs.length} jobs with complete data\n`);

    // Group jobs by size and calculate averages
    const sizeMap = new Map<string, {
      count: number;
      totalCustomerCPM: number;
      totalJDPrintCPM: number;
      jobs: string[];
    }>();

    for (const job of jobs) {
      // Get customer invoice
      const customerInvoice = job.invoices.find(
        inv => inv.fromCompany.id === 'impact-direct' || inv.fromCompany.id === 'bradford'
      );

      // Get JD PO
      const jdPO = job.purchaseOrders.find(
        po => po.originCompany.id === 'bradford' && po.targetCompany.id === 'jd-graphic'
      );

      if (!customerInvoice || !jdPO || !job.quantity) continue;

      const sizeName = job.sizeName!;
      const quantityInThousands = job.quantity / 1000;
      const customerCPM = Number(customerInvoice.amount) / quantityInThousands;
      const jdPrintCPM = Number(jdPO.vendorAmount) / quantityInThousands;

      if (!sizeMap.has(sizeName)) {
        sizeMap.set(sizeName, {
          count: 0,
          totalCustomerCPM: 0,
          totalJDPrintCPM: 0,
          jobs: [],
        });
      }

      const sizeData = sizeMap.get(sizeName)!;
      sizeData.count++;
      sizeData.totalCustomerCPM += customerCPM;
      sizeData.totalJDPrintCPM += jdPrintCPM;
      sizeData.jobs.push(job.jobNo);
    }

    console.log(`📏 Found ${sizeMap.size} unique sizes\n`);

    // Create pricing rules
    let created = 0;
    let updated = 0;

    for (const [sizeName, data] of sizeMap.entries()) {
      const avgCustomerCPM = data.totalCustomerCPM / data.count;
      const avgJDPrintCPM = data.totalJDPrintCPM / data.count;

      try {
        const existing = await prisma.pricingRule.findUnique({
          where: { sizeName },
        });

        if (existing) {
          await prisma.pricingRule.update({
            where: { sizeName },
            data: {
              baseCPM: avgCustomerCPM,
              jdPrintCPM: avgJDPrintCPM,
              notes: `Updated from ${data.count} job(s): ${data.jobs.join(', ')}`,
            },
          });
          updated++;
          console.log(`🔄 Updated: ${sizeName}`);
        } else {
          await prisma.pricingRule.create({
            data: {
              sizeName,
              baseCPM: avgCustomerCPM,
              jdPrintCPM: avgJDPrintCPM,
              notes: `Created from ${data.count} job(s): ${data.jobs.join(', ')}`,
            },
          });
          created++;
          console.log(`✨ Created: ${sizeName}`);
        }

        console.log(`   Base CPM: $${avgCustomerCPM.toFixed(2)}/M`);
        console.log(`   JD Print CPM: $${avgJDPrintCPM.toFixed(2)}/M`);
        console.log(`   Sample count: ${data.count} job(s)`);
        console.log('');
      } catch (error: any) {
        console.error(`❌ Error creating/updating pricing rule for ${sizeName}:`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✨ Created: ${created} pricing rules`);
    console.log(`   🔄 Updated: ${updated} pricing rules`);
    console.log(`   📏 Total sizes: ${sizeMap.size}`);

    // Show all pricing rules
    console.log('\n📋 Current Pricing Rules:');
    console.log('─'.repeat(100));
    console.log(
      'Size'.padEnd(20) +
      'Base CPM'.padEnd(15) +
      'JD Print CPM'.padEnd(15) +
      'Active'
    );
    console.log('─'.repeat(100));

    const allRules = await prisma.pricingRule.findMany({
      orderBy: { sizeName: 'asc' },
    });

    for (const rule of allRules) {
      console.log(
        rule.sizeName.padEnd(20) +
        `$${Number(rule.baseCPM).toFixed(2)}/M`.padEnd(15) +
        `$${Number(rule.jdPrintCPM).toFixed(2)}/M`.padEnd(15) +
        (rule.isActive ? '✅' : '❌')
      );
    }
    console.log('─'.repeat(100));

  } catch (error) {
    console.error('💥 Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedPricingRules()
  .then(() => {
    console.log('\n✅ Pricing rules seeded successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  });
