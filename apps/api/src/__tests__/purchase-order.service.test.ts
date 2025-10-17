import { describe, it, expect } from 'vitest';
import { calculatePOAmounts } from '../lib/utils.js';

describe('Purchase Order Service', () => {
  describe('Auto PO Creation Logic', () => {
    it('should calculate correct vendor and margin amounts', () => {
      // Test case from requirements: $100 job
      const customerTotal = 100;
      const { vendorAmount, marginAmount } = calculatePOAmounts(customerTotal);

      expect(vendorAmount).toBe(80); // 80% to Bradford
      expect(marginAmount).toBe(20); // 20% margin for Impact
    });

    it('should calculate for larger amounts', () => {
      const customerTotal = 1000;
      const { vendorAmount, marginAmount } = calculatePOAmounts(customerTotal);

      expect(vendorAmount).toBe(800);
      expect(marginAmount).toBe(200);
    });

    it('should maintain precision for decimal amounts', () => {
      const customerTotal = 99.99;
      const { vendorAmount, marginAmount } = calculatePOAmounts(customerTotal);

      expect(vendorAmount).toBe(79.99);
      expect(marginAmount).toBe(20);
      expect(vendorAmount + marginAmount).toBeCloseTo(customerTotal, 2);
    });
  });

  describe('Money Flow Validation', () => {
    it('should validate the $100 example from requirements', () => {
      // Customer pays $100 → Impact
      const customerPayment = 100;

      // Impact pays $80 → Bradford (auto PO)
      const { vendorAmount: impactToBradford, marginAmount: impactMargin } =
        calculatePOAmounts(customerPayment);

      expect(impactToBradford).toBe(80);
      expect(impactMargin).toBe(20);

      // Bradford pays $60 → JD (from webhook, Bradford keeps $20)
      const bradfordToJD = 60;
      const bradfordMargin = impactToBradford - bradfordToJD;

      expect(bradfordMargin).toBe(20);

      // Validate totals
      expect(impactMargin).toBe(20); // Impact: $20
      expect(bradfordMargin).toBe(20); // Bradford: $20
      expect(bradfordToJD).toBe(60); // JD: $60
      expect(impactMargin + bradfordMargin + bradfordToJD).toBe(customerPayment);
    });
  });
});
