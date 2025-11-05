import sgMail from '@sendgrid/mail';
import { env } from '../env.js';

// Initialize SendGrid
if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  cc?: string; // Optional CC field
  fromName?: string; // Optional custom sender name (defaults to EMAIL_FROM_NAME)
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

export async function sendEmail(params: SendEmailParams) {
  console.log('\n========================================');
  console.log('📧 [EMAIL SERVICE] sendEmail() called');
  console.log('========================================');

  const { to, subject, html, cc, fromName, attachments } = params;

  console.log(`[EMAIL] To: ${to}`);
  console.log(`[EMAIL] CC: ${cc || 'none'}`);
  console.log(`[EMAIL] Subject: ${subject}`);

  // Log attachment details
  if (attachments && attachments.length > 0) {
    console.log(`[EMAIL] Attachments: ${attachments.length}`);
    attachments.forEach((att, index) => {
      const sizeKB = (att.content.length / 1024).toFixed(2);
      console.log(`[EMAIL]   ${index + 1}. ${att.filename} (${sizeKB} KB)`);
    });
  } else {
    console.log(`[EMAIL] Attachments: 0`);
  }

  console.log(`[EMAIL] EMAIL_REDIRECT_TO: ${env.EMAIL_REDIRECT_TO || 'NOT SET'}`);
  console.log(`[EMAIL] SENDGRID_API_KEY present: ${env.SENDGRID_API_KEY ? 'YES' : 'NO'}`);

  // Redirect emails if EMAIL_REDIRECT_TO is set (for testing)
  const actualRecipient = env.EMAIL_REDIRECT_TO || to;
  const isRedirected = env.EMAIL_REDIRECT_TO && env.EMAIL_REDIRECT_TO !== to;

  if (isRedirected) {
    console.log(`[EMAIL] ⚠️  REDIRECT: Sending to ${actualRecipient} instead of ${to}`);
  }

  // If no SendGrid API key, just log to console (development mode)
  if (!env.SENDGRID_API_KEY) {
    console.log('\n📧 [EMAIL] (Development Mode - Not Sent)');
    console.log(`To: ${actualRecipient}${isRedirected ? ` (originally: ${to})` : ''}`);
    console.log(`From: ${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${html.substring(0, 300)}...`);
    if (attachments) {
      console.log(`Attachments: ${attachments.map(a => a.filename).join(', ')}`);
    }
    console.log('─────────────────────────────────────\n');
    return { id: 'dev-mode-email', message: 'Email logged to console (dev mode)' };
  }

  console.log('[EMAIL] SendGrid API key found, proceeding to send email...');

  try {
    // Add redirect notice to subject if redirecting
    const actualSubject = isRedirected
      ? `[For: ${to}] ${subject}`
      : subject;

    // Convert comma-separated recipients to array for SendGrid
    const recipients = actualRecipient.includes(',')
      ? actualRecipient.split(',').map((r: string) => r.trim())
      : actualRecipient;

    const msg: any = {
      to: recipients,
      from: {
        email: env.EMAIL_FROM,
        name: fromName || env.EMAIL_FROM_NAME, // Use custom name if provided
      },
      subject: actualSubject,
      html: isRedirected
        ? `<div style="background: #fff3cd; border: 2px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
             <strong>⚠️ EMAIL REDIRECT:</strong> This email was originally intended for <strong>${to}</strong>
           </div>${html}`
        : html,
    };

    // Add CC if provided (and not redirecting)
    if (cc && !isRedirected) {
      msg.cc = cc;
    }

    if (attachments && attachments.length > 0) {
      msg.attachments = attachments.map((att) => {
        // Detect MIME type based on file extension
        let mimeType = 'application/octet-stream';
        if (att.filename.endsWith('.pdf')) {
          mimeType = 'application/pdf';
        } else if (att.filename.endsWith('.xlsx')) {
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (att.filename.endsWith('.xls')) {
          mimeType = 'application/vnd.ms-excel';
        } else if (att.filename.endsWith('.csv')) {
          mimeType = 'text/csv';
        }

        return {
          filename: att.filename,
          content: att.content.toString('base64'),
          type: mimeType,
          disposition: 'attachment',
        };
      });
    }

    // Log what we're about to send
    console.log('[EMAIL] Preparing to send via SendGrid...');
    console.log(`[EMAIL] Final recipients: ${msg.to}`);
    if (msg.cc) {
      console.log(`[EMAIL] Final CC: ${msg.cc}`);
    }
    if (msg.attachments && msg.attachments.length > 0) {
      msg.attachments.forEach((att: any, index: number) => {
        console.log(`[EMAIL] Attachment ${index + 1}: ${att.filename} (MIME: ${att.type})`);
      });
    }

    console.log('[EMAIL] Calling SendGrid API...');
    const result = await sgMail.send(msg);
    console.log('[EMAIL] ✅ SendGrid API call successful!');
    console.log(`[EMAIL] Response status: ${result[0].statusCode}`);
    console.log(`[EMAIL] Message ID: ${result[0].headers['x-message-id']}`);

    // Check if response indicates sandbox mode
    if (result[0].statusCode === 202) {
      console.log('[EMAIL] ⚠️  Status 202 (Accepted) - Email queued by SendGrid');
      console.log('[EMAIL] ⚠️  If emails are not arriving, check:');
      console.log('[EMAIL]     1. SendGrid Sandbox Mode is OFF (Settings → Mail Settings)');
      console.log('[EMAIL]     2. Sender email is verified (Settings → Sender Authentication)');
      console.log('[EMAIL]     3. Activity Feed for delivery status (Activity → Activity Feed)');
    }

    if (isRedirected) {
      console.log(`✅ [EMAIL] Email sent to ${actualRecipient} (originally for ${to})`);
    } else {
      console.log(`✅ [EMAIL] Email sent to ${actualRecipient}`);
    }
    console.log('========================================\n');
    return { id: result[0].headers['x-message-id'], message: 'Email sent successfully' };
  } catch (error: any) {
    console.error('\n❌ [EMAIL] SendGrid error:', error.response?.body || error);
    console.error('[EMAIL] Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.response?.statusCode,
    });
    console.log('========================================\n');
    throw error;
  }
}

