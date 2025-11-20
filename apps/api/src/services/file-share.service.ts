import { prisma } from '@printing-workflow/db';
import crypto from 'crypto';
import { env } from '../env.js';

/**
 * Generate a secure share token (UUID v4)
 */
function generateShareToken(): string {
  return crypto.randomUUID();
}

/**
 * Calculate expiration date (7 days from now)
 */
function getExpirationDate(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
  return expiresAt;
}

/**
 * Create a file share link for a single file
 */
export async function createFileShare(params: {
  fileId: string;
  createdFor?: string; // e.g., "vendor", "customer", "proof"
  createdBy?: string; // User ID who created the share
  expirationDays?: number; // Override default 7 days
}) {
  const { fileId, createdFor, createdBy, expirationDays = 7 } = params;

  // Check if file exists
  const file = await prisma.file.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    throw new Error('File not found');
  }

  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expirationDays);

  // Create file share
  const fileShare = await prisma.fileShare.create({
    data: {
      fileId,
      shareToken: generateShareToken(),
      expiresAt,
      createdFor,
      createdBy,
    },
  });

  // Generate public URL
  const shareUrl = `${env.API_URL || 'http://localhost:3001'}/api/share/files/${fileShare.shareToken}/download`;

  console.log(`✅ Created file share for ${file.fileName}: ${shareUrl} (expires ${expiresAt.toLocaleString()})`);

  return {
    ...fileShare,
    shareUrl,
    fileName: file.fileName,
  };
}

/**
 * Create file shares for all files in a job
 * Returns array of file shares with URLs
 */
export async function createFileSharesForJob(params: {
  jobId: string;
  createdFor?: string;
  createdBy?: string;
  expirationDays?: number;
}) {
  const { jobId, createdFor, createdBy, expirationDays } = params;

  // Get all files for this job
  const files = await prisma.file.findMany({
    where: {
      jobId,
      kind: {
        in: ['ARTWORK', 'DATA_FILE'], // Only share artwork and data files
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (files.length === 0) {
    console.warn(`⚠️ No files found for job ${jobId}`);
    return [];
  }

  console.log(`📁 Creating file shares for ${files.length} files in job ${jobId}`);

  // Create shares for all files
  const fileShares = await Promise.all(
    files.map((file) =>
      createFileShare({
        fileId: file.id,
        createdFor,
        createdBy,
        expirationDays,
      })
    )
  );

  return fileShares;
}

/**
 * Get file by share token (validate token and expiration)
 */
export async function getFileByShareToken(shareToken: string) {
  const fileShare = await prisma.fileShare.findUnique({
    where: { shareToken },
    include: {
      file: true,
    },
  });

  if (!fileShare) {
    throw new Error('Share link not found');
  }

  // Check if expired
  if (new Date() > fileShare.expiresAt) {
    throw new Error('Share link has expired');
  }

  return fileShare;
}

/**
 * Track file download (increment access count)
 */
export async function trackFileDownload(shareToken: string) {
  await prisma.fileShare.update({
    where: { shareToken },
    data: {
      accessedAt: new Date(),
      accessCount: {
        increment: 1,
      },
    },
  });

  console.log(`📥 File downloaded via share token ${shareToken}`);
}

/**
 * Delete expired file shares (cleanup utility)
 */
export async function cleanupExpiredShares() {
  const result = await prisma.fileShare.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  console.log(`🗑️  Deleted ${result.count} expired file shares`);
  return result.count;
}

/**
 * Get all file shares for a job
 */
export async function getFileSharesForJob(jobId: string) {
  const files = await prisma.file.findMany({
    where: { jobId },
    include: {
      fileShares: {
        where: {
          expiresAt: {
            gt: new Date(), // Only non-expired shares
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1, // Get most recent share per file
      },
    },
  });

  return files.map((file) => ({
    fileId: file.id,
    fileName: file.fileName,
    kind: file.kind,
    share: file.fileShares[0] || null,
    shareUrl: file.fileShares[0]
      ? `${env.API_URL || 'http://localhost:3001'}/api/share/files/${file.fileShares[0].shareToken}/download`
      : null,
  }));
}
