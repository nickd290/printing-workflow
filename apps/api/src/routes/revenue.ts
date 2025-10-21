import { FastifyPluginAsync } from 'fastify';
import { getRevenueMetrics, getBradfordMetrics, getPOFlowMetrics } from '../services/revenue.service.js';

export const revenueRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/revenue/metrics - Get revenue metrics and statistics
  fastify.get('/metrics', async (request, reply) => {
    const metrics = await getRevenueMetrics();
    return metrics;
  });

  // GET /api/revenue/bradford - Get Bradford-specific metrics
  fastify.get('/bradford', async (request, reply) => {
    const metrics = await getBradfordMetrics();
    return metrics;
  });

  // GET /api/revenue/po-flow - Get PO flow metrics showing Customer → Impact → Bradford → JD chain
  fastify.get('/po-flow', async (request, reply) => {
    const metrics = await getPOFlowMetrics();
    return metrics;
  });
};
