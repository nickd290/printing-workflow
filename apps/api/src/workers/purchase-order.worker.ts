import { Worker, Job } from 'bullmq';
import { connection, CreateAutoPOJob } from '../lib/queue.js';
import { QUEUE_NAMES, COMPANY_IDS } from '@printing-workflow/shared';
import { createAutoPurchaseOrder } from '../services/purchase-order.service.js';

const purchaseOrderWorker = new Worker(
  QUEUE_NAMES.PURCHASE_ORDERS,
  async (job: Job<CreateAutoPOJob>) => {
    const { jobId, customerTotal } = job.data;

    console.log(`Creating auto PO for job ${jobId}`);

    try {
      // Create Impact Direct → Bradford PO
      const po = await createAutoPurchaseOrder({
        jobId,
        originCompanyId: COMPANY_IDS.IMPACT_DIRECT,
        targetCompanyId: COMPANY_IDS.BRADFORD,
        originalAmount: customerTotal,
      });

      console.log(`Auto PO created: ${po.id}`);
      return po;
    } catch (error) {
      console.error(`Failed to create auto PO for job ${jobId}:`, error);
      throw error;
    }
  },
  { connection }
);

purchaseOrderWorker.on('completed', (job) => {
  console.log(`PO job ${job.id} completed`);
});

purchaseOrderWorker.on('failed', (job, err) => {
  console.error(`PO job ${job?.id} failed:`, err);
});

export { purchaseOrderWorker };
