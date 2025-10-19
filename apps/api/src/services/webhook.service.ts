import { prisma, WebhookSource } from '@printing-workflow/db';
import { createPOFromWebhook, findPOByExternalRef } from './purchase-order.service.js';
import { getJobByJobNo } from './job.service.js';
import { COMPANY_IDS, CUSTOMER_CODE_TO_ID } from '@printing-workflow/shared';
import { parseBradfordPO } from './pdf-parser.service.js';
import type { FastifyRequest } from 'fastify';
import { logger, logSecurityEvent, logBusinessEvent, logError } from '../lib/logger.js';

/**
 * Validate email address from Bradford
 * Uses strict validation to prevent spoofing
 */
function isValidBradfordEmail(emailString: string): boolean {
  // Remove any extra whitespace
  const trimmed = emailString.trim().toLowerCase();

  // Extract email address from formats like:
  // "Steve Gustafson <steve.gustafson@bgeltd.com>"
  // "<steve.gustafson@bgeltd.com>"
  // "steve.gustafson@bgeltd.com"
  const emailMatch = trimmed.match(/<?([\w.+-]+@[\w.-]+\.[\w.-]+)>?$/);

  if (!emailMatch) {
    return false;
  }

  const extractedEmail = emailMatch[1];

  // Strictly validate it's exactly steve.gustafson@bgeltd.com
  return extractedEmail === 'steve.gustafson@bgeltd.com';
}

export async function logWebhookEvent(data: {
  source: WebhookSource;
  payload: any;
}) {
  return prisma.webhookEvent.create({
    data: {
      source: data.source,
      payload: data.payload,
      processed: false,
    },
  });
}

export async function markWebhookAsProcessed(id: string) {
  return prisma.webhookEvent.update({
    where: { id },
    data: { processed: true },
  });
}

/**
 * Process Bradford PO webhook
 * This creates a PO from Bradford to JD Graphic
 */
export async function processBradfordPOWebhook(payload: {
  componentId: string;
  estimateNumber: string;
  amount: number;
  pdfUrl?: string;
  jobNo?: string;
}) {
  // Log webhook event
  const webhookEvent = await logWebhookEvent({
    source: WebhookSource.BRADFORD,
    payload,
  });

  try {
    // Check if we already processed this PO
    const externalRef = `${payload.componentId}-${payload.estimateNumber}`;
    const existingPO = await findPOByExternalRef(externalRef);

    if (existingPO) {
      console.log(`PO already exists for ${externalRef}`);
      await markWebhookAsProcessed(webhookEvent.id);
      return existingPO;
    }

    // Try to find associated job
    let jobId: string | undefined;
    if (payload.jobNo) {
      const job = await getJobByJobNo(payload.jobNo);
      jobId = job?.id;
    }

    // Create PO from Bradford to JD Graphic
    const po = await createPOFromWebhook({
      componentId: payload.componentId,
      estimateNumber: payload.estimateNumber,
      amount: payload.amount,
      jobId,
      originCompanyId: COMPANY_IDS.BRADFORD,
      targetCompanyId: COMPANY_IDS.JD_GRAPHIC,
    });

    // Mark webhook as processed
    await markWebhookAsProcessed(webhookEvent.id);

    console.log(
      `Bradford PO processed: ${payload.componentId}-${payload.estimateNumber} → $${payload.amount}`
    );

    return po;
  } catch (error) {
    console.error('Failed to process Bradford webhook:', error);
    throw error;
  }
}

/**
 * Process inbound email from SendGrid Inbound Parse
 * Looks for Bradford PO emails from steve.gustafson@bgeltd.com
 * with subject containing JJSG or BALSG
 */
