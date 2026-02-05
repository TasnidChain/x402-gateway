/**
 * Tests for stateless x402Fetch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { x402Fetch } from './fetch';
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

describe('x402Fetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return response directly if not 402', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'free' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const response = await x402Fetch('https://api.example.com/free', {
      privateKey: TEST_PRIVATE_KEY,
      network: 'base-mainnet',
    });

    expect(response.status).toBe(200);
  });

  it('should handle 402 and auto-pay', async () => {
    vi.spyOn(globalThis, 'fetch')
      // Initial 402 response
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
        new Response(JSON.stringify({ content: 'premium data' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const response = await x402Fetch('https://api.example.com/premium', {
      privateKey: TEST_PRIVATE_KEY,
      network: 'base-mainnet',
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ content: 'premium data' });
  });

  it('should enforce maxPrice guard', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ...mock402Body, price: '5.00' }), {
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

    await expect(
      x402Fetch('https://api.example.com/expensive', {
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
        maxPrice: '1.00',
      })
    ).rejects.toThrow(X402BudgetError);
  });

  it('should allow price within maxPrice', async () => {
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
        new Response(JSON.stringify({ receipt: 'jwt.token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ content: 'data' }), { status: 200 })
      );

    const response = await x402Fetch('https://api.example.com/premium', {
      privateKey: TEST_PRIVATE_KEY,
      network: 'base-mainnet',
      maxPrice: '1.00', // 0.01 is within limit
    });

    expect(response.status).toBe(200);
  });

  it('should throw on invalid 402 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Payment Required', { status: 402 })
    );

    await expect(
      x402Fetch('https://api.example.com/broken', {
        privateKey: TEST_PRIVATE_KEY,
        network: 'base-mainnet',
      })
    ).rejects.toThrow(X402PaymentError);
  });

  it('should pass through custom headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'ok' }), { status: 200 })
    );

    await x402Fetch('https://api.example.com/free', {
      privateKey: TEST_PRIVATE_KEY,
      network: 'base-mainnet',
      headers: { 'X-Custom': 'value' },
    });

    const callArgs = fetchSpy.mock.calls[0];
    expect(callArgs[1]).toBeDefined();
    expect(callArgs[1]?.headers).toBeDefined();
  });
});
