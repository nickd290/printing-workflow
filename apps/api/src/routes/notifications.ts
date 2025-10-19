import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@printing-workflow/db';
import { queueEmail } from '../lib/queue.js';
import { emailTemplates } from '../lib/email.js';

const notificationsRoutes: FastifyPluginAsync = async (server) => {
  // Send proof notification email
  server.post('/send-proof-notification', async (request, reply) => {
      const { proofId, customerEmail } = request.body as any;

      const proof = await prisma.proof.findUnique({
        where: { id: proofId },
        include: {
          job: true,
          file: true,
        },
      });

      if (!proof) {
        return reply.code(404).send({ error: 'Proof not found' });
      }

      const { subject, html } = emailTemplates.proofReady(
        proof.job.jobNo,
        proof.id,
        proof.version,
        customerEmail
      );

      // Queue email
      await queueEmail({
        to: customerEmail,
        subject,
        html,
      });

      // Log notification
      await prisma.notification.create({
        data: {
          recipient: customerEmail,
          subject,
          body: html,
          type: 'PROOF_READY',
        },
      });

      return { success: true, message: 'Proof notification sent' };
    }
  );

  // Send invoice notification email
  server.post('/send-invoice-notification', async (request, reply) => {
      const { invoiceId, customerEmail } = request.body as any;

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          job: true,
        },
      });

      if (!invoice) {
        return reply.code(404).send({ error: 'Invoice not found' });
      }

      const { subject, html } = emailTemplates.invoiceSent(
        invoice.invoiceNo,
        invoice.job.jobNo,
        Number(invoice.amount)
      );

      // Queue email with PDF attachment if available
      const attachments = invoice.pdfUrl
        ? [
            {
              filename: `${invoice.invoiceNo}.pdf`,
              content: Buffer.from(''), // TODO: Fetch from S3
            },
          ]
        : undefined;

      await queueEmail({
        to: customerEmail,
        subject,
        html,
        attachments,
      });

      // Log notification
      await prisma.notification.create({
        data: {
          recipient: customerEmail,
          subject,
          body: html,
          type: 'INVOICE_SENT',
        },
      });

      // Update invoice status to SENT
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'SENT' },
      });

      return { success: true, message: 'Invoice notification sent' };
    }
  );

  // Send job status update notification
  server.post('/send-status-notification', async (request, reply) => {
      const { jobId, customerEmail, status } = request.body as any;

      const job = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return reply.code(404).send({ error: 'Job not found' });
      }

      const subject = `Job ${job.jobNo} Status Update: ${status.replace(/_/g, ' ')}`;
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Job Status Update</h2>
          <p>Your job <strong>${job.jobNo}</strong> status has been updated.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>New Status:</strong> ${status.replace(/_/g, ' ')}</p>
          </div>
          <p>We'll keep you updated as your job progresses.</p>
        </div>
      `;

      await queueEmail({
        to: customerEmail,
        subject,
        html,
      });

      await prisma.notification.create({
        data: {
          recipient: customerEmail,
          subject,
          body: html,
          type: 'STATUS_UPDATE',
        },
      });

      return { success: true, message: 'Status notification sent' };
    }
  );

  // Get notification history
  server.get('/history', async (request, reply) => {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return { notifications };
  });

  // Resend notification
  server.post('/resend/:id', async (request, reply) => {
      const { id } = request.params as any;
      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return reply.code(404).send({ error: 'Notification not found' });
      }

      await queueEmail({
        to: notification.recipient,
        subject: notification.subject,
        html: notification.body,
      });

      await prisma.notification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() },
      });

      return { success: true, message: 'Notification resent' };
    }
  );
};

export default notificationsRoutes;
