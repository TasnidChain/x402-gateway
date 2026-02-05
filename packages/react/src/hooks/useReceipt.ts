/**
 * @x402/react - useReceipt Hook
 * Client-side receipt storage and validation
 */

import { useState, useCallback, useEffect } from 'react';
import {
  decodeReceipt,
  isReceiptValid,
  getReceiptRemainingTime,
  formatReceiptExpiry,
  STORAGE_KEYS,
  type X402Receipt,
} from '@x402/core';

export interface UseReceiptOptions {
  /** Content ID to check receipt for */
  contentId: string;
  /** Auto-refresh interval in ms (default: 60000 = 1 minute) */
  refreshInterval?: number;
}

export interface UseReceiptReturn {
  /** Decoded receipt if valid */
  receipt: X402Receipt | null;
  /** JWT token string */
  token: string | null;
  /** Whether receipt exists and is valid */
  isValid: boolean;
  /** Remaining validity time in seconds */
  remainingTime: number;
  /** Human-readable expiry string */
  expiryText: string;
  /** Store a new receipt */
  store: (token: string) => void;
  /** Clear stored receipt */
  clear: () => void;
  /** Refresh receipt status */
  refresh: () => void;
}

/**
 * Get storage key for a content ID
 */
function getStorageKey(contentId: string): string {
  return `${STORAGE_KEYS.RECEIPT_PREFIX}${contentId}`;
}

/**
 * Hook for managing receipt storage and validation
 *
 * @example
 * const { receipt, isValid, store, clear } = useReceipt({
 *   contentId: 'article-123',
 * });
 *
 * if (isValid) {
 *   console.log('Content unlocked until:', receipt.expiresAt);
 * }
 */
export function useReceipt(options: UseReceiptOptions): UseReceiptReturn {
  const { contentId, refreshInterval = 60000 } = options;

  const [token, setToken] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<X402Receipt | null>(null);

  // Load receipt from storage
  const loadReceipt = useCallback(() => {
    if (typeof window === 'undefined') return;

    const key = getStorageKey(contentId);
    const stored = localStorage.getItem(key);

    if (!stored) {
      setToken(null);
      setReceipt(null);
      return;
    }

    // Decode and validate
    const decoded = decodeReceipt(stored);

    if (!decoded || !isReceiptValid(decoded, contentId)) {
      // Invalid or expired - clear it
      localStorage.removeItem(key);
      setToken(null);
      setReceipt(null);
      return;
    }

    setToken(stored);
    setReceipt(decoded);
  }, [contentId]);

  // Store a new receipt
  const store = useCallback(
    (newToken: string) => {
      if (typeof window === 'undefined') return;

      // Decode to validate
      const decoded = decodeReceipt(newToken);
      if (!decoded) {
        console.error('Invalid receipt token');
        return;
      }

      // Store in localStorage
      const key = getStorageKey(contentId);
      localStorage.setItem(key, newToken);

      setToken(newToken);
      setReceipt(decoded);
    },
    [contentId]
  );

  // Clear stored receipt
  const clear = useCallback(() => {
    if (typeof window === 'undefined') return;

    const key = getStorageKey(contentId);
    localStorage.removeItem(key);

    setToken(null);
    setReceipt(null);
  }, [contentId]);

  // Refresh receipt status
  const refresh = useCallback(() => {
    loadReceipt();
  }, [loadReceipt]);

  // Calculate derived values
  const isValid = receipt !== null && isReceiptValid(receipt, contentId);
  const remainingTime = receipt ? getReceiptRemainingTime(receipt) : 0;
  const expiryText = receipt ? formatReceiptExpiry(receipt) : 'No receipt';

  // Load on mount and when contentId changes
  useEffect(() => {
    loadReceipt();
  }, [loadReceipt]);

  // Auto-refresh to check expiry
  useEffect(() => {
    if (!receipt || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      // Check if expired
      if (!isReceiptValid(receipt, contentId)) {
        clear();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [receipt, contentId, refreshInterval, clear]);

  // Listen for storage changes (cross-tab sync)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      const key = getStorageKey(contentId);
      if (event.key === key) {
        loadReceipt();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [contentId, loadReceipt]);

  return {
    receipt,
    token,
    isValid,
    remainingTime,
    expiryText,
    store,
    clear,
    refresh,
  };
}

/**
 * Check if a receipt exists for a content ID (static function)
 * Useful for checking before rendering paywall
 */
export function hasValidReceipt(contentId: string): boolean {
  if (typeof window === 'undefined') return false;

  const key = getStorageKey(contentId);
  const stored = localStorage.getItem(key);

  if (!stored) return false;

  const decoded = decodeReceipt(stored);
  return decoded !== null && isReceiptValid(decoded, contentId);
}

/**
 * Get all stored receipts
 */
export function getAllReceipts(): { contentId: string; receipt: X402Receipt }[] {
  if (typeof window === 'undefined') return [];

  const receipts: { contentId: string; receipt: X402Receipt }[] = [];
  const prefix = STORAGE_KEYS.RECEIPT_PREFIX;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;

    const contentId = key.slice(prefix.length);
    const token = localStorage.getItem(key);
    if (!token) continue;

    const receipt = decodeReceipt(token);
    if (receipt && isReceiptValid(receipt)) {
      receipts.push({ contentId, receipt });
    }
  }

  return receipts;
}

/**
 * Clear all stored receipts
 */
export function clearAllReceipts(): void {
  if (typeof window === 'undefined') return;

  const prefix = STORAGE_KEYS.RECEIPT_PREFIX;
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}
