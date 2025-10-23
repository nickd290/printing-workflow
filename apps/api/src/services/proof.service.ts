import { prisma, ProofStatus, JobStatus } from '@printing-workflow/db';
import { queueEmail } from '../lib/queue.js';
import { emailTemplates } from '../lib/email.js';
import { createInvoiceForJob } from './invoice.service.js';
import { randomUUID } from 'crypto';

export async function uploadProof(data: { jobId: string; fileId: string }) {
  const job = await prisma.job.findUnique({
    where: { id: data.jobId },
    include: {
      customer: true,
      proofs: {
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  // Calculate next version number
  const nextVersion = job.proofs.length > 0 ? job.proofs[0].version + 1 : 1;

  // Generate shareable link (UUID) and set expiration (7 days from now)
  const shareToken = randomUUID();
  const shareExpiresAt = new Date();
  shareExpiresAt.setDate(shareExpiresAt.getDate() + 7);

  // Create proof
  const proof = await prisma.proof.create({
    data: {
      jobId: data.jobId,
      fileId: data.fileId,
      version: nextVersion,
      status: ProofStatus.PENDING,
      shareToken,
      shareExpiresAt,
    },
    include: {
      job: {
        include: {
          customer: true,
        },
      },
      file: true,
    },
  });

  // Update job status
  await prisma.job.update({
    where: { id: data.jobId },
    data: { status: JobStatus.READY_FOR_PROOF },
  });

  // Queue email notification with shareable link
  const template = emailTemplates.proofReady(job.jobNo, proof.id, nextVersion, shareToken);

  await queueEmail({
    to: job.customer.email || '',
    subject: template.subject,
    html: template.html,
  });

  // Create notification record
  await prisma.notification.create({
    data: {
      type: 'PROOF_READY',
      jobId: job.id,
      recipient: job.customer.email || '',
      subject: template.subject,
      body: template.html,
    },
  });

  return proof;
}

export async function approveProof(data: {
  proofId: string;
  comments?: string;
  approvedBy?: string;
}) {
  // Create approval
  const approval = await prisma.proofApproval.create({
    data: {
      proofId: data.proofId,
      approved: true,
      comments: data.comments,
      approvedBy: data.approvedBy,
    },
  });

  // Update proof status
  const proof = await prisma.proof.update({
    where: { id: data.proofId },
    data: { status: ProofStatus.APPROVED },
    include: {
      job: {
        include: {
          customer: true,
        },
      },
    },
  });

  // Update job status
  await prisma.job.update({
    where: { id: proof.jobId },
    data: { status: JobStatus.PROOF_APPROVED },
  });

  // Queue email notification
  const template = emailTemplates.proofApproved(proof.job.jobNo, proof.version);

  await queueEmail({
    to: proof.job.customer.email || '',
    subject: template.subject,
    html: template.html,
  });

  // Create notification record
  await prisma.notification.create({
    data: {
      type: 'PROOF_APPROVED',
      jobId: proof.jobId,
      recipient: proof.job.customer.email || '',
      subject: template.subject,
      body: template.html,
    },
  });

  // AUTO-GENERATE INVOICE: When proof is approved, automatically generate invoice
  try {
    console.log(`🎯 Auto-generating invoice for job ${proof.job.jobNo} after proof approval...`);
    const invoice = await createInvoiceForJob({ jobId: proof.jobId });
    console.log(`✅ Auto-generated invoice ${invoice.invoiceNo} for job ${proof.job.jobNo}`);

    // Auto-send invoice email
    const invoiceTemplate = emailTemplates.invoiceSent(
      invoice.invoiceNo,
      proof.job.jobNo,
      Number(invoice.amount)
    );

    await queueEmail({
      to: proof.job.customer.email || '',
      subject: invoiceTemplate.subject,
      html: invoiceTemplate.html,
    });

    await prisma.notification.create({
      data: {
        type: 'INVOICE_SENT',
        jobId: proof.jobId,
        recipient: proof.job.customer.email || '',
        subject: invoiceTemplate.subject,
        body: invoiceTemplate.html,
      },
    });

    console.log(`📧 Invoice email queued for ${proof.job.customer.email}`);
  } catch (error) {
    console.error('Failed to auto-generate invoice:', error);
    // Don't fail the whole approval if invoice generation fails
  }

  return { proof, approval };
}

export async function requestProofChanges(data: {
  proofId: string;
  comments: string;
  approvedBy?: string;
}) {
  // Create approval with approved: false
  const approval = await prisma.proofApproval.create({
    data: {
      proofId: data.proofId,
      approved: false,
      comments: data.comments,
      approvedBy: data.approvedBy,
    },
  });

  // Update proof status
  const proof = await prisma.proof.update({
    where: { id: data.proofId },
    data: { status: ProofStatus.CHANGES_REQUESTED },
    include: {
      job: {
        include: {
          customer: true,
        },
      },
    },
  });

  // Update job status back to in_production
  await prisma.job.update({
    where: { id: proof.jobId },
    data: { status: JobStatus.IN_PRODUCTION },
  });

  return { proof, approval };
}

export async function getProofById(id: string) {
  return prisma.proof.findUnique({
    where: { id },
    include: {
      job: {
        include: {
          customer: true,
        },
      },
      file: true,
      approvals: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });
}

export async function listProofsByJob(jobId: string) {
  return prisma.proof.findMany({
    where: { jobId },
    include: {
      file: true,
      approvals: true,
    },
    orderBy: {
      version: 'desc',
    },
  });
}

/**
 * Get proof by shareable token (for public access)
 * Validates that the link hasn't expired
 */
export async function getProofByShareToken(token: string) {
  const proof = await prisma.proof.findUnique({
    where: { shareToken: token },
    include: {
      job: {
        include: {
          customer: true,
        },
      },
      file: true,
      approvals: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!proof) {
    throw new Error('Proof not found');
  }

  // Check if link has expired
  if (proof.shareExpiresAt && proof.shareExpiresAt < new Date()) {
    throw new Error('This proof link has expired');
  }

  return proof;
}

/**
 * Generate a new share link for an existing proof
 * Extends expiration by 7 days from now
 */
export async function generateShareLink(proofId: string) {
  const shareToken = randomUUID();
  const shareExpiresAt = new Date();
  shareExpiresAt.setDate(shareExpiresAt.getDate() + 7);

  const proof = await prisma.proof.update({
    where: { id: proofId },
    data: {
      shareToken,
      shareExpiresAt,
    },
    include: {
      job: true,
      file: true,
    },
  });

  return proof;
}
