import { FastifyPluginAsync } from 'fastify';
import {
  getInventory,
  getInventoryByRollType,
  initializeInventory,
  adjustInventory,
  getTransactionHistory,
  deductForJob,
  getLowStockItems,
  updateInventorySettings,
  getInventorySummary,
  type PaperRollType,
  type TransactionType,
} from '../services/paper-inventory.service.js';

export const paperInventoryRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/paper-inventory - Get all inventory
  fastify.get('/', async (request, reply) => {
    const { companyId } = request.query as { companyId?: string };
    const inventory = await getInventory(companyId);
    return { inventory };
  });

  // GET /api/paper-inventory/summary - Get inventory summary with alerts
  fastify.get('/summary', async (request, reply) => {
    const { companyId } = request.query as { companyId?: string };
    const summary = await getInventorySummary(companyId);
    return summary;
  });

  // GET /api/paper-inventory/low-stock - Get low stock items
  fastify.get('/low-stock', async (request, reply) => {
    const { companyId } = request.query as { companyId?: string };
    const lowStockItems = await getLowStockItems(companyId);
    return { lowStockItems };
  });

  // GET /api/paper-inventory/:rollType - Get specific roll type inventory
  fastify.get('/:rollType', async (request, reply) => {
    const { rollType } = request.params as { rollType: PaperRollType };
    const { companyId } = request.query as { companyId?: string };

    const inventory = await getInventoryByRollType(rollType, companyId);

    if (!inventory) {
      return reply.status(404).send({ error: 'Inventory not found' });
    }

    return inventory;
  });

  // POST /api/paper-inventory/initialize - Initialize inventory
  fastify.post('/initialize', async (request, reply) => {
    const { companyId } = request.body as { companyId?: string };
    const inventory = await initializeInventory(companyId);
    return { inventory, message: 'Inventory initialized successfully' };
  });

  // POST /api/paper-inventory/adjust - Adjust inventory (add, remove, adjust)
  fastify.post('/adjust', async (request, reply) => {
    const body = request.body as {
      rollType: PaperRollType;
      quantity: number;
      type: TransactionType;
      companyId?: string;
      jobId?: string;
      notes?: string;
      userId?: string;
    };

    try {
      const result = await adjustInventory(body);
      return {
        success: true,
        inventory: result.inventory,
        transaction: result.transaction,
      };
    } catch (error: any) {
      return reply.status(400).send({
        error: error.message || 'Failed to adjust inventory',
      });
    }
  });

  // POST /api/paper-inventory/deduct-for-job - Deduct inventory for a job
  fastify.post('/deduct-for-job', async (request, reply) => {
    const body = request.body as {
      jobId: string;
      rollType: PaperRollType;
      quantity: number;
      userId?: string;
      notes?: string;
    };

    try {
      const result = await deductForJob(body);
      return {
        success: true,
        inventory: result.inventory,
        transaction: result.transaction,
      };
    } catch (error: any) {
      return reply.status(400).send({
        error: error.message || 'Failed to deduct inventory',
      });
    }
  });

  // GET /api/paper-inventory/transactions - Get transaction history
  fastify.get('/transactions', async (request, reply) => {
    const { companyId, rollType, jobId, limit } = request.query as {
      companyId?: string;
      rollType?: PaperRollType;
      jobId?: string;
      limit?: string;
    };

    const transactions = await getTransactionHistory({
      companyId,
      rollType,
      jobId,
      limit: limit ? parseInt(limit) : undefined,
    });

    return { transactions };
  });

  // PATCH /api/paper-inventory/:rollType/settings - Update inventory settings
  fastify.patch('/:rollType/settings', async (request, reply) => {
    const { rollType } = request.params as { rollType: PaperRollType };
    const body = request.body as {
      reorderPoint?: number;
      weightPerRoll?: number;
      companyId?: string;
    };

    try {
      const inventory = await updateInventorySettings(
        rollType,
        {
          reorderPoint: body.reorderPoint,
          weightPerRoll: body.weightPerRoll,
        },
        body.companyId
      );
      return { success: true, inventory };
    } catch (error: any) {
      return reply.status(400).send({
        error: error.message || 'Failed to update inventory settings',
      });
    }
  });
};
