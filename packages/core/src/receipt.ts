/**
 * @x402/core - Receipt Utilities
 * JWT-based receipt creation, verification, and management
 * Uses jose library for Edge Runtime compatibility
 */

import * as jose from 'jose';
import type { X402Receipt } from './types';
import { DEFAULT_RECEIPT_TTL } from './constants';

/**
 * Generate a unique receipt ID
 */
function generateReceiptId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `rcpt_${timestamp}${random}`;
}

/**
 * Build a receipt object from payment details
 *
 * @param params - Payment details
 * @returns Receipt object (not yet signed)
 */
export function buildReceipt(params: {
  contentId: string;
  payer: `0x${string}`;
  payee: `0x${string}`;
  amount: string;
  currency?: string;
  txHash: `0x${string}`;
  chainId: number;
  facilitator?: string;
  ttlSeconds?: number;
}): X402Receipt {
  const now = Math.floor(Date.now() / 1000);
  const ttl = params.ttlSeconds ?? DEFAULT_RECEIPT_TTL;

  return {
    id: generateReceiptId(),
    contentId: params.contentId,
    payer: params.payer,
    payee: params.payee,
    amount: params.amount,
    currency: params.currency ?? 'USDC',
    txHash: params.txHash,
    chainId: params.chainId,
    paidAt: now,
    expiresAt: now + ttl,
    facilitator: params.facilitator ?? 'https://x402.org/facilitator',
  };
}

/**
 * Create a signed JWT receipt token
 *
 * @param receipt - Receipt to sign
 * @param secret - JWT signing secret
 * @returns JWT token string
 *
 * @example
 * const token = await createReceiptToken(receipt, process.env.JWT_SECRET);
 */
