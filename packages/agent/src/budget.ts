/**
 * @x402/agent - Budget Manager
 * Enforces spending limits and tracks payment history for agent wallets
 */

import type { SpendingPolicy } from '@x402/core';
import { parsePrice, formatPrice } from '@x402/core';
import { X402BudgetError } from '@x402/core';

/**
 * Record of a single payment made by the agent
 */
export interface PaymentRecord {
  /** Content/resource that was paid for */
  contentId: string;

  /** Amount paid in smallest unit */
  amount: string;

  /** Domain of the paid resource */
  domain: string;

  /** Timestamp of payment */
  timestamp: number;
}

/**
 * Result of a spending check
 */
export interface SpendCheckResult {
  /** Whether the spend is allowed */
  allowed: boolean;

  /** Reason if not allowed */
  reason?: string;
}

/**
 * Budget status report
 */
export interface BudgetStatus {
  /** Maximum per-request in USDC (human-readable) or 'unlimited' */
  perRequest: string;

  /** Total remaining in USDC (human-readable) or 'unlimited' */
  totalRemaining: string;

  /** Total spent in USDC (human-readable) */
  totalSpent: string;

  /** Number of payments made */
  paymentCount: number;
}

/**
 * Budget manager for enforcing agent spending policies
 *
 * @example
 * const budget = new BudgetManager({
 *   maxPerRequest: '1.00',
 *   maxTotal: '100.00',
 *   allowedDomains: ['api.example.com'],
 * });
 *
 * const check = budget.checkSpend('0.50', 'api.example.com');
 * if (check.allowed) {
 *   // Proceed with payment
 *   budget.recordSpend('500000', 'article-123', 'api.example.com');
 * }
 */
export class BudgetManager {
  private readonly policy: SpendingPolicy;
  private totalSpent: bigint = 0n;
  private history: PaymentRecord[] = [];

  /** Callback for budget warnings (when 80% consumed) */
  onBudgetWarning?: (remaining: string) => void;

  constructor(policy: SpendingPolicy = {}) {
    this.policy = policy;
  }

  /**
   * Check if a spend amount is allowed under the current policy
   *
   * @param amount - Amount in USDC (human-readable, e.g., "0.50")
   * @param domain - Domain being paid (optional, checked against allowlist)
   * @returns Whether the spend is allowed
   */
  checkSpend(amount: string, domain?: string): SpendCheckResult {
    // Check domain allowlist
    if (domain && this.policy.allowedDomains && this.policy.allowedDomains.length > 0) {
      if (!this.policy.allowedDomains.includes(domain)) {
        return {
          allowed: false,
          reason: `Domain "${domain}" is not in the allowed list`,
        };
      }
    }

    const amountSmallest = BigInt(parsePrice(amount));

    // Check per-request limit
    if (this.policy.maxPerRequest) {
      const maxPerRequest = BigInt(parsePrice(this.policy.maxPerRequest));
      if (amountSmallest > maxPerRequest) {
        return {
          allowed: false,
          reason: `Amount ${amount} USDC exceeds per-request limit of ${this.policy.maxPerRequest} USDC`,
        };
      }
    }

    // Check total limit
    if (this.policy.maxTotal) {
      const maxTotal = BigInt(parsePrice(this.policy.maxTotal));
      const projectedTotal = this.totalSpent + amountSmallest;
      if (projectedTotal > maxTotal) {
        const remaining = maxTotal - this.totalSpent;
        return {
          allowed: false,
          reason: `Would exceed total budget. Remaining: ${formatPrice(remaining.toString(), { symbol: false })} USDC`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Record a completed spend
   *
   * @param amountSmallest - Amount in smallest unit (e.g., "500000" for 0.50 USDC)
   * @param contentId - Content ID that was paid for
   * @param domain - Domain of the resource
   */
  recordSpend(amountSmallest: string, contentId: string, domain: string): void {
    this.totalSpent += BigInt(amountSmallest);

    this.history.push({
      contentId,
      amount: amountSmallest,
      domain,
      timestamp: Date.now(),
    });

    // Check for 80% budget warning
    if (this.policy.maxTotal) {
      const maxTotal = BigInt(parsePrice(this.policy.maxTotal));
      const threshold = (maxTotal * 80n) / 100n;
      if (this.totalSpent >= threshold && this.onBudgetWarning) {
        const remaining = maxTotal - this.totalSpent;
        this.onBudgetWarning(formatPrice(remaining.toString(), { symbol: false }));
      }
    }
  }

  /**
   * Get current budget status
   */
  getStatus(): BudgetStatus {
    const perRequest = this.policy.maxPerRequest
      ? `${this.policy.maxPerRequest} USDC`
      : 'unlimited';

    let totalRemaining = 'unlimited';
    if (this.policy.maxTotal) {
      const maxTotal = BigInt(parsePrice(this.policy.maxTotal));
      const remaining = maxTotal - this.totalSpent;
      totalRemaining = `${formatPrice(remaining.toString(), { symbol: false })} USDC`;
    }

    const totalSpent = formatPrice(this.totalSpent.toString(), { symbol: false });

    return {
      perRequest,
      totalRemaining,
      totalSpent: `${totalSpent} USDC`,
      paymentCount: this.history.length,
    };
  }

  /**
   * Get the remaining total budget in smallest unit (or null if unlimited)
   */
  getRemainingSmallest(): string | null {
    if (!this.policy.maxTotal) return null;
    const maxTotal = BigInt(parsePrice(this.policy.maxTotal));
    const remaining = maxTotal - this.totalSpent;
    return remaining.toString();
  }

  /**
   * Get payment history
   */
  getHistory(): readonly PaymentRecord[] {
    return this.history;
  }

  /**
   * Reset all spending records
   */
  reset(): void {
    this.totalSpent = 0n;
    this.history = [];
  }

  /**
   * Assert that a spend is allowed, throwing if not
   *
   * @param amount - Amount in USDC (human-readable)
   * @param domain - Domain being paid
   * @throws {X402BudgetError} If spend is not allowed
   */
  assertSpend(amount: string, domain?: string): void {
    const check = this.checkSpend(amount, domain);
    if (!check.allowed) {
      // Determine specific error code
      if (domain && this.policy.allowedDomains && !this.policy.allowedDomains.includes(domain)) {
        throw new X402BudgetError(check.reason!, 'DOMAIN_NOT_ALLOWED');
      }
      if (this.policy.maxPerRequest) {
        const maxPerRequest = BigInt(parsePrice(this.policy.maxPerRequest));
        const amountSmallest = BigInt(parsePrice(amount));
        if (amountSmallest > maxPerRequest) {
          throw new X402BudgetError(check.reason!, 'PER_REQUEST_LIMIT');
        }
      }
      throw new X402BudgetError(check.reason!, 'BUDGET_EXCEEDED');
    }
  }
}
