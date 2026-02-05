import { describe, it, expect } from 'vitest';
import {
  buildPaymentRequiredResponse,
  parsePaymentRequiredFromParts,
  validatePaymentRequest,
  createAuthenticatedHeaders,
} from './x402';

describe('x402 protocol utilities', () => {
  describe('buildPaymentRequiredResponse', () => {
    it('should build a valid 402 response', () => {
      const response = buildPaymentRequiredResponse({
        payTo: '0x1234567890123456789012345678901234567890',
        price: '0.01',
        contentId: 'article-123',
        network: 'base-mainnet',
      });

      expect(response.status).toBe(402);
      expect(response.headers['X-402-PayTo']).toBe('0x1234567890123456789012345678901234567890');
      expect(response.headers['X-402-Price']).toBe('0.01');
      expect(response.headers['X-402-Currency']).toBe('USDC');
      expect(response.headers['X-402-Network']).toBe('base-mainnet');
      expect(response.headers['X-402-Content-Id']).toBe('article-123');
      expect(response.body.payTo).toBe('0x1234567890123456789012345678901234567890');
      expect(response.body.accepts).toHaveLength(1);
    });

    it('should include description when provided', () => {
      const response = buildPaymentRequiredResponse({
        payTo: '0x1234567890123456789012345678901234567890',
        price: '0.01',
        contentId: 'article-123',
        network: 'base-mainnet',
        description: 'Premium content',
      });

      expect(response.headers['X-402-Description']).toBe('Premium content');
      expect(response.body.description).toBe('Premium content');
    });

    it('should use default facilitator URL', () => {
      const response = buildPaymentRequiredResponse({
        payTo: '0x1234567890123456789012345678901234567890',
        price: '0.01',
        contentId: 'article-123',
        network: 'base-mainnet',
      });

      expect(response.headers['X-402-Facilitator']).toBe('https://x402.org/facilitator');
    });

    it('should use custom facilitator URL', () => {
      const response = buildPaymentRequiredResponse({
        payTo: '0x1234567890123456789012345678901234567890',
        price: '0.01',
        contentId: 'article-123',
        network: 'base-mainnet',
        facilitatorUrl: 'https://custom.facilitator.com',
      });

      expect(response.headers['X-402-Facilitator']).toBe('https://custom.facilitator.com');
    });
  });

  describe('parsePaymentRequiredFromParts', () => {
    it('should parse valid headers and body', () => {
      const headers = {
        'X-402-PayTo': '0x1234567890123456789012345678901234567890',
        'X-402-Price': '0.01',
        'X-402-Currency': 'USDC',
        'X-402-Network': 'base-mainnet',
        'X-402-Content-Id': 'article-123',
      };

      const body = {};

      const result = parsePaymentRequiredFromParts(headers, body);

      expect(result).not.toBeNull();
      expect(result?.payTo).toBe('0x1234567890123456789012345678901234567890');
      expect(result?.price).toBe('0.01');
      expect(result?.contentId).toBe('article-123');
      expect(result?.network).toBe('base-mainnet');
    });

    it('should prefer body values over headers', () => {
      const headers = {
        'X-402-Price': '0.01',
      };

      const body = {
        payTo: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        price: '0.05',
        contentId: 'article-123',
        network: 'base-mainnet' as const,
      };

      const result = parsePaymentRequiredFromParts(headers, body);

      expect(result?.price).toBe('0.05'); // Body value preferred
    });

    it('should return null for missing required fields', () => {
      const result = parsePaymentRequiredFromParts({}, {});
      expect(result).toBeNull();
    });
  });

  describe('validatePaymentRequest', () => {
    it('should validate a correct payment request', () => {
      const result = validatePaymentRequest({
        payTo: '0x1234567890123456789012345678901234567890',
        price: '0.01',
        contentId: 'article-123',
        network: 'base-mainnet',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing payTo', () => {
      const result = validatePaymentRequest({
        price: '0.01',
        contentId: 'article-123',
        network: 'base-mainnet',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing payTo address');
    });

    it('should reject invalid payTo format', () => {
      const result = validatePaymentRequest({
        payTo: 'invalid-address' as `0x${string}`,
        price: '0.01',
        contentId: 'article-123',
        network: 'base-mainnet',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid payTo address format');
    });

    it('should reject invalid network', () => {
      const result = validatePaymentRequest({
        payTo: '0x1234567890123456789012345678901234567890',
        price: '0.01',
        contentId: 'article-123',
        network: 'ethereum' as any,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid network (must be base-mainnet or base-sepolia)');
    });
  });

  describe('createAuthenticatedHeaders', () => {
    it('should create headers with receipt', () => {
      const headers = createAuthenticatedHeaders('my-receipt-token');
      expect(headers['X-402-Receipt']).toBe('my-receipt-token');
    });
  });
});
