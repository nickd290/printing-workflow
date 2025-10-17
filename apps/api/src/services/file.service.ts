import { prisma, FileKind } from '@printing-workflow/db';
import { uploadFile, getSignedDownloadUrl, getPublicUrl } from '../lib/s3.js';

export async function createFile(data: {
  jobId?: string;
  kind: FileKind;
  file: Buffer;
  fileName: string;
  mimeType: string;
  uploadedBy?: string;
}) {
  // Upload to S3
  const uploadResult = await uploadFile({
    file: data.file,
    fileName: data.fileName,
    mimeType: data.mimeType,
    folder: data.kind.toLowerCase(),
  });

  // Create file record
  const fileRecord = await prisma.file.create({
    data: {
      jobId: data.jobId,
      kind: data.kind,
      objectKey: uploadResult.objectKey,
      fileName: data.fileName,
      mimeType: data.mimeType,
      size: uploadResult.size,
      checksum: uploadResult.checksum,
      uploadedBy: data.uploadedBy,
    },
  });

  return fileRecord;
}

export async function getFileById(id: string) {
  return prisma.file.findUnique({
    where: { id },
    include: {
      job: true,
    },
  });
}

export async function getFileDownloadUrl(id: string) {
  const file = await getFileById(id);
  if (!file) {
    throw new Error('File not found');
  }

  const signedUrl = await getSignedDownloadUrl(file.objectKey);
  return signedUrl;
}

export async function listFilesByJob(jobId: string) {
  return prisma.file.findMany({
    where: { jobId },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function listFiles(filters?: { kind?: FileKind; jobId?: string }) {
  return prisma.file.findMany({
    where: {
      kind: filters?.kind,
      jobId: filters?.jobId,
    },
    include: {
      job: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function deleteFile(id: string) {
  // Note: This only deletes the DB record, not the S3 object
  // In production, you might want to delete from S3 as well
  return prisma.file.delete({
    where: { id },
  });
}
