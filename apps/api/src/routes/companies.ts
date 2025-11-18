import { FastifyPluginAsync } from 'fastify';
import {
  createCompany,
  getCompanyById,
  listCompanies,
  updateCompany,
  deleteCompany,
} from '../services/company.service.js';

export const companyRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/companies - Create company
  fastify.post('/', async (request, reply) => {
    try {
      const body = request.body as {
        name: string;
        type: string;
        email?: string;
        phone?: string;
        address?: string;
      };

      const company = await createCompany(body);
      return company;
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/companies - List all companies
  fastify.get('/', async (request, reply) => {
    try {
      const { type, search } = request.query as {
        type?: string;
        search?: string;
      };

      const filters: any = {};
      if (type) {
        filters.type = type;
      }
      if (search) {
        filters.search = search;
      }

      const companies = await listCompanies(filters);
      return companies;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/companies/:id - Get company by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const company = await getCompanyById(id);
      return company;
    } catch (error: any) {
      if (error.message === 'Company not found') {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // PATCH /api/companies/:id - Update company
  fastify.patch('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        type?: string;
        email?: string;
        phone?: string;
        address?: string;
      };

      const company = await updateCompany(id, body);
      return company;
    } catch (error: any) {
      if (error.message === 'Company not found') {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(400).send({ error: error.message });
    }
  });

  // DELETE /api/companies/:id - Delete company
  fastify.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await deleteCompany(id);
      return result;
    } catch (error: any) {
      if (error.message === 'Company not found') {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(400).send({ error: error.message });
    }
  });
};
