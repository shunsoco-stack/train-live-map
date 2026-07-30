import assert from "node:assert/strict";
import test from "node:test";
import {
  claimMemoryRateLimit,
  releaseMemoryRateLimit,
} from "./communityRateLimit.ts";

test("claim後にreleaseすれば同じ路線へ直ちに再claimできる", () => {
  const rateLimits = new Map<string, number>();
  const now = Date.UTC(2026, 6, 31);

  assert.equal(
    claimMemoryRateLimit(
      rateLimits,
      "reporter-hash",
      "tokaido",
      60_000,
      now,
    ),
    true,
  );
  assert.equal(
    claimMemoryRateLimit(
      rateLimits,
      "reporter-hash",
      "tokaido",
      60_000,
      now,
    ),
    false,
  );
  assert.equal(
    releaseMemoryRateLimit(
      rateLimits,
      "reporter-hash",
      "tokaido",
    ),
    true,
  );
  assert.equal(
    claimMemoryRateLimit(
      rateLimits,
      "reporter-hash",
      "tokaido",
      60_000,
      now,
    ),
    true,
  );
});
