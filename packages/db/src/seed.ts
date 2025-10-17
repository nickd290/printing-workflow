import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create broker/manufacturer companies
  const impactDirect = await prisma.company.upsert({
    where: { id: 'impact-direct' },
    update: {},
    create: {
      id: 'impact-direct',
      name: 'Impact Direct',
      type: 'broker',
      email: 'info@impactdirect.com',
      phone: '555-0100',
      address: '123 Business St, Suite 100, City, ST 12345',
    },
  });

  const bradford = await prisma.company.upsert({
    where: { id: 'bradford' },
    update: {},
    create: {
      id: 'bradford',
      name: 'Bradford',
      type: 'broker',
      email: 'steve.gustafson@bgeltd.com',
      phone: '555-0200',
      address: '456 Commerce Ave, City, ST 12346',
    },
  });

  const jdGraphic = await prisma.company.upsert({
    where: { id: 'jd-graphic' },
    update: {},
    create: {
      id: 'jd-graphic',
      name: 'JD Graphic',
      type: 'manufacturer',
      email: 'production@jdgraphic.com',
      phone: '555-0300',
      address: '789 Factory Rd, City, ST 12347',
    },
  });

  // Create customer companies
  const jjsa = await prisma.company.upsert({
    where: { id: 'jjsa' },
    update: {},
    create: {
      id: 'jjsa',
      name: 'JJSA',
      type: 'customer',
      email: 'orders@jjsa.com',
      phone: '555-0400',
      address: '321 Client Blvd, City, ST 12348',
    },
  });

  const ballantine = await prisma.company.upsert({
    where: { id: 'ballantine' },
    update: {},
    create: {
      id: 'ballantine',
      name: 'Ballantine',
      type: 'customer',
      email: 'orders@ballantine.com',
      phone: '555-0500',
      address: '654 Customer Ave, City, ST 12349',
    },
  });

  console.log('✅ Companies created');

  // Create Impact Direct users
  const impactAdmin = await prisma.user.upsert({
    where: { email: 'admin@impactdirect.com' },
    update: {},
    create: {
      email: 'admin@impactdirect.com',
      name: 'Impact Direct Admin',
      role: Role.BROKER_ADMIN,
      companyId: impactDirect.id,
      emailVerified: new Date(),
    },
  });

  const impactManager = await prisma.user.upsert({
    where: { email: 'manager@impactdirect.com' },
    update: {},
    create: {
      email: 'manager@impactdirect.com',
      name: 'Impact Direct Manager',
      role: Role.MANAGER,
      companyId: impactDirect.id,
      emailVerified: new Date(),
    },
  });

  // Create Bradford admin
  const bradfordAdmin = await prisma.user.upsert({
    where: { email: 'steve.gustafson@bgeltd.com' },
    update: {},
    create: {
      email: 'steve.gustafson@bgeltd.com',
      name: 'Steve Gustafson',
      role: Role.BRADFORD_ADMIN,
      companyId: bradford.id,
      emailVerified: new Date(),
    },
  });

  // Create customer users
  const jjsaUser = await prisma.user.upsert({
    where: { email: 'orders@jjsa.com' },
    update: {},
    create: {
      email: 'orders@jjsa.com',
      name: 'JJSA Orders',
      role: Role.CUSTOMER,
      companyId: jjsa.id,
      emailVerified: new Date(),
    },
  });

  const ballantineUser = await prisma.user.upsert({
    where: { email: 'orders@ballantine.com' },
    update: {},
    create: {
      email: 'orders@ballantine.com',
      name: 'Ballantine Orders',
      role: Role.CUSTOMER,
      companyId: ballantine.id,
      emailVerified: new Date(),
    },
  });

  console.log('✅ Users created');

  // Create contacts
  await prisma.contact.upsert({
    where: { id: 'contact-jjsa-1' },
    update: {},
    create: {
      id: 'contact-jjsa-1',
      companyId: jjsa.id,
      name: 'JJSA Primary Contact',
      email: 'contact@jjsa.com',
      phone: '555-0401',
      isPrimary: true,
    },
  });

  await prisma.contact.upsert({
    where: { id: 'contact-ballantine-1' },
    update: {},
    create: {
      id: 'contact-ballantine-1',
      companyId: ballantine.id,
      name: 'Ballantine Primary Contact',
      email: 'contact@ballantine.com',
      phone: '555-0501',
      isPrimary: true,
    },
  });

  await prisma.contact.upsert({
    where: { id: 'contact-bradford-1' },
    update: {},
    create: {
      id: 'contact-bradford-1',
      companyId: bradford.id,
      name: 'Steve Gustafson',
      email: 'steve.gustafson@bgeltd.com',
      phone: '555-0201',
      isPrimary: true,
    },
  });

  console.log('✅ Contacts created');

  console.log('🎉 Seeding complete!');
  console.log('\n📧 User Accounts:');
  console.log('  Impact Direct Admin: admin@impactdirect.com');
  console.log('  Impact Direct Manager: manager@impactdirect.com');
  console.log('  Bradford Admin: steve.gustafson@bgeltd.com');
  console.log('  JJSA Customer: orders@jjsa.com');
  console.log('  Ballantine Customer: orders@ballantine.com');
  console.log('\n🏢 Companies:');
  console.log('  Customers: JJSA (code: JJSG), Ballantine (code: BALSG)');
  console.log('  Brokers: Impact Direct, Bradford');
  console.log('  Manufacturer: JD Graphic');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
