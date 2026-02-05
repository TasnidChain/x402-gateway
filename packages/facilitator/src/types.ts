/**
 * @x402/facilitator - Types
 * Facilitator-specific type definitions
 */

import type { FacilitatorPayload, TransferAuthorization } from '@x402/core';

/**
 * Parsed and validated request from the client
 */
export interface ValidatedRequest {
  payload: FacilitatorPayload;
  chainId: number;
  authorization: TransferAuthorization;
  signature: `0x${string}`;
  resource: string;
}

/**
 * Result of executing a transfer
 */
export interface TransferResult {
  txHash: `0x${string}`;
  success: boolean;
}

/**
 * Interface for transfer executors (mock or on-chain)
 */
export interface TransferExecutor {
  execute(params: {
    authorization: TransferAuthorization;
    signature: `0x${string}`;
    chainId: number;
  }): Promise<TransferResult>;
}

/**
 * Fee breakdown for a payment
 */
export interface FeeBreakdown {
  /** Original amount in smallest unit */
  totalAmount: string;
  /** Amount going to publisher */
  publisherAmount: string;
  /** Fee amount kept by facilitator */
  feeAmount: string;
  /** Fee percentage applied */
  feePercent: number;
}
