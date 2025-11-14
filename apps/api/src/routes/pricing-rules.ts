import { FastifyPluginAsync } from 'fastify';

export const pricingRulesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/pricing-rules - List all pricing rules
  fastify.get('/', async (request, reply) => {
    const { prisma } = await import('@printing-workflow/db');

    const rules = await prisma.pricingRule.findMany({
      orderBy: {
        sizeName: 'asc',
      },
    });

    return { rules };
  });

  // GET /api/pricing-rules/:id - Get single pricing rule
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { prisma } = await import('@printing-workflow/db');

    const rule = await prisma.pricingRule.findUnique({
      where: { id },
    });

    if (!rule) {
      return reply.status(404).send({ error: 'Pricing rule not found' });
    }

    return { rule };
  });

  // POST /api/pricing-rules - Create new pricing rule
  fastify.post('/', async (request, reply) => {
    const body = request.body as {
      sizeName: string;
      baseCPM: number;
      printCPM: number;
      notes?: string;
      isActive?: boolean;
    };

    const { prisma } = await import('@printing-workflow/db');

    // Check if size already exists
    const existing = await prisma.pricingRule.findUnique({
      where: { sizeName: body.sizeName },
    });

    if (existing) {
      return reply.status(400).send({ error: `Pricing rule for size "${body.sizeName}" already exists` });
    }

    const rule = await prisma.pricingRule.create({
      data: {
        sizeName: body.sizeName,
        baseCPM: body.baseCPM,
        printCPM: body.printCPM,
        notes: body.notes,
        isActive: body.isActive ?? true,
      },
    });

    return { rule };
  });

  // PATCH /api/pricing-rules/:id - Update pricing rule
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      baseCPM?: number;
      printCPM?: number;
      notes?: string;
      isActive?: boolean;
    };

    const { prisma } = await import('@printing-workflow/db');

    try {
      const rule = await prisma.pricingRule.update({
        where: { id },
        data: {
          baseCPM: body.baseCPM,
          printCPM: body.printCPM,
          notes: body.notes,
          isActive: body.isActive,
        },
      });

      return { rule };
    } catch (error) {
      return reply.status(404).send({ error: 'Pricing rule not found' });
    }
  });

  // DELETE /api/pricing-rules/:id - Delete pricing rule
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { prisma } = await import('@printing-workflow/db');

    try {
      await prisma.pricingRule.delete({
        where: { id },
      });

      return { success: true };
    } catch (error) {
      return reply.status(404).send({ error: 'Pricing rule not found' });
    }
  });

  // GET /api/pricing-rules/by-size/:sizeName - Get pricing rule by size
  fastify.get('/by-size/:sizeName', async (request, reply) => {
    const { sizeName } = request.params as { sizeName: string };
    const { prisma } = await import('@printing-workflow/db');

    const rule = await prisma.pricingRule.findUnique({
      where: { sizeName },
    });

    if (!rule) {
      return reply.status(404).send({ error: `No pricing rule found for size "${sizeName}"` });
    }

    return { rule };
  });

  // POST /api/pricing-rules/calculate - Calculate pricing for a job
  fastify.post('/calculate', async (request, reply) => {
    const body = request.body as {
      sizeName: string;
      quantity: number;
      overrides?: {
        customerCPM?: number;
        printCPM?: number;
        paperCostCPM?: number;
        paperChargedCPM?: number;
        paperMarkupPercent?: number;
      };
    };

    const { prisma } = await import('@printing-workflow/db');
    const { calculateDynamicPricing, validatePricing } = await import('@printing-workflow/shared');

    try {
      const pricing = await calculateDynamicPricing(
        prisma,
        body.sizeName,
        body.quantity,
        body.overrides
      );

      const validation = validatePricing(pricing);

      return {
        pricing,
        validation,
      };
    } catch (error: any) {
      return reply.status(400).send({
        error: error.message || 'Failed to calculate pricing'
      });
    }
  });
};
