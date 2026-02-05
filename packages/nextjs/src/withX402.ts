/**
 * @x402/nextjs - App Router API Route Wrapper
 * Wrapper for protecting Next.js App Router API routes with x402
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  buildPaymentRequiredResponse,
  type X402Network,
  type X402Receipt,
  DEFAULT_FACILITATOR_URL,
} from '@x402/core';
import { ReceiptVerifier } from './receiptVerifier';

export interface WithX402Config {
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
  getContentId?: (request: NextRequest, params: RouteParams) => string;
}

export interface X402RouteContext {
  /** Verified receipt */
  receipt: X402Receipt;

  /** Content ID for this request */
  contentId: string;

  /** Receipt token (for forwarding if needed) */
  receiptToken: string;
}

export interface RouteParams {
  params: Promise<Record<string, string | string[]>>;
}

type RouteHandler = (
  request: NextRequest,
  context: RouteParams & { x402: X402RouteContext }
) => Promise<Response> | Response;

/**
 * Wrap an App Router API route with x402 payment protection
 *
 * @param config - Payment configuration
 * @param handler - Route handler to wrap
 * @returns Protected route handler
 *
 * @example
 * // app/api/content/[id]/route.ts
 * import { withX402 } from '@x402/nextjs';
 *
 * export const GET = withX402(
 *   {
 *     price: '0.01',
 *     payTo: process.env.X402_PAY_TO as `0x${string}`,
 *     network: 'base-mainnet',
 *     jwtSecret: process.env.JWT_SECRET!,
 *   },
 *   async (request, { params, x402 }) => {
 *     const { id } = await params;
 *     const content = await getContent(id);
 *     return Response.json({
 *       content,
 *       paidAt: x402.receipt.paidAt,
 *     });
 *   }
 * );
 */
export function withX402(
  config: WithX402Config,
  handler: RouteHandler
): (request: NextRequest, context: RouteParams) => Promise<Response> {
  const verifier = new ReceiptVerifier({
    jwtSecret: config.jwtSecret,
    enableCache: true,
  });

  return async function protectedHandler(
    request: NextRequest,
    context: RouteParams
  ): Promise<Response> {
    // Determine content ID
    const contentId = config.getContentId
      ? config.getContentId(request, context)
      : request.nextUrl.pathname;

    // Verify receipt
    const result = await verifier.verifyFromHeaders(request.headers, contentId);

    if (result.valid && result.receipt && result.token) {
      // Valid receipt - call the handler
      const x402Context: X402RouteContext = {
        receipt: result.receipt,
        contentId,
        receiptToken: result.token,
      };

      return handler(request, {
        ...context,
        x402: x402Context,
      });
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

    return new NextResponse(JSON.stringify(paymentResponse.body), {
      status: 402,
      headers: {
        ...paymentResponse.headers,
        'Content-Type': 'application/json',
      },
    });
  };
}

/**
 * Create a reusable withX402 wrapper with shared configuration
 *
 * @param baseConfig - Base configuration shared across routes
 * @returns Configured withX402 function
 *
 * @example
 * // lib/x402.ts
 * export const withProtectedRoute = createWithX402({
 *   payTo: process.env.X402_PAY_TO as `0x${string}`,
 *   network: 'base-mainnet',
 *   jwtSecret: process.env.JWT_SECRET!,
 * });
 *
 * // app/api/content/[id]/route.ts
 * import { withProtectedRoute } from '@/lib/x402';
 *
 * export const GET = withProtectedRoute(
 *   { price: '0.01' },
 *   async (request, { x402 }) => {
 *     // ...
 *   }
 * );
 */
export function createWithX402(
  baseConfig: Omit<WithX402Config, 'price' | 'description' | 'getContentId'>
) {
  return function configuredWithX402(
    routeConfig: Pick<WithX402Config, 'price' | 'description' | 'getContentId'>,
    handler: RouteHandler
  ) {
    return withX402(
      {
        ...baseConfig,
        ...routeConfig,
      },
      handler
    );
  };
}
