import { FastifyPluginAsync } from 'fastify';
import { FileKind } from '@printing-workflow/db';
import {
  createFile,
  getFileById,
  getFileDownloadUrl,
  getFileBuffer,
  listFiles,
  listFilesByJob,
  deleteFile,
} from '../services/file.service.js';
import { parseCustomerPO } from '../services/pdf-parser.service.js';
import {
  getFileByShareToken,
  trackFileDownload,
} from '../services/file-share.service.js';

export const fileRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/files/parse-po - Parse customer PO (supports PDF and images)
  fastify.post('/parse-po', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      return reply.status(400).send({
        success: false,
        error: 'File too large',
        message: 'Maximum file size is 10MB. Please upload a smaller file.'
      });
    }

    console.log('📄 Parsing PO file:', data.filename, '(', buffer.length, 'bytes )');

    try {
      const parsed = await parseCustomerPO(buffer, data.filename);
      console.log('✅ Parsed customer PO successfully:');
      console.log('  - description:', parsed.description);
      console.log('  - paper:', parsed.paper);
      console.log('  - flatSize:', parsed.flatSize);
      console.log('  - foldedSize:', parsed.foldedSize);
      console.log('  - colors:', parsed.colors);
      console.log('  - finishing:', parsed.finishing);
      console.log('  - total:', parsed.total);
      console.log('  - poNumber:', parsed.poNumber);
      console.log('  - deliveryDate:', parsed.deliveryDate);
      console.log('  - samples:', parsed.samples);
      return { success: true, parsed };
    } catch (error: any) {
      console.error('❌ Error parsing PO:', error);

      // Provide helpful error messages based on error type
      if (error.message.includes('Unsupported file format')) {
        return reply.status(400).send({
          success: false,
          error: 'Unsupported file format',
          message: 'Please upload a PDF or image file (PNG, JPG).'
        });
      }

      if (error.message.includes('OpenAI API key')) {
        return reply.status(500).send({
          success: false,
          error: 'OCR service unavailable',
          message: 'Image OCR requires OpenAI API configuration. Please contact support.'
        });
      }

      if (error.message.includes('OCR returned empty text')) {
        return reply.status(400).send({
          success: false,
          error: 'Unreadable file',
          message: 'Could not extract text from the image. The image may be blank, corrupted, or of poor quality. Please try a clearer image or PDF.'
        });
      }

      if (error.message.includes('Failed to extract text')) {
        return reply.status(400).send({
          success: false,
          error: 'Extraction failed',
          message: 'Could not extract text from the file. Please ensure the file is a valid PDF or image.'
        });
      }

      // Generic error
      return reply.status(400).send({
        success: false,
        error: 'Failed to parse PO',
        message: error.message
      });
    }
  });

  // POST /api/files/upload - Upload file
  fastify.post('/upload', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();
    const fields = data.fields as any;

    // Extract values from multipart field objects
    const jobId = fields?.jobId?.value;
    const kind = fields?.kind?.value as FileKind;
    const uploadedBy = fields?.uploadedBy?.value;

    const file = await createFile({
      jobId,
      kind,
      file: buffer,
      fileName: data.filename,
      mimeType: data.mimetype,
      uploadedBy,
    });

    return { success: true, file };
  });

  // GET /api/files/:id - Get file metadata
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const file = await getFileById(id);

    if (!file) {
      return reply.status(404).send({ error: 'File not found' });
    }

    return file;
  });

  // GET /api/files/:id/download-url - Get download URL
  fastify.get('/:id/download-url', async (request, reply) => {
    const { id } = request.params as { id: string };
    const url = await getFileDownloadUrl(id);
    return { url };
  });

  // GET /api/files - List files
  fastify.get('/', async (request, reply) => {
    const { kind, jobId } = request.query as {
      kind?: FileKind;
      jobId?: string;
    };

    const files = await listFiles({ kind, jobId });
    return { files };
  });

  // GET /api/files/by-job/:jobId - List files for a job
  fastify.get('/by-job/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const files = await listFilesByJob(jobId);
    return { files };
  });

  // GET /api/files/:id/download - Download file
  fastify.get('/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const { buffer, fileName, mimeType } = await getFileBuffer(id);

      reply.header('Content-Type', mimeType);
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Length', buffer.length.toString());

      return reply.send(buffer);
    } catch (error: any) {
      if (error.message === 'File not found') {
        return reply.status(404).send({ error: 'File not found' });
      }
      return reply.status(500).send({ error: 'Failed to download file' });
    }
  });

  // GET /api/files/share/:shareToken/download - Public file download via share token
  // This endpoint is PUBLIC - no authentication required
  fastify.get('/share/:shareToken/download', async (request, reply) => {
    const { shareToken } = request.params as { shareToken: string };

    try {
      // Validate token and check expiration
      const fileShare = await getFileByShareToken(shareToken);

      if (!fileShare || !fileShare.file) {
        return reply.status(404).send({
          error: 'File not found or link has expired',
        });
      }

      // Get file buffer
      const { buffer, fileName, mimeType } = await getFileBuffer(fileShare.file.id);

      // Track download
      await trackFileDownload(shareToken);

      // Set headers
      reply.header('Content-Type', mimeType);
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Length', buffer.length.toString());

      console.log(`✅ Public file download: ${fileName} via share token ${shareToken}`);

      return reply.send(buffer);
    } catch (error: any) {
      console.error('❌ Error downloading file via share token:', error);

      if (error.message === 'Share link not found') {
        return reply.status(404).send({ error: 'Share link not found' });
      }

      if (error.message === 'Share link has expired') {
        return reply.status(410).send({
          error: 'Share link has expired',
          message: 'This download link has expired. Please contact the sender for a new link.',
        });
      }

      if (error.message === 'File not found') {
        return reply.status(404).send({ error: 'File not found' });
      }

      return reply.status(500).send({ error: 'Failed to download file' });
    }
  });

  // DELETE /api/files/:id - Delete file
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await deleteFile(id);
      return { success: true, message: 'File deleted successfully' };
    } catch (error: any) {
      if (error.message === 'File not found') {
        return reply.status(404).send({ error: 'File not found' });
      }
      return reply.status(500).send({ error: 'Failed to delete file' });
    }
  });
};