// Professional email template wrapper
function emailTemplate(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IDP Production</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f4f4;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 600;
    }
    .header p {
      margin: 5px 0 0;
      color: #e0e7ff;
      font-size: 14px;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      margin: 0 0 20px;
      color: #1a1a1a;
      font-size: 24px;
      font-weight: 600;
    }
    .content p {
      margin: 0 0 15px;
      color: #4a5568;
      font-size: 16px;
    }
    .info-box {
      background-color: #f7fafc;
      border-left: 4px solid #667eea;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box strong {
      color: #2d3748;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      margin: 20px 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);
    }
    .button:hover {
      box-shadow: 0 6px 8px rgba(102, 126, 234, 0.4);
    }
    .footer {
      background-color: #2d3748;
      padding: 30px;
      text-align: center;
      color: #a0aec0;
      font-size: 14px;
    }
    .footer p {
      margin: 5px 0;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .divider {
      height: 1px;
      background-color: #e2e8f0;
      margin: 25px 0;
    }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <div class="email-container">
          <div class="header">
            <h1>IDP Production</h1>
            <p>Professional Printing Services</p>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p><strong>IDP Production</strong></p>
            <p>nick@jdgraphic.com</p>
            <p style="margin-top: 15px; color: #718096;">This email was sent automatically. Please do not reply.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Email templates
export const emailTemplates = {
  quoteReady: (quoteName: string, quoteId: string) => ({
    subject: '📋 Your Quote is Ready for Review',
    html: emailTemplate(
      `
        <h2>Your Quote is Ready</h2>
        <p>Great news! We've prepared your quote for <strong>${quoteName}</strong>.</p>

        <div class="info-box">
          <p><strong>Quote ID:</strong> ${quoteId}</p>
          <p style="margin: 10px 0 0;">Review the details and pricing at your convenience.</p>
        </div>

        <center>
          <a href="${env.NEXTAUTH_URL}/quotes/${quoteId}" class="button">View Quote Details</a>
        </center>

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          Have questions? Feel free to reach out to our team at any time.
        </p>
      `,
      'Your quote is ready for review'
    ),
  }),

  proofReady: (jobNo: string, proofId: string, version: number, shareToken?: string, customerEmail?: string) => ({
    subject: `🎨 Proof Ready for Review - Job ${jobNo}`,
    html: emailTemplate(
      `
        <h2>Your Proof is Ready</h2>
        <p>We've prepared proof <strong>version ${version}</strong> for your review.</p>

        <div class="info-box">
          <p><strong>Job Number:</strong> ${jobNo}</p>
          <p><strong>Proof Version:</strong> ${version}</p>
          <p style="margin: 10px 0 0;">Please review carefully and provide your approval or requested changes.</p>
        </div>

        <center>
          <a href="${shareToken ? `${env.NEXTAUTH_URL}/proof/share/${shareToken}` : `${env.NEXTAUTH_URL}/proof/view/${proofId}`}" class="button">Review & Approve Proof</a>
        </center>

        ${shareToken ? `
        <p style="text-align: center; color: #718096; font-size: 14px; margin-top: 16px;">
          <strong>Direct Link:</strong><br>
          <a href="${env.NEXTAUTH_URL}/proof/share/${shareToken}" style="color: #3182CE; word-break: break-all;">
            ${env.NEXTAUTH_URL}/proof/share/${shareToken}
          </a><br>
          <span style="color: #E53E3E; font-size: 12px;">⏰ This link expires in 7 days</span>
        </p>
        ` : ''}

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          <strong>Important:</strong> Production will begin once you approve this proof. Please ensure all details are correct.
        </p>
      `,
      `Proof version ${version} ready for job ${jobNo}`
    ),
  }),

  proofApproved: (jobNo: string, version: number) => ({
    subject: `✅ Proof Approved - Job ${jobNo}`,
    html: emailTemplate(
      `
        <h2>Proof Approved - Production Starting</h2>
        <p>Thank you for approving proof version ${version} for job ${jobNo}.</p>

        <div class="info-box">
          <p><strong>Job Number:</strong> ${jobNo}</p>
          <p><strong>Approved Version:</strong> ${version}</p>
          <p style="margin: 10px 0 0;">✅ Your job has been moved to production and will be completed soon.</p>
        </div>

        <p style="margin-top: 25px;">We'll notify you when your order is ready for shipment.</p>

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          Thank you for choosing IDP Production for your printing needs!
        </p>
      `,
      `Proof approved - production starting for job ${jobNo}`
    ),
  }),

  shipmentScheduled: (jobNo: string, carrier: string, trackingNo?: string) => ({
    subject: `📦 Your Order is On the Way - Job ${jobNo}`,
    html: emailTemplate(
      `
        <h2>Order Shipped!</h2>
        <p>Great news! Your order has been shipped and is on its way to you.</p>

        <div class="info-box">
          <p><strong>Job Number:</strong> ${jobNo}</p>
          <p><strong>Carrier:</strong> ${carrier}</p>
          ${trackingNo ? `<p><strong>Tracking Number:</strong> ${trackingNo}</p>` : ''}
        </div>

        ${trackingNo ? `
          <center>
            <a href="https://www.google.com/search?q=${encodeURIComponent(carrier + ' tracking ' + trackingNo)}" class="button">Track Shipment</a>
          </center>
        ` : ''}

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          You'll receive your order soon. Thank you for your business!
        </p>
      `,
      `Your order ${jobNo} has shipped`
    ),
  }),

  invoiceSent: (invoiceNo: string, jobNo: string, amount: number) => ({
    subject: `💰 Invoice ${invoiceNo} - Job ${jobNo}`,
    html: emailTemplate(
      `
        <h2>Invoice Attached</h2>
        <p>Please find your invoice attached to this email.</p>

        <div class="info-box">
          <p><strong>Invoice Number:</strong> ${invoiceNo}</p>
          <p><strong>Job Number:</strong> ${jobNo}</p>
          <p><strong>Amount Due:</strong> $${amount.toFixed(2)}</p>
        </div>

        <p style="margin-top: 25px;">
          Payment is due within 30 days of the invoice date. If you have any questions about this invoice, please don't hesitate to contact us.
        </p>

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          Thank you for your continued business!
        </p>
      `,
      `Invoice ${invoiceNo} for $${amount.toFixed(2)}`
    ),
  }),

  // New: Job Created notification
  jobCreated: (jobNo: string, customerName: string, total: number) => ({
    subject: `🎯 New Job Created - ${jobNo}`,
    html: emailTemplate(
      `
        <h2>New Job Confirmation</h2>
        <p>Your job has been successfully created and is now in our system.</p>

        <div class="info-box">
          <p><strong>Job Number:</strong> ${jobNo}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Order Total:</strong> $${total.toFixed(2)}</p>
        </div>

        <center>
          <a href="${env.NEXTAUTH_URL}/jobs" class="button">View Job Details</a>
        </center>

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          We'll keep you updated as your job progresses through production.
        </p>
      `,
      `New job ${jobNo} created successfully`
    ),
  }),

  // New: Bradford PO Created notification
  bradfordPOCreated: (jobNo: string, amount: number) => ({
    subject: `📄 Purchase Order Created - Job ${jobNo}`,
    html: emailTemplate(
      `
        <h2>Purchase Order Created</h2>
        <p>A purchase order has been automatically generated for this job.</p>

        <div class="info-box">
          <p><strong>Job Number:</strong> ${jobNo}</p>
          <p><strong>PO Amount:</strong> $${amount.toFixed(2)}</p>
          <p style="margin: 10px 0 0;">This PO has been sent to your vendor for processing.</p>
        </div>

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          You can track the status of this purchase order in your dashboard.
        </p>
      `,
      `PO created for job ${jobNo}`
    ),
  }),

  // Bradford PO to JD Graphic
  bradfordPOToJD: (componentId: string, jobNo: string, poNumber: string, vendorAmount: number) => ({
    subject: `📋 New Purchase Order - ${componentId}`,
    html: emailTemplate(
      `
        <h2>New Purchase Order Received</h2>
        <p>Bradford has issued a new purchase order for production.</p>

        <div class="info-box">
          <p><strong>PO Number:</strong> ${poNumber}</p>
          <p><strong>Component ID:</strong> ${componentId}</p>
          <p><strong>Job Number:</strong> ${jobNo}</p>
          <p><strong>PO Amount:</strong> $${vendorAmount.toFixed(2)}</p>
        </div>

        <p style="margin-top: 25px;">
          The Bradford Print Order Form is attached to this email with complete job specifications.
        </p>

        <center>
          <a href="${env.NEXTAUTH_URL}/jobs/${jobNo}" class="button">View Job Details</a>
        </center>

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          <strong>Ship To:</strong> FOB JD Graphic<br>
          Please review the attached print order form for complete specifications.
        </p>
      `,
      `New PO ${poNumber} for ${componentId}`
    ),
  }),

  // Job Ready for Production (Internal Team)
  jobReadyForProduction: (jobNo: string, customerName: string, artworkCount: number, dataFileCount: number, customerPO?: string) => ({
    subject: `🚀 Job Ready for Production - ${jobNo}`,
    html: emailTemplate(
      `
        <h2>Job Ready to Start Production</h2>
        <p>All required files have been uploaded and the job is ready to begin production.</p>

        <div class="info-box">
          <p><strong>Job Number:</strong> ${jobNo}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          ${customerPO ? `<p><strong>Customer PO:</strong> ${customerPO}</p>` : ''}
          <p><strong>Artwork Files:</strong> ${artworkCount} uploaded ✅</p>
          <p><strong>Data Files:</strong> ${dataFileCount} uploaded ✅</p>
        </div>

        <center>
          <a href="${env.NEXTAUTH_URL}/jobs/${jobNo}" class="button">View Job & Start Production</a>
        </center>

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          <strong>Next Steps:</strong> Review all files and specifications before starting production.
        </p>
      `,
      `Job ${jobNo} ready for production`
    ),
  }),

  // Job Submitted Confirmation (Customer)
  jobSubmittedConfirmation: (jobNo: string, customerName: string, artworkCount: number, dataFileCount: number, deliveryDate?: string) => ({
    subject: `✅ Job ${jobNo} Submitted Successfully`,
    html: emailTemplate(
      `
        <h2>Thank You - Your Job Has Been Submitted!</h2>
        <p>We've received all your files and your job is now queued for production.</p>

        <div class="info-box">
          <p><strong>Job Number:</strong> ${jobNo}</p>
          <p><strong>Status:</strong> Ready for Production ✅</p>
          <p><strong>Artwork Files Received:</strong> ${artworkCount}</p>
          <p><strong>Data Files Received:</strong> ${dataFileCount}</p>
          ${deliveryDate ? `<p><strong>Estimated Delivery:</strong> ${deliveryDate}</p>` : ''}
        </div>

        <p style="margin-top: 25px;">
          Our production team will review your files and begin work on your order. We'll send you a proof for approval before finalizing production.
        </p>

        <center>
          <a href="${env.NEXTAUTH_URL}/jobs/${jobNo}" class="button">Track Your Order</a>
        </center>

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          <strong>What's Next?</strong> You'll receive a proof for approval within 1-2 business days. Production will begin immediately after your approval.
        </p>
      `,
      `Job ${jobNo} submitted and ready for production`
    ),
  }),

  // Invoice Chain - Job Completed
  invoiceChainGenerated: (invoiceNo: string, jobNo: string, amount: number, fromCompany: string, toCompany: string, customerPONumber?: string) => ({
    subject: `💰 Invoice ${invoiceNo} - Job ${jobNo}`,
    html: emailTemplate(
      `
        <h2>Invoice for Job ${jobNo}</h2>
        <p>Please find the attached invoice for the completed job.</p>

        <div class="info-box">
          <p><strong>Invoice Number:</strong> ${invoiceNo}</p>
          <p><strong>Job Number:</strong> ${jobNo}</p>
          ${customerPONumber ? `<p><strong>Customer PO:</strong> ${customerPONumber}</p>` : ''}
          <p><strong>From:</strong> ${fromCompany}</p>
          <p><strong>To:</strong> ${toCompany}</p>
          <p><strong>Amount Due:</strong> $${amount.toFixed(2)}</p>
        </div>

        <p style="margin-top: 25px;">
          The invoice is attached as a PDF. Payment is due within 30 days of the invoice date.
        </p>

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          If you have any questions about this invoice, please contact us. Thank you for your business!
        </p>
      `,
      `Invoice ${invoiceNo} for $${amount.toFixed(2)}`
    ),
  }),

  // Payment Batch Confirmed with Transfer
  paymentBatchConfirmed: (data: {
    customerInvoices: Array<{ invoiceNo: string; jobNo: string; customer: string; amount: number }>;
    bradfordInvoices: Array<{ invoiceNo: string; jobNo: string; amount: number }>;
    totalReceived: number;
    totalOwedToBradford: number;
    netProfit: number;
    transferNumber: string;
  }) => ({
    subject: `💸 Payment Batch Confirmed - Transfer ${data.transferNumber}`,
    html: emailTemplate(
      `
        <h2>Payment Batch Processed</h2>
        <p>Impact Direct has processed a batch payment and initiated a wire transfer to Bradford.</p>

        <div class="info-box">
          <p><strong>Wire/ACH Transfer Number:</strong> ${data.transferNumber}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Invoices Paid:</strong> ${data.customerInvoices.length}</p>
        </div>

        <h3 style="margin-top: 30px; color: #1a1a1a; font-size: 20px;">Customer Payments Received</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
          <thead>
            <tr style="background-color: #f7fafc; border-bottom: 2px solid #e2e8f0;">
              <th style="padding: 10px; text-align: left;">Invoice</th>
              <th style="padding: 10px; text-align: left;">Job</th>
              <th style="padding: 10px; text-align: left;">Customer</th>
              <th style="padding: 10px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.customerInvoices.map(inv => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; color: #3182CE; font-weight: 600;">${inv.invoiceNo}</td>
                <td style="padding: 10px; color: #4a5568;">${inv.jobNo}</td>
                <td style="padding: 10px; color: #4a5568;">${inv.customer}</td>
                <td style="padding: 10px; text-align: right; font-weight: 600;">$${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
            <tr style="background-color: #f0fff4; border-top: 2px solid #48bb78;">
              <td colspan="3" style="padding: 12px; font-weight: bold; color: #1a1a1a;">Total Received:</td>
              <td style="padding: 12px; text-align: right; font-weight: bold; color: #48bb78; font-size: 16px;">$${data.totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <h3 style="margin-top: 30px; color: #1a1a1a; font-size: 20px;">Bradford Invoices Being Paid</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
          <thead>
            <tr style="background-color: #fff5f5; border-bottom: 2px solid #feb2b2;">
              <th style="padding: 10px; text-align: left;">Invoice</th>
              <th style="padding: 10px; text-align: left;">Job</th>
              <th style="padding: 10px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${data.bradfordInvoices.map(inv => `
              <tr style="border-bottom: 1px solid #feb2b2;">
                <td style="padding: 10px; color: #3182CE; font-weight: 600;">${inv.invoiceNo}</td>
                <td style="padding: 10px; color: #4a5568;">${inv.jobNo}</td>
                <td style="padding: 10px; text-align: right; font-weight: 600;">$${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
            <tr style="background-color: #fff5f5; border-top: 2px solid #f56565;">
              <td colspan="2" style="padding: 12px; font-weight: bold; color: #1a1a1a;">Total to Bradford:</td>
              <td style="padding: 12px; text-align: right; font-weight: bold; color: #f56565; font-size: 16px;">$${data.totalOwedToBradford.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div class="info-box" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; margin-top: 30px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 18px; font-weight: bold; color: #ffffff;">Net Profit:</span>
            <span style="font-size: 24px; font-weight: bold; color: #ffffff;">$${data.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 14px;">
            Profit margin after Bradford costs
          </p>
        </div>

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          <strong>Wire Transfer:</strong> Transfer ${data.transferNumber} has been initiated for $${data.totalOwedToBradford.toLocaleString('en-US', { minimumFractionDigits: 2 })} to Bradford.
        </p>
      `,
      `Payment batch processed - Transfer ${data.transferNumber}`
    ),
  }),

  // Comprehensive job creation confirmation with all PO details
  jobCreatedWithDetails: (data: {
    jobNo: string;
    customerName: string;
    description?: string;
    quantity?: number;
    total?: number;
    orderDate?: string;
    pickupDate?: string;
    poolDate?: string;
    deliveryDate?: string;
    paper?: string;
    flatSize?: string;
    foldedSize?: string;
    colors?: string;
    finishing?: string;
    sampleRecipients?: Array<{
      quantity: number;
      recipientName: string;
      address: string;
      city?: string;
      state?: string;
      zip?: string;
    }>;
    notes?: string;
  }) => ({
    subject: `New Order Created - Job #${data.jobNo}`,
    html: emailTemplate(
      `
        <h2>New Order Confirmation</h2>
        <p>A new order has been successfully created and is now in the IDP Production system.</p>

        <div class="info-box">
          <p><strong>Job Number:</strong> ${data.jobNo}</p>
          <p><strong>Customer:</strong> ${data.customerName}</p>
          ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
          ${data.quantity ? `<p><strong>Quantity:</strong> ${data.quantity.toLocaleString()} pieces</p>` : ''}
          ${data.total ? `<p><strong>Order Total:</strong> $${data.total.toFixed(2)}</p>` : ''}
        </div>

        ${data.orderDate || data.pickupDate || data.poolDate || data.deliveryDate ? `
          <h3 style="margin-top: 25px; color: #1a1a1a; font-size: 18px;">Delivery Schedule</h3>
          <div class="info-box" style="background-color: #f0f9ff;">
            ${data.orderDate ? `<p><strong>Order Date:</strong> ${new Date(data.orderDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>` : ''}
            ${data.pickupDate ? `<p><strong>Pickup Date:</strong> ${new Date(data.pickupDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>` : ''}
            ${data.poolDate ? `<p><strong>Pool Date:</strong> ${new Date(data.poolDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>` : ''}
            ${data.deliveryDate ? `<p><strong>Delivery Date:</strong> ${new Date(data.deliveryDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>` : ''}
          </div>
        ` : ''}

        ${data.paper || data.flatSize || data.foldedSize || data.colors || data.finishing ? `
          <h3 style="margin-top: 25px; color: #1a1a1a; font-size: 18px;">Specifications</h3>
          <div class="info-box">
            ${data.paper ? `<p><strong>Paper:</strong> ${data.paper}</p>` : ''}
            ${data.flatSize ? `<p><strong>Flat Size:</strong> ${data.flatSize}</p>` : ''}
            ${data.foldedSize ? `<p><strong>Folded Size:</strong> ${data.foldedSize}</p>` : ''}
            ${data.colors ? `<p><strong>Colors:</strong> ${data.colors}</p>` : ''}
            ${data.finishing ? `<p><strong>Finishing:</strong> ${data.finishing}</p>` : ''}
          </div>
        ` : ''}

        ${data.sampleRecipients && data.sampleRecipients.length > 0 ? `
          <h3 style="margin-top: 25px; color: #1a1a1a; font-size: 18px;">Sample Distribution</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
            <thead>
              <tr style="background-color: #f7fafc; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 10px; text-align: left;">Quantity</th>
                <th style="padding: 10px; text-align: left;">Recipient</th>
                <th style="padding: 10px; text-align: left;">Address</th>
              </tr>
            </thead>
            <tbody>
              ${data.sampleRecipients.map(recipient => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px; font-weight: 600;">${recipient.quantity}</td>
                  <td style="padding: 10px;">${recipient.recipientName}</td>
                  <td style="padding: 10px; color: #4a5568; font-size: 13px;">
                    ${recipient.address}${recipient.city ? `, ${recipient.city}` : ''}${recipient.state ? `, ${recipient.state}` : ''}${recipient.zip ? ` ${recipient.zip}` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        ${data.notes ? `
          <h3 style="margin-top: 25px; color: #1a1a1a; font-size: 18px;">Special Notes & Instructions</h3>
          <div class="info-box" style="background-color: #fffbeb; border-left: 4px solid #f59e0b;">
            <p style="white-space: pre-wrap; margin: 0; color: #92400e;">${data.notes}</p>
          </div>
        ` : ''}

        <center style="margin-top: 30px;">
          <a href="${env.NEXTAUTH_URL}/jobs/${data.jobNo}" class="button">View Job Details</a>
        </center>

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          We'll keep you updated as your job progresses through production.
        </p>
      `,
      `New order ${data.jobNo} created successfully`
    ),
  }),

  // File uploaded notification (sent immediately on each file upload)
  fileUploaded: (data: {
    jobNo: string;
    customerName: string;
    fileName: string;
    fileType: 'ARTWORK' | 'DATA_FILE';
    uploadedArtwork: number;
    requiredArtwork: number;
    uploadedDataFiles: number;
    requiredDataFiles: number;
  }) => ({
    subject: `File Uploaded - Job #${data.jobNo}`,
    html: emailTemplate(
      `
        <h2>New File Uploaded</h2>
        <p>A customer has uploaded a file for their order.</p>

        <div class="info-box">
          <p><strong>Job Number:</strong> ${data.jobNo}</p>
          <p><strong>Customer:</strong> ${data.customerName}</p>
          <p><strong>File Name:</strong> ${data.fileName}</p>
          <p><strong>File Type:</strong> ${data.fileType === 'ARTWORK' ? 'Artwork' : 'Data File'}</p>
        </div>

        <h3 style="margin-top: 25px; color: #1a1a1a; font-size: 18px;">Upload Progress</h3>
        <div class="info-box" style="background-color: ${data.uploadedArtwork >= data.requiredArtwork && data.uploadedDataFiles >= data.requiredDataFiles ? '#f0fdf4' : '#f0f9ff'};">
          <p><strong>Artwork Files:</strong> ${data.uploadedArtwork} of ${data.requiredArtwork} uploaded ${data.uploadedArtwork >= data.requiredArtwork ? '✓' : ''}</p>
          ${data.requiredDataFiles > 0 ? `<p><strong>Data Files:</strong> ${data.uploadedDataFiles} of ${data.requiredDataFiles} uploaded ${data.uploadedDataFiles >= data.requiredDataFiles ? '✓' : ''}</p>` : ''}

          ${data.uploadedArtwork >= data.requiredArtwork && data.uploadedDataFiles >= data.requiredDataFiles
            ? `<p style="color: #16a34a; font-weight: 600; margin-top: 10px;">✓ All files received! Job is ready for production.</p>`
            : `<p style="color: #2563eb; margin-top: 10px;">⏳ Waiting for ${data.requiredArtwork - data.uploadedArtwork > 0 ? `${data.requiredArtwork - data.uploadedArtwork} more artwork file(s)` : ''}${data.requiredArtwork - data.uploadedArtwork > 0 && data.requiredDataFiles - data.uploadedDataFiles > 0 ? ' and ' : ''}${data.requiredDataFiles - data.uploadedDataFiles > 0 ? `${data.requiredDataFiles - data.uploadedDataFiles} more data file(s)` : ''}</p>`
          }
        </div>

        <center style="margin-top: 30px;">
          <a href="${env.NEXTAUTH_URL}/jobs/${data.jobNo}" class="button">View Job Details</a>
        </center>

        <div class="divider"></div>

        <p style="color: #718096; font-size: 14px;">
          This is an automated notification sent when customers upload files to their orders.
        </p>
      `,
      `File uploaded for job ${data.jobNo}`
    ),
  }),
};
