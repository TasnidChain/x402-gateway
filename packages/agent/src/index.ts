/**
 * @x402/agent
 * Autonomous AI agent client for x402 micropayments
 *
 * @example
 * // Full client with budget controls and receipt caching
 * import { createX402Agent } from '@x402/agent';
 *
 * const agent = createX402Agent({
 *   privateKey: '0x...',
 *   network: 'base-mainnet',
 *   budget: { maxPerRequest: '1.00', maxTotal: '100.00' },
 * });
 *
 * const response = await agent.fetch('https://api.example.com/premium');
 *
 * @example
 * // Stateless one-off fetch
 * import { x402Fetch } from '@x402/agent';
 *
 * const response = await x402Fetch('https://api.example.com/premium', {
 *   privateKey: '0x...',
 *   network: 'base-mainnet',
 *   maxPrice: '0.50',
 * });
 */

import { X402AgentClient } from './client';
import type { AgentConfig } from '@x402/core';

// === Factory Function ===

/**
 * Create an x402 agent client
 *
 * @param config - Agent configuration
 * @returns X402AgentClient instance
 *
 * @example
 * const agent = createX402Agent({
 *   privateKey: process.env.AGENT_WALLET_KEY as `0x${string}`,
 *   network: 'base-mainnet',
 *   budget: { maxPerRequest: '1.00', maxTotal: '100.00' },
 * });
 *
 * agent.on('payment_success', (event) => {
 *   console.log(`Paid ${event.amount} for ${event.contentId}`);
 * });
 *
 * const response = await agent.fetch('https://api.example.com/premium');
 * const data = await response.json();
 */
export function createX402Agent(config: AgentConfig): X402AgentClient {
  return new X402AgentClient(config);
}

// === Main Client ===
export { X402AgentClient } from './client';
export type { PaymentEventListener, PaymentEventType, AgentFetchOptions } from './client';

// === Stateless Fetch ===
export { x402Fetch } from './fetch';
export type { X402FetchOptions } from './fetch';

// === Building Blocks ===
export { createAgentWallet } from './wallet';
export type { AgentWallet } from './wallet';

export { BudgetManager } from './budget';
export type { PaymentRecord, SpendCheckResult, BudgetStatus } from './budget';

export { ReceiptCache } from './cache';

// === Re-export core types for convenience ===
export type {
  AgentConfig,
  SpendingPolicy,
  RetryConfig,
  PaymentEvent,
  X402Network,
  X402Receipt,
  PaymentResult,
  TransferAuthorization,
  FacilitatorPayload,
  FacilitatorResponse,
} from '@x402/core';

// === Re-export core errors ===
export {
  X402Error,
  X402PaymentError,
  X402BudgetError,
  X402ReceiptError,
  X402NetworkError,
} from '@x402/core';
