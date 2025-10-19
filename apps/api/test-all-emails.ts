import { sendEmail, emailTemplates } from './src/lib/email.js';
import { env } from './src/env.js';

async function testAllEmails() {
  console.log('🧪 Testing All Email Templates...\n');
  console.log('Configuration:');
  console.log(`  Redirect To: ${env.EMAIL_REDIRECT_TO || '(none)'}`);
  console.log(`  From: ${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>\n`);

  if (!env.SENDGRID_API_KEY) {
    console.log('⚠️  SENDGRID_API_KEY not set. Emails will be logged to console only.\n');
  }

  const testEmails = [
    {
      name: '1. Quote Ready',
      recipient: 'orders@ballantine.com',
      template: emailTemplates.quoteReady('Business Cards - 5000pc', 'Q-2025-000123'),
    },
    {
      name: '2. Proof Ready',
      recipient: 'orders@jjsa.com',
      template: emailTemplates.proofReady('J-2025-000456', 'proof-123', 1, 'orders@jjsa.com'),
    },
    {
      name: '3. Proof Approved',
      recipient: 'orders@ballantine.com',
      template: emailTemplates.proofApproved('J-2025-000456', 1),
    },
    {
      name: '4. Shipment Scheduled',
      recipient: 'orders@jjsa.com',
      template: emailTemplates.shipmentScheduled('J-2025-000456', 'UPS Ground', '1Z999AA10123456784'),
    },
    {
      name: '5. Invoice Sent',
      recipient: 'orders@ballantine.com',
      template: emailTemplates.invoiceSent('INV-2025-00123', 'J-2025-000456', 2450.00),
    },
    {
      name: '6. Job Created',
      recipient: 'orders@jjsa.com',
      template: emailTemplates.jobCreated('J-2025-000789', 'JJSA', 3200.00),
    },
    {
      name: '7. Bradford PO Created',
      recipient: 'steve.gustafson@bgeltd.com',
      template: emailTemplates.bradfordPOCreated('J-2025-000456', 1960.00),
    },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const testEmail of testEmails) {
    try {
      console.log(`\n📧 Sending: ${testEmail.name}`);
      console.log(`   Original recipient: ${testEmail.recipient}`);

      const result = await sendEmail({
        to: testEmail.recipient,
        subject: testEmail.template.subject,
        html: testEmail.template.html,
      });

      console.log(`   ✅ Success - Message ID: ${result.id}`);
      successCount++;

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.log(`   ❌ Failed - ${error.message}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Test Summary:`);
  console.log(`   ✅ Successful: ${successCount}/${testEmails.length}`);
  console.log(`   ❌ Failed: ${failCount}/${testEmails.length}`);

  if (env.EMAIL_REDIRECT_TO) {
    console.log(`\n📬 All emails redirected to: ${env.EMAIL_REDIRECT_TO}`);
    console.log('   Check Steve\'s inbox for all 7 test emails!\n');
  }
}

testAllEmails().catch(console.error);
