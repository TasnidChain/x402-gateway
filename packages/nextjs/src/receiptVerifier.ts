/**
 * @x402/nextjs - Receipt Verifier
 * Server-side receipt verification for protected routes
 */

import {
  verifyReceipt,
  extractReceiptFromHeaders,
  type X402Receipt,
} from '@x402/core';

export interface ReceiptVerifierConfig {
  /** JWT secret for receipt verification */
  jwtSecret: string;

  /** Facilitator public key (optional, for facilitator-signed receipts) */
  facilitatorPublicKey?: string;

  /** Cache verified receipts to reduce verification overhead */
  enableCache?: boolean;

  /** Cache TTL in milliseconds (default: 60000 = 1 minute) */
  cacheTTL?: number;
}

interface CachedReceipt {
  receipt: X402Receipt;
  verifiedAt: number;
}

/**
 * Server-side receipt verifier with optional caching
 */
export class ReceiptVerifier {
  private config: ReceiptVerifierConfig;
  private cache: Map<string, CachedReceipt>;

  constructor(config: ReceiptVerifierConfig) {
    this.config = {
      enableCache: true,
      cacheTTL: 60000,
      ...config,
    };
    this.cache = new Map();
  }

  /**
   * Verify a receipt token
   *
   * @param token - JWT receipt token
   * @param expectedContentId - Expected content ID (optional)
   * @returns Verification result
   */
  async verify(
    token: string,
    expectedContentId?: string
  ): Promise<{
    valid: boolean;
    receipt?: X402Receipt;
    error?: string;
  }> {
    // Check cache first
    if (this.config.enableCache) {
      const cached = this.cache.get(token);
      if (cached) {
        const age = Date.now() - cached.verifiedAt;
        if (age < (this.config.cacheTTL ?? 60000)) {
          // Verify content ID match if specified
          if (expectedContentId && cached.receipt.contentId !== expectedContentId) {
            return {
              valid: false,
              error: `Receipt is for "${cached.receipt.contentId}", not "${expectedContentId}"`,
            };
          }
          return { valid: true, receipt: cached.receipt };
        }
        // Cache expired, remove it
        this.cache.delete(token);
      }
    }

    // Verify the token
    const result = await verifyReceipt(token, {
      jwtSecret: this.config.jwtSecret,
      facilitatorPublicKey: this.config.facilitatorPublicKey,
      expectedContentId,
    });

    // Cache if valid
    if (result.valid && result.receipt && this.config.enableCache) {
      this.cache.set(token, {
        receipt: result.receipt,
        verifiedAt: Date.now(),
      });

      // Clean up old cache entries periodically
      if (this.cache.size > 1000) {
        this.cleanCache();
      }
    }

    return result;
  }

  /**
   * Verify receipt from request headers
   *
   * @param headers - Request headers (Web API Headers or plain object)
   * @param expectedContentId - Expected content ID (optional)
   * @returns Verification result
   */
  async verifyFromHeaders(
    headers: Headers | Record<string, string | undefined>,
    expectedContentId?: string
  ): Promise<{
    valid: boolean;
    receipt?: X402Receipt;
    error?: string;
    token?: string;
  }> {
    const token = extractReceiptFromHeaders(headers);

    if (!token) {
      return {
        valid: false,
        error: 'No receipt token found in headers',
      };
    }

    const result = await this.verify(token, expectedContentId);
    return {
      ...result,
      token,
    };
  }

  /**
   * Clear the verification cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    const ttl = this.config.cacheTTL ?? 60000;

    for (const [token, cached] of this.cache.entries()) {
      if (now - cached.verifiedAt > ttl) {
        this.cache.delete(token);
      }
    }
  }
}

/**
 * Create a receipt verifier instance
 *
 * @param config - Verifier configuration
 * @returns ReceiptVerifier instance
 *
 * @example
 * const verifier = createReceiptVerifier({
 *   jwtSecret: process.env.JWT_SECRET!,
 * });
 *
 * const result = await verifier.verifyFromHeaders(request.headers, 'article-123');
 */
export function createReceiptVerifier(config: ReceiptVerifierConfig): ReceiptVerifier {
  return new ReceiptVerifier(config);
}
