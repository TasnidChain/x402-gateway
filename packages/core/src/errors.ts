/**
 * @x402/core - Error Classes
 * Typed error classes for machine-readable error handling
 */

/**
 * Base error class for all x402 errors
 */
export class X402Error extends Error {
  /** Machine-readable error code */
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'X402Error';
    this.code = code;
  }
}

/**
 * Payment-related errors
 */
export class X402PaymentError extends X402Error {
  constructor(
    message: string,
    code:
      | 'PAYMENT_FAILED'
      | 'FACILITATOR_ERROR'
      | 'INSUFFICIENT_FUNDS'
      | 'SIGNING_FAILED'
      | 'INVALID_402_RESPONSE' = 'PAYMENT_FAILED'
  ) {
    super(message, code);
    this.name = 'X402PaymentError';
  }
}

/**
 * Budget/spending limit errors
 */
export class X402BudgetError extends X402Error {
  constructor(
    message: string,
    code: 'BUDGET_EXCEEDED' | 'PER_REQUEST_LIMIT' | 'DOMAIN_NOT_ALLOWED' = 'BUDGET_EXCEEDED'
  ) {
    super(message, code);
    this.name = 'X402BudgetError';
  }
}

/**
 * Receipt verification errors
 */
export class X402ReceiptError extends X402Error {
  constructor(
    message: string,
    code: 'RECEIPT_EXPIRED' | 'RECEIPT_INVALID' | 'RECEIPT_MISSING' = 'RECEIPT_INVALID'
  ) {
    super(message, code);
    this.name = 'X402ReceiptError';
  }
}

/**
 * Network/connectivity errors
 */
export class X402NetworkError extends X402Error {
  constructor(
    message: string,
    code: 'NETWORK_ERROR' | 'RPC_ERROR' | 'TIMEOUT' = 'NETWORK_ERROR'
  ) {
    super(message, code);
    this.name = 'X402NetworkError';
  }
}
