/**
 * @x402/core - Constants
 * Network addresses, contract addresses, and configuration defaults
 */

import type { X402Network } from './types';

/**
 * CAIP-2 chain identifiers
 */
export const CHAIN_IDS: Record<X402Network, string> = {
  'base-mainnet': 'eip155:8453',
  'base-sepolia': 'eip155:84532',
} as const;

/**
 * Numeric chain IDs for wallet operations
 */
export const NUMERIC_CHAIN_IDS: Record<X402Network, number> = {
  'base-mainnet': 8453,
  'base-sepolia': 84532,
} as const;

/**
 * USDC contract addresses by network
 */
export const USDC_ADDRESSES: Record<X402Network, `0x${string}`> = {
  'base-mainnet': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
} as const;

/**
 * Default facilitator URL
 */
export const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';

/**
 * USDC decimals (always 6)
 */
export const USDC_DECIMALS = 6;

/**
 * Default receipt TTL in seconds (24 hours)
 */
export const DEFAULT_RECEIPT_TTL = 86400;

/**
 * Minimum price in USDC (0.001 = $0.001)
 */
export const MIN_PRICE_USDC = '0.001';

/**
 * RPC URLs for each network
 */
export const RPC_URLS: Record<X402Network, string> = {
  'base-mainnet': 'https://mainnet.base.org',
  'base-sepolia': 'https://sepolia.base.org',
} as const;

/**
 * Block explorer URLs
 */
export const EXPLORER_URLS: Record<X402Network, string> = {
  'base-mainnet': 'https://basescan.org',
  'base-sepolia': 'https://sepolia.basescan.org',
} as const;

/**
 * x402 HTTP headers
 */
export const X402_HEADERS = {
  PAY_TO: 'X-402-PayTo',
  PRICE: 'X-402-Price',
  CURRENCY: 'X-402-Currency',
  NETWORK: 'X-402-Network',
  FACILITATOR: 'X-402-Facilitator',
  CONTENT_ID: 'X-402-Content-Id',
  DESCRIPTION: 'X-402-Description',
  RECEIPT: 'X-402-Receipt',
} as const;

/**
 * x402 V2 payment headers
 */
export const X402_PAYMENT_HEADER = 'X-PAYMENT';
export const X402_PAYMENT_RESPONSE = 'X-PAYMENT-RESPONSE';

/**
 * Storage keys for client-side persistence
 */
export const STORAGE_KEYS = {
  RECEIPT_PREFIX: 'x402:receipt:',
  WALLET_ADDRESS: 'x402:wallet',
} as const;
