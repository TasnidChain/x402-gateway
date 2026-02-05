/**
 * @x402/react - useX402Payment Hook
 * Orchestrates the full payment flow: 402 request → wallet sign → facilitator → receipt
 */

import { useState, useCallback } from 'react';
import {
  parsePaymentRequired,
  buildTransferAuthorization,
  buildFacilitatorPayload,
  submitToFacilitator,
  NUMERIC_CHAIN_IDS,
  type X402Receipt,
  type PaymentResult,
} from '@x402/core';
import { useWallet } from './useWallet';
import { useReceipt } from './useReceipt';

export type PaymentStatus =
  | 'idle'
  | 'fetching_params'
  | 'connecting_wallet'
  | 'switching_chain'
  | 'signing'
  | 'submitting'
  | 'confirming'
  | 'success'
  | 'error';

export interface UseX402PaymentOptions {
  /** Content endpoint to fetch (returns 402 when not authenticated) */
  contentEndpoint: string;
  /** Content ID for receipt storage */
  contentId: string;
  /** Callback on successful payment */
  onSuccess?: (receipt: X402Receipt, content: unknown) => void;
  /** Callback on payment error */
  onError?: (error: Error) => void;
}

export interface UseX402PaymentReturn {
  /** Current payment status */
  status: PaymentStatus;
  /** Human-readable status message */
  statusMessage: string;
  /** Whether payment is in progress */
  isProcessing: boolean;
  /** Last error */
  error: Error | null;
  /** Start payment flow */
  pay: () => Promise<PaymentResult>;
  /** Reset to idle state */
  reset: () => void;
  /** Fetched content after successful payment */
  content: unknown | null;
  /** Receipt after successful payment */
  receipt: X402Receipt | null;
  /** Wallet connection state */
  wallet: ReturnType<typeof useWallet>;
  /** Receipt management */
  receiptManager: ReturnType<typeof useReceipt>;
}

const STATUS_MESSAGES: Record<PaymentStatus, string> = {
  idle: '',
  fetching_params: 'Loading payment details...',
  connecting_wallet: 'Connecting wallet...',
  switching_chain: 'Please switch to Base network...',
  signing: 'Please sign the transaction...',
  submitting: 'Submitting payment...',
  confirming: 'Confirming on Base...',
  success: 'Payment successful!',
  error: 'Payment failed',
};

/**
 * Hook for managing the full x402 payment flow
 *
 * @example
 * const { pay, status, statusMessage, isProcessing, error, content } = useX402Payment({
 *   contentEndpoint: '/api/content/article-123',
 *   contentId: 'article-123',
 *   onSuccess: (receipt) => console.log('Paid!', receipt),
 * });
 *
 * return (
 *   <button onClick={pay} disabled={isProcessing}>
 *     {isProcessing ? statusMessage : 'Pay $0.01'}
 *   </button>
 * );
 */
export function useX402Payment(options: UseX402PaymentOptions): UseX402PaymentReturn {
  const { contentEndpoint, contentId, onSuccess, onError } = options;

  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [content, setContent] = useState<unknown | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<X402Receipt | null>(null);

  const wallet = useWallet();
  const receiptManager = useReceipt({ contentId });

  // Main payment flow
  const pay = useCallback(async (): Promise<PaymentResult> => {
    setError(null);
    setStatus('fetching_params');

    try {
      // Step 1: Fetch content endpoint to get 402 payment params
      const response = await fetch(contentEndpoint);

      // If not 402, content might already be unlocked
      if (response.status !== 402) {
        if (response.ok) {
          const data = await response.json();
          setContent(data.content || data);
          setStatus('success');
          return { success: true };
        }
        throw new Error(`Unexpected response: ${response.status}`);
      }

      // Parse payment params from 402 response
      const paymentRequest = await parsePaymentRequired(response);
      if (!paymentRequest) {
        throw new Error('Invalid 402 response - missing payment parameters');
      }

      // Step 2: Connect wallet if not connected
      if (!wallet.isConnected) {
        setStatus('connecting_wallet');
        await wallet.connect();
      }

      // Step 3: Ensure correct chain
      const targetChainId = NUMERIC_CHAIN_IDS[paymentRequest.network];
      if (wallet.chainId !== targetChainId) {
        setStatus('switching_chain');
        await wallet.switchChain(targetChainId);
      }

      // Step 4: Build and sign the transfer authorization (using core functions)
      setStatus('signing');

      const { typedData, authorization } = buildTransferAuthorization({
        from: wallet.address!,
        to: paymentRequest.payTo,
        price: paymentRequest.price,
        network: paymentRequest.network,
      });

      const signature = await wallet.signTypedData(typedData);

      // Step 5: Submit to facilitator (using core functions)
      setStatus('submitting');

      const facilitatorPayloadData = buildFacilitatorPayload({
        signature: signature as `0x${string}`,
        authorization,
        network: paymentRequest.network,
        contentId: paymentRequest.contentId,
      });

      const facilitatorResult = await submitToFacilitator(
        paymentRequest.facilitatorUrl,
        facilitatorPayloadData
      );

      // Step 6: Store receipt
      setStatus('confirming');

      const receiptToken = facilitatorResult.receipt;
      receiptManager.store(receiptToken);

      // Step 7: Fetch content with receipt
      const contentResponse = await fetch(contentEndpoint, {
        headers: {
          'X-402-Receipt': receiptToken,
        },
      });

      if (!contentResponse.ok) {
        throw new Error(`Failed to fetch content: ${contentResponse.status}`);
      }

      const contentData = await contentResponse.json();
      setContent(contentData.content || contentData);
      setPaymentReceipt(receiptManager.receipt);

      setStatus('success');

      if (onSuccess && receiptManager.receipt) {
        onSuccess(receiptManager.receipt, contentData.content || contentData);
      }

      return {
        success: true,
        receipt: receiptManager.receipt!,
        receiptToken,
        txHash: facilitatorResult.txHash,
      };
    } catch (err) {
      const paymentError = err instanceof Error ? err : new Error('Payment failed');
      setError(paymentError);
      setStatus('error');

      if (onError) {
        onError(paymentError);
      }

      return {
        success: false,
        error: paymentError.message,
      };
    }
  }, [contentEndpoint, wallet, receiptManager, onSuccess, onError]);

  // Reset state
  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setContent(null);
    setPaymentReceipt(null);
  }, []);

  return {
    status,
    statusMessage: error ? error.message : STATUS_MESSAGES[status],
    isProcessing: status !== 'idle' && status !== 'success' && status !== 'error',
    error,
    pay,
    reset,
    content,
    receipt: paymentReceipt,
    wallet,
    receiptManager,
  };
}
