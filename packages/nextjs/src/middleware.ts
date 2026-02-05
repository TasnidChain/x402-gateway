/**
 * @x402/nextjs - Middleware
 * Next.js middleware for route-level content gating with x402
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  buildPaymentRequiredResponse,
  type X402Network,
  DEFAULT_FACILITATOR_URL,
} from '@x402/core';
import { ReceiptVerifier } from './receiptVerifier';

export interface X402MiddlewareConfig {
  /** Publisher's wallet address */
  payTo: `0x${string}`;

  /** Network for payments */
  network: X402Network;

  /** Facilitator URL */
  facilitatorUrl?: string;

  /** JWT secret for receipt verification */
  jwtSecret: string;

  /** Enable receipt caching (default: true) */
  enableCache?: boolean;
}

export interface ProtectedRoute {
  /** Route pattern (string or regex) */
  pattern: string | RegExp;

  /** Price in USDC */
  price: string;

  /** Currency (always USDC in v1) */
  currency?: 'USDC';

  /** Description shown on paywall */
  description?: string;

  /** Content ID extractor (optional, defaults to route path) */
  getContentId?: (pathname: string, params: Record<string, string>) => string;
}

/**
 * Create x402 middleware for Next.js
 *
 * @param config - Middleware configuration
 * @returns Middleware creator with protect method
 *
 * @example
 * // middleware.ts
 * import { createX402Middleware } from '@x402/nextjs';
 *
 * const x402 = createX402Middleware({
 *   payTo: process.env.X402_PAY_TO as `0x${string}`,
 *   network: 'base-mainnet',
 *   jwtSecret: process.env.JWT_SECRET!,
 * });
 *
 * export default x402.protect({
 *   '/api/content/(.*)': {
 *     price: '0.01',
 *     description: 'Premium content',
 *   },
 * });
 *
 * export const config = {
 *   matcher: ['/api/content/:path*'],
 * };
 */
export function createX402Middleware(config: X402MiddlewareConfig) {
  const verifier = new ReceiptVerifier({
    jwtSecret: config.jwtSecret,
    enableCache: config.enableCache ?? true,
  });

  /**
   * Create middleware that protects specified routes
   */
  function protect(
    routes: Record<string, Omit<ProtectedRoute, 'pattern'>>
  ): (request: NextRequest) => Promise<NextResponse | undefined> {
    // Compile route patterns
    const compiledRoutes = Object.entries(routes).map(([pattern, routeConfig]) => ({
      pattern: new RegExp(`^${pattern}$`),
      patternString: pattern,
      ...routeConfig,
    }));

    return async function middleware(request: NextRequest): Promise<NextResponse | undefined> {
      const pathname = request.nextUrl.pathname;

      // Find matching route
      const matchedRoute = compiledRoutes.find(route => route.pattern.test(pathname));

      if (!matchedRoute) {
        // No protected route matched, pass through
        return NextResponse.next();
      }

      // Extract content ID from URL
      const match = pathname.match(matchedRoute.pattern);
      const params: Record<string, string> = {};
      if (match) {
        match.slice(1).forEach((value, index) => {
          params[`$${index + 1}`] = value;
        });
      }

      const contentId = matchedRoute.getContentId
        ? matchedRoute.getContentId(pathname, params)
        : pathname;

      // Check for receipt in headers
      const result = await verifier.verifyFromHeaders(request.headers, contentId);

      if (result.valid && result.receipt) {
        // Valid receipt - allow request with receipt info in headers
        const response = NextResponse.next();

        // Add receipt info to request headers for downstream use
        response.headers.set('X-402-Receipt-Valid', 'true');
        response.headers.set('X-402-Payer', result.receipt.payer);
        response.headers.set('X-402-Paid-At', result.receipt.paidAt.toString());

        return response;
      }

      // No valid receipt - return 402 Payment Required
      const paymentResponse = buildPaymentRequiredResponse({
        payTo: config.payTo,
        price: matchedRoute.price,
        currency: matchedRoute.currency || 'USDC',
        contentId,
        network: config.network,
        facilitatorUrl: config.facilitatorUrl || DEFAULT_FACILITATOR_URL,
        description: matchedRoute.description,
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

  return {
    protect,
    verifier,
  };
}

/**
 * Simple middleware function for protecting a single route pattern
 *
 * @param config - Full configuration including route
 * @returns Next.js middleware function
 *
 * @example
 * // For simple single-route protection
 * export default x402Middleware({
 *   payTo: process.env.X402_PAY_TO as `0x${string}`,
 *   network: 'base-mainnet',
 *   jwtSecret: process.env.JWT_SECRET!,
 *   price: '0.01',
 *   pathPattern: '/api/content/(.*)',
 * });
 */
export function x402Middleware(
  config: X402MiddlewareConfig & {
    price: string;
    pathPattern: string;
    description?: string;
  }
) {
  const x402 = createX402Middleware(config);

  return x402.protect({
    [config.pathPattern]: {
      price: config.price,
      description: config.description,
    },
  });
}
