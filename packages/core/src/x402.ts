/**
 * @x402/core - x402 Protocol Utilities
 * HTTP 402 response building and parsing per the x402 specification
 */

import type {
  X402Network,
  X402ResponseBody,
  PaymentRequest,
  PaymentScheme,
} from './types';
import { CHAIN_IDS, DEFAULT_FACILITATOR_URL, USDC_ADDRESSES, X402_HEADERS } from './constants';
import { parsePrice } from './pricing';

/**
 * Build a 402 Payment Required response
 *
 * @param config - Payment configuration
 * @returns Response object with status, headers, and body
 *
 * @example
 * const response = buildPaymentRequiredResponse({
 *   payTo: '0x1234...',
 *   price: '0.01',
 *   contentId: 'article-123',
 *   network: 'base-mainnet',
 * });
 *
 * return new Response(JSON.stringify(response.body), {
 *   status: response.status,
 *   headers: response.headers,
 * });
 */
export function buildPaymentRequiredResponse(config: {
  payTo: `0x${string}`;
  price: string;
  currency?: string;
  contentId: string;
  network: X402Network;
  facilitatorUrl?: string;
  description?: string;
}): {
  status: 402;
  headers: Record<string, string>;
  body: X402ResponseBody;
} {
  const {
    payTo,
    price,
    currency = 'USDC',
    contentId,
    network,
    facilitatorUrl = DEFAULT_FACILITATOR_URL,
    description,
  } = config;

  const amountInSmallestUnit = parsePrice(price);
  const chainId = CHAIN_IDS[network];
  const usdcAddress = USDC_ADDRESSES[network];

  // Build headers
  const headers: Record<string, string> = {
    [X402_HEADERS.PAY_TO]: payTo,
    [X402_HEADERS.PRICE]: price,
    [X402_HEADERS.CURRENCY]: currency,
    [X402_HEADERS.NETWORK]: network,
    [X402_HEADERS.FACILITATOR]: facilitatorUrl,
    [X402_HEADERS.CONTENT_ID]: contentId,
    'Content-Type': 'application/json',
  };

  if (description) {
    headers[X402_HEADERS.DESCRIPTION] = description;
  }

  // Build payment scheme (EIP-3009 transferWithAuthorization)
  const paymentScheme: PaymentScheme = {
    scheme: 'exact',
    network: chainId,
    maxAmountRequired: amountInSmallestUnit,
    resource: contentId,
    description: description || `Payment for ${contentId}`,
    mimeType: 'application/json',
    payload: {
      // EIP-712 typed data for USDC transferWithAuthorization
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization',
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: network === 'base-mainnet' ? 8453 : 84532,
        verifyingContract: usdcAddress,
      },
      message: {
        to: payTo,
        value: amountInSmallestUnit,
        // from, validAfter, validBefore, nonce filled by client
      },
    },
  };

  // Build response body
  const body: X402ResponseBody = {
    payTo,
    price,
    currency,
    contentId,
    network,
    facilitatorUrl,
    description,
    accepts: [paymentScheme],
  };

  return {
    status: 402,
    headers,
    body,
  };
}

/**
 * Parse a 402 response into a PaymentRequest
 *
 * @param response - Fetch Response object or parsed data
 * @returns PaymentRequest if valid 402, null otherwise
 *
 * @example
 * const response = await fetch('/api/content/article-123');
 * if (response.status === 402) {
 *   const paymentRequest = await parsePaymentRequired(response);
 *   if (paymentRequest) {
 *     // Initiate payment flow
 *   }
 * }
 */
export async function parsePaymentRequired(
  response: Response
): Promise<PaymentRequest | null> {
  if (response.status !== 402) {
    return null;
  }

  try {
    // Try to get info from headers first
    const headers = response.headers;
    const body = await response.json() as Partial<X402ResponseBody>;

    // Prefer body values, fall back to headers
    const payTo = (body.payTo || headers.get(X402_HEADERS.PAY_TO)) as `0x${string}`;
    const price = body.price || headers.get(X402_HEADERS.PRICE);
    const currency = body.currency || headers.get(X402_HEADERS.CURRENCY) || 'USDC';
    const contentId = body.contentId || headers.get(X402_HEADERS.CONTENT_ID);
    const network = (body.network || headers.get(X402_HEADERS.NETWORK)) as X402Network;
    const facilitatorUrl = body.facilitatorUrl || headers.get(X402_HEADERS.FACILITATOR) || DEFAULT_FACILITATOR_URL;
    const description = body.description || headers.get(X402_HEADERS.DESCRIPTION) || undefined;

    if (!payTo || !price || !contentId || !network) {
      console.error('Missing required 402 response fields:', { payTo, price, contentId, network });
      return null;
    }

    return {
      payTo,
      price,
      currency,
      contentId,
      network,
      facilitatorUrl,
      description,
    };
  } catch (error) {
    console.error('Failed to parse 402 response:', error);
    return null;
  }
}

/**
 * Parse 402 response from headers and body directly (for server-side use)
 *
 * @param headers - Headers object
 * @param body - Parsed body object
 * @returns PaymentRequest if valid, null otherwise
 */
export function parsePaymentRequiredFromParts(
  headers: Record<string, string | undefined>,
  body: Partial<X402ResponseBody>
): PaymentRequest | null {
  const payTo = (body.payTo || headers[X402_HEADERS.PAY_TO]) as `0x${string}`;
  const price = body.price || headers[X402_HEADERS.PRICE];
  const currency = body.currency || headers[X402_HEADERS.CURRENCY] || 'USDC';
  const contentId = body.contentId || headers[X402_HEADERS.CONTENT_ID];
  const network = (body.network || headers[X402_HEADERS.NETWORK]) as X402Network;
  const facilitatorUrl = body.facilitatorUrl || headers[X402_HEADERS.FACILITATOR] || DEFAULT_FACILITATOR_URL;
  const description = body.description || headers[X402_HEADERS.DESCRIPTION];

  if (!payTo || !price || !contentId || !network) {
    return null;
  }

  return {
    payTo,
    price,
    currency,
    contentId,
    network,
    facilitatorUrl,
    description,
  };
}

/**
 * Validate that a payment request has all required fields
 *
 * @param request - Payment request to validate
 * @returns Validation result
 */
export function validatePaymentRequest(
  request: Partial<PaymentRequest>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!request.payTo) {
    errors.push('Missing payTo address');
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(request.payTo)) {
    errors.push('Invalid payTo address format');
  }

  if (!request.price) {
    errors.push('Missing price');
  } else {
    try {
      parsePrice(request.price);
    } catch {
      errors.push('Invalid price format');
    }
  }

  if (!request.contentId) {
    errors.push('Missing contentId');
  }

  if (!request.network) {
    errors.push('Missing network');
  } else if (!['base-mainnet', 'base-sepolia'].includes(request.network)) {
    errors.push('Invalid network (must be base-mainnet or base-sepolia)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create headers with receipt for authenticated requests
 *
 * @param receiptToken - JWT receipt token
 * @returns Headers object with receipt
 */
export function createAuthenticatedHeaders(receiptToken: string): Record<string, string> {
  return {
    [X402_HEADERS.RECEIPT]: receiptToken,
  };
}

/**
 * Get the x402 specification version supported
 */
export function getX402Version(): string {
  return '1.0';
}
