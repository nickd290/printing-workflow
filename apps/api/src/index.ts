import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import { env } from './env.js';
import { prisma } from '@printing-workflow/db';

// Import routes
import authRoutes from './routes/auth.js';
import { quoteRoutes } from './routes/quotes.js';
import { jobRoutes } from './routes/jobs.js';
import { proofRoutes } from './routes/proofs.js';
import { fileRoutes } from './routes/files.js';
import { shipmentRoutes } from './routes/shipments.js';
import { invoiceRoutes } from './routes/invoices.js';
import { purchaseOrderRoutes } from './routes/purchase-orders.js';
import { webhookRoutes } from './routes/webhooks.js';
import { revenueRoutes } from './routes/revenue.js';
import { paperInventoryRoutes } from './routes/paper-inventory.js';
import { pricingRulesRoutes } from './routes/pricing-rules.js';
import notificationsRoutes from './routes/notifications.js';
import exportsRoutes from './routes/exports.js';
import customerRoutes from './routes/customer.js';
import { adminRoutes } from './routes/admin.js';

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

// Register plugins
await fastify.register(cors, {
  origin: [env.NEXTAUTH_URL, 'http://localhost:5175', 'http://localhost:8888'],
  credentials: true,
});

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file (reduced for security)
    files: 5, // Max 5 files per request
    fields: 20, // Max 20 form fields
    parts: 25, // Max 25 parts total
  },
});

await fastify.register(cookie, {
  secret: env.NEXTAUTH_SECRET, // For signing cookies (optional)
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(quoteRoutes, { prefix: '/api/quotes' });
await fastify.register(jobRoutes, { prefix: '/api/jobs' });
await fastify.register(proofRoutes, { prefix: '/api/proofs' });
await fastify.register(fileRoutes, { prefix: '/api/files' });
await fastify.register(shipmentRoutes, { prefix: '/api/shipments' });
await fastify.register(invoiceRoutes, { prefix: '/api/invoices' });
await fastify.register(purchaseOrderRoutes, { prefix: '/api/purchase-orders' });
await fastify.register(webhookRoutes, { prefix: '/api/webhooks' });
await fastify.register(revenueRoutes, { prefix: '/api/revenue' });
await fastify.register(paperInventoryRoutes, { prefix: '/api/paper-inventory' });
await fastify.register(pricingRulesRoutes, { prefix: '/api/pricing-rules' });
await fastify.register(notificationsRoutes, { prefix: '/api/notifications' });
await fastify.register(exportsRoutes, { prefix: '/api/exports' });
await fastify.register(customerRoutes, { prefix: '/api/customer' });
await fastify.register(adminRoutes, { prefix: '/api/admin' });

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(error.statusCode || 500).send({
    error: error.message || 'Internal Server Error',
    statusCode: error.statusCode || 500,
  });
});

// Graceful shutdown
const listeners = ['SIGINT', 'SIGTERM'];
listeners.forEach((signal) => {
  process.on(signal, async () => {
    await fastify.close();
    await prisma.$disconnect();
    process.exit(0);
  });
});

// Start server
try {
  const port = parseInt(env.API_PORT, 10);
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`🚀 API server listening at http://localhost:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
