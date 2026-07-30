export const SHORT_CDN_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
  "Vercel-CDN-Cache-Control":
    "public, s-maxage=5, stale-while-revalidate=10",
} as const;

export const NO_STORE_CACHE_HEADERS = {
  "Cache-Control": "no-store",
} as const;
