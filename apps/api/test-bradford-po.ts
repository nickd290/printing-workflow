import { createPOFromWebhook } from './src/services/purchase-order.service.js';
import { prisma } from '@printing-workflow/db';
import { COMPANY_IDS } from '@printing-workflow/shared';
import { env } from './src/env.js';

async function testBradfordPO() {
  console.log('🧪 Testing Bradford PO Generation...\n');
  console.log('Configuration:');
  console.log(`  Email Redirect: ${env.EMAIL_REDIRECT_TO || '(none)'}\n`);

  try {
    // Find or create a test job
    let job = await prisma.job.findFirst({
      where: {
        jobNo: { startsWith: 'J-2025-' },
      },
      include: {
        customer: true,
        quote: true,
      },
    });

    if (!job) {
      // Create a test job if none exists
      console.log('📝 Creating test job...');

      const customer = await prisma.company.findFirst({
        where: { type: 'customer' },
      });

      if (!customer) {
        throw new Error('No customer company found. Run seed first.');
      }

      // Create quote
      const quote = await prisma.quote.create({
        data: {
          companyId: customer.id,
          name: 'Test Business Cards',
          quantity: 5000,
          size: '3.5" x 2"',
          paperType: '14pt Gloss Cover',
          colors: '4/4',
          customerTotal: 450.0,
          status: 'APPROVED',
        },
      });

      // Create job
      job = await prisma.job.create({
        data: {
          quoteId: quote.id,
          customerId: customer.id,
          jobNo: `J-2025-${String(Date.now()).slice(-6)}`,
          customerTotal: 450.0,
          status: 'PENDING_PROOF',
        },
        include: {
          customer: true,
          quote: true,
        },
      });

      console.log(`✅ Test job created: ${job.jobNo}\n`);
    } else {
      console.log(`✅ Using existing job: ${job.jobNo}\n`);
    }

    // Simulate Bradford webhook creating a PO
    console.log('📄 Creating Bradford PO for JD Graphic...');

    const componentId = `${job.customer?.name?.substring(0, 4).toUpperCase() || 'CUST'} - 2025-401034`;
    const estimateNumber = '1227439';

    const po = await createPOFromWebhook({
      componentId,
      estimateNumber,
      amount: parseFloat(job.customerTotal.toString()),
      jobId: job.id,
      originCompanyId: COMPANY_IDS.BRADFORD,
      targetCompanyId: COMPANY_IDS.JD_GRAPHIC,
    });

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Bradford PO Created Successfully!');
    console.log(`   PO ID: ${po.id}`);
    console.log(`   Component ID: ${componentId}`);
    console.log(`   PO Number: ${estimateNumber}`);
    console.log(`   Amount: $${po.vendorAmount.toString()}`);
    console.log(`   Job: ${job.jobNo}`);

    if (env.EMAIL_REDIRECT_TO) {
      console.log(`\n📬 Email sent to: ${env.EMAIL_REDIRECT_TO}`);
      console.log('   Check Steve\'s inbox for:');
      console.log('   - Email with Bradford Print Order Form attached');
      console.log('   - PDF attachment matching the BGE template\n');
    } else {
      console.log(`\n📬 Email sent to: JD Graphic production team\n`);
    }

    // Get notification to show what was sent
    const notification = await prisma.notification.findFirst({
      where: {
        jobId: job.id,
        type: 'PO_CREATED',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (notification) {
      console.log('📧 Email Details:');
      console.log(`   Subject: ${notification.subject}`);
      console.log(`   Recipient: ${notification.recipient}\n`);
    }
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testBradfordPO();
