/**
 * Tests for receipt cache
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReceiptCache } from './cache';

describe('ReceiptCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('set and get', () => {
    it('should store and retrieve a receipt token', () => {
      const cache = new ReceiptCache();
      cache.set('article-1', 'jwt.token.here');
      expect(cache.get('article-1')).toBe('jwt.token.here');
    });

    it('should return null for non-existent key', () => {
      const cache = new ReceiptCache();
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should overwrite existing entry', () => {
      const cache = new ReceiptCache();
      cache.set('article-1', 'token-1');
      cache.set('article-1', 'token-2');
      expect(cache.get('article-1')).toBe('token-2');
    });
  });

  describe('TTL expiration', () => {
    it('should return token before TTL expires', () => {
      const cache = new ReceiptCache(60); // 60 seconds TTL
      cache.set('article-1', 'jwt.token');

      // Advance 30 seconds
      vi.advanceTimersByTime(30 * 1000);
      expect(cache.get('article-1')).toBe('jwt.token');
    });

    it('should return null after TTL expires', () => {
      const cache = new ReceiptCache(60); // 60 seconds TTL
      cache.set('article-1', 'jwt.token');

      // Advance 61 seconds
      vi.advanceTimersByTime(61 * 1000);
      expect(cache.get('article-1')).toBeNull();
    });

    it('should support custom TTL per entry', () => {
      const cache = new ReceiptCache(3600); // 1 hour default
      cache.set('short-lived', 'token-1', 10); // 10 seconds
      cache.set('long-lived', 'token-2'); // 1 hour default

      vi.advanceTimersByTime(15 * 1000);

      expect(cache.get('short-lived')).toBeNull(); // Expired
      expect(cache.get('long-lived')).toBe('token-2'); // Still valid
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired entry', () => {
      const cache = new ReceiptCache();
      cache.set('article-1', 'jwt.token');
      expect(cache.has('article-1')).toBe(true);
    });

    it('should return false for non-existent entry', () => {
      const cache = new ReceiptCache();
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired entry', () => {
      const cache = new ReceiptCache(10);
      cache.set('article-1', 'jwt.token');

      vi.advanceTimersByTime(11 * 1000);
      expect(cache.has('article-1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove an entry', () => {
      const cache = new ReceiptCache();
      cache.set('article-1', 'jwt.token');
      cache.delete('article-1');
      expect(cache.get('article-1')).toBeNull();
    });

    it('should not throw for non-existent key', () => {
      const cache = new ReceiptCache();
      expect(() => cache.delete('nonexistent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      const cache = new ReceiptCache();
      cache.set('article-1', 'token-1');
      cache.set('article-2', 'token-2');
      cache.set('article-3', 'token-3');

      cache.clear();

      expect(cache.get('article-1')).toBeNull();
      expect(cache.get('article-2')).toBeNull();
      expect(cache.get('article-3')).toBeNull();
    });
  });

  describe('size', () => {
    it('should return 0 for empty cache', () => {
      const cache = new ReceiptCache();
      expect(cache.size).toBe(0);
    });

    it('should return correct count', () => {
      const cache = new ReceiptCache();
      cache.set('article-1', 'token-1');
      cache.set('article-2', 'token-2');
      expect(cache.size).toBe(2);
    });

    it('should exclude expired entries', () => {
      const cache = new ReceiptCache(10);
      cache.set('short', 'token-1', 5);
      cache.set('long', 'token-2', 30);

      vi.advanceTimersByTime(6 * 1000);

      expect(cache.size).toBe(1);
    });
  });

  describe('keys', () => {
    it('should return empty array for empty cache', () => {
      const cache = new ReceiptCache();
      expect(cache.keys()).toEqual([]);
    });

    it('should return all valid keys', () => {
      const cache = new ReceiptCache();
      cache.set('article-1', 'token-1');
      cache.set('article-2', 'token-2');

      const keys = cache.keys();
      expect(keys).toContain('article-1');
      expect(keys).toContain('article-2');
      expect(keys).toHaveLength(2);
    });

    it('should exclude expired keys', () => {
      const cache = new ReceiptCache(10);
      cache.set('expired', 'token-1', 5);
      cache.set('valid', 'token-2', 30);

      vi.advanceTimersByTime(6 * 1000);

      expect(cache.keys()).toEqual(['valid']);
    });
  });
});
