import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { env } from '../env.js';

/**
 * Webhook signature verification middleware
 *
 * Webhooks should include a signature header to verify they're from trusted sources.
 *
 * How to use:
 * 1. Sender computes HMAC-SHA256 of request body using shared WEBHOOK_SECRET
 * 2. Sender includes signature in X-Webhook-Signature header
 * 3. This middleware verifies the signature matches
 */

export interface WebhookRequest extends FastifyRequest {
  rawBody?: Buffer;
}

/**
 * Verify webhook signature
 */
function verifySignature(body: string | Buffer, signature: string): boolean {
  if (!env.WEBHOOK_SECRET) {
    console.warn('⚠️  WEBHOOK_SECRET not configured - webhook authentication disabled');
    return true; // Allow in development if secret not set
  }

  const bodyString = Buffer.isBuffer(body) ? body.toString('utf-8') : body;
  const expectedSignature = crypto
    .createHmac('sha256', env.WEBHOOK_SECRET)
    .update(bodyString)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Bradford webhook authentication
 * Verifies requests from Bradford's system
 */
export async function verifyBradfordWebhook(
  request: WebhookRequest,
  reply: FastifyReply
) {
  const signature = request.headers['x-webhook-signature'] as string;

  // In development mode, allow webhooks without signature (but log warning)
  if (env.NODE_ENV === 'development' && !signature) {
    request.log.warn('⚠️  Bradford webhook without signature (development mode)');
    return;
  }

  if (!signature) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing X-Webhook-Signature header',
    });
  }

  // Get raw body for signature verification
  const bodyString = JSON.stringify(request.body);

  if (!verifySignature(bodyString, signature)) {
    request.log.error('❌ Invalid webhook signature from Bradford');
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid webhook signature',
    });
  }

  request.log.info('✅ Bradford webhook signature verified');
}

/**
 * Generic webhook authentication
 * Can be used for other webhook sources (Zapier, Make.com, etc.)
 */
export async function verifyGenericWebhook(
  request: WebhookRequest,
  reply: FastifyReply
) {
  // Check for service token (simpler than signature for internal webhooks)
  const serviceToken = request.headers['x-service-token'] as string;

  if (env.NODE_ENV === 'development' && !serviceToken) {
    request.log.warn('⚠️  Webhook without service token (development mode)');
    return;
  }

  if (!serviceToken) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing X-Service-Token header',
    });
  }

  if (serviceToken !== env.WEBHOOK_SECRET) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid service token',
    });
  }
}

/**
 * Helper function to generate signature for testing
 * Use this in your webhook sender code
 */
export function generateWebhookSignature(body: string | object): string {
  if (!env.WEBHOOK_SECRET) {
    throw new Error('WEBHOOK_SECRET not configured');
  }

  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  return crypto
    .createHmac('sha256', env.WEBHOOK_SECRET)
    .update(bodyString)
    .digest('hex');
}
