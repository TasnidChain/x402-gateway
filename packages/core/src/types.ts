/**
 * @x402/core - Type Definitions
 * All shared TypeScript interfaces for the x402 paywall SDK
 */

// === Network Configuration ===

/**
 * Supported networks for x402 payments
 */
export type X402Network = 'base-mainnet' | 'base-sepolia';

// === Publisher Configuration ===

/**
 * Global configuration for x402 paywall
 */
export interface X402Config {
  /** Publisher's wallet address (receives payments) */
  payTo: `0x${string}`;

  /** Network to use for payments */
  network: X402Network;

  /** Facilitator URL (defaults to x402.org facilitator) */
  facilitatorUrl?: string;

  /** Receipt signing secret (server-side only, for self-signed receipts) */
  receiptSecret?: string;

  /** Custom receipt TTL in seconds (default: 86400 = 24 hours) */
  receiptTTL?: number;
}

// === Paywall Configuration ===

/**
 * Configuration for a specific paywall instance
 */
export interface PaywallConfig {
  /** Price in USDC (e.g., "0.01" for 1 cent) */
  price: string;

  /** Currency - USDC only in v1 */
  currency: 'USDC';

  /** Unique content identifier (used for receipt scoping) */
  contentId: string;

  /** Human-readable description shown on paywall */
  description?: string;

  /** Optional: override global network for this paywall */
  network?: X402Network;
}

// === Receipt Types ===

/**
 * Receipt issued after successful payment
 * This JWT is stored client-side and sent with requests to unlock content
 */
export interface X402Receipt {
  /** Unique receipt ID */
  id: string;

  /** Content ID this receipt unlocks */
  contentId: string;

  /** Payer's wallet address */
  payer: `0x${string}`;

  /** Payee's wallet address */
  payee: `0x${string}`;

  /** Amount paid in smallest unit (6 decimals for USDC) */
  amount: string;

  /** Currency */
  currency: string;

  /** Transaction hash on-chain */
  txHash: `0x${string}`;

  /** Chain ID where payment occurred */
  chainId: number;

  /** Timestamp of payment (Unix seconds) */
  paidAt: number;

  /** Expiry timestamp (Unix seconds) */
  expiresAt: number;

  /** Facilitator URL that issued this receipt */
  facilitator: string;
}

/**
 * JWT-encoded receipt with signature
 */
export interface SignedReceipt {
  /** The JWT token string */
  token: string;

  /** Decoded receipt data */
  receipt: X402Receipt;
}

// === Payment Flow Types ===

/**
 * Payment request parameters extracted from 402 response
 */
export interface PaymentRequest {
  /** Publisher's wallet address */
  payTo: `0x${string}`;

  /** Price in USDC (human-readable, e.g., "0.01") */
  price: string;

  /** Currency (always USDC) */
  currency: string;

  /** Content identifier */
  contentId: string;

  /** Network identifier */
  network: X402Network;

  /** Facilitator URL for payment processing */
  facilitatorUrl: string;

  /** Optional description */
  description?: string;
}

/**
 * Result of a payment attempt
 */
export interface PaymentResult {
  /** Whether payment succeeded */
  success: boolean;

  /** Receipt if payment succeeded */
  receipt?: X402Receipt;

  /** JWT token if payment succeeded */
  receiptToken?: string;

  /** Error message if payment failed */
  error?: string;

  /** Transaction hash if available */
  txHash?: `0x${string}`;
}

// === HTTP 402 Response Types ===

/**
 * Headers returned in a 402 Payment Required response
 */
export interface X402Headers {
  'X-402-PayTo': string;
  'X-402-Price': string;
  'X-402-Currency': string;
  'X-402-Network': string;
  'X-402-Facilitator': string;
  'X-402-Content-Id': string;
  'X-402-Description'?: string;
}

/**
 * Body of a 402 Payment Required response
 */
export interface X402ResponseBody {
  payTo: `0x${string}`;
  price: string;
  currency: string;
  contentId: string;
  network: X402Network;
  facilitatorUrl: string;
  description?: string;
  accepts: PaymentScheme[];
}

/**
 * Payment scheme accepted by the facilitator
 */
export interface PaymentScheme {
  /** Scheme identifier (e.g., "exact") */
  scheme: string;

  /** Network chain ID */
  network: string;

  /** Maximum amount in smallest unit */
  maxAmountRequired: string;

  /** Resource identifier */
  resource: string;

  /** Payment description */
  description: string;

  /** MIME type of payload */
  mimeType: string;

  /** Payment payload (e.g., EIP-712 typed data) */
  payload: unknown;
}

// === React Component Props ===
// Note: These props use generic types to avoid React dependency in core package.
// The actual React types are defined in @x402/react package.

/**
 * Props for the main X402Paywall component
 */
export interface X402PaywallProps {
  /** Price in USDC (e.g., "0.01") */
  price: string;

  /** Unique content identifier */
  contentId: string;

  /** Server endpoint that returns protected content */
  contentEndpoint: string;

  /** Optional: description shown on paywall */
  description?: string;

  /** Optional: custom paywall UI component */
  renderPaywall?: (props: PaywallRenderProps) => unknown;

  /** Optional: custom content renderer */
  renderContent?: (props: ContentRenderProps) => unknown;

