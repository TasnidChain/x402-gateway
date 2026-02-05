/**
 * @x402/facilitator - Transfer Execution Interface
 * Defines the contract for executing USDC transfers on-chain
 */

import type { TransferExecutor, TransferResult } from './types';
import type { TransferAuthorization } from '@x402/core';

export type { TransferExecutor, TransferResult };

/**
 * Create the appropriate transfer executor based on configuration
 */
export function createTransferExecutor(mock: boolean): TransferExecutor {
  if (mock) {
    return new MockTransferExecutor();
  }

  // Future: return new OnChainTransferExecutor(privateKey, rpcUrl);
  throw new Error('On-chain transfer executor not yet implemented. Set MOCK_TRANSFERS=true');
}

/**
 * Mock transfer executor for development and testing
 * Returns a deterministic fake txHash based on the authorization nonce
 */
class MockTransferExecutor implements TransferExecutor {
  async execute(params: {
    authorization: TransferAuthorization;
    signature: `0x${string}`;
    chainId: number;
  }): Promise<TransferResult> {
    const { authorization, chainId } = params;

    // Generate a deterministic fake txHash from the nonce
    const nonce = authorization.nonce.slice(2); // strip 0x
    const txHash = `0x${'00'.repeat(12)}${nonce.slice(0, 40)}` as `0x${string}`;

    console.log(
      `[mock] Transfer: ${authorization.from} → ${authorization.to} | ${authorization.value} units | chain ${chainId} | tx ${txHash}`
    );

    return { txHash, success: true };
  }
}
