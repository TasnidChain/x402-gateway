/**
 * @x402/core - EIP-712 Utilities
 * Pure functions for building USDC transferWithAuthorization typed data
 */

import type { X402Network, TransferAuthorization } from './types';
import { USDC_ADDRESSES, NUMERIC_CHAIN_IDS } from './constants';
import { parsePrice } from './pricing';

/**
 * EIP-712 type definition for TransferWithAuthorization (EIP-3009)
 */
export const EIP712_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

/**
 * Build the EIP-712 domain for USDC on a given network
 *
 * @param network - Target network
 * @returns EIP-712 domain separator
 */
export function buildUSDCDomain(network: X402Network): {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
} {
  return {
    name: 'USD Coin',
    version: '2',
    chainId: NUMERIC_CHAIN_IDS[network],
    verifyingContract: USDC_ADDRESSES[network],
  };
}

/**
 * Generate a random 32-byte hex nonce for transfer authorization
 *
 * Uses globalThis.crypto.getRandomValues which is available in:
 * - All modern browsers
 * - Node.js 18+ (via globalThis.crypto)
 *
 * @returns Hex-encoded 32-byte nonce
 */
export function generateNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);

  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`;
}

export interface BuildTransferAuthorizationParams {
  /** Sender's wallet address */
  from: `0x${string}`;

  /** Recipient's wallet address */
  to: `0x${string}`;

  /** Price in USDC (human-readable, e.g., "0.01") */
  price: string;

  /** Target network */
  network: X402Network;

  /** Authorization validity window start (default: 0 = immediately valid) */
  validAfter?: number;

  /** Authorization validity window end (default: now + 3600 = 1 hour) */
  validBefore?: number;

  /** Custom nonce (default: random 32 bytes) */
  nonce?: `0x${string}`;
}

/**
 * Build the full EIP-712 typed data for a USDC transferWithAuthorization
 *
 * @param params - Transfer parameters
 * @returns Complete EIP-712 typed data object + authorization details
 *
 * @example
 * const { typedData, authorization } = buildTransferAuthorization({
 *   from: '0xSender...',
 *   to: '0xRecipient...',
 *   price: '0.01',
 *   network: 'base-mainnet',
 * });
 * // Sign typedData with wallet, use authorization for facilitator payload
 */
export function buildTransferAuthorization(params: BuildTransferAuthorizationParams): {
  typedData: {
    domain: ReturnType<typeof buildUSDCDomain>;
    types: typeof EIP712_TYPES;
    primaryType: 'TransferWithAuthorization';
    message: {
      from: `0x${string}`;
      to: `0x${string}`;
      value: string;
      validAfter: number;
      validBefore: number;
      nonce: `0x${string}`;
    };
  };
  authorization: TransferAuthorization;
} {
  const {
    from,
    to,
    price,
    network,
    validAfter = 0,
    validBefore = Math.floor(Date.now() / 1000) + 3600,
    nonce = generateNonce(),
  } = params;

  const amountInSmallestUnit = parsePrice(price);
  const domain = buildUSDCDomain(network);

  const message = {
    from,
    to,
    value: amountInSmallestUnit,
    validAfter,
    validBefore,
    nonce,
  };

  const authorization: TransferAuthorization = {
    from,
    to,
    value: amountInSmallestUnit,
    validAfter,
    validBefore,
    nonce,
  };

  return {
    typedData: {
      domain,
      types: EIP712_TYPES,
      primaryType: 'TransferWithAuthorization',
      message,
    },
    authorization,
  };
}
