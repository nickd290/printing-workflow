/**
 * Production Email Queue with BullMQ + Redis
 *
 * This file replaces the simple synchronous queue.ts with a production-ready
 * implementation using BullMQ and Redis.
 *
 * Benefits:
 * - Asynchronous processing (doesn't block API responses)
 * - Automatic retries (3 attempts with exponential backoff)
 * - Persistence (emails won't be lost if server crashes)
 * - Monitoring (via BullMQ UI or Redis CLI)
 * - Scalability (can add more workers)
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../env.js';
import { sendEmail } from './email.js';
import { COMPANY_IDS } from '@printing-workflow/shared';

// Redis connection configuration
const redisConnection = env.REDIS_URL
  ? new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    })
  : null;

// Job data types (same as before)
export interface SendEmailJob {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
}

export interface GenerateInvoicePdfJob {
  invoiceId: string;
}

export interface CreateAutoPOJob {
  jobId: string;
  customerTotal: number;
  bradfordTotal: number;
  jdTotal: number;
}

// Create queues
export const emailQueue = redisConnection
  ? new Queue<SendEmailJob>('email', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds, then 4s, 8s
        },
        removeOnComplete: {
          count: 1000, // Keep last 1000 completed jobs
          age: 24 * 3600, // Keep for 24 hours
        },
        removeOnFail: {
          count: 5000, // Keep last 5000 failed jobs for debugging
        },
      },
    })
  : null;

export const autoPOQueue = redisConnection
  ? new Queue<CreateAutoPOJob>('auto-po', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    })
  : null;

// Queue functions
export async function queueEmail(data: SendEmailJob) {
  if (!emailQueue) {
    console.warn('⚠️  Redis not configured - falling back to console logging');
    console.log(`[Email Queue] To: ${data.to}, Subject: ${data.subject}`);
    console.log(`[Email Queue] Body: ${data.html.substring(0, 200)}...`);
    return Promise.resolve();
  }

  try {
    const job = await emailQueue.add('send-email', data);
    console.log(`✅ Email queued: ${job.id} - To: ${data.to}`);
    return job;
  } catch (error) {
    console.error('❌ Failed to queue email:', error);
    throw error;
  }
}

export async function queueInvoicePdfGeneration(data: GenerateInvoicePdfJob) {
  console.log(`[PDF Queue] Generating invoice PDF for: ${data.invoiceId}`);
  // PDF generation happens inline when needed (can be queued if needed)
  return Promise.resolve();
}

export async function queueAutoPOCreation(data: CreateAutoPOJob) {
  if (!autoPOQueue) {
    console.warn('⚠️  Redis not configured - running PO creation synchronously');
    return runAutoPOCreation(data);
  }

  try {
    const job = await autoPOQueue.add('create-auto-po', data);
    console.log(`✅ Auto-PO creation queued: ${job.id} - Job: ${data.jobId}`);
    return job;
  } catch (error) {
    console.error('❌ Failed to queue auto-PO creation:', error);
    // Fallback to synchronous if queue fails
    return runAutoPOCreation(data);
  }
}

// Worker functions
async function processEmailJob(job: Job<SendEmailJob>) {
  const { to, subject, html, attachments } = job.data;

  job.log(`Processing email to ${to}`);

  try {
    await sendEmail({ to, subject, html, attachments });
    job.log(`✅ Email sent successfully to ${to}`);
    return { success: true, to };
  } catch (error: any) {
    job.log(`❌ Failed to send email: ${error.message}`);
    throw error; // BullMQ will retry automatically
  }
}

async function processAutoPOJob(job: Job<CreateAutoPOJob>) {
  job.log(`Creating auto-POs for job ${job.data.jobId}`);
  return runAutoPOCreation(job.data);
}

// Sync function for auto-PO creation (used by both queue and fallback)
async function runAutoPOCreation(data: CreateAutoPOJob) {
  console.log(`[PO Queue] Creating auto-POs for job: ${data.jobId}`);
  console.log(`[PO Queue]   Customer Total: $${data.customerTotal}`);
  console.log(`[PO Queue]   Bradford Total: $${data.bradfordTotal}`);
  console.log(`[PO Queue]   JD Total: $${data.jdTotal}`);

  try {
    const { createAutoPurchaseOrder } = await import(
      '../services/purchase-order.service.js'
    );

    // PO #1: Impact Direct → Bradford
    await createAutoPurchaseOrder({
      jobId: data.jobId,
      originCompanyId: COMPANY_IDS.IMPACT_DIRECT,
      targetCompanyId: COMPANY_IDS.BRADFORD,
      originalAmount: data.customerTotal,
      vendorAmount: data.bradfordTotal,
    });

    // PO #2: Bradford → JD Graphic
    await createAutoPurchaseOrder({
      jobId: data.jobId,
      originCompanyId: COMPANY_IDS.BRADFORD,
      targetCompanyId: COMPANY_IDS.JD_GRAPHIC,
      originalAmount: data.bradfordTotal,
      vendorAmount: data.jdTotal,
    });

    console.log(
      `[PO Queue] ✅ Auto-POs created successfully (Impact→Bradford, Bradford→JD)`
    );
    return { success: true };
  } catch (error) {
    console.error(`[PO Queue] ❌ Failed to create auto-POs:`, error);
    throw error;
  }
}

// Start workers (call this from your main server file)
export function startWorkers() {
  if (!redisConnection) {
    console.log('⚠️  Redis not configured - workers will not start');
    console.log('   Email and PO processing will run synchronously');
    return null;
  }

  console.log('🚀 Starting BullMQ workers...');

  // Email worker
  const emailWorker = new Worker<SendEmailJob>(
    'email',
    processEmailJob,
    {
      connection: redisConnection,
      concurrency: 5, // Process 5 emails simultaneously
    }
  );

  emailWorker.on('completed', (job) => {
    console.log(`✅ Email worker completed job ${job.id}`);
  });

  emailWorker.on('failed', (job, err) => {
    console.error(`❌ Email worker failed job ${job?.id}:`, err.message);
  });

  // Auto-PO worker
  const autoPOWorker = new Worker<CreateAutoPOJob>(
    'auto-po',
    processAutoPOJob,
    {
      connection: redisConnection,
      concurrency: 3, // Process 3 PO creations simultaneously
    }
  );

  autoPOWorker.on('completed', (job) => {
    console.log(`✅ Auto-PO worker completed job ${job.id}`);
  });

  autoPOWorker.on('failed', (job, err) => {
    console.error(`❌ Auto-PO worker failed job ${job?.id}:`, err.message);
  });

  console.log('✅ BullMQ workers started successfully');
  console.log('   - Email worker (concurrency: 5)');
  console.log('   - Auto-PO worker (concurrency: 3)');

  return { emailWorker, autoPOWorker };
}

// Graceful shutdown
export async function shutdownWorkers(workers: any) {
  if (!workers) return;

  console.log('🛑 Shutting down workers...');
  await workers.emailWorker?.close();
  await workers.autoPOWorker?.close();
  await emailQueue?.close();
  await autoPOQueue?.close();
  await redisConnection?.quit();
  console.log('✅ Workers shut down successfully');
}

// Export connection for health checks
export const connection = redisConnection;
