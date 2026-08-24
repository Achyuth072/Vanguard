export interface PoolCandidateMetrics {
  totalRequests: number;
  inFlightRequests: number;
  failureCount: number;
  lastSuccessAt: number;
  lastUsedAt: number;
}

export interface CandidateWithId {
  id: string;
}

/**
 * Multi-Key Model Pool Manager implementing Power-of-Two-Choices (P2C) load balancing.
 * Balances concurrent inference requests across API keys and providers to avoid hotspotting.
 */
export class ModelPoolManager {
  private metrics = new Map<string, PoolCandidateMetrics>();

  /**
   * Selects the next best candidate from an array using Power-of-Two-Choices (P2C)
   * with a least-in-flight concurrency heuristic.
   */
  public selectCandidate<T extends CandidateWithId>(
    candidates: T[],
    isAvailable: (candidate: T) => boolean = () => true
  ): T | null {
    const available = candidates.filter(isAvailable);
    if (available.length === 0) {
      return null;
    }

    if (available.length === 1) {
      return available[0];
    }

    // Power-of-Two-Choices (P2C): sample 2 distinct random candidates
    const idx1 = Math.floor(Math.random() * available.length);
    let idx2 = Math.floor(Math.random() * available.length);
    while (idx2 === idx1 && available.length > 1) {
      idx2 = Math.floor(Math.random() * available.length);
    }

    const c1 = available[idx1];
    const c2 = available[idx2];

    const m1 = this.metrics.get(c1.id) ?? {
      totalRequests: 0,
      inFlightRequests: 0,
      failureCount: 0,
      lastSuccessAt: 0,
      lastUsedAt: 0,
    };

    const m2 = this.metrics.get(c2.id) ?? {
      totalRequests: 0,
      inFlightRequests: 0,
      failureCount: 0,
      lastSuccessAt: 0,
      lastUsedAt: 0,
    };

    // 1. Least in-flight requests wins
    if (m1.inFlightRequests !== m2.inFlightRequests) {
      return m1.inFlightRequests < m2.inFlightRequests ? c1 : c2;
    }

    // 2. Least consecutive failures wins
    if (m1.failureCount !== m2.failureCount) {
      return m1.failureCount < m2.failureCount ? c1 : c2;
    }

    // 3. Least recently used wins
    return m1.lastUsedAt <= m2.lastUsedAt ? c1 : c2;
  }

  /**
   * Sorts candidate array using P2C priority order while maintaining priority rank hints.
   */
  public prioritizeCandidates<T extends CandidateWithId>(
    candidates: T[],
    isAvailable: (candidate: T) => boolean = () => true
  ): T[] {
    const available = candidates.filter(isAvailable);
    const inCooldown = candidates.filter((c) => !isAvailable(c));

    const sortedAvailable = [...available].sort((a, b) => {
      const ma = this.metrics.get(a.id)?.inFlightRequests ?? 0;
      const mb = this.metrics.get(b.id)?.inFlightRequests ?? 0;
      if (ma !== mb) return ma - mb;

      const fa = this.metrics.get(a.id)?.failureCount ?? 0;
      const fb = this.metrics.get(b.id)?.failureCount ?? 0;
      if (fa !== fb) return fa - fb;

      return 0;
    });

    return [...sortedAvailable, ...inCooldown];
  }

  /**
   * Tracks the start of an in-flight inference request.
   */
  public trackStart(candidateId: string): void {
    if (!candidateId) return;
    const current = this.metrics.get(candidateId) ?? {
      totalRequests: 0,
      inFlightRequests: 0,
      failureCount: 0,
      lastSuccessAt: 0,
      lastUsedAt: 0,
    };

    current.inFlightRequests++;
    current.totalRequests++;
    current.lastUsedAt = Date.now();
    this.metrics.set(candidateId, current);
  }

  /**
   * Tracks the conclusion of an in-flight inference request.
   */
  public trackEnd(candidateId: string, success: boolean): void {
    if (!candidateId) return;
    const current = this.metrics.get(candidateId);
    if (!current) return;

    current.inFlightRequests = Math.max(0, current.inFlightRequests - 1);
    if (success) {
      current.lastSuccessAt = Date.now();
      current.failureCount = 0;
    } else {
      current.failureCount++;
    }
  }

  /**
   * Returns current metrics for a candidate.
   */
  public getMetrics(candidateId: string): PoolCandidateMetrics | undefined {
    return this.metrics.get(candidateId);
  }

  /**
   * Resets all pool metrics.
   */
  public reset(): void {
    this.metrics.clear();
  }
}

export const poolManager = new ModelPoolManager();
