import { prisma } from '@printing-workflow/db';

export type PaperRollType = '20_7pt_matte' | '18_7pt_matte' | '15_7pt_matte' | '20_9pt';
export type TransactionType = 'ADD' | 'REMOVE' | 'ADJUST' | 'JOB_USAGE';

/**
 * Get all paper inventory for a company
 */
export async function getInventory(companyId: string = 'bradford') {
  return prisma.paperInventory.findMany({
    where: { companyId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 5, // Include last 5 transactions per roll type
      },
    },
    orderBy: [
      { paperPoint: 'asc' },
      { rollWidth: 'desc' },
    ],
  });
}

/**
 * Get a specific inventory item by roll type
 */
export async function getInventoryByRollType(rollType: PaperRollType, companyId: string = 'bradford') {
  return prisma.paperInventory.findFirst({
    where: {
      rollType,
      companyId,
    },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
}

/**
 * Initialize inventory for Bradford with default roll types
 */
export async function initializeInventory(companyId: string = 'bradford') {
  const rollTypes = [
    { rollType: '20_7pt_matte' as PaperRollType, rollWidth: 20, paperPoint: 7, paperType: 'matte', quantity: 0, reorderPoint: 2 },
    { rollType: '18_7pt_matte' as PaperRollType, rollWidth: 18, paperPoint: 7, paperType: 'matte', quantity: 0, reorderPoint: 2 },
    { rollType: '15_7pt_matte' as PaperRollType, rollWidth: 15, paperPoint: 7, paperType: 'matte', quantity: 0, reorderPoint: 2 },
    { rollType: '20_9pt' as PaperRollType, rollWidth: 20, paperPoint: 9, paperType: 'standard', quantity: 0, reorderPoint: 2 },
  ];

  const results = [];
  for (const rollConfig of rollTypes) {
    // Check if already exists
    const existing = await prisma.paperInventory.findFirst({
      where: {
        rollType: rollConfig.rollType,
        companyId,
      },
    });

    if (!existing) {
      const created = await prisma.paperInventory.create({
        data: {
          ...rollConfig,
          companyId,
        },
      });
      results.push(created);
    } else {
      results.push(existing);
    }
  }

  return results;
}

/**
 * Adjust inventory quantity (add, remove, or adjust)
 */
export async function adjustInventory(data: {
  rollType: PaperRollType;
  quantity: number; // positive for add, negative for remove
  type: TransactionType;
  companyId?: string;
  jobId?: string;
  notes?: string;
  userId?: string;
}) {
  const companyId = data.companyId || 'bradford';

  // Get or create inventory item
  let inventory = await prisma.paperInventory.findFirst({
    where: {
      rollType: data.rollType,
      companyId,
    },
  });

  if (!inventory) {
    // Create if doesn't exist
    const rollConfig = getRollConfig(data.rollType);
    inventory = await prisma.paperInventory.create({
      data: {
        ...rollConfig,
        quantity: 0,
        companyId,
      },
    });
  }

  // Calculate new quantity
  const newQuantity = inventory.quantity + data.quantity;

  if (newQuantity < 0) {
    throw new Error(`Insufficient inventory. Current: ${inventory.quantity}, Requested: ${Math.abs(data.quantity)}`);
  }

  // Update inventory and create transaction
  const [updatedInventory, transaction] = await prisma.$transaction([
    prisma.paperInventory.update({
      where: { id: inventory.id },
      data: { quantity: newQuantity },
    }),
    prisma.paperTransaction.create({
      data: {
        inventoryId: inventory.id,
        type: data.type,
        quantity: data.quantity,
        jobId: data.jobId,
        notes: data.notes,
        userId: data.userId,
      },
    }),
  ]);

  return { inventory: updatedInventory, transaction };
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(filters?: {
  companyId?: string;
  rollType?: PaperRollType;
  jobId?: string;
  limit?: number;
}) {
  const companyId = filters?.companyId || 'bradford';

  const where: any = {};

  if (filters?.rollType || companyId) {
    where.inventory = {};
    if (filters?.rollType) {
      where.inventory.rollType = filters.rollType;
    }
    if (companyId) {
      where.inventory.companyId = companyId;
    }
  }

  if (filters?.jobId) {
    where.jobId = filters.jobId;
  }

  return prisma.paperTransaction.findMany({
    where,
    include: {
      inventory: true,
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit || 50,
  });
}

/**
 * Deduct inventory for a job
 */
export async function deductForJob(data: {
  jobId: string;
  rollType: PaperRollType;
  quantity: number;
  userId?: string;
  notes?: string;
}) {
  return adjustInventory({
    rollType: data.rollType,
    quantity: -Math.abs(data.quantity), // Ensure negative
    type: 'JOB_USAGE',
    jobId: data.jobId,
    userId: data.userId,
    notes: data.notes || `Used for job ${data.jobId}`,
  });
}

/**
 * Check for low stock items
 */
export async function getLowStockItems(companyId: string = 'bradford') {
  const inventory = await prisma.paperInventory.findMany({
    where: { companyId },
  });

  return inventory.filter(item => {
    if (item.reorderPoint === null) return false;
    return item.quantity <= item.reorderPoint;
  });
}

/**
 * Update inventory settings (reorder point, weight per roll, etc.)
 */
export async function updateInventorySettings(
  rollType: PaperRollType,
  settings: {
    reorderPoint?: number;
    weightPerRoll?: number;
  },
  companyId: string = 'bradford'
) {
  const inventory = await prisma.paperInventory.findFirst({
    where: { rollType, companyId },
  });

  if (!inventory) {
    throw new Error(`Inventory not found for roll type: ${rollType}`);
  }

  return prisma.paperInventory.update({
    where: { id: inventory.id },
    data: settings,
  });
}

/**
 * Helper function to get roll configuration
 */
function getRollConfig(rollType: PaperRollType) {
  const configs = {
    '20_7pt_matte': { rollType: '20_7pt_matte' as PaperRollType, rollWidth: 20, paperPoint: 7, paperType: 'matte', reorderPoint: 2 },
    '18_7pt_matte': { rollType: '18_7pt_matte' as PaperRollType, rollWidth: 18, paperPoint: 7, paperType: 'matte', reorderPoint: 2 },
    '15_7pt_matte': { rollType: '15_7pt_matte' as PaperRollType, rollWidth: 15, paperPoint: 7, paperType: 'matte', reorderPoint: 2 },
    '20_9pt': { rollType: '20_9pt' as PaperRollType, rollWidth: 20, paperPoint: 9, paperType: 'standard', reorderPoint: 2 },
  };

  return configs[rollType];
}

/**
 * Get inventory summary with low stock alerts
 */
export async function getInventorySummary(companyId: string = 'bradford') {
  const inventory = await getInventory(companyId);
  const lowStock = await getLowStockItems(companyId);

  const totalRolls = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const totalWeight = inventory.reduce((sum, item) => {
    if (item.weightPerRoll) {
      return sum + (item.quantity * Number(item.weightPerRoll));
    }
    return sum;
  }, 0);

  return {
    inventory,
    lowStockItems: lowStock,
    totalRolls,
    totalWeight,
    lowStockCount: lowStock.length,
  };
}
