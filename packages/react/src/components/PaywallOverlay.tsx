/**
 * @x402/react - PaywallOverlay
 * Default paywall UI component with blur overlay and payment card
 */

import React, { useState } from 'react';
import type { PaywallRenderProps } from '@x402/core';
import { createStyles, defaultTheme, type X402Theme } from '../styles/theme';
import { useX402ThemeSafe } from '../context/X402Provider';

export interface PaywallOverlayProps extends PaywallRenderProps {
  /** Custom theme override */
  theme?: X402Theme;
}

/**
 * Default paywall overlay UI
 *
 * States:
 * - locked: Shows price and pay button
 * - connecting: Shows connecting spinner
 * - processing: Shows processing spinner with status
 * - error: Shows error message with retry
 */
export function PaywallOverlay({
  price,
  currency,
  description,
  isConnected,
  isProcessing,
  statusMessage,
  onPay,
  onConnect,
  error,
  theme: themeProp,
}: PaywallOverlayProps): React.ReactElement {
  // Use provided theme or context theme
  const contextTheme = useX402ThemeSafe();
  const theme: X402Theme = themeProp || contextTheme || defaultTheme;

  const styles = createStyles(theme);
  const [isHovered, setIsHovered] = useState(false);

  const handlePay = async () => {
    if (!isConnected) {
      await onConnect();
    }
    await onPay();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Lock icon */}
        <div style={styles.lockIcon}>
          {isProcessing ? (
            <div style={styles.spinner} />
          ) : error ? (
            '⚠️'
          ) : (
            '🔒'
          )}
        </div>

        {/* Title */}
        <h3 style={styles.title}>
          {error ? 'Payment Failed' : isProcessing ? 'Processing...' : 'Premium Content'}
        </h3>

        {/* Description or status */}
        <p style={styles.description}>
          {error
            ? error.message
            : isProcessing
            ? statusMessage || 'Please wait...'
            : description || 'Unlock this content with a micropayment'}
        </p>

        {/* Price tag (hidden during processing) */}
        {!isProcessing && !error && (
          <div style={styles.priceTag}>
            {price} {currency}
          </div>
        )}

        {/* Action button */}
        {error ? (
          <button
            onClick={handlePay}
            style={{
              ...styles.button,
              ...(isHovered ? styles.buttonHover : {}),
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            Try Again
          </button>
        ) : !isConnected ? (
          <button
            onClick={onConnect}
            disabled={isProcessing}
            style={{
              ...styles.connectButton,
              ...(isProcessing ? styles.buttonDisabled : {}),
            }}
          >
            {isProcessing ? (
              <>
                <span style={styles.spinner} />
                Connecting...
              </>
            ) : (
              'Connect Wallet'
            )}
          </button>
        ) : (
          <button
            onClick={onPay}
            disabled={isProcessing}
            style={{
              ...styles.button,
              ...(isHovered && !isProcessing ? styles.buttonHover : {}),
              ...(isProcessing ? styles.buttonDisabled : {}),
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {isProcessing ? (
              <>
                <span style={styles.spinner} />
                {statusMessage || 'Processing...'}
              </>
            ) : (
              <>
                Pay {price} {currency}
              </>
            )}
          </button>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          Powered by{' '}
          <a
            href="https://x402.org"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            x402
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Spinner component for loading states
 */
export function Spinner({ size = 20 }: { size?: number }): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        border: '2px solid transparent',
        borderTopColor: 'currentColor',
        borderRadius: '50%',
        animation: 'x402-spin 0.8s linear infinite',
      }}
    />
  );
}
