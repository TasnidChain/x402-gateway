/**
 * @x402/agent - X402 Agent Client
 * Main class orchestrating the autonomous payment flow for AI agents
 */

import {
  parsePaymentRequired,
  buildTransferAuthorization,
  buildFacilitatorPayload,
  submitToFacilitatorWithRetry,
  formatPrice,
  parsePrice,
  X402PaymentError,
  X402_PAYMENT_HEADER,
  X402_HEADERS,
  DEFAULT_FACILITATOR_URL,
} from '@x402/core';
import type {
  AgentConfig,
  PaymentEvent,
  PaymentRequest,
  X402Network,
} from '@x402/core';
import { createAgentWallet, type AgentWallet } from './wallet';
import { BudgetManager } from './budget';
import { ReceiptCache } from './cache';

/**
 * Listener type for payment events
 */
export type PaymentEventListener = (event: PaymentEvent) => void;

/**
 * Event types emitted by X402AgentClient
 */
export type PaymentEventType = PaymentEvent['type'];

/**
 * Options for agent fetch requests
 */
export interface AgentFetchOptions extends Omit<RequestInit, 'headers'> {
  /** Custom headers (receipt headers are added automatically) */
  headers?: Record<string, string>;

  /** Override max price for this request (USDC, e.g., "0.50") */
  maxPrice?: string;
}

/**
 * X402 Agent Client — autonomous payment client for AI agents
 *
 * Provides a drop-in `fetch()` replacement that automatically detects 402 Payment Required
 * responses, signs EIP-712 authorizations, submits to the facilitator, and caches receipts.
 *
 * @example
 * const client = new X402AgentClient({
 *   privateKey: '0x...',
 *   network: 'base-mainnet',
 *   budget: { maxPerRequest: '1.00', maxTotal: '100.00' },
 * });
 *
 * // Auto-handles 402 responses
 * const response = await client.fetch('https://api.example.com/premium');
 * const data = await response.json();
 *
 * // Events
 * client.on('payment_success', (event) => {
 *   console.log(`Paid ${event.amount} for ${event.contentId}`);
 * });
 */
export class X402AgentClient {
  private readonly wallet: AgentWallet;
  private readonly network: X402Network;
  private readonly budget: BudgetManager;
  private readonly receiptCache: ReceiptCache;
  private readonly facilitatorUrl: string;
  private readonly retryConfig: { maxRetries: number; backoffMs: number };
  private readonly listeners = new Map<PaymentEventType, Set<PaymentEventListener>>();

  constructor(config: AgentConfig) {
    this.wallet = createAgentWallet(config.privateKey, config.network);
    this.network = config.network;
    this.facilitatorUrl = config.facilitatorUrl ?? DEFAULT_FACILITATOR_URL;
    this.retryConfig = {
      maxRetries: config.retryConfig?.maxRetries ?? 2,
      backoffMs: config.retryConfig?.backoffMs ?? 1000,
    };

    // Set up budget manager
    this.budget = new BudgetManager(config.budget);
    this.budget.onBudgetWarning = (remaining: string) => {
      this.emit('budget_warning', {
        type: 'budget_warning',
        contentId: '',
        budgetRemaining: remaining,
        timestamp: Date.now(),
      });
    };

    // Set up receipt cache
    this.receiptCache = new ReceiptCache(config.receiptTTL ?? 86400);
  }

  // === Event Emitter ===

