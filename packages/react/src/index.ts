/**
 * @x402/react
 * React components and hooks for x402 paywall
 */

// Provider
export { X402Provider, useX402, useX402Config, useX402Wallet, useX402Theme, useX402ThemeSafe } from './context/X402Provider';
export type { X402ProviderProps, X402ContextValue } from './context/X402Provider';

// Components
export { X402Paywall, PaywallGate } from './components/X402Paywall';
export type { X402PaywallComponentProps } from './components/X402Paywall';

export { PaywallOverlay, Spinner } from './components/PaywallOverlay';
export type { PaywallOverlayProps } from './components/PaywallOverlay';

export { ReceiptBadge, ReceiptIndicator } from './components/ReceiptBadge';
export type { ReceiptBadgeProps } from './components/ReceiptBadge';

// Hooks
export { useWallet } from './hooks/useWallet';
export type { UseWalletOptions, UseWalletReturn } from './hooks/useWallet';

export { useReceipt, hasValidReceipt, getAllReceipts, clearAllReceipts } from './hooks/useReceipt';
export type { UseReceiptOptions, UseReceiptReturn } from './hooks/useReceipt';

export { useX402Payment } from './hooks/useX402Payment';
export type { UseX402PaymentOptions, UseX402PaymentReturn, PaymentStatus } from './hooks/useX402Payment';

// Theme
export { defaultTheme, darkTheme, createStyles, injectKeyframes } from './styles/theme';
export type { X402Theme } from './styles/theme';

// Re-export commonly used types from core
export type {
  X402Config,
  X402Receipt,
  PaywallConfig,
  PaymentRequest,
  PaymentResult,
  PaywallRenderProps,
  ContentRenderProps,
  X402Network,
} from '@x402/core';
