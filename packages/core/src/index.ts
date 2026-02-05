/**
 * @x402/core
 * Core utilities for x402 paywall - types, receipts, protocol helpers
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Receipt utilities
export {
  buildReceipt,
  createReceiptToken,
  verifyReceipt,
  isReceiptValid,
  decodeReceipt,
  extractReceiptFromHeaders,
  getReceiptRemainingTime,
  formatReceiptExpiry,
} from './receipt';

// x402 protocol utilities
export {
  buildPaymentRequiredResponse,
  parsePaymentRequired,
  parsePaymentRequiredFromParts,
  validatePaymentRequest,
  createAuthenticatedHeaders,
  getX402Version,
} from './x402';

// Pricing utilities
export {
  parsePrice,
  formatPrice,
  validatePrice,
  comparePrice,
  addPrices,
  percentageOfPrice,
} from './pricing';

// EIP-712 utilities
export {
  EIP712_TYPES,
  buildUSDCDomain,
  generateNonce,
  buildTransferAuthorization,
} from './eip712';
export type { BuildTransferAuthorizationParams } from './eip712';

// Facilitator client
export {
  buildFacilitatorPayload,
  submitToFacilitator,
  submitToFacilitatorWithRetry,
} from './facilitator';

// Error classes
export {
  X402Error,
  X402PaymentError,
  X402BudgetError,
  X402ReceiptError,
  X402NetworkError,
} from './errors';
