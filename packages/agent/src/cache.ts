/**
 * @x402/agent - Receipt Cache
 * In-memory receipt cache with TTL-based auto-eviction for server-side agents
 */

/**
 * Cached receipt entry
 */
interface CacheEntry {
  /** JWT receipt token */
  token: string;

  /** Expiry timestamp (ms since epoch) */
  expiresAt: number;
}

/**
 * In-memory receipt cache for agent clients
 *
 * Caches JWT receipt tokens by content ID with automatic TTL-based eviction.
 * This prevents re-paying for content that was recently purchased.
 *
 * @example
 * const cache = new ReceiptCache(3600); // 1 hour TTL
 * cache.set('article-123', 'jwt.token.here');
 *
 * if (cache.has('article-123')) {
 *   const token = cache.get('article-123');
 *   // Use cached token instead of paying again
 * }
 */
export class ReceiptCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly defaultTTL: number;
  private accessCount = 0;
  private readonly cleanupInterval = 100;

  /**
   * Create a new receipt cache
   *
   * @param defaultTTL - Default time-to-live in seconds (default: 86400 = 24 hours)
   */
  constructor(defaultTTL = 86400) {
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get a cached receipt token
   *
   * @param contentId - Content identifier
   * @returns Receipt token if cached and not expired, null otherwise
   */
  get(contentId: string): string | null {
    this.accessCount++;

    // Periodic cleanup every N accesses
    if (this.accessCount % this.cleanupInterval === 0) {
      this.cleanup();
    }

    const entry = this.cache.get(contentId);
    if (!entry) return null;

    // Check expiry
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(contentId);
      return null;
    }

    return entry.token;
  }

  /**
   * Cache a receipt token
   *
   * @param contentId - Content identifier
   * @param token - JWT receipt token
   * @param ttl - Time-to-live in seconds (overrides default)
   */
  set(contentId: string, token: string, ttl?: number): void {
    const effectiveTTL = ttl ?? this.defaultTTL;
    this.cache.set(contentId, {
      token,
      expiresAt: Date.now() + effectiveTTL * 1000,
    });
  }

  /**
   * Check if a content ID has a valid (non-expired) cached receipt
   *
   * @param contentId - Content identifier
   * @returns True if a valid receipt exists
   */
  has(contentId: string): boolean {
    const entry = this.cache.get(contentId);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(contentId);
      return false;
    }

    return true;
  }

  /**
   * Remove a specific entry from the cache
   *
   * @param contentId - Content identifier to remove
   */
  delete(contentId: string): void {
    this.cache.delete(contentId);
  }

  /**
   * Clear all cached receipts
   */
  clear(): void {
    this.cache.clear();
    this.accessCount = 0;
  }

  /**
   * Get the number of cached (non-expired) entries
   */
  get size(): number {
    this.cleanup();
    return this.cache.size;
  }

  /**
   * Get all content IDs with valid cached receipts
   */
  keys(): string[] {
    this.cleanup();
    return Array.from(this.cache.keys());
  }

  /**
   * Remove all expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}