  /** Optional: callback on successful payment */
  onPaymentSuccess?: (receipt: X402Receipt) => void;

  /** Optional: callback on payment failure */
  onPaymentError?: (error: Error) => void;

  /** Children rendered as preview/teaser (always visible) */
  children?: unknown;
}

/**
 * Props passed to custom paywall renderer
 */
export interface PaywallRenderProps {
  /** Formatted price (e.g., "$0.01") */
  price: string;

  /** Currency symbol */
  currency: string;

  /** Optional description */
  description?: string;

  /** Whether wallet is connected */
  isConnected: boolean;

  /** Whether payment is being processed */
  isProcessing: boolean;

  /** Current status message */
  statusMessage?: string;

  /** Trigger payment */
  onPay: () => Promise<void>;

  /** Connect wallet */
  onConnect: () => Promise<void>;

  /** Error if any */
  error?: Error | null;
}

/**
 * Props passed to custom content renderer
 */
export interface ContentRenderProps {
  /** The fetched content (HTML string or JSON) */
  content: unknown;

  /** The receipt that unlocked this content */
  receipt: X402Receipt;
}

/**
 * Props for the X402Provider
 */
export interface X402ProviderProps {
  /** Global x402 configuration */
  config: X402Config;

  /** Child components */
  children: unknown;
}

// === Middleware Types ===

/**
 * Route configuration for middleware
 */
export interface RouteConfig {
  /** Route pattern (regex string) */
  pattern: string;

  /** Price in USDC */
  price: string;

  /** Currency */
  currency: 'USDC';

  /** Optional description */
  description?: string;
}

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /** Publisher wallet address */
  payTo: `0x${string}`;

  /** Network */
  network: X402Network;

  /** Facilitator URL */
  facilitatorUrl?: string;

  /** JWT secret for receipt verification */
  receiptSecret?: string;
}

/**
 * Context passed to protected route handlers
 */
export interface X402Context {
  /** Verified receipt */
  receipt: X402Receipt;

  /** Content ID from the route */
  contentId: string;
}

// === Agent Types ===

/**
 * Configuration for an x402 agent client
 */
export interface AgentConfig {
  /** Agent's private key for signing transactions */
  privateKey: `0x${string}`;

  /** Network for payments */
  network: X402Network;

  /** Spending limits and policies */
  budget?: SpendingPolicy;

  /** Facilitator URL override */
  facilitatorUrl?: string;

  /** Receipt TTL in seconds (default: 86400) */
  receiptTTL?: number;

  /** Retry configuration for facilitator requests */
  retryConfig?: RetryConfig;
}

/**
 * Spending policy to enforce agent budget limits
 */
export interface SpendingPolicy {
  /** Maximum USDC per single request (e.g., "1.00") */
  maxPerRequest?: string;

  /** Maximum USDC lifetime spend (e.g., "100.00") */
  maxTotal?: string;

  /** Whitelist of allowed domains (if set, only these domains can be paid) */
  allowedDomains?: string[];
}

/**
 * Retry configuration for facilitator requests
 */
export interface RetryConfig {
  /** Maximum number of retries (default: 2) */
  maxRetries?: number;

  /** Base backoff in milliseconds (default: 1000) */
  backoffMs?: number;
}

/**
 * Event emitted during agent payment lifecycle
 */
export interface PaymentEvent {
  /** Event type */
  type: 'payment_started' | 'payment_success' | 'payment_failed' | 'budget_warning';

  /** Content ID being paid for */
  contentId: string;

  /** Amount in USDC (human-readable) */
  amount?: string;

  /** Receipt if payment succeeded */
  receipt?: X402Receipt;

  /** Error if payment failed */
  error?: Error;

  /** Remaining budget in USDC */
  budgetRemaining?: string;

  /** Unix timestamp of event */
  timestamp: number;
}

/**
 * EIP-3009 transfer authorization parameters
 */
export interface TransferAuthorization {
  /** Sender address */
  from: `0x${string}`;

  /** Recipient address */
  to: `0x${string}`;

  /** Amount in smallest unit (string for BigInt compatibility) */
  value: string;

  /** Unix timestamp after which authorization is valid */
  validAfter: number;

  /** Unix timestamp before which authorization is valid */
  validBefore: number;

  /** Random 32-byte nonce */
  nonce: `0x${string}`;
}

/**
 * Payload sent to the x402 facilitator
 */
export interface FacilitatorPayload {
  /** Protocol version */
  x402Version: number;

  /** Payment scheme (e.g., "exact") */
  scheme: string;

  /** CAIP-2 network identifier (e.g., "eip155:8453") */
  network: string;

  /** Signed payment data */
  payload: {
    /** EIP-712 signature */
    signature: `0x${string}`;

    /** Transfer authorization details */
    authorization: TransferAuthorization;
  };

  /** Resource/content identifier */
  resource: string;
}

/**
 * Response from the x402 facilitator
 */
export interface FacilitatorResponse {
  /** JWT receipt token */
  receipt: string;

  /** On-chain transaction hash (if available) */
  txHash?: `0x${string}`;
}

// === Utility Types ===

/**
 * Hex-encoded string
 */
export type Hex = `0x${string}`;

/**
 * Address type (20 bytes)
 */
export type Address = `0x${string}`;

/**
 * Transaction hash type (32 bytes)
 */
export type TransactionHash = `0x${string}`;

