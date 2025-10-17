import { prisma } from '@printing-workflow/db';
import { queueEmail } from '../lib/queue.js';
import { emailTemplates } from '../lib/email.js';

export async function scheduleShipment(data: {
  jobId: string;
  carrier: string;
  trackingNo?: string;
  weight?: number;
  boxes?: number;
  scheduledAt?: Date;
  recipients: Array<{
    companyId?: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone?: string;
  }>;
}) {
  const job = await prisma.job.findUnique({
    where: { id: data.jobId },
    include: {
      customer: true,
    },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  // Create shipment
  const shipment = await prisma.shipment.create({
    data: {
      jobId: data.jobId,
      carrier: data.carrier,
      trackingNo: data.trackingNo,
      weight: data.weight,
      boxes: data.boxes,
      scheduledAt: data.scheduledAt,
      recipients: {
        create: data.recipients,
      },
    },
    include: {
      recipients: true,
      job: {
        include: {
          customer: true,
        },
      },
    },
  });

  // Queue email notification
  const template = emailTemplates.shipmentScheduled(
    job.jobNo,
    data.carrier,
    data.trackingNo
  );

  await queueEmail({
    to: job.customer.email || '',
    subject: template.subject,
    html: template.html,
  });

  // Create notification record
  await prisma.notification.create({
    data: {
      type: 'SHIPMENT_SCHEDULED',
      jobId: job.id,
      recipient: job.customer.email || '',
      subject: template.subject,
      body: template.html,
    },
  });

  return shipment;
}

export async function updateShipmentTracking(
  shipmentId: string,
  trackingNo: string
) {
  return prisma.shipment.update({
    where: { id: shipmentId },
    data: { trackingNo },
  });
}

export async function markShipmentAsShipped(shipmentId: string) {
  return prisma.shipment.update({
    where: { id: shipmentId },
    data: { shippedAt: new Date() },
  });
}

export async function markShipmentAsDelivered(shipmentId: string) {
  return prisma.shipment.update({
    where: { id: shipmentId },
    data: { deliveredAt: new Date() },
  });
}

export async function getShipmentById(id: string) {
  return prisma.shipment.findUnique({
    where: { id },
    include: {
      job: {
        include: {
          customer: true,
        },
      },
      recipients: {
        include: {
          company: true,
        },
      },
    },
  });
}

export async function listShipmentsByJob(jobId: string) {
  return prisma.shipment.findMany({
    where: { jobId },
    include: {
      recipients: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function createSampleShipment(data: {
  description: string;
  carrier: string;
  trackingNo?: string;
  recipientEmail: string;
}) {
  return prisma.sampleShipment.create({
    data: {
      description: data.description,
      carrier: data.carrier,
      trackingNo: data.trackingNo,
      recipientEmail: data.recipientEmail,
    },
  });
}
