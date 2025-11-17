/**
 * Comprehensive Test Suite for Pricing Calculator
 * Tests all 3 margin calculation modes after paperMarkupCPM bug fix
 */

import { calculateDynamicPricing } from '../pricing-calculator';

// Mock Prisma Client
const mockPrisma = {
  pricingRule: {
    findUnique: jest.fn(),
  },
} as any;

// Sample pricing rule for "7 1/4 x 16 3/8" size
const samplePricingRule = {
  id: 'test-rule-1',
  sizeName: '7 1/4 x 16 3/8',
  printCPM: 34.74, // What Bradford pays JD for printing
  jdInvoicePerM: 34.74, // Same as printCPM
  paperCPM: 15.46, // Bradford's paper cost
  paperChargedCPM: 18.55, // What Bradford charges for paper (with markup)
  paperWeightPer1000: 22.90,
  bradfordInvoicePerM: 57.00, // What Impact pays Bradford
  impactInvoicePerM: 67.56, // What customer pays Impact
  baseCPM: 67.56,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Pricing Calculator - All 3 Modes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.pricingRule.findUnique.mockResolvedValue(samplePricingRule);
  });

  describe('Mode 1: Normal (50/50 Split)', () => {
    it('should split print margin 50/50 between Impact and Bradford', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        false, // jdSuppliesPaper = false
        false  // bradfordWaivesPaperMargin = false
      );

      // Customer CPM = 67.56
      // Bradford base cost = 34.74 (print) + 18.55 (paper) = 53.29
      // Margin pool = 67.56 - 53.29 = 14.27
      // 50/50 split = 7.135 each

      expect(result.customerCPM).toBe(67.56);
      expect(result.impactMarginCPM).toBeCloseTo(7.135, 2);
      expect(result.bradfordPrintMarginCPM).toBeCloseTo(7.135, 2);

      // Bradford's paper markup = 18.55 - 15.46 = 3.09
      expect(result.bradfordPaperMarginCPM).toBeCloseTo(3.09, 2);

      // Bradford total margin = print margin + paper markup
      expect(result.bradfordTotalMarginCPM).toBeCloseTo(10.225, 2);
    });

    it('should calculate correct totals for 10,000 quantity', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000
      );

      // Customer total = 67.56 * 10 = 675.60
      expect(result.customerTotal).toBeCloseTo(675.60, 2);

      // Impact margin = 7.135 * 10 = 71.35
      expect(result.impactMargin).toBeCloseTo(71.35, 1);

      // Bradford print margin = 7.135 * 10 = 71.35
      expect(result.bradfordPrintMargin).toBeCloseTo(71.35, 1);

      // Bradford paper margin = 3.09 * 10 = 30.90
      expect(result.bradfordPaperMargin).toBeCloseTo(30.90, 1);

      // Bradford total margin = 10.225 * 10 = 102.25
      expect(result.bradfordTotalMargin).toBeCloseTo(102.25, 1);
    });

    it('should verify Bradford gets paper markup on top of print margin', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000
      );

      // Bradford total margin should be > Bradford print margin
      expect(result.bradfordTotalMargin).toBeGreaterThan(result.bradfordPrintMargin);

      // Difference should equal paper markup
      const paperMarkup = result.bradfordTotalMargin - result.bradfordPrintMargin;
      expect(paperMarkup).toBeCloseTo(result.bradfordPaperMargin, 1);
    });
  });

  describe('Mode 2: JD Supplies Paper (10/10/80 Split)', () => {
    it('should give Impact 10% of revenue', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        true, // jdSuppliesPaper = true
        false
      );

      // Customer total = 67.56 * 10 = 675.60
      // Impact margin = 10% of 675.60 = 67.56
      expect(result.customerTotal).toBeCloseTo(675.60, 2);
      expect(result.impactMargin).toBeCloseTo(67.56, 2);
      expect(result.impactMarginCPM).toBeCloseTo(6.756, 3);
    });

    it('should give Bradford 10% of revenue', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        true,
        false
      );

      // Bradford margin = 10% of 675.60 = 67.56
      expect(result.bradfordPrintMargin).toBeCloseTo(67.56, 2);
      expect(result.bradfordPrintMarginCPM).toBeCloseTo(6.756, 3);
    });

    it('should give JD 80% of revenue', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        true,
        false
      );

      // JD total = 80% of 675.60 = 540.48
      expect(result.jdTotal).toBeCloseTo(540.48, 2);
    });

    it('should have ZERO paper markup when JD supplies paper', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        true,
        false
      );

      // Bradford paper margin should be 0
      expect(result.bradfordPaperMargin).toBe(0);
      expect(result.bradfordPaperMarginCPM).toBe(0);

      // Bradford total margin = print margin only
      expect(result.bradfordTotalMargin).toBe(result.bradfordPrintMargin);
    });

    it('should verify 10+10+80=100', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        true,
        false
      );

      const total = result.impactMargin + result.bradfordPrintMargin + result.jdTotal;
      expect(total).toBeCloseTo(result.customerTotal, 1);
    });
  });

  describe('Mode 3: Bradford Waives Paper Margin (50/50 Total Margin)', () => {
    it('should split total margin 50/50', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        false,
        true // bradfordWaivesPaperMargin = true
      );

      // Customer CPM = 67.56
      // JD print cost = 34.74
      // Paper at cost = 15.46
      // Total margin = 67.56 - 34.74 - 15.46 = 17.36
      // 50/50 split = 8.68 each

      expect(result.impactMarginCPM).toBeCloseTo(8.68, 2);
      expect(result.bradfordPrintMarginCPM).toBeCloseTo(8.68, 2);
    });

    it('should charge paper at cost (no markup)', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        false,
        true
      );

      // Paper charged should equal paper cost (15.46)
      expect(result.paperChargedCPM).toBe(result.paperCostCPM);
      expect(result.paperChargedCPM).toBe(15.46);
    });

    it('should have ZERO paper markup when Bradford waives', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        false,
        true
      );

      // THE BUG FIX: Bradford paper margin should be 0
      expect(result.bradfordPaperMargin).toBe(0);
      expect(result.bradfordPaperMarginCPM).toBe(0);
    });

    it('should have Bradford total margin equal print margin only', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        false,
        true
      );

      // Bradford total margin = print margin (no paper markup)
      expect(result.bradfordTotalMargin).toBe(result.bradfordPrintMargin);
      expect(result.bradfordTotalMarginCPM).toBe(result.bradfordPrintMarginCPM);
    });

    it('should verify Impact and Bradford margins are equal', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        false,
        true
      );

      expect(result.impactMargin).toBeCloseTo(result.bradfordPrintMargin, 1);
    });

    it('should calculate correct totals for 10,000 quantity', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        false,
        true
      );

      // Total margin CPM = 17.36
      // 50/50 = 8.68 each
      // For 10,000 qty = 86.80 each
      expect(result.impactMargin).toBeCloseTo(86.80, 1);
      expect(result.bradfordPrintMargin).toBeCloseTo(86.80, 1);
      expect(result.bradfordPaperMargin).toBe(0);
      expect(result.bradfordTotalMargin).toBeCloseTo(86.80, 1);
    });
  });

  describe('Edge Cases & Validation', () => {
    it('should handle custom pricing overrides', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        { customerCPM: 60.00 }, // Override customer price
        false,
        false
      );

      expect(result.customerCPM).toBe(60.00);
      expect(result.isCustomPricing).toBe(true);
    });

    it('should detect undercharge scenarios', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        { customerCPM: 50.00 }, // Below standard 67.56
        false,
        false
      );

      expect(result.requiresApproval).toBe(true);
      expect(result.underchargeAmount).toBeGreaterThan(0);
    });

    it('should handle small quantities correctly', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        1000 // 1,000 pieces
      );

      expect(result.quantity).toBe(1000);
      expect(result.quantityInThousands).toBe(1);
      expect(result.customerTotal).toBeCloseTo(67.56, 2);
    });

    it('should handle large quantities correctly', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        250000 // 250,000 pieces
      );

      expect(result.quantity).toBe(250000);
      expect(result.quantityInThousands).toBe(250);
      expect(result.customerTotal).toBeCloseTo(16890, 0);
    });
  });

  describe('Regression Tests for Bug Fix', () => {
    it('should NOT have paper markup in JD Supplies mode (bug fix verification)', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        true,
        false
      );

      // Before fix: bradfordPaperMargin would incorrectly be 30.90
      // After fix: should be 0
      expect(result.bradfordPaperMargin).toBe(0);
    });

    it('should NOT have paper markup in Bradford Waives mode (bug fix verification)', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        false,
        true
      );

      // Before fix: bradfordPaperMargin would incorrectly be 30.90
      // After fix: should be 0
      expect(result.bradfordPaperMargin).toBe(0);
      expect(result.bradfordPaperMarginCPM).toBe(0);
    });

    it('should correctly recalculate paperMarkupCPM when paper is waived', async () => {
      const result = await calculateDynamicPricing(
        mockPrisma,
        '7 1/4 x 16 3/8',
        10000,
        undefined,
        false,
        true
      );

      // paperChargedCPM should equal paperCostCPM
      expect(result.paperChargedCPM).toBe(result.paperCostCPM);

      // Therefore markup should be 0
      const markup = result.paperChargedCPM - result.paperCostCPM;
      expect(markup).toBe(0);
    });
  });
});
