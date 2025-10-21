import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function consolidateCustomers() {
  console.log('🏢 Starting Customer Consolidation...\n');

  try {
    // Step 1: Get current employee-based companies
    const lorieCompany = await prisma.company.findFirst({
      where: { email: 'lorie@jjsainc.com' },
    });

    const jenniferCompany = await prisma.company.findFirst({
      where: { email: 'jennifer@ballantine.com' },
    });

    const mattCompany = await prisma.company.findFirst({
      where: { email: 'matt@ballantine.com' },
    });

    if (!lorieCompany || !jenniferCompany || !mattCompany) {
      throw new Error('Could not find all employee companies');
    }

    console.log('📋 Current Companies:');
    console.log(`   Lorie: ${lorieCompany.id} (${lorieCompany.name})`);
    console.log(`   Jennifer: ${jenniferCompany.id} (${jenniferCompany.name})`);
    console.log(`   Matt: ${mattCompany.id} (${mattCompany.name})`);
    console.log('');

    // Step 2: Create or update proper customer companies
    console.log('🔧 Creating/Updating Customer Companies...\n');

    const jjsaCompany = await prisma.company.upsert({
      where: { id: 'jjsa' },
      update: {
        name: 'JJS&A Inc.',
        type: 'customer',
        email: 'contact@jjsainc.com',
        phone: null,
        address: '304 Lakeside Dr., Southampton PA 18966',
      },
      create: {
        id: 'jjsa',
        name: 'JJS&A Inc.',
        type: 'customer',
        email: 'contact@jjsainc.com',
        phone: null,
        address: '304 Lakeside Dr., Southampton PA 18966',
      },
    });

    const ballantineCompany = await prisma.company.upsert({
      where: { id: 'ballantine' },
      update: {
        name: 'Ballantine',
        type: 'customer',
        email: 'contact@ballantine.com',
        phone: null,
        address: '45 North Broad Street, Suite 317, Ridgewood, NJ 07834',
      },
      create: {
        id: 'ballantine',
        name: 'Ballantine',
        type: 'customer',
        email: 'contact@ballantine.com',
        phone: null,
        address: '45 North Broad Street, Suite 317, Ridgewood, NJ 07834',
      },
    });

    console.log(`✅ Created/Updated: ${jjsaCompany.name} (${jjsaCompany.id})`);
    console.log(`✅ Created/Updated: ${ballantineCompany.name} (${ballantineCompany.id})`);
    console.log('');

    // Step 3: Migrate jobs to proper companies
    console.log('📦 Migrating Jobs...\n');

    // Migrate Lorie's jobs to JJSA
    const lorieJobsUpdate = await prisma.job.updateMany({
      where: { customerId: lorieCompany.id },
      data: { customerId: jjsaCompany.id },
    });

    console.log(`✅ Migrated ${lorieJobsUpdate.count} jobs from Lorie → JJSA`);

    // Migrate Jennifer's jobs to Ballantine
    const jenniferJobsUpdate = await prisma.job.updateMany({
      where: { customerId: jenniferCompany.id },
      data: { customerId: ballantineCompany.id },
    });

    console.log(`✅ Migrated ${jenniferJobsUpdate.count} jobs from Jennifer → Ballantine`);

    // Migrate Matt's jobs to Ballantine
    const mattJobsUpdate = await prisma.job.updateMany({
      where: { customerId: mattCompany.id },
      data: { customerId: ballantineCompany.id },
    });

    console.log(`✅ Migrated ${mattJobsUpdate.count} jobs from Matt → Ballantine`);
    console.log('');

    // Step 4: Create Contact records for employees
    console.log('👥 Creating Contact Records...\n');

    // Lorie as contact for JJSA
    await prisma.contact.upsert({
      where: {
        id: 'contact-lorie-jjsa' // Using a deterministic ID
      },
      update: {
        companyId: jjsaCompany.id,
        name: 'Lorie Modelevsky',
        email: 'lorie@jjsainc.com',
        isPrimary: true,
      },
      create: {
        id: 'contact-lorie-jjsa',
        companyId: jjsaCompany.id,
        name: 'Lorie Modelevsky',
        email: 'lorie@jjsainc.com',
        isPrimary: true,
      },
    });

    console.log('✅ Created contact: Lorie Modelevsky → JJSA');

    // Jennifer as contact for Ballantine
    await prisma.contact.upsert({
      where: {
        id: 'contact-jennifer-ballantine'
      },
      update: {
        companyId: ballantineCompany.id,
        name: 'Jennifer',
        email: 'jennifer@ballantine.com',
        isPrimary: true,
      },
      create: {
        id: 'contact-jennifer-ballantine',
        companyId: ballantineCompany.id,
        name: 'Jennifer',
        email: 'jennifer@ballantine.com',
        isPrimary: true,
      },
    });

    console.log('✅ Created contact: Jennifer → Ballantine');

    // Matt as contact for Ballantine
    await prisma.contact.upsert({
      where: {
        id: 'contact-matt-ballantine'
      },
      update: {
        companyId: ballantineCompany.id,
        name: 'Matt',
        email: 'matt@ballantine.com',
        isPrimary: false,
      },
      create: {
        id: 'contact-matt-ballantine',
        companyId: ballantineCompany.id,
        name: 'Matt',
        email: 'matt@ballantine.com',
        isPrimary: false,
      },
    });

    console.log('✅ Created contact: Matt → Ballantine');
    console.log('');

    // Step 5: Show final summary
    console.log('📊 Final Summary:\n');

    const jjsaJobs = await prisma.job.count({
      where: { customerId: jjsaCompany.id },
    });

    const ballantineJobs = await prisma.job.count({
      where: { customerId: ballantineCompany.id },
    });

    console.log('Customer Companies:');
    console.log(`   ${jjsaCompany.name}: ${jjsaJobs} jobs`);
    console.log(`   ${ballantineCompany.name}: ${ballantineJobs} jobs`);
    console.log('');

    // Check if old companies can be deleted
    const lorieRemainingJobs = await prisma.job.count({
      where: { customerId: lorieCompany.id },
    });

    const jenniferRemainingJobs = await prisma.job.count({
      where: { customerId: jenniferCompany.id },
    });

    const mattRemainingJobs = await prisma.job.count({
      where: { customerId: mattCompany.id },
    });

    console.log('Old Employee Companies (can be deleted):');
    console.log(`   ${lorieCompany.name}: ${lorieRemainingJobs} jobs remaining`);
    console.log(`   ${jenniferCompany.name}: ${jenniferRemainingJobs} jobs remaining`);
    console.log(`   ${mattCompany.name}: ${mattRemainingJobs} jobs remaining`);
    console.log('');

    if (lorieRemainingJobs === 0 && jenniferRemainingJobs === 0 && mattRemainingJobs === 0) {
      console.log('🗑️  Cleaning up old employee companies...\n');

      await prisma.company.delete({ where: { id: lorieCompany.id } });
      console.log(`   ✅ Deleted: ${lorieCompany.name}`);

      await prisma.company.delete({ where: { id: jenniferCompany.id } });
      console.log(`   ✅ Deleted: ${jenniferCompany.name}`);

      await prisma.company.delete({ where: { id: mattCompany.id } });
      console.log(`   ✅ Deleted: ${mattCompany.name}`);
    }

  } catch (error) {
    console.error('💥 Consolidation failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

consolidateCustomers()
  .then(() => {
    console.log('\n✅ Consolidation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Consolidation failed:', error);
    process.exit(1);
  });
