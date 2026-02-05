/**
 * @x402/agent - Agent Wallet
 * Server-side wallet using viem's privateKeyToAccount for headless signing
 */

import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import type { X402Network } from '@x402/core';
import { USDC_ADDRESSES, RPC_URLS } from '@x402/core';

/**
 * ERC-20 balanceOf ABI fragment
 */
const ERC20_BALANCE_OF_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Chain configuration mapping
 */
const CHAINS: Record<X402Network, typeof base | typeof baseSepolia> = {
  'base-mainnet': base,
  'base-sepolia': baseSepolia,
};

/**
 * Agent wallet interface for server-side signing
 */
export interface AgentWallet {
  /** Wallet address derived from private key */
  readonly address: `0x${string}`;

  /** Sign EIP-712 typed data */
  signTypedData(params: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: `0x${string}`;
    };
    types: Record<string, readonly { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;

  /** Get USDC balance in smallest unit */
  getBalance(): Promise<string>;
}

/**
 * Create an agent wallet from a private key
 *
 * @param privateKey - Hex-encoded private key (with 0x prefix)
 * @param network - Target network
 * @returns AgentWallet instance
 *
 * @example
 * const wallet = createAgentWallet('0xprivatekey...', 'base-mainnet');
 * console.log(wallet.address); // '0x...'
 * const balance = await wallet.getBalance(); // '1000000' (1 USDC)
 */
export function createAgentWallet(
  privateKey: `0x${string}`,
  network: X402Network
): AgentWallet {
  const account = privateKeyToAccount(privateKey);
  const chain = CHAINS[network];

  const publicClient = createPublicClient({
    chain,
    transport: http(RPC_URLS[network]),
  });

  return {
    address: account.address,

    async signTypedData(params): Promise<`0x${string}`> {
      return account.signTypedData({
        domain: params.domain,
        types: params.types,
        primaryType: params.primaryType,
        message: params.message,
      });
    },

    async getBalance(): Promise<string> {
      const balance = await publicClient.readContract({
        address: USDC_ADDRESSES[network],
        abi: ERC20_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      });

      return balance.toString();
    },
  };
}
