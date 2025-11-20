import { FastifyPluginAsync } from 'fastify';
import {
  createEmployee,
  getEmployeeById,
  listEmployees,
  updateEmployee,
  deleteEmployee,
} from '../services/employee.service.js';

export const employeeRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/employees - Create employee
  fastify.post('/', async (request, reply) => {
    try {
      const body = request.body as {
        companyId: string;
        name: string;
        email: string;
        phone?: string;
        position?: string;
        isPrimary?: boolean;
      };

      const employee = await createEmployee(body);
      return employee;
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // GET /api/employees - List all employees
  fastify.get('/', async (request, reply) => {
    try {
      const { companyId, search, isPrimary } = request.query as {
        companyId?: string;
        search?: string;
        isPrimary?: string;
      };

      const filters: any = {};
      if (companyId) {
        filters.companyId = companyId;
      }
      if (search) {
        filters.search = search;
      }
      if (isPrimary !== undefined) {
        filters.isPrimary = isPrimary === 'true';
      }

      const employees = await listEmployees(filters);
      return employees;
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET /api/employees/:id - Get employee by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const employee = await getEmployeeById(id);
      return employee;
    } catch (error: any) {
      if (error.message === 'Employee not found') {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(500).send({ error: error.message });
    }
  });

  // PATCH /api/employees/:id - Update employee
  fastify.patch('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        email?: string;
        phone?: string;
        position?: string;
        isPrimary?: boolean;
      };

      const employee = await updateEmployee(id, body);
      return employee;
    } catch (error: any) {
      if (error.message === 'Employee not found') {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(400).send({ error: error.message });
    }
  });

  // DELETE /api/employees/:id - Delete employee
  fastify.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await deleteEmployee(id);
      return result;
    } catch (error: any) {
      if (error.message === 'Employee not found') {
        return reply.status(404).send({ error: error.message });
      }
      return reply.status(400).send({ error: error.message });
    }
  });
};
