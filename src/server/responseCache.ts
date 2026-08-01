interface CacheEntry<T> {
  value?: T;
  expiresAt: number;
  pending?: Promise<T>;
}

const cacheGlobal = globalThis as typeof globalThis & {
  __trainLiveMapResponseCache?: Map<string, CacheEntry<unknown>>;
};

function responseCache(): Map<string, CacheEntry<unknown>> {
  if (!cacheGlobal.__trainLiveMapResponseCache) {
    cacheGlobal.__trainLiveMapResponseCache = new Map();
  }
  return cacheGlobal.__trainLiveMapResponseCache;
}

/** Short-lived per-instance cache with request coalescing for upstream APIs. */
export async function cachedResponse<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  now = Date.now(),
): Promise<T> {
  const cache = responseCache();
  const current = cache.get(key) as CacheEntry<T> | undefined;
  if (current?.value !== undefined && current.expiresAt > now) {
    return current.value;
  }
  if (current?.pending) return current.pending;

  const entry: CacheEntry<T> = current ?? { expiresAt: 0 };
  const pending = loader()
    .then((value) => {
      entry.value = value;
      entry.expiresAt = Date.now() + ttlMs;
      entry.pending = undefined;
      cache.set(key, entry as CacheEntry<unknown>);
      return value;
    })
    .catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });
  entry.pending = pending;
  cache.set(key, entry as CacheEntry<unknown>);
  return pending;
}

export function sharedCacheHeaders(
  maxAgeSeconds: number,
  staleWhileRevalidateSeconds: number,
): Record<string, string> {
  return {
    "Cache-Control": `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
  };
}
