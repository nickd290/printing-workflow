import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseSpecsFromText } from '../services/quote.service.js';

describe('Quote Service', () => {
  describe('parseSpecsFromText', () => {
    it('should extract quantity from text', async () => {
      const text = 'Need 5000 pieces of business cards';
      const result = await parseSpecsFromText(text);

      expect(result.quantity).toBe(5000);
    });

    it('should extract size from text', async () => {
      const text = 'Flyers 8.5 x 11 inches';
      const result = await parseSpecsFromText(text);

      expect(result.size).toBe('8.5x11');
    });

    it('should extract color information', async () => {
      const text = 'Full color 4/4 printing';
      const result = await parseSpecsFromText(text);

      expect(result.colors).toBe('4/4');
    });

    it('should handle complex text with multiple specs', async () => {
      const text = `
        Need 1000 brochures
        Size: 11 x 17
        Colors: 4/4
        Paper: 100# gloss text
      `;
      const result = await parseSpecsFromText(text);

      expect(result.quantity).toBe(1000);
      expect(result.size).toBe('11x17');
      expect(result.colors).toBe('4/4');
    });

    it('should return default values for missing specs', async () => {
      const text = 'Just some basic printing';
      const result = await parseSpecsFromText(text);

      expect(result.paper).toBe('Not specified');
      expect(result.quantity).toBeGreaterThan(0);
    });
  });
});
