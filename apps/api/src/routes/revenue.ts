import { FastifyPluginAsync } from 'fastify';
import { getRevenueMetrics } from '../services/revenue.service.js';

export const revenueRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/revenue/metrics - Get revenue metrics and statistics
  fastify.get('/metrics', async (request, reply) => {
    const metrics = await getRevenueMetrics();
    return metrics;
  });
};
