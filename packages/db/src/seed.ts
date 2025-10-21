import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Default password for all demo users: "password123"
const DEFAULT_PASSWORD = 'password123';
const SALT_ROUNDS = 10;

async function main() {
  console.log('🌱 Seeding database...');

  // Hash the default password
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
  console.log('🔐 Default password hashed (use "password123" to login)');

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
      password: hashedPassword,
      name: 'Impact Direct Admin',
      role: Role.BROKER_ADMIN,
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
      password: hashedPassword,
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
      password: hashedPassword,
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
      password: hashedPassword,
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

  // Create sample jobs in different statuses
  const job1 = await prisma.job.upsert({
    where: { jobNo: 'J-2025-000001' },
    update: {},
    create: {
      jobNo: 'J-2025-000001',
      customerId: jjsa.id,
      customerPONumber: 'JJSA-PO-2025-001',
      status: 'PENDING',
      specs: {
        product: 'Business Cards',
        paper: '14pt Uncoated',
        colors: '4/4',
        finishing: 'Round Corners',
      },
      sizeName: '3.5 x 2',
      quantity: 5000,
      customerTotal: 450.00,
      impactMargin: 90.00,
      bradfordTotal: 360.00,
    },
  });

  const job2 = await prisma.job.upsert({
    where: { jobNo: 'J-2025-000002' },
    update: {},
    create: {
      jobNo: 'J-2025-000002',
      customerId: ballantine.id,
      customerPONumber: 'BALL-2025-042',
      status: 'IN_PRODUCTION',
      specs: {
        product: 'Flyers',
        paper: '100lb Gloss Text',
        colors: '4/4',
        finishing: 'None',
      },
      sizeName: '8.5 x 11',
      quantity: 10000,
      customerTotal: 850.00,
      impactMargin: 170.00,
      bradfordTotal: 680.00,
    },
  });

  const job3 = await prisma.job.upsert({
    where: { jobNo: 'J-2025-000003' },
    update: {},
    create: {
      jobNo: 'J-2025-000003',
      customerId: jjsa.id,
      customerPONumber: 'JJSA-PO-2025-002',
      status: 'READY_FOR_PROOF',
      specs: {
        product: 'Brochures',
        paper: '100lb Gloss Cover',
        colors: '4/4',
        finishing: 'Tri-Fold',
      },
      sizeName: '11 x 8.5',
      quantity: 2500,
      customerTotal: 1200.00,
      impactMargin: 240.00,
      bradfordTotal: 960.00,
    },
  });

  const job4 = await prisma.job.upsert({
    where: { jobNo: 'J-2025-000004' },
    update: {},
    create: {
      jobNo: 'J-2025-000004',
      customerId: ballantine.id,
      customerPONumber: 'BALL-2025-043',
      status: 'PROOF_APPROVED',
      specs: {
        product: 'Postcards',
        paper: '14pt Uncoated',
        colors: '4/4',
        finishing: 'UV Coating',
      },
      sizeName: '6 x 9',
      quantity: 15000,
      customerTotal: 1800.00,
      impactMargin: 360.00,
      bradfordTotal: 1440.00,
    },
  });

  const job5 = await prisma.job.upsert({
    where: { jobNo: 'J-2025-000005' },
    update: {},
    create: {
      jobNo: 'J-2025-000005',
      customerId: jjsa.id,
      customerPONumber: 'JJSA-PO-2025-003',
      status: 'COMPLETED',
      specs: {
        product: 'Letterhead',
        paper: '70lb Uncoated',
        colors: '4/0',
        finishing: 'None',
      },
      sizeName: '8.5 x 11',
      quantity: 1000,
      customerTotal: 380.00,
      impactMargin: 76.00,
      bradfordTotal: 304.00,
    },
  });

  console.log('✅ Jobs created');

  // Create sample files for proofs
  const proofFile1 = await prisma.file.upsert({
    where: { id: 'file-proof-1' },
    update: {},
    create: {
      id: 'file-proof-1',
      kind: 'PROOF',
      jobId: job3.id,
      objectKey: 'proofs/2025/proof-j-2025-000003-v1.pdf',
      fileName: 'brochure-proof-v1.pdf',
      mimeType: 'application/pdf',
      size: 2457600,
      checksum: 'abc123def456',
      uploadedBy: bradfordAdmin.id,
    },
  });

  const proofFile2 = await prisma.file.upsert({
    where: { id: 'file-proof-2' },
    update: {},
    create: {
      id: 'file-proof-2',
      kind: 'PROOF',
      jobId: job4.id,
      objectKey: 'proofs/2025/proof-j-2025-000004-v1.pdf',
      fileName: 'postcard-proof-v1.pdf',
      mimeType: 'application/pdf',
      size: 1843200,
      checksum: 'xyz789ghi012',
      uploadedBy: bradfordAdmin.id,
    },
  });

  console.log('✅ Files created');

  // Create proofs
  const proof1 = await prisma.proof.upsert({
    where: { id: 'proof-1' },
    update: {},
    create: {
      id: 'proof-1',
      jobId: job3.id,
      version: 1,
      status: 'PENDING',
      fileId: proofFile1.id,
      adminNotes: 'Initial proof ready for customer review',
    },
  });

  const proof2 = await prisma.proof.upsert({
    where: { id: 'proof-2' },
    update: {},
    create: {
      id: 'proof-2',
      jobId: job4.id,
      version: 1,
      status: 'APPROVED',
      fileId: proofFile2.id,
      adminNotes: 'Proof approved, ready for production',
    },
  });

  // Create proof approval for approved proof
  await prisma.proofApproval.upsert({
    where: { id: 'approval-1' },
    update: {},
    create: {
      id: 'approval-1',
      proofId: proof2.id,
      approved: true,
      comments: 'Looks perfect! Please proceed with production.',
      approvedBy: ballantineUser.id,
    },
  });

  console.log('✅ Proofs created');

  // Create purchase orders (Impact Direct → Bradford)
  await prisma.purchaseOrder.upsert({
    where: { id: 'po-1' },
    update: {},
    create: {
      id: 'po-1',
      originCompanyId: impactDirect.id,
      targetCompanyId: bradford.id,
      jobId: job3.id,
      originalAmount: 1200.00,
      vendorAmount: 960.00,
      marginAmount: 240.00,
      externalRef: 'BGE-2025-001',
      poNumber: 'IMP-JJSA-PO-2025-002',
      referencePONumber: 'JJSA-PO-2025-002',
      status: 'PENDING',
    },
  });

  await prisma.purchaseOrder.upsert({
    where: { id: 'po-2' },
    update: {},
    create: {
      id: 'po-2',
      originCompanyId: impactDirect.id,
      targetCompanyId: bradford.id,
      jobId: job4.id,
      originalAmount: 1800.00,
      vendorAmount: 1440.00,
      marginAmount: 360.00,
      externalRef: 'BGE-2025-002',
      poNumber: 'IMP-BALL-2025-043',
      referencePONumber: 'BALL-2025-043',
      status: 'ACCEPTED',
    },
  });

  // Create Bradford → JD purchase order for job4 (example of complete chain)
  await prisma.purchaseOrder.upsert({
    where: { id: 'po-3' },
    update: {},
    create: {
      id: 'po-3',
      originCompanyId: bradford.id,
      targetCompanyId: jdGraphic.id,
      jobId: job4.id,
      originalAmount: 1440.00,
      vendorAmount: 1200.00,
      marginAmount: 240.00,
      poNumber: 'BRA-2025-001',
      referencePONumber: 'BALL-2025-043',
      status: 'ACCEPTED',
    },
  });

  console.log('✅ Purchase Orders created');

  // Create invoice file
  const invoiceFile = await prisma.file.upsert({
    where: { id: 'file-invoice-1' },
    update: {},
    create: {
      id: 'file-invoice-1',
      kind: 'INVOICE',
      jobId: job4.id,
      objectKey: 'invoices/2025/invoice-INV-2025-0001.pdf',
      fileName: 'invoice-INV-2025-0001.pdf',
      mimeType: 'application/pdf',
      size: 245760,
      checksum: 'inv123abc456',
      uploadedBy: impactAdmin.id,
    },
  });

  // Create invoice
  await prisma.invoice.upsert({
    where: { invoiceNo: 'INV-2025-0001' },
    update: {},
    create: {
      invoiceNo: 'INV-2025-0001',
      jobId: job4.id,
      toCompanyId: ballantine.id,
      fromCompanyId: impactDirect.id,
      amount: 1800.00,
      status: 'SENT',
      pdfFileId: invoiceFile.id,
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  });

  console.log('✅ Invoices created');

  console.log('🎉 Seeding complete!');
  console.log('\n📧 User Accounts:');
  console.log('  Impact Direct Admin: admin@impactdirect.com');
  console.log('  Bradford Admin: steve.gustafson@bgeltd.com');
  console.log('  JJSA Customer: orders@jjsa.com');
  console.log('  Ballantine Customer: orders@ballantine.com');
  console.log('\n🏢 Companies:');
  console.log('  Customers: JJSA, Ballantine');
  console.log('  Brokers: Impact Direct, Bradford');
  console.log('  Manufacturer: JD Graphic');
  console.log('\n📋 Sample Data:');
  console.log('  Jobs: 5 (across different statuses)');
  console.log('  Proofs: 2 (1 pending, 1 approved)');
  console.log('  Purchase Orders: 2');
  console.log('  Invoices: 1 (sent)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
