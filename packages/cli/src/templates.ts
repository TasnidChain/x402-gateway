/**
 * @x402/cli - Code Templates
 * Templates for scaffolding x402 in Next.js projects
 */

export const ENV_TEMPLATE = (config: {
  payTo: string;
  network: string;
  jwtSecret?: string;
}) => `# x402 Paywall Configuration
X402_PAY_TO=${config.payTo}
X402_NETWORK=${config.network}
X402_FACILITATOR_URL=https://x402.org/facilitator

# JWT Secret for receipt verification (generate a secure random string)
JWT_SECRET=${config.jwtSecret || 'your-jwt-secret-here-generate-a-secure-one'}
`;

export const MIDDLEWARE_TEMPLATE = `import { createX402Middleware } from '@x402/nextjs';

const x402 = createX402Middleware({
  payTo: process.env.X402_PAY_TO as \`0x\${string}\`,
  network: process.env.X402_NETWORK as 'base-mainnet' | 'base-sepolia',
  jwtSecret: process.env.JWT_SECRET!,
});

export default x402.protect({
  '/api/premium/(.*)': {
    price: '0.01',
    description: 'Premium content access',
  },
});

export const config = {
  matcher: ['/api/premium/:path*'],
};
`;

export const APP_ROUTER_TEMPLATE = `import { withX402 } from '@x402/nextjs';
import { NextRequest } from 'next/server';

export const GET = withX402(
  {
    price: '0.01',
    payTo: process.env.X402_PAY_TO as \`0x\${string}\`,
    network: process.env.X402_NETWORK as 'base-mainnet' | 'base-sepolia',
    jwtSecret: process.env.JWT_SECRET!,
    description: 'Premium content',
  },
  async (request: NextRequest, { x402 }) => {
    // This code only runs after successful payment verification
    // x402.receipt contains the verified receipt

    return Response.json({
      content: '<h2>Premium Content</h2><p>You have unlocked this content!</p>',
      paidAt: new Date(x402.receipt.paidAt * 1000).toISOString(),
      expiresAt: new Date(x402.receipt.expiresAt * 1000).toISOString(),
    });
  }
);
`;

export const LAYOUT_TEMPLATE = `import { X402Provider } from '@x402/react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <X402Provider
          config={{
            payTo: process.env.NEXT_PUBLIC_X402_PAY_TO as \`0x\${string}\`,
            network: (process.env.NEXT_PUBLIC_X402_NETWORK || 'base-sepolia') as 'base-mainnet' | 'base-sepolia',
          }}
          appName="My App"
        >
          {children}
        </X402Provider>
      </body>
    </html>
  );
}
`;

export const PAGE_TEMPLATE = `'use client';

import { X402Paywall } from '@x402/react';

export default function PremiumPage() {
  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h1>Premium Content Demo</h1>
      <p>This is a demo of x402 paywall integration.</p>

      <div style={{ marginTop: '2rem' }}>
        <X402Paywall
          price="0.01"
          contentId="premium-content-1"
          contentEndpoint="/api/premium"
          description="Unlock this premium content for just $0.01"
        >
          {/* This teaser content is always visible */}
          <div style={{
            padding: '2rem',
            background: 'linear-gradient(to bottom, transparent, white)',
            filter: 'blur(2px)',
            userSelect: 'none',
          }}>
            <h2>Exclusive Content</h2>
            <p>This premium content contains valuable insights that...</p>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit...</p>
          </div>
        </X402Paywall>
      </div>
    </main>
  );
}
`;

export const CONFIG_TEMPLATE = `import type { X402Config } from '@x402/core';

export const x402Config: X402Config = {
  payTo: process.env.X402_PAY_TO as \`0x\${string}\`,
  network: (process.env.X402_NETWORK || 'base-sepolia') as 'base-mainnet' | 'base-sepolia',
  facilitatorUrl: process.env.X402_FACILITATOR_URL,
};
`;

export const GITIGNORE_ADDITIONS = `
# x402 local config
.env.local
.env*.local
`;
