import { FastifyPluginAsync } from 'fastify';
import { scheduleShipmentSchema } from '@printing-workflow/shared';
import {
  scheduleShipment,
  updateShipmentTracking,
  markShipmentAsShipped,
  markShipmentAsDelivered,
  getShipmentById,
  listShipmentsByJob,
  createSampleShipment,
} from '../services/shipment.service.js';

export const shipmentRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/shipments/:jobId/schedule - Schedule shipment
  fastify.post('/:jobId/schedule', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const body = scheduleShipmentSchema.parse({ ...request.body, jobId });

    const shipment = await scheduleShipment({
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
    });

    return shipment;
  });

  // PATCH /api/shipments/:id/tracking - Update tracking number
  fastify.patch('/:id/tracking', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { trackingNo } = request.body as { trackingNo: string };

    const shipment = await updateShipmentTracking(id, trackingNo);
    return shipment;
  });

  // POST /api/shipments/:id/shipped - Mark as shipped
  fastify.post('/:id/shipped', async (request, reply) => {
    const { id } = request.params as { id: string };
    const shipment = await markShipmentAsShipped(id);
    return shipment;
  });

  // POST /api/shipments/:id/delivered - Mark as delivered
  fastify.post('/:id/delivered', async (request, reply) => {
    const { id } = request.params as { id: string };
    const shipment = await markShipmentAsDelivered(id);
    return shipment;
  });

  // GET /api/shipments/:id - Get shipment by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const shipment = await getShipmentById(id);

    if (!shipment) {
      return reply.status(404).send({ error: 'Shipment not found' });
    }

    return shipment;
  });

  // GET /api/shipments/by-job/:jobId - List shipments for a job
  fastify.get('/by-job/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const shipments = await listShipmentsByJob(jobId);
    return { shipments };
  });

  // POST /api/shipments/samples - Create sample shipment
  fastify.post('/samples', async (request, reply) => {
    const body = request.body as {
      description: string;
      carrier: string;
      trackingNo?: string;
      recipientEmail: string;
    };

    const shipment = await createSampleShipment(body);
    return shipment;
  });
};
