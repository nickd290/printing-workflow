import { prisma, FileKind } from '@printing-workflow/db';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { env } from '../env.js';

/**
 * Calculate SHA-256 checksum for file integrity
 */
function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Generate unique filename with prefix
 */
function generateFileName(originalFileName: string, folder: string): string {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(8).toString('hex');
  const sanitizedName = originalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${folder}/${timestamp}-${hash}-${sanitizedName}`;
}

/**
 * Upload file to disk storage
 */
async function uploadFile(params: {
  file: Buffer;
  fileName: string;
  mimeType: string;
  folder: string;
}): Promise<{
  objectKey: string;
  checksum: string;
  size: number;
}> {
  const { file, fileName, folder } = params;

  const uploadDir = env.UPLOAD_DIR || './uploads';
  const folderPath = path.join(uploadDir, folder);

  // Create folder if it doesn't exist
  await fs.mkdir(folderPath, { recursive: true });

  // Generate unique filename
  const objectKey = generateFileName(fileName, folder);
  const filePath = path.join(uploadDir, objectKey);

  // Calculate checksum
  const checksum = calculateChecksum(file);

  // Write file to disk
  await fs.writeFile(filePath, file);

  console.log(`✅ File uploaded to disk: ${objectKey}`);

  return {
    objectKey,
    checksum,
    size: file.length,
  };
}

export async function createFile(data: {
  jobId?: string;
  kind: FileKind;
  file: Buffer;
  fileName: string;
  mimeType: string;
  uploadedBy?: string;
}) {
  // Determine folder based on file kind
  const folderMap: Record<FileKind, string> = {
    ARTWORK: 'artwork',
    PROOF: 'proofs',
    INVOICE: 'invoices',
    PO_PDF: 'pos',
    DATA_FILE: 'data_files',
  };

  const folder = folderMap[data.kind] || 'uploads';

  // Upload to disk
  const uploadResult = await uploadFile({
    file: data.file,
    fileName: data.fileName,
    mimeType: data.mimeType,
    folder,
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

  // Return API endpoint for download
  return `${env.API_URL}/api/files/${id}/download`;
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
  const file = await getFileById(id);
  if (!file) {
    throw new Error('File not found');
  }

  // Delete physical file from disk
  const uploadDir = env.UPLOAD_DIR || './uploads';
  const filePath = path.join(uploadDir, file.objectKey);

  try {
    await fs.unlink(filePath);
    console.log(`🗑️  File deleted from disk: ${file.objectKey}`);
  } catch (error) {
    console.error(`Failed to delete file from disk: ${file.objectKey}`, error);
    // Continue with database deletion even if disk deletion fails
  }

  // Delete database record
  return prisma.file.delete({
    where: { id },
  });
}

/**
 * Get file buffer from disk (for downloading)
 */
export async function getFileBuffer(id: string): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}> {
  const file = await getFileById(id);
  if (!file) {
    throw new Error('File not found');
  }

  const uploadDir = env.UPLOAD_DIR || './uploads';
  const filePath = path.join(uploadDir, file.objectKey);

  // Read file from disk
  const buffer = await fs.readFile(filePath);

  return {
    buffer,
    fileName: file.fileName,
    mimeType: file.mimeType,
  };
}
