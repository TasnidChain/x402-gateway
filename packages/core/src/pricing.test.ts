import { describe, it, expect } from 'vitest';
import {
  parsePrice,
  formatPrice,
  validatePrice,
  comparePrice,
  addPrices,
  percentageOfPrice,
} from './pricing';

describe('pricing utilities', () => {
  describe('parsePrice', () => {
    it('should parse dollar string with symbol', () => {
      expect(parsePrice('$0.10')).toBe('100000');
      expect(parsePrice('$1.00')).toBe('1000000');
      expect(parsePrice('$0.001')).toBe('1000');
      expect(parsePrice('$0.01')).toBe('10000');
    });

    it('should parse dollar string without symbol', () => {
      expect(parsePrice('0.10')).toBe('100000');
      expect(parsePrice('1.00')).toBe('1000000');
      expect(parsePrice('0.001')).toBe('1000');
    });

    it('should parse number', () => {
      expect(parsePrice(0.1)).toBe('100000');
      expect(parsePrice(1)).toBe('1000000');
      expect(parsePrice(0.01)).toBe('10000');
    });

    it('should handle edge cases', () => {
      expect(parsePrice(0)).toBe('0');
      expect(parsePrice('0')).toBe('0');
      expect(parsePrice('$0')).toBe('0');
    });

    it('should throw on invalid input', () => {
      expect(() => parsePrice('invalid')).toThrow('Invalid price');
      expect(() => parsePrice(-1)).toThrow('Invalid price');
    });
  });

  describe('formatPrice', () => {
    it('should format with currency symbol by default', () => {
      expect(formatPrice('100000')).toBe('$0.10');
      expect(formatPrice('1000000')).toBe('$1.00');
      expect(formatPrice('10000')).toBe('$0.01');
    });

    it('should format without symbol when specified', () => {
      expect(formatPrice('100000', { symbol: false })).toBe('0.10');
      expect(formatPrice('1000000', { symbol: false })).toBe('1.00');
    });

    it('should respect decimal places', () => {
      expect(formatPrice('123456', { decimals: 4 })).toBe('$0.1235');
      expect(formatPrice('123456', { decimals: 6 })).toBe('$0.123456');
    });

    it('should handle numeric input', () => {
      expect(formatPrice(100000)).toBe('$0.10');
      expect(formatPrice(1000000)).toBe('$1.00');
    });

    it('should throw on invalid input', () => {
      expect(() => formatPrice('invalid')).toThrow('Invalid amount');
      expect(() => formatPrice(-1)).toThrow('Invalid amount');
    });
  });

  describe('validatePrice', () => {
    it('should validate valid prices', () => {
      const result = validatePrice('$0.01');
      expect(result.valid).toBe(true);
      expect(result.amount).toBe('10000');
    });

    it('should reject prices below minimum', () => {
      const result = validatePrice('$0.0001');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least');
    });

    it('should reject invalid format', () => {
      const result = validatePrice('invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  describe('comparePrice', () => {
    it('should compare prices correctly', () => {
      expect(comparePrice('$0.01', '$0.02')).toBe(-1);
      expect(comparePrice('$0.02', '$0.01')).toBe(1);
      expect(comparePrice('$0.01', '$0.01')).toBe(0);
    });

    it('should work with mixed formats', () => {
      expect(comparePrice(0.01, '$0.01')).toBe(0);
      expect(comparePrice('0.01', 0.02)).toBe(-1);
    });
  });

  describe('addPrices', () => {
    it('should add prices correctly', () => {
      expect(addPrices('$0.01', '$0.01')).toBe('20000');
      expect(addPrices('$0.50', '$0.50')).toBe('1000000');
    });
  });

  describe('percentageOfPrice', () => {
    it('should calculate percentage correctly', () => {
      // 10% of $1.00
      expect(percentageOfPrice('$1.00', 0.1)).toBe('100000');
      // 50% of $1.00
      expect(percentageOfPrice('$1.00', 0.5)).toBe('500000');
    });
  });
});
