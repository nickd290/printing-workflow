/**
 * File Storage Service - AWS S3 Compatible
 *
 * Supports:
 * - AWS S3 (production)
 * - MinIO (local development)
 * - DigitalOcean Spaces
 * - Any S3-compatible storage
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { env } from '../env.js';

// Initialize S3 client
const s3Client = env.S3_ENDPOINT
  ? new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: true, // Required for MinIO
    })
  : null;

const bucket = env.S3_BUCKET || 'printing-files';

/**
 * Check if S3 is configured
 */
export function isStorageConfigured(): boolean {
  return s3Client !== null && !!env.S3_ACCESS_KEY_ID;
}

/**
 * Generate unique object key with prefix
 */
function generateObjectKey(fileName: string, prefix: string): string {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(8).toString('hex');
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${prefix}/${timestamp}-${hash}-${sanitizedName}`;
}

/**
 * Calculate SHA-256 checksum for file integrity
 */
export function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Upload file to S3
 */
export async function uploadFile(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  prefix: 'proofs' | 'invoices' | 'artwork' | 'pos';
}): Promise<{
  objectKey: string;
  url: string;
  size: number;
  checksum: string;
}> {
  if (!isStorageConfigured()) {
    throw new Error('S3 storage is not configured. Set S3_* environment variables.');
  }

  const { buffer, fileName, mimeType, prefix } = params;
  const objectKey = generateObjectKey(fileName, prefix);
  const checksum = calculateChecksum(buffer);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      'original-filename': fileName,
      'checksum-sha256': checksum,
      'uploaded-at': new Date().toISOString(),
    },
  });

  await s3Client!.send(command);

  const url = env.S3_PUBLIC_URL
    ? `${env.S3_PUBLIC_URL}/${bucket}/${objectKey}`
    : `https://${bucket}.s3.${env.S3_REGION}.amazonaws.com/${objectKey}`;

  console.log(`✅ File uploaded to S3: ${objectKey}`);

  return {
    objectKey,
    url,
    size: buffer.length,
    checksum,
  };
}

/**
 * Generate signed URL for secure file access (expires in 24 hours)
 */
export async function getSignedDownloadUrl(
  objectKey: string,
  expiresIn: number = 86400 // 24 hours
): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error('S3 storage is not configured');
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  });

  const url = await getSignedUrl(s3Client!, command, { expiresIn });
  return url;
}

/**
 * Download file from S3
 */
export async function downloadFile(objectKey: string): Promise<{
  buffer: Buffer;
  contentType: string;
  metadata: Record<string, string>;
}> {
  if (!isStorageConfigured()) {
    throw new Error('S3 storage is not configured');
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  });

  const response = await s3Client!.send(command);

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  return {
    buffer,
    contentType: response.ContentType || 'application/octet-stream',
    metadata: response.Metadata || {},
  };
}

/**
 * Delete file from S3
 */
export async function deleteFile(objectKey: string): Promise<void> {
  if (!isStorageConfigured()) {
    throw new Error('S3 storage is not configured');
  }

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  });

  await s3Client!.send(command);
  console.log(`🗑️  File deleted from S3: ${objectKey}`);
}

/**
 * Check if file exists in S3
 */
export async function fileExists(objectKey: string): Promise<boolean> {
  if (!isStorageConfigured()) {
    return false;
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    });

    await s3Client!.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Verify file integrity using checksum
 */
export async function verifyFileIntegrity(
  objectKey: string,
  expectedChecksum: string
): Promise<boolean> {
  const { buffer, metadata } = await downloadFile(objectKey);

  const storedChecksum = metadata['checksum-sha256'];
  const calculatedChecksum = calculateChecksum(buffer);

  // Check against both stored and expected checksums
  return (
    calculatedChecksum === expectedChecksum ||
    (storedChecksum && storedChecksum === expectedChecksum)
  );
}

/**
 * Upload multiple files (batch)
 */
export async function uploadFiles(
  files: Array<{
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    prefix: 'proofs' | 'invoices' | 'artwork' | 'pos';
  }>
): Promise<
  Array<{
    objectKey: string;
    url: string;
    size: number;
    checksum: string;
  }>
> {
  const uploadPromises = files.map((file) => uploadFile(file));
  return Promise.all(uploadPromises);
}
