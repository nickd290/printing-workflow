import { prisma } from '@printing-workflow/db';
import { queueEmail } from '../lib/queue.js';
import { emailTemplates } from '../lib/email.js';
import { env } from '../env.js';

/**
 * Send job ready for production notifications
 * Sends to both internal team and customer
 */
export async function sendJobReadyNotifications(job: {
  id: string;
  jobNo: string;
  customerPONumber?: string | null;
  customer: {
    name: string;
    email?: string | null;
  };
  deliveryDate?: Date | null;
  files: Array<{ kind: string }>;
}) {
  // Count files
  const artworkCount = job.files.filter((f) => f.kind === 'ARTWORK').length;
  const dataFileCount = job.files.filter((f) => f.kind === 'DATA_FILE').length;

  // Format delivery date if available
  const deliveryDateStr = job.deliveryDate
    ? new Date(job.deliveryDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : undefined;

  // 1. Send to internal team (production team email)
  const internalEmail = env.EMAIL_FROM || 'nick@jdgraphic.com';
  const internalTemplate = emailTemplates.jobReadyForProduction(
    job.jobNo,
    job.customer.name,
    artworkCount,
    dataFileCount,
    job.customerPONumber || undefined
  );

  await queueEmail({
    to: internalEmail,
    subject: internalTemplate.subject,
    html: internalTemplate.html,
  });

  // Log internal notification
  await prisma.notification.create({
    data: {
      jobId: job.id,
      recipient: internalEmail,
      subject: internalTemplate.subject,
      body: internalTemplate.html,
      type: 'JOB_READY_FOR_PRODUCTION',
      sentAt: new Date(),
    },
  });

  console.log(`✓ Sent job ready notification to internal team: ${job.jobNo}`);

  // 2. Send to customer (if email available)
  if (job.customer.email) {
    const customerTemplate = emailTemplates.jobSubmittedConfirmation(
      job.jobNo,
      job.customer.name,
      artworkCount,
      dataFileCount,
      deliveryDateStr
    );

    await queueEmail({
      to: job.customer.email,
      subject: customerTemplate.subject,
      html: customerTemplate.html,
    });

    // Log customer notification
    await prisma.notification.create({
      data: {
        jobId: job.id,
        recipient: job.customer.email,
        subject: customerTemplate.subject,
        body: customerTemplate.html,
        type: 'JOB_SUBMITTED_CONFIRMATION',
        sentAt: new Date(),
      },
    });

    console.log(`✓ Sent job submission confirmation to customer: ${job.customer.email}`);
  }

  // 3. Send to third-party vendor (if THIRD_PARTY_VENDOR routing)
  try {
    // Find PO for this job to check if it's a third-party vendor job
    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: {
        jobId: job.id,
        targetVendorId: {
          not: null, // Has a vendor (third-party routing)
        },
      },
      include: {
        targetVendor: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (purchaseOrder && purchaseOrder.targetVendor && purchaseOrder.targetVendor.email) {
      const vendorEmail = purchaseOrder.targetVendor.email;

      // Generate file share links for all job files
      const { createFileSharesForJob, getFileSharesForJob } = await import('../services/file-share.service.js');

      // Create file shares if they don't exist yet
      await createFileSharesForJob({
        jobId: job.id,
        createdFor: 'vendor',
        expirationDays: 7,
      });

      // Get file shares with URLs
      const fileShares = await getFileSharesForJob(job.id);
      const files = fileShares
        .filter(f => f.share && f.shareUrl) // Only files with active shares
        .map(f => ({
          fileName: f.fileName,
          kind: f.kind,
          shareUrl: f.shareUrl!,
        }));

      const vendorTemplate = emailTemplates.vendorJobReady({
        jobNo: job.jobNo,
        customerName: job.customer.name,
        vendorName: purchaseOrder.targetVendor.name,
        poNumber: purchaseOrder.poNumber,
        vendorAmount: parseFloat(purchaseOrder.vendorAmount || '0'),
        artworkCount,
        dataFileCount,
        deliveryDate: deliveryDateStr,
        files, // Include file download links
      });

      await queueEmail({
        to: vendorEmail,
        subject: vendorTemplate.subject,
        html: vendorTemplate.html,
      });

      // Log vendor notification
      await prisma.notification.create({
        data: {
          jobId: job.id,
          recipient: vendorEmail,
          subject: vendorTemplate.subject,
          body: vendorTemplate.html,
          type: 'VENDOR_JOB_READY',
          sentAt: new Date(),
        },
      });

      console.log(`✓ Sent vendor job ready notification to: ${vendorEmail} for job ${job.jobNo} with ${files.length} file links`);
    }
  } catch (vendorNotificationError) {
    console.error('❌ Failed to send vendor job ready notification:', vendorNotificationError);
    // Don't throw - this is a nice-to-have notification
  }
}

/**
 * Generic notification sender
 */
export async function sendNotification(params: {
  to: string;
  subject: string;
  html: string;
  type: string;
  jobId?: string;
}) {
  await queueEmail({
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  await prisma.notification.create({
    data: {
      jobId: params.jobId,
      recipient: params.to,
      subject: params.subject,
      body: params.html,
      type: params.type as any,
      sentAt: new Date(),
    },
  });

  console.log(`✓ Sent notification to ${params.to}: ${params.subject}`);
}