export async function processInboundEmail(data: {
  from: string;
  subject: string;
  text: string;
  request: FastifyRequest;
}) {
  const { from, subject, text, request } = data;

  // Log the inbound email
  logger.info({
    type: 'webhook_email_received',
    from,
    subject,
    textLength: text?.length || 0,
  }, 'Processing inbound email webhook');

  // Validate email is from Bradford using strict validation
  const isBradfordEmail = isValidBradfordEmail(from);

  if (!isBradfordEmail) {
    logSecurityEvent({
      type: 'webhook_signature_failed',
      details: { from, subject, reason: 'Invalid sender email' },
    });

    logger.warn({
      type: 'webhook_email_rejected',
      from,
      subject,
      reason: 'Not from Bradford email address',
    }, 'Email rejected: invalid sender');

    return {
      action: 'ignored',
      reason: 'Not from Bradford email address',
    };
  }

  // Check if subject contains customer code (JJSG or BALSG)
  const hasCustomerCode = /JJSG|BALSG/i.test(subject);

  if (!hasCustomerCode) {
    logger.info({
      type: 'webhook_email_ignored',
      from,
      subject,
      reason: 'No customer code in subject',
    }, 'Email ignored: no customer code');

    return {
      action: 'ignored',
      reason: 'No customer code in subject',
    };
  }

  logger.info({
    type: 'webhook_email_valid',
    from,
    subject,
  }, 'Bradford PO email detected');

  // Log webhook event
  const webhookEvent = await logWebhookEvent({
    source: WebhookSource.EMAIL,
    payload: {
      from,
      subject,
      text: text.substring(0, 500), // First 500 chars
    },
  });

  try {
    // Extract PDF attachments from multipart request
    // SendGrid Inbound Parse sends attachments as separate parts
    const attachments = [];

    // Read all multipart parts to find PDF attachments
    const parts = request.parts ? request.parts() : null;

    if (parts) {
      for await (const part of parts) {
        if (part.type === 'file' && part.mimetype === 'application/pdf') {
          const buffer = await part.toBuffer();
          attachments.push({
            filename: part.filename,
            buffer,
          });
          console.log('📎 Found PDF attachment:', part.filename);
        }
      }
    }

    if (attachments.length === 0) {
      logger.warn({
        type: 'webhook_email_no_attachments',
        from,
        subject,
      }, 'No PDF attachments found in email');

      return {
        action: 'ignored',
        reason: 'No PDF attachments found',
      };
    }

    // Parse the first PDF attachment
    const pdfBuffer = attachments[0].buffer;
    const pdfFilename = attachments[0].filename;

    logger.info({
      type: 'webhook_pdf_parsing',
      filename: pdfFilename,
      size: pdfBuffer.length,
    }, 'Parsing Bradford PO PDF');

    const parsed = await parseBradfordPO(pdfBuffer);

    // Validate parsed data
    if (!parsed.customerCode || !parsed.customerId) {
      throw new Error('PDF parsing failed: missing customer information');
    }

    if (!parsed.amount || parsed.amount <= 0) {
      throw new Error(`PDF parsing failed: invalid amount (${parsed.amount})`);
    }

    logger.info({
      type: 'webhook_pdf_parsed',
      customerCode: parsed.customerCode,
      customerId: parsed.customerId,
      amount: parsed.amount,
      poNumber: parsed.poNumber,
    }, 'PDF parsed successfully');

    // Find the associated job by customer code
    // Look for most recent job for this customer
    const recentJob = await prisma.job.findFirst({
      where: {
        customerId: parsed.customerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const jobId = recentJob?.id;

    // Create PO: Bradford → JD Graphic
    const externalRef = parsed.poNumber
      ? `Bradford-${parsed.customerCode}-${parsed.poNumber}`
      : `Bradford-${parsed.customerCode}-${Date.now()}`;

    // Check if PO already exists
    const existingPO = await findPOByExternalRef(externalRef);

    if (existingPO) {
      logger.info({
        type: 'webhook_po_duplicate',
        externalRef,
        poId: existingPO.id,
      }, 'PO already exists');

      await markWebhookAsProcessed(webhookEvent.id);

      return {
        action: 'duplicate',
        message: 'PO already exists',
        purchaseOrder: existingPO,
      };
    }

    // Create the PO and mark webhook as processed in a transaction
    const po = await prisma.$transaction(async (tx) => {
      // Create the PO
      const newPO = await createPOFromWebhook({
        componentId: parsed.customerCode,
        estimateNumber: parsed.poNumber || 'N/A',
        amount: parsed.amount,
        jobId,
        originCompanyId: COMPANY_IDS.BRADFORD,
        targetCompanyId: COMPANY_IDS.JD_GRAPHIC,
      });

      // Mark webhook as processed
      await tx.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true },
      });

      return newPO;
    });

    // Log business event
    logBusinessEvent({
      type: 'po_created',
      jobId,
      customerId: parsed.customerId,
      amount: parsed.amount,
      details: {
        source: 'email',
        from: 'Bradford',
        to: 'JD Graphic',
        externalRef,
      },
    });

    logger.info({
      type: 'webhook_po_created',
      externalRef,
      poId: po.id,
      jobId,
      amount: parsed.amount,
    }, 'Bradford PO created from email');

    return {
      action: 'created',
      message: 'PO created successfully from email',
      purchaseOrder: po,
      parsed,
    };
  } catch (error: any) {
    logError(error, {
      type: 'webhook_email_processing_failed',
      from,
      subject,
      webhookEventId: webhookEvent.id,
    });

    logger.error({
      type: 'webhook_email_error',
      from,
      subject,
      error: error.message,
      stack: error.stack,
    }, 'Error processing Bradford email');

    throw error;
  }
}

export async function listWebhookEvents(filters?: {
  source?: WebhookSource;
  processed?: boolean;
}) {
  return prisma.webhookEvent.findMany({
    where: {
      source: filters?.source,
      processed: filters?.processed,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 100,
  });
}
