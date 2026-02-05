/**
 * @x402/agent - Standalone x402Fetch
 * Stateless fetch wrapper that auto-handles 402 Payment Required responses
 */

import {
  parsePaymentRequired,
  buildTransferAuthorization,
  buildFacilitatorPayload,
  submitToFacilitator,
  parsePrice,
  X402PaymentError,
  X402BudgetError,
  X402_PAYMENT_HEADER,
  X402_HEADERS,
} from '@x402/core';
import type { X402Network } from '@x402/core';
import { createAgentWallet } from './wallet';

/**
 * Options for x402Fetch — extends standard RequestInit with payment config
 */
export interface X402FetchOptions extends RequestInit {
  /** Agent's private key for signing */
  privateKey: `0x${string}`;

  /** Network for payments */
  network: X402Network;

  /** Maximum price willing to pay (USDC, e.g., "0.50"). Throws if exceeded */
  maxPrice?: string;

  /** Override facilitator URL */
  facilitatorUrl?: string;
}

/**
 * Standalone fetch wrapper that automatically handles 402 Payment Required responses
 *
 * Unlike X402AgentClient, this is stateless — no receipt caching, no budget tracking,
 * no event emission. Perfect for one-off requests or simple scripts.
 *
 * @param url - Resource URL
 * @param options - Fetch options with x402 payment config
 * @returns Standard Response object
 *
 * @example
 * import { x402Fetch } from '@x402/agent';
 *
 * const response = await x402Fetch('https://api.example.com/premium', {
 *   privateKey: '0x...',
 *   network: 'base-mainnet',
 *   maxPrice: '1.00',
 * });
 * const data = await response.json();
 */
export async function x402Fetch(
  url: string | URL,
  options: X402FetchOptions
): Promise<Response> {
  const { privateKey, network, maxPrice, facilitatorUrl, ...fetchOptions } = options;
  const urlString = url.toString();

  // Make initial request
  const initialResponse = await globalThis.fetch(urlString, fetchOptions);

  // If not 402, return as-is
  if (initialResponse.status !== 402) {
    return initialResponse;
  }

  // Parse 402 payment params
  const paymentRequest = await parsePaymentRequired(initialResponse);
  if (!paymentRequest) {
    throw new X402PaymentError(
      'Invalid 402 response — missing payment parameters',
      'INVALID_402_RESPONSE'
    );
  }

  // Check max price guard
  if (maxPrice) {
    const requestedAmount = BigInt(parsePrice(paymentRequest.price));
    const maxAmount = BigInt(parsePrice(maxPrice));
    if (requestedAmount > maxAmount) {
      throw new X402BudgetError(
        `Requested price ${paymentRequest.price} USDC exceeds max price ${maxPrice} USDC`,
        'PER_REQUEST_LIMIT'
      );
    }
  }

  // Create temporary wallet
  const wallet = createAgentWallet(privateKey, network);

  // Build EIP-712 authorization
  const { typedData, authorization } = buildTransferAuthorization({
    from: wallet.address,
    to: paymentRequest.payTo,
    price: paymentRequest.price,
    network,
  });

  // Sign with agent wallet
  const signature = await wallet.signTypedData(typedData);

  // Build and submit facilitator payload
  const payload = buildFacilitatorPayload({
    signature,
    authorization,
    network,
    contentId: paymentRequest.contentId,
  });

  const effectiveFacilitatorUrl = facilitatorUrl || paymentRequest.facilitatorUrl;
  const result = await submitToFacilitator(effectiveFacilitatorUrl, payload);

  // Retry original request with receipt
  const retryHeaders = new Headers(fetchOptions.headers as HeadersInit | undefined);
  retryHeaders.set(X402_HEADERS.RECEIPT, result.receipt);
  retryHeaders.set(X402_PAYMENT_HEADER, result.receipt);

  return globalThis.fetch(urlString, {
    ...fetchOptions,
    headers: retryHeaders,
  });
}
