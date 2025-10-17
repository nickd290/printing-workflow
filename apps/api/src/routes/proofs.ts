import { FastifyPluginAsync } from 'fastify';
import {
  uploadProofSchema,
  approveProofSchema,
  requestProofChangesSchema,
} from '@printing-workflow/shared';
import {
  uploadProof,
  approveProof,
  requestProofChanges,
  getProofById,
  listProofsByJob,
} from '../services/proof.service.js';

export const proofRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/proofs/:jobId/upload - Upload proof
  fastify.post('/:jobId/upload', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const body = uploadProofSchema.parse({ ...request.body, jobId });

    const proof = await uploadProof(body);
    return proof;
  });

  // POST /api/proofs/:proofId/approve - Approve proof
  fastify.post('/:proofId/approve', async (request, reply) => {
    const { proofId } = request.params as { proofId: string };
    const body = approveProofSchema.parse({ ...request.body, proofId });

    const result = await approveProof(body);
    return result;
  });

  // POST /api/proofs/:proofId/request-changes - Request proof changes
  fastify.post('/:proofId/request-changes', async (request, reply) => {
    const { proofId } = request.params as { proofId: string };
    const body = requestProofChangesSchema.parse({ ...request.body, proofId });

    const result = await requestProofChanges(body);
    return result;
  });

  // GET /api/proofs/:id - Get proof by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const proof = await getProofById(id);

    if (!proof) {
      return reply.status(404).send({ error: 'Proof not found' });
    }

    return proof;
  });

  // GET /api/proofs/by-job/:jobId - List proofs for a job
  fastify.get('/by-job/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const proofs = await listProofsByJob(jobId);
    return { proofs };
  });
};
