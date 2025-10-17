import { FastifyPluginAsync } from 'fastify';
import {
  parseTextRequestSchema,
  createQuoteRequestSchema,
  createQuoteSchema,
  approveQuoteSchema,
} from '@printing-workflow/shared';
import {
  parseSpecsFromText,
  createQuoteRequest,
  createQuote,
  approveQuote,
  getQuoteById,
  listQuotes,
} from '../services/quote.service.js';

export const quoteRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/quotes/parse-text - AI stub to parse specs
  fastify.post('/parse-text', async (request, reply) => {
    const body = parseTextRequestSchema.parse(request.body);
    const specs = await parseSpecsFromText(body.text);
    return { specs };
  });

  // POST /api/quotes/request - Create quote request
  fastify.post('/request', async (request, reply) => {
    const body = createQuoteRequestSchema.parse(request.body);
    const quoteRequest = await createQuoteRequest(body);
    return quoteRequest;
  });

  // POST /api/quotes - Create quote
  fastify.post('/', async (request, reply) => {
    const body = createQuoteSchema.parse(request.body);
    const quote = await createQuote({
      ...body,
      validUntil: new Date(body.validUntil),
    });
    return quote;
  });

  // POST /api/quotes/:id/approve - Approve quote
  fastify.post('/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const quote = await approveQuote(id);
    return quote;
  });

  // GET /api/quotes/:id - Get quote by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const quote = await getQuoteById(id);

    if (!quote) {
      return reply.status(404).send({ error: 'Quote not found' });
    }

    return quote;
  });

  // GET /api/quotes - List quotes
  fastify.get('/', async (request, reply) => {
    const { customerId, status } = request.query as {
      customerId?: string;
      status?: string;
    };

    const quotes = await listQuotes({
      customerId,
      status: status as any,
    });

    return { quotes };
  });
};
