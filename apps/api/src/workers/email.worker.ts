import { Worker, Job } from 'bullmq';
import { connection, SendEmailJob } from '../lib/queue.js';
import { sendEmail } from '../lib/email.js';
import { QUEUE_NAMES } from '@printing-workflow/shared';
import { prisma } from '@printing-workflow/db';

const emailWorker = new Worker(
  QUEUE_NAMES.EMAIL,
  async (job: Job<SendEmailJob>) => {
    const { to, subject, html, attachments } = job.data;

    console.log(`Sending email to ${to}: ${subject}`);

    try {
      const result = await sendEmail({ to, subject, html, attachments });

      // Log notification as sent
      await prisma.notification.updateMany({
        where: {
          recipient: to,
          subject,
          sentAt: null,
        },
        data: {
          sentAt: new Date(),
        },
      });

      console.log(`Email sent successfully to ${to}`);
      return result;
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  },
  { connection }
);

emailWorker.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Email job ${job?.id} failed:`, err);
});

export { emailWorker };
