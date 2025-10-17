import { prisma, ProofStatus, JobStatus } from '@printing-workflow/db';
import { queueEmail } from '../lib/queue.js';
import { emailTemplates } from '../lib/email.js';

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

  // Create proof
  const proof = await prisma.proof.create({
    data: {
      jobId: data.jobId,
      fileId: data.fileId,
      version: nextVersion,
      status: ProofStatus.PENDING,
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

  // Queue email notification
  const template = emailTemplates.proofReady(job.jobNo, proof.id, nextVersion);

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
