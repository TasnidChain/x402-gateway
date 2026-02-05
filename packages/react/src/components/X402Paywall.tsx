/**
 * @x402/react - X402Paywall
 * Main paywall component that gates content behind x402 micropayments
 */

import React, { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { X402PaywallProps, PaywallRenderProps, ContentRenderProps, X402Receipt } from '@x402/core';
import { formatPrice, parsePrice } from '@x402/core';
import { useX402Payment } from '../hooks/useX402Payment';
import { useReceipt } from '../hooks/useReceipt';
import { PaywallOverlay } from './PaywallOverlay';
import { ReceiptBadge } from './ReceiptBadge';

export interface X402PaywallComponentProps extends Omit<X402PaywallProps, 'renderPaywall' | 'renderContent'> {
  /** Custom paywall UI */
  renderPaywall?: (props: PaywallRenderProps) => ReactNode;
  /** Custom content renderer */
  renderContent?: (props: ContentRenderProps) => ReactNode;
}

/**
 * Main paywall component
 *
 * Gates content behind x402 micropayments. Content is fetched from a server
 * endpoint only after payment verification.
 *
 * @example
 * <X402Paywall
 *   price="0.01"
 *   contentId="article-123"
 *   contentEndpoint="/api/content/article-123"
 *   description="Read the full article"
 * >
 *   <p className="teaser">This is the preview text...</p>
 * </X402Paywall>
 */
export function X402Paywall({
  price,
  contentId,
  contentEndpoint,
  description,
  renderPaywall,
  renderContent,
  onPaymentSuccess,
  onPaymentError,
  children,
}: X402PaywallComponentProps): React.ReactElement {
  // Check for existing valid receipt
  const receiptManager = useReceipt({ contentId });

  // Content state
  const [content, setContent] = useState<unknown | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<Error | null>(null);

  // Payment hook
  const {
    status: _status,
    statusMessage,
    isProcessing,
    error: paymentError,
    pay,
    wallet,
  } = useX402Payment({
    contentEndpoint,
    contentId,
    onSuccess: (receipt, fetchedContent) => {
      setContent(fetchedContent);
      if (onPaymentSuccess) {
        onPaymentSuccess(receipt);
      }
    },
    onError: onPaymentError,
  });

  // Format price for display
  const formattedPrice = price.startsWith('$') ? price : formatPrice(parsePrice(price));

  // Wrap pay and connect to match Promise<void> signature
  const handlePay = useMemo(() => async (): Promise<void> => {
    await pay();
  }, [pay]);

  const handleConnect = useMemo(() => async (): Promise<void> => {
    await wallet.connect();
  }, [wallet]);

  // Load content if we have a valid receipt
  const loadContentWithReceipt = useCallback(async () => {
    if (!receiptManager.token) return;

    setIsLoadingContent(true);
    setContentError(null);

    try {
      const response = await fetch(contentEndpoint, {
        headers: {
          'X-402-Receipt': receiptManager.token,
        },
      });

      if (!response.ok) {
        if (response.status === 402) {
          // Receipt is no longer valid, clear it
          receiptManager.clear();
          return;
        }
        throw new Error(`Failed to load content: ${response.status}`);
      }

      const data = await response.json();
      setContent(data.content || data);
    } catch (err) {
      setContentError(err instanceof Error ? err : new Error('Failed to load content'));
    } finally {
      setIsLoadingContent(false);
    }
  }, [contentEndpoint, receiptManager]);

  // Load content on mount if receipt exists
  useEffect(() => {
    if (receiptManager.isValid && !content) {
      loadContentWithReceipt();
    }
  }, [receiptManager.isValid, content, loadContentWithReceipt]);

  // Build paywall props
  const paywallProps: PaywallRenderProps = {
    price: formattedPrice,
    currency: 'USDC',
    description,
    isConnected: wallet.isConnected,
    isProcessing,
    statusMessage,
    onPay: handlePay,
    onConnect: handleConnect,
    error: paymentError,
  };

  // Build content props
  const contentProps: ContentRenderProps | null =
    receiptManager.receipt && content
      ? {
          content,
          receipt: receiptManager.receipt,
        }
      : null;

  // Render unlocked content
  if (content && receiptManager.isValid && receiptManager.receipt) {
    if (renderContent) {
      return <>{renderContent(contentProps!)}</>;
    }

    return (
      <div className="x402-content">
        <ReceiptBadge receipt={receiptManager.receipt} />
        <div
          className="x402-content-body"
          dangerouslySetInnerHTML={
            typeof content === 'string' ? { __html: content } : undefined
          }
        >
          {typeof content !== 'string' ? (
            <pre>{JSON.stringify(content, null, 2)}</pre>
          ) : undefined}
        </div>
      </div>
    );
  }

  // Loading state when checking existing receipt
  if (isLoadingContent) {
    return (
      <div className="x402-paywall" style={{ position: 'relative', minHeight: '200px' }}>
        {children as ReactNode}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
          }}
        >
          <div>Loading content...</div>
        </div>
      </div>
    );
  }

  // Error loading content with receipt
  if (contentError && receiptManager.isValid) {
    return (
      <div className="x402-paywall" style={{ position: 'relative', minHeight: '200px' }}>
        {children as ReactNode}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
          }}
        >
          <p>You&apos;ve already paid, but we couldn&apos;t load the content.</p>
          <button onClick={loadContentWithReceipt}>Try Again</button>
        </div>
      </div>
    );
  }

  // Render paywall
  return (
    <div className="x402-paywall" style={{ position: 'relative', minHeight: '200px' }}>
      {/* Preview/teaser content */}
      {children as ReactNode}

      {/* Paywall overlay */}
      {renderPaywall ? renderPaywall(paywallProps) : <PaywallOverlay {...paywallProps} />}
    </div>
  );
}

/**
 * Simple wrapper for content that may be paywalled
 * Use when you want to check receipt status declaratively
 */
export function PaywallGate({
  contentId,
  children,
  fallback,
}: {
  contentId: string;
  children: (receipt: X402Receipt) => ReactNode;
  fallback: ReactNode;
}): React.ReactElement {
  const { receipt, isValid } = useReceipt({ contentId });

  if (isValid && receipt) {
    return <>{children(receipt)}</>;
  }

  return <>{fallback}</>;
}
