import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Check if S3 is configured
const isS3Configured = !!(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);

export const s3Client = isS3Configured
  ? new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true, // Required for MinIO
    })
  : null;

export interface UploadFileParams {
  file: Buffer;
  fileName: string;
  mimeType: string;
  folder?: string;
}

export interface UploadFileResult {
  objectKey: string;
  checksum: string;
  size: number;
}

export async function uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
  const { file, fileName, mimeType, folder = 'uploads' } = params;

  // Generate checksum
  const checksum = crypto.createHash('sha256').update(file).digest('hex');

  // Generate unique object key
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(8).toString('hex');
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const objectKey = `${folder}/${timestamp}-${randomStr}-${sanitizedFileName}`;

  if (isS3Configured && s3Client) {
    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: objectKey,
      Body: file,
      ContentType: mimeType,
    });

    await s3Client.send(command);
  } else {
    // Fall back to local filesystem
    const uploadsDir = path.join(process.cwd(), '../../uploads');
    const folderPath = path.join(uploadsDir, folder);

    // Create directory if it doesn't exist
    await fs.mkdir(folderPath, { recursive: true });

    // Write file
    const filePath = path.join(uploadsDir, objectKey);
    await fs.writeFile(filePath, file);
  }

  return {
    objectKey,
    checksum,
    size: file.length,
  };
}

export async function getSignedDownloadUrl(objectKey: string, expiresIn = 3600): Promise<string> {
  if (isS3Configured && s3Client) {
    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: objectKey,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  } else {
    // For local filesystem, return a local URL
    return `${env.API_URL}/api/files/download/${encodeURIComponent(objectKey)}`;
  }
}

export function getPublicUrl(objectKey: string): string {
  if (isS3Configured) {
    return `${env.S3_PUBLIC_URL}/${env.S3_BUCKET}/${objectKey}`;
  } else {
    return `${env.API_URL}/api/files/download/${encodeURIComponent(objectKey)}`;
  }
}
