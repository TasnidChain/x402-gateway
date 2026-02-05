/**
 * @x402/core - Facilitator Client
 * Functions for building and submitting payment requests to the x402 facilitator
 */

import type {
  TransferAuthorization,
  FacilitatorPayload,
  FacilitatorResponse,
  X402Network,
} from './types';
import { NUMERIC_CHAIN_IDS } from './constants';
import { X402PaymentError, X402NetworkError } from './errors';

/**
 * Build the facilitator request payload
 *
 * @param params - Payment parameters
 * @returns Facilitator request payload
 *
 * @example
 * const payload = buildFacilitatorPayload({
 *   signature: '0x...',
 *   authorization: { from, to, value, validAfter, validBefore, nonce },
 *   network: 'base-mainnet',
 *   contentId: 'article-123',
 * });
 */
export function buildFacilitatorPayload(params: {
  /** EIP-712 signature from wallet */
  signature: `0x${string}`;

  /** Transfer authorization details */
  authorization: TransferAuthorization;

  /** Target network */
  network: X402Network;

  /** Content/resource identifier */
  contentId: string;
}): FacilitatorPayload {
  const { signature, authorization, network, contentId } = params;
  const chainId = NUMERIC_CHAIN_IDS[network];

  return {
    x402Version: 1,
    scheme: 'exact',
    network: `eip155:${chainId}`,
    payload: {
      signature,
      authorization: {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value,
        validAfter: authorization.validAfter,
        validBefore: authorization.validBefore,
        nonce: authorization.nonce,
      },
    },
    resource: contentId,
  };
}

/**
 * Submit a payment to the x402 facilitator
 *
 * @param facilitatorUrl - Facilitator endpoint URL
 * @param payload - Payment payload
 * @returns Facilitator response with receipt and optional txHash
 * @throws {X402PaymentError} If facilitator returns an error
 * @throws {X402NetworkError} If network request fails
 *
 * @example
 * const result = await submitToFacilitator(
 *   'https://x402.org/facilitator',
 *   facilitatorPayload
 * );
 * console.log(result.receipt); // JWT token
 * console.log(result.txHash);  // On-chain tx hash
 */
export async function submitToFacilitator(
  facilitatorUrl: string,
  payload: FacilitatorPayload
): Promise<FacilitatorResponse> {
  let response: Response;

  try {
    response = await fetch(facilitatorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new X402NetworkError(
      `Failed to reach facilitator at ${facilitatorUrl}: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'NETWORK_ERROR'
    );
  }

  if (!response.ok) {
    let errorMessage: string;
    try {
      const errorData = await response.json() as { error?: string; message?: string };
      errorMessage = errorData.error || errorData.message || `Facilitator error: ${response.status}`;
    } catch {
      errorMessage = `Facilitator error: ${response.status} ${response.statusText}`;
    }

    throw new X402PaymentError(errorMessage, 'FACILITATOR_ERROR');
  }

  const result = await response.json() as { receipt?: string; token?: string; txHash?: `0x${string}` };

  const receiptToken = result.receipt || result.token;
  if (!receiptToken) {
    throw new X402PaymentError('No receipt returned from facilitator', 'FACILITATOR_ERROR');
  }

  return {
    receipt: receiptToken,
    txHash: result.txHash,
  };
}

/**
 * Submit to facilitator with retry logic
 *
 * @param facilitatorUrl - Facilitator endpoint URL
 * @param payload - Payment payload
 * @param options - Retry options
 * @returns Facilitator response
 */
export async function submitToFacilitatorWithRetry(
  facilitatorUrl: string,
  payload: FacilitatorPayload,
  options: { maxRetries?: number; backoffMs?: number } = {}
): Promise<FacilitatorResponse> {
  const { maxRetries = 2, backoffMs = 1000 } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await submitToFacilitator(facilitatorUrl, payload);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry non-retryable errors
      if (err instanceof X402PaymentError && err.code !== 'FACILITATOR_ERROR') {
        throw err;
      }

      // Don't retry on last attempt
      if (attempt < maxRetries) {
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new X402PaymentError('Facilitator request failed after retries', 'FACILITATOR_ERROR');
}