  /**
   * Register an event listener
   */
  on(event: PaymentEventType, listener: PaymentEventListener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  /**
   * Remove an event listener
   */
  off(event: PaymentEventType, listener: PaymentEventListener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  /**
   * Emit a payment event
   */
  private emit(event: PaymentEventType, payload: PaymentEvent): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch {
          // Swallow listener errors to prevent breaking the payment flow
        }
      }
    }
  }

  // === Core API ===

  /**
   * Fetch a resource, automatically handling 402 Payment Required responses
   *
   * Flow:
   * 1. Check receipt cache → attach header if available
   * 2. Make request to URL
   * 3. If 200: return response
   * 4. If 402: parse payment params, check budget, sign, submit, cache receipt, retry
   *
   * @param url - Resource URL
   * @param options - Fetch options (headers, body, etc.)
   * @returns Standard Response object
   */
  async fetch(url: string | URL, options?: AgentFetchOptions): Promise<Response> {
    const urlString = url.toString();
    const contentId = this.extractContentId(urlString);
    const headers = new Headers(options?.headers);

    // Try cached receipt first
    const cachedToken = this.receiptCache.get(contentId);
    if (cachedToken) {
      headers.set(X402_HEADERS.RECEIPT, cachedToken);
      headers.set(X402_PAYMENT_HEADER, cachedToken);

      const response = await globalThis.fetch(urlString, {
        ...options,
        headers,
      });

      // If cached receipt still works, return
      if (response.ok) {
        return response;
      }

      // If 402, receipt expired — fall through to pay again
      if (response.status === 402) {
        this.receiptCache.delete(contentId);
      } else {
        return response;
      }
    }

    // Make initial request without receipt
    const initialResponse = await globalThis.fetch(urlString, {
      ...options,
      headers,
    });

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

    // Pay and retry
    return this.payAndRetry(urlString, paymentRequest, options);
  }

  /**
   * Explicitly pay for a resource (without fetching content)
   *
   * @param url - Resource URL to pay for
   * @returns Receipt token
   */
  async pay(url: string): Promise<{ receiptToken: string; txHash?: `0x${string}` }> {
    const response = await globalThis.fetch(url);

    if (response.status !== 402) {
      throw new X402PaymentError(
        `Expected 402 response, got ${response.status}`,
        'PAYMENT_FAILED'
      );
    }

    const paymentRequest = await parsePaymentRequired(response);
    if (!paymentRequest) {
      throw new X402PaymentError(
        'Invalid 402 response — missing payment parameters',
        'INVALID_402_RESPONSE'
      );
    }

    return this.executePayment(paymentRequest);
  }

  /**
   * Get a cached receipt token for a content ID
   */
  getReceipt(contentId: string): string | null {
    return this.receiptCache.get(contentId);
  }

  /**
   * Get the agent wallet's USDC balance
   */
  async getBalance(): Promise<string> {
    return this.wallet.getBalance();
  }

  /**
   * Get current budget status
   */
  getBudgetStatus() {
    return this.budget.getStatus();
  }

  /**
   * Get the agent wallet address
   */
  get address(): `0x${string}` {
    return this.wallet.address;
  }

  /**
   * Get payment history
   */
  getPaymentHistory() {
    return this.budget.getHistory();
  }

  /**
   * Reset budget tracking and receipt cache
   */
  reset(): void {
    this.budget.reset();
    this.receiptCache.clear();
  }

  // === Private Methods ===

  /**
   * Execute payment and retry the original request with the receipt
   */
  private async payAndRetry(
    url: string,
    paymentRequest: PaymentRequest,
    options?: AgentFetchOptions
  ): Promise<Response> {
    const { receiptToken } = await this.executePayment(paymentRequest);

    // Retry original request with receipt
    const retryHeaders = new Headers(options?.headers);
    retryHeaders.set(X402_HEADERS.RECEIPT, receiptToken);
    retryHeaders.set(X402_PAYMENT_HEADER, receiptToken);

    return globalThis.fetch(url, {
      ...options,
      headers: retryHeaders,
    });
  }

  /**
   * Execute the full payment flow: budget check → sign → submit → cache
   */
  private async executePayment(
    paymentRequest: PaymentRequest
  ): Promise<{ receiptToken: string; txHash?: `0x${string}` }> {
    const { contentId, price } = paymentRequest;
    const domain = this.extractDomain(paymentRequest.facilitatorUrl);

    // Emit payment started
    this.emit('payment_started', {
      type: 'payment_started',
      contentId,
      amount: price,
      timestamp: Date.now(),
    });

    try {
      // Check budget
      this.budget.assertSpend(price, domain);

      // Build EIP-712 typed data
      const { typedData, authorization } = buildTransferAuthorization({
        from: this.wallet.address,
        to: paymentRequest.payTo,
        price,
        network: this.network,
      });

      // Sign with agent wallet
      const signature = await this.wallet.signTypedData(typedData);

      // Build facilitator payload
      const payload = buildFacilitatorPayload({
        signature,
        authorization,
        network: this.network,
        contentId,
      });

      // Submit to facilitator (with retry)
      const facilitatorUrl = paymentRequest.facilitatorUrl || this.facilitatorUrl;
      const result = await submitToFacilitatorWithRetry(facilitatorUrl, payload, this.retryConfig);

      // Cache receipt
      this.receiptCache.set(contentId, result.receipt);

      // Record spend
      const amountSmallest = parsePrice(price);
      this.budget.recordSpend(amountSmallest, contentId, domain);

      // Emit success
      const remaining = this.budget.getRemainingSmallest();
      this.emit('payment_success', {
        type: 'payment_success',
        contentId,
        amount: price,
        budgetRemaining: remaining
          ? formatPrice(remaining, { symbol: false })
          : undefined,
        timestamp: Date.now(),
      });

      return {
        receiptToken: result.receipt,
        txHash: result.txHash,
      };
    } catch (err) {
      // Emit failure
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('payment_failed', {
        type: 'payment_failed',
        contentId,
        amount: price,
        error,
        timestamp: Date.now(),
      });

      throw err;
    }
  }

  /**
   * Extract a content ID from a URL (uses pathname as identifier)
   */
  private extractContentId(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.host}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  /**
   * Extract domain from a URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
}
