/**
 * @x402/nextjs
 * Next.js middleware and API route wrappers for x402 paywall
 */

// Middleware
export {
  createX402Middleware,
  x402Middleware,
  type X402MiddlewareConfig,
  type ProtectedRoute,
} from './middleware';

// App Router wrapper
export {
  withX402,
  createWithX402,
  type WithX402Config,
  type X402RouteContext,
  type RouteParams,
} from './withX402';

// Pages Router wrapper
export {
  withX402Pages,
  createWithX402Pages,
  type WithX402PagesConfig,
  type X402PagesContext,
} from './withX402Pages';

// Receipt verifier
export {
  ReceiptVerifier,
  createReceiptVerifier,
  type ReceiptVerifierConfig,
} from './receiptVerifier';

// Re-export commonly used types from core
export type {
  X402Network,
  X402Config,
  X402Receipt,
  PaymentRequest,
  RouteConfig,
} from '@x402/core';
