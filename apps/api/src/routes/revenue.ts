import { FastifyPluginAsync } from 'fastify';
import { getRevenueMetrics, getBradfordMetrics } from '../services/revenue.service.js';

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
};
