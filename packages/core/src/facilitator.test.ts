/**
 * Tests for facilitator client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFacilitatorPayload, submitToFacilitator, submitToFacilitatorWithRetry } from './facilitator';
import { X402PaymentError, X402NetworkError } from './errors';
import type { TransferAuthorization } from './types';

const mockAuthorization: TransferAuthorization = {
  from: '0x1234567890123456789012345678901234567890',
  to: '0x0987654321098765432109876543210987654321',
  value: '10000',
  validAfter: 0,
  validBefore: 9999999999,
  nonce: '0x' + 'ab'.repeat(32) as `0x${string}`,
};

const mockSignature = '0x' + 'cd'.repeat(65) as `0x${string}`;

describe('facilitator client', () => {
  describe('buildFacilitatorPayload', () => {
    it('should build correct payload structure', () => {
      const payload = buildFacilitatorPayload({
        signature: mockSignature,
        authorization: mockAuthorization,
        network: 'base-mainnet',
        contentId: 'article-123',
      });

      expect(payload).toEqual({
        x402Version: 1,
        scheme: 'exact',
        network: 'eip155:8453',
        payload: {
          signature: mockSignature,
          authorization: mockAuthorization,
        },
        resource: 'article-123',
      });
    });

    it('should use correct CAIP-2 network for base-sepolia', () => {
      const payload = buildFacilitatorPayload({
        signature: mockSignature,
        authorization: mockAuthorization,
        network: 'base-sepolia',
        contentId: 'test-content',
      });

      expect(payload.network).toBe('eip155:84532');
    });

    it('should set x402Version to 1', () => {
      const payload = buildFacilitatorPayload({
        signature: mockSignature,
        authorization: mockAuthorization,
        network: 'base-mainnet',
        contentId: 'content-1',
      });

      expect(payload.x402Version).toBe(1);
      expect(payload.scheme).toBe('exact');
    });
  });

  describe('submitToFacilitator', () => {
    const mockPayload = buildFacilitatorPayload({
      signature: mockSignature,
      authorization: mockAuthorization,
      network: 'base-mainnet',
      contentId: 'article-123',
    });

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should return receipt on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ receipt: 'jwt.token.here', txHash: '0xabc' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await submitToFacilitator('https://x402.org/facilitator', mockPayload);
      expect(result.receipt).toBe('jwt.token.here');
      expect(result.txHash).toBe('0xabc');
    });

    it('should handle receipt in token field', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'jwt.from.token.field' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await submitToFacilitator('https://x402.org/facilitator', mockPayload);
      expect(result.receipt).toBe('jwt.from.token.field');
    });

    it('should throw X402PaymentError on HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Insufficient balance' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(submitToFacilitator('https://x402.org/facilitator', mockPayload))
        .rejects.toThrow(X402PaymentError);
    });

    it('should throw X402PaymentError with facilitator error message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Nonce already used' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(submitToFacilitator('https://x402.org/facilitator', mockPayload))
        .rejects.toThrow('Nonce already used');
    });

    it('should throw X402NetworkError on fetch failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(submitToFacilitator('https://x402.org/facilitator', mockPayload))
        .rejects.toThrow(X402NetworkError);
    });

    it('should throw X402PaymentError if no receipt in response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(submitToFacilitator('https://x402.org/facilitator', mockPayload))
        .rejects.toThrow('No receipt returned');
    });

    it('should send correct request format', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ receipt: 'jwt.token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await submitToFacilitator('https://facilitator.test', mockPayload);

      expect(fetchSpy).toHaveBeenCalledWith('https://facilitator.test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPayload),
      });
    });
  });

  describe('submitToFacilitatorWithRetry', () => {
    const mockPayload = buildFacilitatorPayload({
      signature: mockSignature,
      authorization: mockAuthorization,
      network: 'base-mainnet',
      contentId: 'article-123',
    });

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should succeed on first attempt', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ receipt: 'jwt.token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await submitToFacilitatorWithRetry(
        'https://x402.org/facilitator',
        mockPayload,
        { maxRetries: 2, backoffMs: 10 }
      );
      expect(result.receipt).toBe('jwt.token');
    });

    it('should retry on facilitator error and succeed', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Temporary error' }), { status: 500 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ receipt: 'jwt.retry.token' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );

      const result = await submitToFacilitatorWithRetry(
        'https://x402.org/facilitator',
        mockPayload,
        { maxRetries: 2, backoffMs: 10 }
      );

      expect(result.receipt).toBe('jwt.retry.token');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exhausted', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'Server down' }), { status: 500 })
      );

      await expect(
        submitToFacilitatorWithRetry('https://x402.org/facilitator', mockPayload, {
          maxRetries: 1,
          backoffMs: 10,
        })
      ).rejects.toThrow(X402PaymentError);
    });

    it('should not retry network errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

      // Network errors are retried (they're transient)
      await expect(
        submitToFacilitatorWithRetry('https://x402.org/facilitator', mockPayload, {
          maxRetries: 1,
          backoffMs: 10,
        })
      ).rejects.toThrow(X402NetworkError);
    });
  });
});
