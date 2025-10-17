import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateJobNumber, generateInvoiceNumber, calculatePOAmounts } from '../lib/utils.js';
import { prisma } from '@printing-workflow/db';

// Mock Prisma
vi.mock('@printing-workflow/db', () => ({
  prisma: {
    job: {
      findFirst: vi.fn(),
    },
    invoice: {
      findFirst: vi.fn(),
    },
  },
}));

describe('Utils', () => {
  describe('generateJobNumber', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should generate first job number for the year', async () => {
      vi.mocked(prisma.job.findFirst).mockResolvedValue(null);

      const jobNo = await generateJobNumber();
      const year = new Date().getFullYear();

      expect(jobNo).toBe(`J-${year}-000001`);
    });

    it('should increment existing job number', async () => {
      const year = new Date().getFullYear();
      vi.mocked(prisma.job.findFirst).mockResolvedValue({
        id: '1',
        jobNo: `J-${year}-000005`,
        quoteId: null,
        customerId: '1',
        status: 'PENDING',
        specs: {},
        customerTotal: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      } as any);

      const jobNo = await generateJobNumber();

      expect(jobNo).toBe(`J-${year}-000006`);
    });
  });

  describe('generateInvoiceNumber', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should generate first invoice number for the year', async () => {
      vi.mocked(prisma.invoice.findFirst).mockResolvedValue(null);

      const invoiceNo = await generateInvoiceNumber();
      const year = new Date().getFullYear();

      expect(invoiceNo).toBe(`INV-${year}-000001`);
    });
  });

  describe('calculatePOAmounts', () => {
    it('should calculate 80/20 split', () => {
      const result = calculatePOAmounts(100);

      expect(result.vendorAmount).toBe(80);
      expect(result.marginAmount).toBe(20);
    });

    it('should handle decimal amounts correctly', () => {
      const result = calculatePOAmounts(123.45);

      expect(result.vendorAmount).toBe(98.76);
      expect(result.marginAmount).toBe(24.69);
    });
  });
});
