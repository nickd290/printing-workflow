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

export const fileRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/files/parse-po - Parse customer PO
  fastify.post('/parse-po', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();

    try {
      const parsed = await parseCustomerPO(buffer);
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
