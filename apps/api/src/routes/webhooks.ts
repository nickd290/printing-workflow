import { FastifyPluginAsync } from 'fastify';
import { bradfordWebhookSchema } from '@printing-workflow/shared';
import {
  processBradfordPOWebhook,
  listWebhookEvents,
} from '../services/webhook.service.js';
import { WebhookSource } from '@printing-workflow/db';

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
