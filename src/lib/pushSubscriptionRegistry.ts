export interface ExpiringPushRecord {
  id: string;
  updatedAt: string;
}

export function claimSlidingWindowRateLimit(
  timestamps: readonly number[],
  now: number,
  windowMs: number,
  maximum: number,
): { allowed: boolean; timestamps: number[] } {
  const active = timestamps.filter((timestamp) => timestamp > now - windowMs);
  if (active.length >= maximum) return { allowed: false, timestamps: active };
  return { allowed: true, timestamps: [...active, now] };
}

/** Map-backed registry: lookup, upsert, and removal are constant-time. */
export class MemoryPushSubscriptionRegistry<T extends ExpiringPushRecord> {
  private readonly records = new Map<string, T>();
  private readonly maximum: number;

  constructor(maximum: number) {
    this.maximum = maximum;
  }

  get(id: string): T | null {
    return this.records.get(id) ?? null;
  }

  upsert(record: T): boolean {
    if (!this.records.has(record.id) && this.records.size >= this.maximum) {
      return false;
    }
    this.records.set(record.id, record);
    return true;
  }

  remove(id: string): boolean {
    return this.records.delete(id);
  }

  listActive(cutoff: number): T[] {
    const active: T[] = [];
    for (const [id, record] of this.records) {
      if (Date.parse(record.updatedAt) < cutoff) {
        this.records.delete(id);
      } else {
        active.push(record);
      }
    }
    return active;
  }

  size(): number {
    return this.records.size;
  }
}
