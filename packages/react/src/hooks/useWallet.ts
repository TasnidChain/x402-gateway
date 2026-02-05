/**
 * @x402/react - useWallet Hook
 * Wallet connection using Coinbase Wallet SDK
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { createCoinbaseWalletSDK } from '@coinbase/wallet-sdk';
import { createWalletClient, custom, type WalletClient, type Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import type { X402Network } from '@x402/core';
import { NUMERIC_CHAIN_IDS } from '@x402/core';

export interface UseWalletOptions {
  /** App name shown in wallet */
  appName?: string;
  /** App logo URL */
  appLogoUrl?: string;
  /** Preferred network */
  network?: X402Network;
}

export interface UseWalletReturn {
  /** Connected wallet address */
  address: Address | null;
  /** Whether wallet is connected */
  isConnected: boolean;
  /** Whether connection is in progress */
  isConnecting: boolean;
  /** Current chain ID */
  chainId: number | null;
  /** Connect wallet */
  connect: () => Promise<Address>;
  /** Disconnect wallet */
  disconnect: () => void;
  /** Switch to specified chain */
  switchChain: (chainId: number) => Promise<void>;
  /** Sign typed data (EIP-712) */
  signTypedData: (params: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<`0x${string}`>;
  /** Wallet client for custom operations */
  walletClient: WalletClient | null;
  /** Last error */
  error: Error | null;
}

/**
 * Hook for wallet connection and operations
 *
 * @example
 * const { address, isConnected, connect, signTypedData } = useWallet({
 *   appName: 'My App',
 *   network: 'base-mainnet',
 * });
 *
 * if (!isConnected) {
 *   return <button onClick={connect}>Connect Wallet</button>;
 * }
 */
export function useWallet(options: UseWalletOptions = {}): UseWalletReturn {
  const { appName = 'x402 Paywall', appLogoUrl, network = 'base-mainnet' } = options;

  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  const sdkRef = useRef<ReturnType<typeof createCoinbaseWalletSDK> | null>(null);
  const providerRef = useRef<any>(null);

  // Initialize SDK
  const getSDK = useCallback(() => {
    if (!sdkRef.current) {
      sdkRef.current = createCoinbaseWalletSDK({
        appName,
        appLogoUrl,
      });
    }
    return sdkRef.current;
  }, [appName, appLogoUrl]);

  // Get provider
  const getProvider = useCallback(() => {
    if (!providerRef.current) {
      const sdk = getSDK();
      providerRef.current = sdk.getProvider();
    }
    return providerRef.current;
  }, [getSDK]);

  // Connect wallet
  const connect = useCallback(async (): Promise<Address> => {
    setIsConnecting(true);
    setError(null);

    try {
      const provider = getProvider();

      // Request accounts
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as Address[];

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from wallet');
      }

      const userAddress = accounts[0];
      setAddress(userAddress);

      // Get chain ID
      const chainIdHex = (await provider.request({
        method: 'eth_chainId',
      })) as string;
      const currentChainId = parseInt(chainIdHex, 16);
      setChainId(currentChainId);

      // Create wallet client
      const chain = network === 'base-mainnet' ? base : baseSepolia;
      const client = createWalletClient({
        account: userAddress,
        chain,
        transport: custom(provider),
      });
      setWalletClient(client);

      // Check if on correct chain
      const targetChainId = NUMERIC_CHAIN_IDS[network];
      if (currentChainId !== targetChainId) {
        // Try to switch chain
        try {
          await switchChain(targetChainId);
        } catch (switchError) {
          console.warn('Failed to switch chain:', switchError);
          // Continue anyway - user may switch manually
        }
      }

      return userAddress;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to connect wallet');
      setError(error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [getProvider, network]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setWalletClient(null);
    setError(null);

    // Clear provider reference to force re-initialization
    providerRef.current = null;
  }, []);

  // Switch chain
  const switchChain = useCallback(
    async (targetChainId: number): Promise<void> => {
      const provider = getProvider();

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        });
        setChainId(targetChainId);

        // Update wallet client with new chain
        if (address) {
          const chain = targetChainId === 8453 ? base : baseSepolia;
          const client = createWalletClient({
            account: address,
            chain,
            transport: custom(provider),
          });
          setWalletClient(client);
        }
      } catch (err: any) {
        // Chain not added - try to add it
        if (err.code === 4902) {
          const chain = targetChainId === 8453 ? base : baseSepolia;
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${targetChainId.toString(16)}`,
                chainName: chain.name,
                nativeCurrency: chain.nativeCurrency,
                rpcUrls: [chain.rpcUrls.default.http[0]],
                blockExplorerUrls: [chain.blockExplorers?.default.url],
              },
            ],
          });
          setChainId(targetChainId);
        } else {
          throw err;
        }
      }
    },
    [getProvider, address]
  );

  // Sign typed data (EIP-712)
  const signTypedData = useCallback(
    async (params: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }): Promise<`0x${string}`> => {
      if (!address) {
        throw new Error('Wallet not connected');
      }

      const provider = getProvider();

      const signature = (await provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(params)],
      })) as `0x${string}`;

      return signature;
    },
    [address, getProvider]
  );

  // Listen for account changes
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;

    const handleAccountsChanged = (accounts: Address[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== address) {
        setAddress(accounts[0]);
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      setChainId(newChainId);
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
    };
  }, [address, disconnect]);

  return {
    address,
    isConnected: !!address,
    isConnecting,
    chainId,
    connect,
    disconnect,
    switchChain,
    signTypedData,
    walletClient,
    error,
  };
}
