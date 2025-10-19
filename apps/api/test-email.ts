import { sendEmail } from './src/lib/email.js';
import { env } from './src/env.js';

async function testEmail() {
  console.log('🧪 Testing SendGrid Email Configuration...\n');

  console.log('Configuration:');
  console.log(`  API Key: ${env.SENDGRID_API_KEY ? '✅ Set (starts with: ' + env.SENDGRID_API_KEY.substring(0, 10) + '...)' : '❌ Not set'}`);
  console.log(`  From Email: ${env.EMAIL_FROM}`);
  console.log(`  From Name: ${env.EMAIL_FROM_NAME}`);
  console.log(`  Redirect To: ${env.EMAIL_REDIRECT_TO || '(none - will send to actual recipients)'}`);
  console.log('');

  if (!env.SENDGRID_API_KEY) {
    console.log('⚠️  SENDGRID_API_KEY is not set. Email will be logged to console only.');
    console.log('   Set SENDGRID_API_KEY in .env file to enable actual email delivery.\n');
  }

  try {
    console.log('📧 Sending test email...\n');

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test Email from IDP Production',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from your printing workflow application.</p>
        <p>If you're seeing this, your email configuration is working!</p>
        <ul>
          <li><strong>From:</strong> ${env.EMAIL_FROM_NAME} &lt;${env.EMAIL_FROM}&gt;</li>
          <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
        </ul>
      `,
    });

    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${result.id}`);
    console.log(`   Message: ${result.message}\n`);

    if (env.EMAIL_REDIRECT_TO) {
      console.log(`📬 Email was redirected to: ${env.EMAIL_REDIRECT_TO}`);
      console.log('   Check your inbox at this address.\n');
    }

  } catch (error: any) {
    console.error('❌ Email failed to send!\n');

    if (error.response) {
      console.error('SendGrid Error Response:');
      console.error('  Status:', error.response.statusCode);
      console.error('  Body:', JSON.stringify(error.response.body, null, 2));

      if (error.response.statusCode === 401) {
        console.error('\n⚠️  Authentication failed. Your SendGrid API key may be invalid or expired.');
        console.error('   Please verify your API key at: https://app.sendgrid.com/settings/api_keys');
      } else if (error.response.statusCode === 403) {
        console.error('\n⚠️  Permission denied. Your sender email may not be verified.');
        console.error('   Please verify your sender at: https://app.sendgrid.com/settings/sender_auth');
      }
    } else {
      console.error('Error:', error.message);
    }

    console.error('\n');
    process.exit(1);
  }
}

testEmail();
