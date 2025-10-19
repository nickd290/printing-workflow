/**
 * Unit tests for webhook.service.ts
 * Tests email validation, PDF parsing, PO creation, and error handling
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { processInboundEmail } from '../services/webhook.service.js';
import { prisma } from '@printing-workflow/db';
import type { FastifyRequest } from 'fastify';

// Mock dependencies
vi.mock('../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logSecurityEvent: vi.fn(),
  logBusinessEvent: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../services/pdf-parser.service.js', () => ({
  parseBradfordPO: vi.fn(),
}));

vi.mock('../services/purchase-order.service.js', () => ({
  createPOFromWebhook: vi.fn(),
  findPOByExternalRef: vi.fn(),
}));

import { parseBradfordPO } from '../services/pdf-parser.service.js';
import { createPOFromWebhook, findPOByExternalRef } from '../services/purchase-order.service.js';

// Mock Fastify request
function createMockRequest(attachments: Array<{ filename: string; buffer: Buffer; mimetype: string }>): FastifyRequest {
  return {
    parts: async function* () {
      for (const attachment of attachments) {
        yield {
          type: 'file' as const,
          filename: attachment.filename,
          mimetype: attachment.mimetype,
          toBuffer: async () => attachment.buffer,
        };
      }
    },
  } as any;
}

describe('webhook.service - processInboundEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.webhookEvent.deleteMany({
      where: {
        payload: {
          path: ['subject'],
          string_contains: 'TEST',
        },
      },
    });
  });

  describe('Email Sender Validation', () => {
    test('should reject emails not from Bradford', async () => {
      const result = await processInboundEmail({
        from: 'attacker@evil.com',
        subject: 'JJSG Order',
        text: '',
        request: createMockRequest([]),
      });

      expect(result.action).toBe('ignored');
      expect(result.reason).toContain('Bradford');
    });

    test('should reject spoofed emails with Bradford in name', async () => {
      const result = await processInboundEmail({
        from: 'Fake Steve <attacker@evil.com> steve.gustafson@bgeltd.com',
        subject: 'JJSG Order',
        text: '',
        request: createMockRequest([]),
      });

      expect(result.action).toBe('ignored');
      expect(result.reason).toContain('Bradford');
    });

    test('should accept valid Bradford email', async () => {
      const result = await processInboundEmail({
        from: 'steve.gustafson@bgeltd.com',
        subject: 'Random Email',
        text: '',
        request: createMockRequest([]),
      });

      // Should pass email validation but fail on customer code
      expect(result.reason).not.toContain('Bradford');
    });

    test('should accept Bradford email with display name', async () => {
      const result = await processInboundEmail({
        from: 'Steve Gustafson <steve.gustafson@bgeltd.com>',
        subject: 'Random Email',
        text: '',
        request: createMockRequest([]),
      });

      // Should pass email validation but fail on customer code
      expect(result.reason).not.toContain('Bradford');
    });
  });

  describe('Customer Code Validation', () => {
    test('should reject emails without customer code', async () => {
      const result = await processInboundEmail({
        from: 'steve.gustafson@bgeltd.com',
        subject: 'Random Email Without Code',
        text: '',
        request: createMockRequest([]),
      });

      expect(result.action).toBe('ignored');
      expect(result.reason).toContain('customer code');
    });

    test('should accept email with JJSG in subject', async () => {
      const result = await processInboundEmail({
        from: 'steve.gustafson@bgeltd.com',
        subject: 'JJSG Order 12345',
        text: '',
        request: createMockRequest([]),
      });

      // Should pass customer code check but fail on no attachments
      expect(result.reason).not.toContain('customer code');
    });

    test('should accept email with BALSG in subject', async () => {
      const result = await processInboundEmail({
        from: 'steve.gustafson@bgeltd.com',
        subject: 'BALSG Order 67890',
        text: '',
        request: createMockRequest([]),
      });

      // Should pass customer code check but fail on no attachments
      expect(result.reason).not.toContain('customer code');
    });

    test('should accept customer code case-insensitive', async () => {
      const result = await processInboundEmail({
        from: 'steve.gustafson@bgeltd.com',
        subject: 'jjsg order (lowercase)',
        text: '',
        request: createMockRequest([]),
      });

      // Should pass customer code check
      expect(result.reason).not.toContain('customer code');
    });
  });

  describe('PDF Attachment Validation', () => {
    test('should reject emails without PDF attachments', async () => {
      const result = await processInboundEmail({
        from: 'steve.gustafson@bgeltd.com',
        subject: 'JJSG Order',
        text: '',
        request: createMockRequest([]),
      });

      expect(result.action).toBe('ignored');
      expect(result.reason).toContain('PDF attachments');
    });

    test('should ignore non-PDF attachments', async () => {
      const result = await processInboundEmail({
        from: 'steve.gustafson@bgeltd.com',
        subject: 'JJSG Order',
        text: '',
        request: createMockRequest([
          {
            filename: 'document.docx',
            buffer: Buffer.from('fake docx'),
            mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        ]),
      });

      expect(result.action).toBe('ignored');
      expect(result.reason).toContain('PDF attachments');
    });

    test('should process email with valid PDF attachment', async () => {
      // Mock PDF parsing to succeed
      vi.mocked(parseBradfordPO).mockResolvedValue({
        customerCode: 'JJSG',
        customerId: 'jjsa',
        amount: 1234.56,
        poNumber: '12345',
        description: 'Test PO',
        rawText: 'PDF content',
      });

      // Mock no existing PO
      vi.mocked(findPOByExternalRef).mockResolvedValue(null);

      // Mock PO creation
      vi.mocked(createPOFromWebhook).mockResolvedValue({
        id: 'test-po-id',
        externalRef: 'Bradford-JJSG-12345',
      } as any);

      const result = await processInboundEmail({
        from: 'steve.gustafson@bgeltd.com',
        subject: 'JJSG Order 12345',
        text: '',
        request: createMockRequest([
          {
            filename: 'po.pdf',
            buffer: Buffer.from('fake pdf'),
            mimetype: 'application/pdf',
          },
        ]),
      });

      expect(result.action).toBe('created');
      expect(parseBradfordPO).toHaveBeenCalled();
    });
  });

  describe('PDF Parsing', () => {
    test('should handle PDF parsing errors', async () => {
      vi.mocked(parseBradfordPO).mockRejectedValue(new Error('PDF corrupt'));

      await expect(
        processInboundEmail({
          from: 'steve.gustafson@bgeltd.com',
          subject: 'JJSG Order',
          text: '',
          request: createMockRequest([
            {
              filename: 'corrupt.pdf',
              buffer: Buffer.from('corrupt'),
              mimetype: 'application/pdf',
            },
          ]),
        })
      ).rejects.toThrow('PDF corrupt');
    });

    test('should reject PDF with missing customer code', async () => {
      vi.mocked(parseBradfordPO).mockResolvedValue({
        customerCode: '',
        customerId: '',
        amount: 1234.56,
        poNumber: '12345',
        description: 'Test PO',
        rawText: 'PDF content',
      });

      await expect(
        processInboundEmail({
          from: 'steve.gustafson@bgeltd.com',
          subject: 'JJSG Order',
          text: '',
          request: createMockRequest([
            {
              filename: 'po.pdf',
              buffer: Buffer.from('fake pdf'),
              mimetype: 'application/pdf',
            },
          ]),
        })
      ).rejects.toThrow('missing customer information');
    });

    test('should reject PDF with invalid amount', async () => {
      vi.mocked(parseBradfordPO).mockResolvedValue({
        customerCode: 'JJSG',
        customerId: 'jjsa',
        amount: 0,
        poNumber: '12345',
        description: 'Test PO',
        rawText: 'PDF content',
      });

      await expect(
        processInboundEmail({
          from: 'steve.gustafson@bgeltd.com',
          subject: 'JJSG Order',
          text: '',
          request: createMockRequest([
            {
              filename: 'po.pdf',
              buffer: Buffer.from('fake pdf'),
              mimetype: 'application/pdf',
            },
          ]),
        })
      ).rejects.toThrow('invalid amount');
    });
  });

  describe('PO Creation', () => {
    test('should create PO for valid email with PDF', async () => {
      vi.mocked(parseBradfordPO).mockResolvedValue({
        customerCode: 'JJSG',
        customerId: 'jjsa',
        amount: 1234.56,
        poNumber: '12345',
        description: 'Test PO',
        rawText: 'PDF content',
      });

      vi.mocked(findPOByExternalRef).mockResolvedValue(null);

      const mockPO = {
        id: 'test-po-id',
        externalRef: 'Bradford-JJSG-12345',
        vendorAmount: 1234.56,
      };

      vi.mocked(createPOFromWebhook).mockResolvedValue(mockPO as any);

      const result = await processInboundEmail({
        from: 'steve.gustafson@bgeltd.com',
        subject: 'JJSG Order 12345',
        text: '',
        request: createMockRequest([
          {
            filename: 'po.pdf',
            buffer: Buffer.from('fake pdf'),
            mimetype: 'application/pdf',
          },
        ]),
      });

      expect(result.action).toBe('created');
      expect(result.purchaseOrder).toEqual(mockPO);
      expect(createPOFromWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          componentId: 'JJSG',
          estimateNumber: '12345',
          amount: 1234.56,
        })
      );
    });

    test('should handle duplicate POs', async () => {
      vi.mocked(parseBradfordPO).mockResolvedValue({
        customerCode: 'JJSG',
        customerId: 'jjsa',
        amount: 1234.56,
        poNumber: '12345',
        description: 'Test PO',
        rawText: 'PDF content',
      });

      const existingPO = {
        id: 'existing-po-id',
        externalRef: 'Bradford-JJSG-12345',
      };

      vi.mocked(findPOByExternalRef).mockResolvedValue(existingPO as any);

      const result = await processInboundEmail({
        from: 'steve.gustafson@bgeltd.com',
        subject: 'JJSG Order 12345',
        text: '',
        request: createMockRequest([
          {
            filename: 'po.pdf',
            buffer: Buffer.from('fake pdf'),
            mimetype: 'application/pdf',
          },
        ]),
      });

      expect(result.action).toBe('duplicate');
      expect(result.purchaseOrder).toEqual(existingPO);
      expect(createPOFromWebhook).not.toHaveBeenCalled();
    });
  });

  describe('Webhook Event Logging', () => {
    test('should log webhook event for processed email', async () => {
      vi.mocked(parseBradfordPO).mockResolvedValue({
        customerCode: 'JJSG',
        customerId: 'jjsa',
        amount: 1234.56,
        poNumber: '12345',
        description: 'Test PO',
        rawText: 'PDF content',
      });

      vi.mocked(findPOByExternalRef).mockResolvedValue(null);
      vi.mocked(createPOFromWebhook).mockResolvedValue({ id: 'po-id' } as any);

      await processInboundEmail({
        from: 'steve.gustafson@bgeltd.com',
        subject: 'TEST JJSG Order',
        text: '',
        request: createMockRequest([
          {
            filename: 'po.pdf',
            buffer: Buffer.from('fake pdf'),
            mimetype: 'application/pdf',
          },
        ]),
      });

      // Verify webhook event was created
      const webhookEvents = await prisma.webhookEvent.findMany({
        where: {
          source: 'EMAIL',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      expect(webhookEvents.length).toBeGreaterThan(0);
      expect(webhookEvents[0].processed).toBe(true);
    });
  });
});
