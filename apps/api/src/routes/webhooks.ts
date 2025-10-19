import { FastifyPluginAsync } from 'fastify';
import { bradfordWebhookSchema } from '@printing-workflow/shared';
import {
  processBradfordPOWebhook,
  processInboundEmail,
  listWebhookEvents,
} from '../services/webhook.service.js';
import { WebhookSource } from '@printing-workflow/db';
import { logger, logSecurityEvent } from '../lib/logger.js';
import { env } from '../env.js';

// TypeScript interface for SendGrid Inbound Parse multipart fields
interface SendGridInboundFields {
  from?: { value: string };
  to?: { value: string };
  subject?: { value: string };
  text?: { value: string };
  html?: { value: string };
  [key: string]: any;
}

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/webhooks/bradford-po - Bradford PO webhook
  fastify.post('/bradford-po', async (request, reply) => {
    const body = bradfordWebhookSchema.parse(request.body);

    const po = await processBradfordPOWebhook(body);

    return {
      success: true,
      purchaseOrder: po,
    };
  });

  // POST /api/webhooks/inbound-email - Receive emails from SendGrid Inbound Parse
  // Authentication: Requires webhook secret token in URL or header
  fastify.post('/inbound-email', async (request, reply) => {
    try {
      logger.info({
        type: 'webhook_request',
        path: '/inbound-email',
        ip: request.ip,
      }, 'Received inbound email webhook');

      // Authentication check
      const tokenFromQuery = (request.query as any)?.token;
      const tokenFromHeader = request.headers['x-webhook-secret'];
      const providedToken = tokenFromQuery || tokenFromHeader;

      if (env.WEBHOOK_SECRET) {
        if (!providedToken || providedToken !== env.WEBHOOK_SECRET) {
          logSecurityEvent({
            type: 'webhook_signature_failed',
            ip: request.ip,
            details: {
              path: '/inbound-email',
              reason: 'Invalid or missing webhook secret',
            },
          });

          logger.warn({
            type: 'webhook_auth_failed',
            ip: request.ip,
          }, 'Webhook authentication failed: invalid secret');

          return reply.status(401).send({
            success: false,
            error: 'Unauthorized: Invalid webhook secret',
          });
        }
      }

      // SendGrid Inbound Parse sends multipart form data
      const data = await request.file();

      if (!data) {
        logger.warn({
          type: 'webhook_no_data',
          ip: request.ip,
        }, 'No multipart data received');

        return reply.status(400).send({
          success: false,
          error: 'No email data received',
        });
      }

      // Extract form fields from multipart data with proper typing
      const fields = data.fields as SendGridInboundFields;
      const from = fields?.from?.value || '';
      const subject = fields?.subject?.value || '';
      const text = fields?.text?.value || '';

      if (!from || !subject) {
        logger.warn({
          type: 'webhook_invalid_data',
          hasFrom: !!from,
          hasSubject: !!subject,
        }, 'Missing required email fields');

        return reply.status(400).send({
          success: false,
          error: 'Missing required email fields (from, subject)',
        });
      }

      logger.info({
        type: 'webhook_email_details',
        from,
        subject,
      }, 'Processing email webhook');

      // Process the email and extract attachments
      const result = await processInboundEmail({
        from,
        subject,
        text,
        request,
      });

      return {
        success: true,
        message: 'Email processed successfully',
        result,
      };
    } catch (error: any) {
      logger.error({
        type: 'webhook_error',
        error: error.message,
        stack: error.stack,
      }, 'Error processing inbound email webhook');

      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to process inbound email',
      });
    }
  });

  // GET /api/webhooks/events - List webhook events
  fastify.get('/events', async (request, reply) => {
    const { source, processed } = request.query as {
      source?: WebhookSource;
      processed?: string;
    };

    const events = await listWebhookEvents({
      source,
      processed: processed === 'true' ? true : processed === 'false' ? false : undefined,
    });

    return { events };
  });
};
