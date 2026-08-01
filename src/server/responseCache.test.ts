import assert from "node:assert/strict";
import test from "node:test";
import { cachedResponse, sharedCacheHeaders } from "./responseCache.ts";

test("concurrent upstream requests are coalesced", async () => {
  let calls = 0;
  const loader = async () => {
    calls += 1;
    await Promise.resolve();
    return { value: 42 };
  };
  const key = `test-coalescing-${crypto.randomUUID()}`;
  const [first, second] = await Promise.all([
    cachedResponse(key, 1_000, loader),
    cachedResponse(key, 1_000, loader),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(first, { value: 42 });
  assert.deepEqual(second, first);
});

test("shared cache header keeps five seconds and ten seconds stale window", () => {
  assert.deepEqual(sharedCacheHeaders(5, 10), {
    "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
  });
});
