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
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

export async function sendEmail(params: SendEmailParams) {
  const { to, subject, html, attachments } = params;

  // Redirect emails if EMAIL_REDIRECT_TO is set (for testing)
  const actualRecipient = env.EMAIL_REDIRECT_TO || to;
  const isRedirected = env.EMAIL_REDIRECT_TO && env.EMAIL_REDIRECT_TO !== to;

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

  try {
    // Add redirect notice to subject if redirecting
    const actualSubject = isRedirected
      ? `[For: ${to}] ${subject}`
      : subject;

    const msg: any = {
      to: actualRecipient,
      from: {
        email: env.EMAIL_FROM,
        name: env.EMAIL_FROM_NAME,
      },
      subject: actualSubject,
      html: isRedirected
        ? `<div style="background: #fff3cd; border: 2px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
             <strong>⚠️ EMAIL REDIRECT:</strong> This email was originally intended for <strong>${to}</strong>
           </div>${html}`
        : html,
    };

    if (attachments && attachments.length > 0) {
      msg.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: att.content.toString('base64'),
        type: 'application/pdf',
        disposition: 'attachment',
      }));
    }

    const result = await sgMail.send(msg);
    if (isRedirected) {
      console.log(`✅ Email sent to ${actualRecipient} (originally for ${to}): ${subject}`);
    } else {
      console.log(`✅ Email sent to ${actualRecipient}: ${subject}`);
    }
    return { id: result[0].headers['x-message-id'], message: 'Email sent successfully' };
  } catch (error: any) {
    console.error('SendGrid error:', error.response?.body || error);
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

  proofReady: (jobNo: string, proofId: string, version: number, customerEmail?: string) => ({
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
          <a href="${env.NEXTAUTH_URL}/proof/view/${proofId}" class="button">Review & Approve Proof</a>
        </center>

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
};
