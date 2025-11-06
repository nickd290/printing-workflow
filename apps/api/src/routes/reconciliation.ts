import { FastifyPluginAsync } from 'fastify';
import {
  auditJob,
  findJobsWithIssues,
  autoFixMissingPOs,
  autoFixMissingInvoices,
  validateAmounts,
} from '../services/reconciliation.service';

const reconciliationRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/reconciliation/audit/:jobId
   * Get complete audit for a single job
   */
  server.get('/audit/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    try {
      const audit = await auditJob(jobId);
      return reply.code(200).send(audit);
    } catch (error: any) {
      server.log.error('Audit job failed:', error);
      return reply.code(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/reconciliation/report
   * Get full system reconciliation report with all jobs that have issues
   */
  server.get('/report', async (request, reply) => {
    try {
      const report = await findJobsWithIssues();
      return reply.code(200).send(report);
    } catch (error: any) {
      server.log.error('Generate report failed:', error);
      return reply.code(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/reconciliation/issues
   * Get paginated list of jobs with issues
   */
  server.get('/issues', async (request, reply) => {
    const { page = '1', limit = '50' } = request.query as { page?: string; limit?: string };

    try {
      const report = await findJobsWithIssues();

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;

      const paginatedJobs = report.jobs.slice(startIndex, endIndex);

      return reply.code(200).send({
        jobs: paginatedJobs,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(report.jobs.length / limitNum),
          totalItems: report.jobs.length,
          itemsPerPage: limitNum,
        },
        summary: report.summary,
      });
    } catch (error: any) {
      server.log.error('Get issues failed:', error);
      return reply.code(500).send({ error: error.message });
    }
  });

  /**
   * POST /api/reconciliation/fix-pos/:jobId
   * Auto-fix missing POs for a specific job
   */
  server.post('/fix-pos/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    try {
      const result = await autoFixMissingPOs(jobId);
      return reply.code(200).send({
        success: true,
        jobId,
        posCreated: result.created,
        message: result.created.length > 0
          ? `Created ${result.created.length} PO(s): ${result.created.join(', ')}`
          : 'No POs needed to be created',
      });
    } catch (error: any) {
      server.log.error('Fix POs failed:', error);
      return reply.code(500).send({ error: error.message });
    }
  });

  /**
   * POST /api/reconciliation/fix-invoices/:jobId
   * Auto-fix missing invoices for a COMPLETED job
   */
  server.post('/fix-invoices/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    try {
      const result = await autoFixMissingInvoices(jobId);
      return reply.code(200).send({
        success: true,
        jobId,
        invoicesCreated: result.created,
        message: result.created.length > 0
          ? `Created ${result.created.length} invoice(s): ${result.created.join(', ')}`
          : 'No invoices needed to be created',
      });
    } catch (error: any) {
      server.log.error('Fix invoices failed:', error);
      return reply.code(400).send({ error: error.message });
    }
  });

  /**
   * POST /api/reconciliation/batch-fix
   * Batch fix multiple jobs at once
   */
  server.post('/batch-fix', async (request, reply) => {
    const { jobIds, fixType } = request.body as {
      jobIds: string[];
      fixType: 'pos' | 'invoices' | 'both';
    };

    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return reply.code(400).send({ error: 'jobIds array is required' });
    }

    if (!['pos', 'invoices', 'both'].includes(fixType)) {
      return reply.code(400).send({ error: 'fixType must be "pos", "invoices", or "both"' });
    }

    const results = {
      total: jobIds.length,
      successful: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const jobId of jobIds) {
      try {
        const jobResult: any = { jobId, success: true, actions: [] };

        if (fixType === 'pos' || fixType === 'both') {
          const posResult = await autoFixMissingPOs(jobId);
          if (posResult.created.length > 0) {
            jobResult.actions.push(...posResult.created.map(po => `Created ${po}`));
          }
        }

        if (fixType === 'invoices' || fixType === 'both') {
          try {
            const invoicesResult = await autoFixMissingInvoices(jobId);
            if (invoicesResult.created.length > 0) {
              jobResult.actions.push(...invoicesResult.created.map(inv => `Created ${inv}`));
            }
          } catch (error: any) {
            // Invoice creation might fail if job not COMPLETED - treat as warning
            jobResult.warnings = [error.message];
          }
        }

        results.successful++;
        results.details.push(jobResult);
      } catch (error: any) {
        results.failed++;
        results.details.push({
          jobId,
          success: false,
          error: error.message,
        });
        server.log.error(`Batch fix failed for job ${jobId}:`, error);
      }
    }

    return reply.code(200).send(results);
  });

  /**
   * GET /api/reconciliation/validate/:jobId
   * Validate amounts for a specific job (strict validation)
   */
  server.get('/validate/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    try {
      const validationErrors = await validateAmounts(jobId);

      if (validationErrors.length === 0) {
        return reply.code(200).send({
          valid: true,
          jobId,
          message: 'All amounts are valid',
          errors: [],
        });
      }

      return reply.code(200).send({
        valid: false,
        jobId,
        message: `Found ${validationErrors.length} validation error(s)`,
        errors: validationErrors,
      });
    } catch (error: any) {
      server.log.error('Validate amounts failed:', error);
      return reply.code(500).send({ error: error.message });
    }
  });
};

export default reconciliationRoutes;
