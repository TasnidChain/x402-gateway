import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildReceipt,
  createReceiptToken,
  verifyReceipt,
  isReceiptValid,
  decodeReceipt,
  extractReceiptFromHeaders,
  getReceiptRemainingTime,
  formatReceiptExpiry,
} from './receipt';
import type { X402Receipt } from './types';

const TEST_SECRET = 'test-jwt-secret-for-testing-only';

describe('receipt utilities', () => {
  describe('buildReceipt', () => {
    it('should build a receipt with all fields', () => {
      const receipt = buildReceipt({
        contentId: 'article-123',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '10000',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
      });

      expect(receipt.id).toMatch(/^rcpt_/);
      expect(receipt.contentId).toBe('article-123');
      expect(receipt.payer).toBe('0x1234567890123456789012345678901234567890');
      expect(receipt.payee).toBe('0x0987654321098765432109876543210987654321');
      expect(receipt.amount).toBe('10000');
      expect(receipt.currency).toBe('USDC');
      expect(receipt.chainId).toBe(8453);
      expect(receipt.paidAt).toBeGreaterThan(0);
      expect(receipt.expiresAt).toBeGreaterThan(receipt.paidAt);
    });

    it('should use custom TTL', () => {
      const receipt = buildReceipt({
        contentId: 'article-123',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '10000',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
        ttlSeconds: 3600, // 1 hour
      });

      expect(receipt.expiresAt - receipt.paidAt).toBe(3600);
    });
  });

  describe('createReceiptToken and verifyReceipt', () => {
    it('should create and verify a receipt token', async () => {
      const receipt = buildReceipt({
        contentId: 'test-content',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '100000',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
      });

      const token = await createReceiptToken(receipt, TEST_SECRET);
      expect(token).toBeTruthy();
      expect(token.split('.')).toHaveLength(3); // JWT format

      const result = await verifyReceipt(token, { jwtSecret: TEST_SECRET });
      expect(result.valid).toBe(true);
      expect(result.receipt?.contentId).toBe('test-content');
      expect(result.receipt?.amount).toBe('100000');
    });

    it('should reject token with wrong secret', async () => {
      const receipt = buildReceipt({
        contentId: 'test-content',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '100000',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
      });

      const token = await createReceiptToken(receipt, TEST_SECRET);
      const result = await verifyReceipt(token, { jwtSecret: 'wrong-secret' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('verification failed');
    });

    it('should reject expired receipt', async () => {
      const receipt = buildReceipt({
        contentId: 'test-content',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '100000',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
        ttlSeconds: -1, // Already expired
      });

      const token = await createReceiptToken(receipt, TEST_SECRET);
      const result = await verifyReceipt(token, { jwtSecret: TEST_SECRET });
      expect(result.valid).toBe(false);
      // jose uses "exp" claim timestamp check failed message
      expect(result.error).toMatch(/expired|"exp" claim/);
    });

    it('should verify content ID match', async () => {
      const receipt = buildReceipt({
        contentId: 'content-a',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '100000',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
      });

      const token = await createReceiptToken(receipt, TEST_SECRET);
      const result = await verifyReceipt(token, {
        jwtSecret: TEST_SECRET,
        expectedContentId: 'content-b',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('content-a');
    });
  });

  describe('isReceiptValid', () => {
    it('should return true for valid receipt', () => {
      const receipt: X402Receipt = {
        id: 'rcpt_test',
        contentId: 'article-123',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '10000',
        currency: 'USDC',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
        paidAt: Math.floor(Date.now() / 1000) - 100,
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        facilitator: 'https://x402.org/facilitator',
      };

      expect(isReceiptValid(receipt)).toBe(true);
      expect(isReceiptValid(receipt, 'article-123')).toBe(true);
    });

    it('should return false for expired receipt', () => {
      const receipt: X402Receipt = {
        id: 'rcpt_test',
        contentId: 'article-123',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '10000',
        currency: 'USDC',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
        paidAt: Math.floor(Date.now() / 1000) - 86500,
        expiresAt: Math.floor(Date.now() / 1000) - 100, // Expired
        facilitator: 'https://x402.org/facilitator',
      };

      expect(isReceiptValid(receipt)).toBe(false);
    });

    it('should return false for wrong content ID', () => {
      const receipt: X402Receipt = {
        id: 'rcpt_test',
        contentId: 'article-123',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '10000',
        currency: 'USDC',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
        paidAt: Math.floor(Date.now() / 1000) - 100,
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        facilitator: 'https://x402.org/facilitator',
      };

      expect(isReceiptValid(receipt, 'article-456')).toBe(false);
    });
  });

  describe('decodeReceipt', () => {
    it('should decode a valid token', async () => {
      const receipt = buildReceipt({
        contentId: 'test-content',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '100000',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
      });

      const token = await createReceiptToken(receipt, TEST_SECRET);
      const decoded = decodeReceipt(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.contentId).toBe('test-content');
    });

    it('should return null for invalid token', () => {
      expect(decodeReceipt('invalid.token')).toBeNull();
      expect(decodeReceipt('not-a-jwt')).toBeNull();
    });
  });

  describe('extractReceiptFromHeaders', () => {
    it('should extract from X-402-Receipt header', () => {
      const headers = new Headers();
      headers.set('X-402-Receipt', 'my-token');

      expect(extractReceiptFromHeaders(headers)).toBe('my-token');
    });

    it('should extract from Authorization header', () => {
      const headers = new Headers();
      headers.set('Authorization', 'X402 my-token');

      expect(extractReceiptFromHeaders(headers)).toBe('my-token');
    });

    it('should prefer X-402-Receipt over Authorization', () => {
      const headers = new Headers();
      headers.set('X-402-Receipt', 'receipt-token');
      headers.set('Authorization', 'X402 auth-token');

      expect(extractReceiptFromHeaders(headers)).toBe('receipt-token');
    });

    it('should work with plain object headers', () => {
      expect(extractReceiptFromHeaders({ 'X-402-Receipt': 'token' })).toBe('token');
      expect(extractReceiptFromHeaders({ 'Authorization': 'X402 token' })).toBe('token');
    });

    it('should return null when no receipt', () => {
      expect(extractReceiptFromHeaders(new Headers())).toBeNull();
      expect(extractReceiptFromHeaders({})).toBeNull();
    });
  });

  describe('getReceiptRemainingTime', () => {
    it('should return remaining time', () => {
      const receipt: X402Receipt = {
        id: 'rcpt_test',
        contentId: 'article-123',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '10000',
        currency: 'USDC',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
        paidAt: Math.floor(Date.now() / 1000) - 100,
        expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        facilitator: 'https://x402.org/facilitator',
      };

      const remaining = getReceiptRemainingTime(receipt);
      expect(remaining).toBeGreaterThan(3500);
      expect(remaining).toBeLessThanOrEqual(3600);
    });

    it('should return 0 for expired receipt', () => {
      const receipt: X402Receipt = {
        id: 'rcpt_test',
        contentId: 'article-123',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '10000',
        currency: 'USDC',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
        paidAt: Math.floor(Date.now() / 1000) - 86500,
        expiresAt: Math.floor(Date.now() / 1000) - 100,
        facilitator: 'https://x402.org/facilitator',
      };

      expect(getReceiptRemainingTime(receipt)).toBe(0);
    });
  });

  describe('formatReceiptExpiry', () => {
    it('should format hours', () => {
      const receipt: X402Receipt = {
        id: 'rcpt_test',
        contentId: 'article-123',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '10000',
        currency: 'USDC',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
        paidAt: Math.floor(Date.now() / 1000) - 100,
        expiresAt: Math.floor(Date.now() / 1000) + 7200, // 2 hours
        facilitator: 'https://x402.org/facilitator',
      };

      expect(formatReceiptExpiry(receipt)).toMatch(/hour/);
    });

    it('should format expired', () => {
      const receipt: X402Receipt = {
        id: 'rcpt_test',
        contentId: 'article-123',
        payer: '0x1234567890123456789012345678901234567890',
        payee: '0x0987654321098765432109876543210987654321',
        amount: '10000',
        currency: 'USDC',
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        chainId: 8453,
        paidAt: Math.floor(Date.now() / 1000) - 86500,
        expiresAt: Math.floor(Date.now() / 1000) - 100,
        facilitator: 'https://x402.org/facilitator',
      };

      expect(formatReceiptExpiry(receipt)).toBe('Expired');
    });
  });
});
