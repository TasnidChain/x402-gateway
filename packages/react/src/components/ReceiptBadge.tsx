/**
 * @x402/react - ReceiptBadge
 * Badge component showing unlock status and expiry
 */

import React from 'react';
import type { X402Receipt } from '@x402/core';
import { formatReceiptExpiry } from '@x402/core';
import { createStyles, defaultTheme, type X402Theme } from '../styles/theme';
import { useX402ThemeSafe } from '../context/X402Provider';

export interface ReceiptBadgeProps {
  /** Receipt to display */
  receipt: X402Receipt;
  /** Show expiry time */
  showExpiry?: boolean;
  /** Custom theme override */
  theme?: X402Theme;
  /** Additional styles */
  style?: React.CSSProperties;
  /** Additional class name */
  className?: string;
}

/**
 * Badge showing that content has been unlocked
 *
 * @example
 * {receipt && <ReceiptBadge receipt={receipt} showExpiry />}
 */
export function ReceiptBadge({
  receipt,
  showExpiry = true,
  theme: themeProp,
  style,
  className,
}: ReceiptBadgeProps): React.ReactElement {
  // Use provided theme or context theme
  const contextTheme = useX402ThemeSafe();
  const theme: X402Theme = themeProp || contextTheme || defaultTheme;

  const styles = createStyles(theme);
  const expiryText = formatReceiptExpiry(receipt);

  return (
    <span
      className={className}
      style={{
        ...styles.badge,
        ...style,
      }}
    >
      <span>✓</span>
      <span>Unlocked</span>
      {showExpiry && expiryText !== 'Expired' && (
        <span style={{ opacity: 0.8 }}>• {expiryText}</span>
      )}
    </span>
  );
}

/**
 * Compact receipt indicator (just a checkmark)
 */
export function ReceiptIndicator({
  receipt,
  theme: themeProp,
  style,
}: {
  receipt: X402Receipt;
  theme?: X402Theme;
  style?: React.CSSProperties;
}): React.ReactElement {
  const contextTheme = useX402ThemeSafe();
  const theme: X402Theme = themeProp || contextTheme || defaultTheme;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        backgroundColor: theme.colors.success + '20',
        color: theme.colors.success,
        fontSize: '12px',
        ...style,
      }}
      title={`Unlocked • ${formatReceiptExpiry(receipt)}`}
    >
      ✓
    </span>
  );
}