export async function createReceiptToken(
  receipt: X402Receipt,
  secret: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  const token = await new jose.SignJWT({
    ...receipt,
    // Standard JWT claims
    sub: receipt.payer,
    iat: receipt.paidAt,
    exp: receipt.expiresAt,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(receipt.paidAt)
    .setExpirationTime(receipt.expiresAt)
    .sign(secretKey);

  return token;
}

/**
 * Verify a receipt JWT token
 *
 * @param token - JWT token to verify
 * @param options - Verification options
 * @returns Verification result with decoded receipt
 *
 * @example
 * const result = await verifyReceipt(token, { jwtSecret: process.env.JWT_SECRET });
 * if (result.valid) {
 *   console.log('Receipt for:', result.receipt.contentId);
 * }
 */
export async function verifyReceipt(
  token: string,
  options: {
    /** JWT secret for signature verification */
    jwtSecret?: string;
    /** Facilitator public key (for facilitator-signed receipts) */
    facilitatorPublicKey?: string;
    /** Expected content ID (optional additional check) */
    expectedContentId?: string;
  }
): Promise<{
  valid: boolean;
  receipt?: X402Receipt;
  error?: string;
}> {
  try {
    let payload: jose.JWTPayload;

    if (options.jwtSecret) {
      // Verify with symmetric secret
      const secretKey = new TextEncoder().encode(options.jwtSecret);
      const result = await jose.jwtVerify(token, secretKey);
      payload = result.payload;
    } else if (options.facilitatorPublicKey) {
      // Verify with asymmetric public key
      const publicKey = await jose.importSPKI(options.facilitatorPublicKey, 'ES256');
      const result = await jose.jwtVerify(token, publicKey);
      payload = result.payload;
    } else {
      // Decode without verification (for client-side display only)
      const decoded = jose.decodeJwt(token);
      payload = decoded;
    }

    // Extract receipt from payload
    const receipt: X402Receipt = {
      id: payload.id as string,
      contentId: payload.contentId as string,
      payer: payload.payer as `0x${string}`,
      payee: payload.payee as `0x${string}`,
      amount: payload.amount as string,
      currency: payload.currency as string,
      txHash: payload.txHash as `0x${string}`,
      chainId: payload.chainId as number,
      paidAt: payload.paidAt as number,
      expiresAt: payload.expiresAt as number,
      facilitator: payload.facilitator as string,
    };

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (receipt.expiresAt < now) {
      return {
        valid: false,
        receipt,
        error: 'Receipt has expired',
      };
    }

    // Check content ID if specified
    if (options.expectedContentId && receipt.contentId !== options.expectedContentId) {
      return {
        valid: false,
        receipt,
        error: `Receipt is for content "${receipt.contentId}", not "${options.expectedContentId}"`,
      };
    }

    return {
      valid: true,
      receipt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      error: `Receipt verification failed: ${message}`,
    };
  }
}

/**
 * Check if a receipt is valid (not expired and matches content ID)
 * This is a quick client-side check; server should always re-verify
 *
 * @param receipt - Receipt to check
 * @param contentId - Optional content ID to match
 * @returns Whether receipt is valid
 */
export function isReceiptValid(receipt: X402Receipt, contentId?: string): boolean {
  const now = Math.floor(Date.now() / 1000);

  if (receipt.expiresAt < now) {
    return false;
  }

  if (contentId && receipt.contentId !== contentId) {
    return false;
  }

  return true;
}

/**
 * Decode a receipt token without verification
 * Use for displaying receipt info; never trust for authorization
 *
 * @param token - JWT token to decode
 * @returns Decoded receipt or null if invalid format
 */
export function decodeReceipt(token: string): X402Receipt | null {
  try {
    const payload = jose.decodeJwt(token);

    return {
      id: payload.id as string,
      contentId: payload.contentId as string,
      payer: payload.payer as `0x${string}`,
      payee: payload.payee as `0x${string}`,
      amount: payload.amount as string,
      currency: payload.currency as string,
      txHash: payload.txHash as `0x${string}`,
      chainId: payload.chainId as number,
      paidAt: payload.paidAt as number,
      expiresAt: payload.expiresAt as number,
      facilitator: payload.facilitator as string,
    };
  } catch {
    return null;
  }
}

/**
 * Extract receipt token from HTTP headers
 * Checks X-402-Receipt, X-PAYMENT (V2), and Authorization: X402 <token>
 *
 * @param headers - Headers object (Web API Headers or plain object)
 * @returns Receipt token or null
 */
export function extractReceiptFromHeaders(
  headers: Headers | Record<string, string | undefined>
): string | null {
  // Handle Web API Headers
  if (headers instanceof Headers) {
    // Check X-402-Receipt header first
    const receipt = headers.get('X-402-Receipt');
    if (receipt) return receipt;

    // Check X-PAYMENT header (V2 / agent-compatible)
    const xPayment = headers.get('X-PAYMENT');
    if (xPayment) return xPayment;

    // Check Authorization header
    const auth = headers.get('Authorization');
    if (auth?.startsWith('X402 ')) {
      return auth.slice(5);
    }

    return null;
  }

  // Handle plain object
  const receipt = headers['X-402-Receipt'] || headers['x-402-receipt'];
  if (receipt) return receipt;

  // Check X-PAYMENT header (V2 / agent-compatible)
  const xPayment = headers['X-PAYMENT'] || headers['x-payment'];
  if (xPayment) return xPayment;

  const auth = headers['Authorization'] || headers['authorization'];
  if (auth?.startsWith('X402 ')) {
    return auth.slice(5);
  }

  return null;
}

/**
 * Get remaining validity time of a receipt
 *
 * @param receipt - Receipt to check
 * @returns Remaining time in seconds, or 0 if expired
 */
export function getReceiptRemainingTime(receipt: X402Receipt): number {
  const now = Math.floor(Date.now() / 1000);
  const remaining = receipt.expiresAt - now;
  return Math.max(0, remaining);
}

/**
 * Format receipt expiry as human-readable string
 *
 * @param receipt - Receipt to format
 * @returns Human-readable expiry string (e.g., "23 hours", "45 minutes")
 */
export function formatReceiptExpiry(receipt: X402Receipt): string {
  const remaining = getReceiptRemainingTime(receipt);

  if (remaining === 0) {
    return 'Expired';
  }

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
