/**
 * @x402/facilitator
 * x402 payment facilitator server
 *
 * Processes USDC micropayments on Base:
 * - Receives EIP-712 signed transfer authorizations
 * - Validates signatures
 * - Executes transfers (mock or on-chain)
 * - Returns signed JWT receipts
 */

import { loadConfig } from './config';
import { createTransferExecutor } from './transfer';
import { startServer } from './server';

// Re-export for programmatic usage
export { loadConfig } from './config';
export { handlePayment } from './handler';
export { calculateFee } from './fee';
export { verifySignature, recoverSigner, resolveNetwork, validateTimeWindow } from './signature';
export { createTransferExecutor } from './transfer';
export { startServer } from './server';
export type { FacilitatorConfig } from './config';
export type { TransferExecutor, TransferResult, FeeBreakdown, ValidatedRequest } from './types';

// Start server when run directly
const config = loadConfig();
const executor = createTransferExecutor(config.mockTransfers);
startServer(config, executor);
