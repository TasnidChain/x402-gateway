/**
 * @x402/cli - Generate Command
 * Generate secrets and configuration snippets
 */

import crypto from 'crypto';
import chalk from 'chalk';

export function generateCommand(type: string): void {
  switch (type) {
    case 'secret':
      generateSecret();
      break;
    case 'config':
      generateConfigSample();
      break;
    default:
      console.log(chalk.red(`Unknown generate type: ${type}`));
      console.log('');
      console.log('Available types:');
      console.log('  secret  - Generate a secure JWT secret');
      console.log('  config  - Generate a sample configuration file');
      process.exit(1);
  }
}

function generateSecret(): void {
  const secret = `x402_${crypto.randomBytes(32).toString('hex')}`;

  console.log(chalk.green('\n🔐 Generated JWT Secret:\n'));
  console.log(chalk.cyan(secret));
  console.log(chalk.gray('\nAdd this to your .env.local as JWT_SECRET\n'));
}

function generateConfigSample(): void {
  const sample = `
// x402.config.ts
import type { X402Config } from '@x402/core';

export const x402Config: X402Config = {
  // Your wallet address that receives payments
  payTo: process.env.X402_PAY_TO as \`0x\${string}\`,

  // Network: 'base-mainnet' for production, 'base-sepolia' for testing
  network: (process.env.X402_NETWORK || 'base-sepolia') as 'base-mainnet' | 'base-sepolia',

  // Facilitator URL (optional, defaults to x402.org)
  facilitatorUrl: process.env.X402_FACILITATOR_URL,

  // Receipt validity in seconds (optional, default: 86400 = 24 hours)
  receiptTTL: 86400,
};

// Route pricing configuration
export const routePricing = {
  '/api/premium/basic': { price: '0.01', description: 'Basic premium content' },
  '/api/premium/pro': { price: '0.10', description: 'Pro premium content' },
  '/api/premium/enterprise': { price: '1.00', description: 'Enterprise content' },
};
`;

  console.log(chalk.green('\n📄 Sample x402 Configuration:\n'));
  console.log(sample);
}
