import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import { env } from './env.js';
import { prisma } from '@printing-workflow/db';
import fs from 'fs';

console.log('========================================');
console.log('🔵 API Server Starting...');
console.log('========================================');
// Running on port 3001 (default API port)
console.log('Timestamp:', new Date().toISOString());
console.log('Node Version:', process.version);
console.log('Environment:', env.NODE_ENV);
console.log('Port (from env):', env.PORT);
console.log('API URL:', env.API_URL);
console.log('NEXTAUTH_URL:', env.NEXTAUTH_URL);
console.log('DATABASE_URL:', env.DATABASE_URL ? `${env.DATABASE_URL.substring(0, 30)}...` : 'NOT SET');
console.log('----------------------------------------');

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
import reportsRoutes from './routes/reports.js';

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

// Configure upload directory
const uploadDir = env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`✅ Created upload directory: ${uploadDir}`);
} else {
  console.log(`✅ Upload directory exists: ${uploadDir}`);
}

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
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
await fastify.register(reportsRoutes, { prefix: '/api/reports' });

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
  console.log('Testing database connection...');
  await prisma.$connect();
  console.log('✅ Database connected successfully!');

  // Use PORT from environment (Railway auto-injects 8080, local defaults to 3001)
  const port = parseInt(env.PORT, 10);
  console.log(`Attempting to bind to port: ${port} on host 0.0.0.0`);
  console.log(`Using PORT: ${env.PORT} (Railway auto-injects 8080 in production)`);

  await fastify.listen({ port, host: '0.0.0.0' });

  console.log('========================================');
  console.log(`✅ API server listening at http://localhost:${port}`);
  console.log('Server is ready to accept connections!');
  console.log('========================================');
} catch (err) {
  console.error('========================================');
  console.error('❌ FATAL ERROR: Failed to start server');
  console.error('========================================');
  console.error('Error details:', err);
  console.error('Error message:', err instanceof Error ? err.message : 'Unknown error');
  console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
  fastify.log.error(err);
  process.exit(1);
}
