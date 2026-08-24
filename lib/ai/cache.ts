import { createHash } from "crypto";

export interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  provider?: string;
  hits: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRatio: number;
}

/**
 * Deterministic Content-Addressed Tier Caching for AI fit scoring, job extractions, and parsed structures.
 * Prevents redundant LLM token burn when re-evaluating unchanged candidate/job combinations.
 */
export class AICacheService {
  private static memoryL1 = new Map<string, CacheEntry<unknown>>();
  private static totalHits = 0;
  private static totalMisses = 0;
  private static defaultTTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  /**
   * Generates a deterministic SHA-256 hash key from arbitrary primitive or structured parts.
   */
  public static generateKey(parts: (string | number | boolean | object | undefined | null)[]): string {
    const serialized = parts
      .map((part) => {
        if (part === null || part === undefined) return "";
        if (typeof part === "object") {
          return JSON.stringify(part, Object.keys(part).sort());
        }
        return String(part).trim();
      })
      .join("::");

    return createHash("sha256").update(serialized).digest("hex");
  }

  /**
   * Retrieves a cached value if present and unexpired.
   */
  public static get<T>(key: string): T | null {
    if (!key) {
      this.totalMisses++;
      return null;
    }

    const entry = this.memoryL1.get(key);
    if (!entry) {
      this.totalMisses++;
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.memoryL1.delete(key);
      this.totalMisses++;
      return null;
    }

    entry.hits++;
    this.totalHits++;
    return entry.data as T;
  }

  /**
   * Caches a value with a specified or default TTL.
   */
  public static set<T>(key: string, data: T, ttlMs = this.defaultTTL, provider?: string): void {
    if (!key || data === undefined || data === null) return;

    const now = Date.now();
    this.memoryL1.set(key, {
      data,
      createdAt: now,
      expiresAt: now + ttlMs,
      provider,
      hits: 0,
    });
  }

  /**
   * Checks if an unexpired key exists.
   */
  public static has(key: string): boolean {
    if (!key) return false;
    const entry = this.memoryL1.get(key);
    if (!entry) return false;
    if (Date.now() >= entry.expiresAt) {
      this.memoryL1.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Deletes a specific key from cache.
   */
  public static delete(key: string): boolean {
    return this.memoryL1.delete(key);
  }

  /**
   * Clears the entire in-memory cache and resets stats.
   */
  public static clear(): void {
    this.memoryL1.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
  }

  /**
   * Current active entries count (pruning expired ones on lookup).
   */
  public static size(): number {
    const now = Date.now();
    for (const [key, entry] of this.memoryL1.entries()) {
      if (now >= entry.expiresAt) {
        this.memoryL1.delete(key);
      }
    }
    return this.memoryL1.size;
  }

  /**
   * Returns cache metrics (size, hits, misses, hit ratio).
   */
  public static getStats(): CacheStats {
    const total = this.totalHits + this.totalMisses;
    return {
      size: this.memoryL1.size,
      hits: this.totalHits,
      misses: this.totalMisses,
      hitRatio: total > 0 ? Number((this.totalHits / total).toFixed(4)) : 0,
    };
  }
}
