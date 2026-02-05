/**
 * @x402/react - X402Provider
 * Global context provider for x402 configuration and wallet state
 */

import React, { createContext, useContext, useMemo, useEffect, type ReactNode } from 'react';
import type { X402Config, X402Network } from '@x402/core';
import { DEFAULT_FACILITATOR_URL } from '@x402/core';
import { useWallet, type UseWalletReturn } from '../hooks/useWallet';
import { defaultTheme, injectKeyframes, type X402Theme } from '../styles/theme';

export interface X402ContextValue {
  /** Global configuration */
  config: X402Config;
  /** Wallet state and methods */
  wallet: UseWalletReturn;
  /** Theme for components */
  theme: X402Theme;
}

const X402Context = createContext<X402ContextValue | null>(null);

export interface X402ProviderProps {
  /** Configuration for x402 */
  config: {
    /** Publisher's wallet address */
    payTo: `0x${string}`;
    /** Network for payments */
    network: X402Network;
    /** Facilitator URL (optional) */
    facilitatorUrl?: string;
    /** Receipt TTL in seconds (optional) */
    receiptTTL?: number;
  };
  /** Custom theme (optional) */
  theme?: X402Theme;
  /** App name shown in wallet (optional) */
  appName?: string;
  /** App logo URL (optional) */
  appLogoUrl?: string;
  /** Child components */
  children: ReactNode;
}

/**
 * Provider component for x402 configuration
 *
 * @example
 * // app/layout.tsx
 * import { X402Provider } from '@x402/react';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <X402Provider
 *           config={{
 *             payTo: '0xYourWalletAddress',
 *             network: 'base-mainnet',
 *           }}
 *         >
 *           {children}
 *         </X402Provider>
 *       </body>
 *     </html>
 *   );
 * }
 */
export function X402Provider({
  config,
  theme = defaultTheme,
  appName,
  appLogoUrl,
  children,
}: X402ProviderProps): React.ReactElement {
  // Validate config
  useEffect(() => {
    if (!config.payTo) {
      console.error('[x402] Missing payTo address in X402Provider config');
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(config.payTo)) {
      console.error('[x402] Invalid payTo address format');
    }
  }, [config.payTo]);

  // Inject CSS keyframes for animations
  useEffect(() => {
    injectKeyframes();
  }, []);

  // Initialize wallet
  const wallet = useWallet({
    appName,
    appLogoUrl,
    network: config.network,
  });

  // Build full config with defaults
  const fullConfig: X402Config = useMemo(
    () => ({
      payTo: config.payTo,
      network: config.network,
      facilitatorUrl: config.facilitatorUrl || DEFAULT_FACILITATOR_URL,
      receiptTTL: config.receiptTTL,
    }),
    [config]
  );

  // Build context value
  const contextValue: X402ContextValue = useMemo(
    () => ({
      config: fullConfig,
      wallet,
      theme,
    }),
    [fullConfig, wallet, theme]
  );

  return <X402Context.Provider value={contextValue}>{children}</X402Context.Provider>;
}

/**
 * Hook to access x402 context
 *
 * @example
 * const { config, wallet, theme } = useX402();
 */
export function useX402(): X402ContextValue {
  const context = useContext(X402Context);

  if (!context) {
    throw new Error('useX402 must be used within an X402Provider');
  }

  return context;
}

/**
 * Hook to access x402 config only
 */
export function useX402Config(): X402Config {
  return useX402().config;
}

/**
 * Hook to access wallet from x402 context
 */
export function useX402Wallet(): UseWalletReturn {
  return useX402().wallet;
}

/**
 * Hook to access theme from x402 context
 */
export function useX402Theme(): X402Theme {
  return useX402().theme;
}

/**
 * Safe hook to access theme - returns null if outside provider
 * Useful for components that can work with or without provider
 */
export function useX402ThemeSafe(): X402Theme | null {
  const context = useContext(X402Context);
  return context?.theme ?? null;
}
