import { FastifyPluginAsync } from 'fastify';
import {
  createVendor,
  getVendorById,
  listVendors,
  updateVendor,
  deleteVendor,
} from '../services/vendor.service.js';

export const vendorRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/vendors - Create vendor
  fastify.post('/', async (request, reply) => {
    try {
      const body = request.body as {
        name: string;
        email?: string;
        phone?: string;
        address?: string;
      };

      const vendor = await createVendor(body);
      return vendor;
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/vendors - List all vendors
  fastify.get('/', async (request, reply) => {
    try {
      const { isActive, search } = request.query as {
        isActive?: string;
        search?: string;
      };

      const filters: any = {};
      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }
      if (search) {
        filters.search = search;
      }

      const vendors = await listVendors(filters);
      return vendors;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/vendors/:id - Get vendor by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const vendor = await getVendorById(id);
      return vendor;
    } catch (error: any) {
      if (error.message === 'Vendor not found') {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // PATCH /api/vendors/:id - Update vendor
  fastify.patch('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        email?: string;
        phone?: string;
        address?: string;
        isActive?: boolean;
      };

      const vendor = await updateVendor(id, body);
      return vendor;
    } catch (error: any) {
      if (error.message === 'Vendor not found') {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(400).send({ error: error.message });
    }
  });

  // DELETE /api/vendors/:id - Delete/deactivate vendor
  fastify.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const vendor = await deleteVendor(id);
      return { success: true, vendor };
    } catch (error: any) {
      if (error.message === 'Vendor not found') {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(400).send({ error: error.message });
    }
  });
};
