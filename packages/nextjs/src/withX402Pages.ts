/**
 * @x402/nextjs - Pages Router API Route Wrapper
 * Wrapper for protecting Next.js Pages Router API routes with x402
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  buildPaymentRequiredResponse,
  type X402Network,
  type X402Receipt,
  DEFAULT_FACILITATOR_URL,
} from '@x402/core';
import { ReceiptVerifier } from './receiptVerifier';

export interface WithX402PagesConfig {
  /** Price in USDC */
  price: string;

  /** Currency (always USDC in v1) */
  currency?: 'USDC';

  /** Publisher's wallet address */
  payTo: `0x${string}`;

  /** Network for payments */
  network: X402Network;

  /** JWT secret for receipt verification */
  jwtSecret: string;

  /** Facilitator URL */
  facilitatorUrl?: string;

  /** Description shown on paywall */
  description?: string;

  /** Custom content ID extractor */
  getContentId?: (req: NextApiRequest) => string;
}

export interface X402PagesContext {
  /** Verified receipt */
  receipt: X402Receipt;

  /** Content ID for this request */
  contentId: string;

  /** Receipt token (for forwarding if needed) */
  receiptToken: string;
}

type PagesRouteHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  x402: X402PagesContext
) => Promise<void> | void;

/**
 * Wrap a Pages Router API route with x402 payment protection
 *
 * @param config - Payment configuration
 * @param handler - Route handler to wrap
 * @returns Protected route handler
 *
 * @example
 * // pages/api/content/[id].ts
 * import { withX402Pages } from '@x402/nextjs';
 *
 * export default withX402Pages(
 *   {
 *     price: '0.01',
 *     payTo: process.env.X402_PAY_TO as `0x${string}`,
 *     network: 'base-mainnet',
 *     jwtSecret: process.env.JWT_SECRET!,
 *   },
 *   async (req, res, x402) => {
 *     const { id } = req.query;
 *     const content = await getContent(id as string);
 *     res.json({
 *       content,
 *       paidAt: x402.receipt.paidAt,
 *     });
 *   }
 * );
 */
export function withX402Pages(
  config: WithX402PagesConfig,
  handler: PagesRouteHandler
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  const verifier = new ReceiptVerifier({
    jwtSecret: config.jwtSecret,
    enableCache: true,
  });

  return async function protectedHandler(
    req: NextApiRequest,
    res: NextApiResponse
  ): Promise<void> {
    // Determine content ID
    const contentId = config.getContentId
      ? config.getContentId(req)
      : req.url || '/';

    // Convert headers to the format expected by extractReceiptFromHeaders
    const headers: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      headers[key] = Array.isArray(value) ? value[0] : value;
    }

    // Verify receipt
    const result = await verifier.verifyFromHeaders(headers, contentId);

    if (result.valid && result.receipt && result.token) {
      // Valid receipt - call the handler
      const x402Context: X402PagesContext = {
        receipt: result.receipt,
        contentId,
        receiptToken: result.token,
      };

      return handler(req, res, x402Context);
    }

    // No valid receipt - return 402
    const paymentResponse = buildPaymentRequiredResponse({
      payTo: config.payTo,
      price: config.price,
      currency: config.currency || 'USDC',
      contentId,
      network: config.network,
      facilitatorUrl: config.facilitatorUrl || DEFAULT_FACILITATOR_URL,
      description: config.description,
    });

    // Set headers
    for (const [key, value] of Object.entries(paymentResponse.headers)) {
      res.setHeader(key, value);
    }

    res.status(402).json(paymentResponse.body);
  };
}

/**
 * Create a reusable withX402Pages wrapper with shared configuration
 *
 * @param baseConfig - Base configuration shared across routes
 * @returns Configured withX402Pages function
 *
 * @example
 * // lib/x402.ts
 * export const withProtectedRoute = createWithX402Pages({
 *   payTo: process.env.X402_PAY_TO as `0x${string}`,
 *   network: 'base-mainnet',
 *   jwtSecret: process.env.JWT_SECRET!,
 * });
 *
 * // pages/api/content/[id].ts
 * import { withProtectedRoute } from '@/lib/x402';
 *
 * export default withProtectedRoute(
 *   { price: '0.01' },
 *   async (req, res, x402) => {
 *     // ...
 *   }
 * );
 */
export function createWithX402Pages(
  baseConfig: Omit<WithX402PagesConfig, 'price' | 'description' | 'getContentId'>
) {
  return function configuredWithX402Pages(
    routeConfig: Pick<WithX402PagesConfig, 'price' | 'description' | 'getContentId'>,
    handler: PagesRouteHandler
  ) {
    return withX402Pages(
      {
        ...baseConfig,
        ...routeConfig,
      },
      handler
    );
  };
}
