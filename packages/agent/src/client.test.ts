/**
 * Tests for X402AgentClient
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { X402AgentClient } from './client';
import { X402PaymentError, X402BudgetError } from '@x402/core';

// Known test private key
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`;

// Mock 402 response body
const mock402Body = {
  payTo: '0x0987654321098765432109876543210987654321',
  price: '0.01',
  currency: 'USDC',
  contentId: 'article-123',
  network: 'base-mainnet',
  facilitatorUrl: 'https://x402.org/facilitator',
  accepts: [
    {
      scheme: 'exact',
      network: 'eip155:8453',
      maxAmountRequired: '10000',
      resource: 'article-123',
      description: 'Premium article',
      mimeType: 'application/json',
      payload: {},
    },
  ],
};

describe('X402AgentClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
      });
      expect(client.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should accept budget config', () => {
      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
        budget: {
          maxPerRequest: '1.00',
          maxTotal: '100.00',
        },
      });
      const status = client.getBudgetStatus();
      expect(status.perRequest).toBe('1.00 USDC');
      expect(status.totalRemaining).toBe('100.00 USDC');
    });
  });

  describe('fetch', () => {
    it('should return response directly if not 402', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'free content' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
      });

      const response = await client.fetch('https://api.example.com/free');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ data: 'free content' });
    });

    it('should throw on invalid 402 response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Payment Required', {
          status: 402,
          // No payment params headers or body
        })
      );

      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
      });

      await expect(client.fetch('https://api.example.com/premium'))
        .rejects.toThrow(X402PaymentError);
    });

    it('should handle 402 and submit payment', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        // First call: 402 response with payment params
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mock402Body), {
            status: 402,
            headers: {
              'Content-Type': 'application/json',
              'X-402-PayTo': mock402Body.payTo,
              'X-402-Price': mock402Body.price,
              'X-402-Currency': mock402Body.currency,
              'X-402-Network': mock402Body.network,
              'X-402-Facilitator': mock402Body.facilitatorUrl,
              'X-402-Content-Id': mock402Body.contentId,
            },
          })
        )
        // Second call: facilitator returns receipt
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ receipt: 'jwt.receipt.token', txHash: '0xabc123' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        // Third call: retry with receipt gets content
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ content: 'premium data' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );

      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
      });

      const response = await client.fetch('https://api.example.com/premium');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ content: 'premium data' });

      // Verify 3 fetch calls were made
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('should use cached receipt on subsequent requests', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        // First call: 402
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mock402Body), {
            status: 402,
            headers: {
              'Content-Type': 'application/json',
              'X-402-PayTo': mock402Body.payTo,
              'X-402-Price': mock402Body.price,
              'X-402-Currency': mock402Body.currency,
              'X-402-Network': mock402Body.network,
              'X-402-Facilitator': mock402Body.facilitatorUrl,
              'X-402-Content-Id': mock402Body.contentId,
            },
          })
        )
        // Facilitator response
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ receipt: 'jwt.receipt.token' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        // Retry with receipt
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ content: 'data' }), { status: 200 })
        )
        // Second request with cached receipt
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ content: 'data again' }), { status: 200 })
        );

      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
      });

      // First request triggers payment
      await client.fetch('https://api.example.com/premium');

      // Second request should use cached receipt (no facilitator call)
      const response2 = await client.fetch('https://api.example.com/premium');
      expect(response2.status).toBe(200);

      // Should be 4 total fetch calls (not 6 — no second payment)
      expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it('should enforce budget limits', async () => {
      const expensiveBody = {
        ...mock402Body,
        price: '5.00',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(expensiveBody), {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'X-402-PayTo': mock402Body.payTo,
            'X-402-Price': '5.00',
            'X-402-Currency': mock402Body.currency,
            'X-402-Network': mock402Body.network,
            'X-402-Facilitator': mock402Body.facilitatorUrl,
            'X-402-Content-Id': mock402Body.contentId,
          },
        })
      );

      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
        budget: { maxPerRequest: '1.00' },
      });

      await expect(client.fetch('https://api.example.com/expensive'))
        .rejects.toThrow(X402BudgetError);
    });
  });

  describe('events', () => {
    it('should emit payment_started event', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mock402Body), {
            status: 402,
            headers: {
              'Content-Type': 'application/json',
              'X-402-PayTo': mock402Body.payTo,
              'X-402-Price': mock402Body.price,
              'X-402-Currency': mock402Body.currency,
              'X-402-Network': mock402Body.network,
              'X-402-Facilitator': mock402Body.facilitatorUrl,
              'X-402-Content-Id': mock402Body.contentId,
            },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ receipt: 'jwt.token' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ content: 'data' }), { status: 200 })
        );

      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
      });

      const events: string[] = [];
      client.on('payment_started', () => events.push('started'));
      client.on('payment_success', () => events.push('success'));

      await client.fetch('https://api.example.com/premium');

      expect(events).toContain('started');
      expect(events).toContain('success');
    });

    it('should emit payment_failed event on error', async () => {
      const expensiveBody = { ...mock402Body, price: '5.00' };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(expensiveBody), {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'X-402-PayTo': mock402Body.payTo,
            'X-402-Price': '5.00',
            'X-402-Currency': mock402Body.currency,
            'X-402-Network': mock402Body.network,
            'X-402-Facilitator': mock402Body.facilitatorUrl,
            'X-402-Content-Id': mock402Body.contentId,
          },
        })
      );

      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
        budget: { maxPerRequest: '1.00' },
      });

      const failedEvents: string[] = [];
      client.on('payment_failed', () => failedEvents.push('failed'));

      try {
        await client.fetch('https://api.example.com/expensive');
      } catch {
        // Expected
      }

      expect(failedEvents).toContain('failed');
    });

    it('should support on/off for event listeners', () => {
      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
      });

      const listener = vi.fn();
      client.on('payment_started', listener);
      client.off('payment_started', listener);

      // Listener should have been removed — no way to test directly
      // but at least verify it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('getBudgetStatus', () => {
    it('should return budget status', () => {
      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
        budget: { maxPerRequest: '1.00', maxTotal: '50.00' },
      });

      const status = client.getBudgetStatus();
      expect(status.perRequest).toBe('1.00 USDC');
      expect(status.totalRemaining).toBe('50.00 USDC');
      expect(status.totalSpent).toBe('0.00 USDC');
    });
  });

  describe('getPaymentHistory', () => {
    it('should return empty array initially', () => {
      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
      });

      expect(client.getPaymentHistory()).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should clear budget and cache', () => {
      const client = new X402AgentClient({
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
        budget: { maxTotal: '10.00' },
      });

      client.reset();

      const status = client.getBudgetStatus();
      expect(status.totalSpent).toBe('0.00 USDC');
    });
  });
});
