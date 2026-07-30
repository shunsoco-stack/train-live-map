import assert from "node:assert/strict";
import test from "node:test";
import {
  claimMemoryIpRateLimit,
  createMemoryIpRateLimitState,
  ipRateLimitStorageKey,
  releaseMemoryIpRateLimit,
  type IpRateLimitInput,
} from "./ipRateLimiter.ts";

const NOW = Date.UTC(2026, 6, 31);

function input(
  overrides: Partial<IpRateLimitInput> = {},
): IpRateLimitInput {
  return {
    scope: "community-report-global",
    ipHash: "hashed-ip-a",
    limit: 10,
    windowSeconds: 300,
    ...overrides,
  };
}

test("同一IP全体は5分で10回まで許可し11回目を拒否する", () => {
  const state = createMemoryIpRateLimitState();

  for (let index = 0; index < 10; index += 1) {
    assert.equal(
      claimMemoryIpRateLimit(
        state,
        input(),
        NOW,
        `token-${index}`,
      ).allowed,
      true,
    );
  }
  assert.equal(
    claimMemoryIpRateLimit(state, input(), NOW, "token-10").allowed,
    false,
  );
  assert.equal(
    claimMemoryIpRateLimit(
      state,
      input(),
      NOW + 300_001,
      "token-after-window",
    ).allowed,
    true,
  );
});

test("同一IPと同一路線は60秒に1回だけ許可する", () => {
  const state = createMemoryIpRateLimitState();
  const lineInput = input({
    scope: "community-report-line",
    discriminator: "tokaido",
    limit: 1,
    windowSeconds: 60,
  });

  assert.equal(
    claimMemoryIpRateLimit(state, lineInput, NOW, "first").allowed,
    true,
  );
  assert.equal(
    claimMemoryIpRateLimit(state, lineInput, NOW + 59_999, "second")
      .allowed,
    false,
  );
  assert.equal(
    claimMemoryIpRateLimit(state, lineInput, NOW + 60_000, "third")
      .allowed,
    true,
  );
});

test("IP、路線、scopeごとに独立した枠を使う", () => {
  const state = createMemoryIpRateLimitState();
  const first = input({
    scope: "community-report-line",
    discriminator: "tokaido",
    limit: 1,
    windowSeconds: 60,
  });

  assert.equal(
    claimMemoryIpRateLimit(state, first, NOW, "first").allowed,
    true,
  );
  assert.equal(
    claimMemoryIpRateLimit(
      state,
      { ...first, discriminator: "yamanote" },
      NOW,
      "other-line",
    ).allowed,
    true,
  );
  assert.equal(
    claimMemoryIpRateLimit(
      state,
      { ...first, ipHash: "hashed-ip-b" },
      NOW,
      "other-ip",
    ).allowed,
    true,
  );
});

test("失敗した処理の枠は所有tokenが一致する場合だけ解放する", () => {
  const state = createMemoryIpRateLimitState();
  const claim = claimMemoryIpRateLimit(
    state,
    input({ limit: 1 }),
    NOW,
    "owned-token",
  );
  assert.equal(claim.allowed, true);
  if (!claim.allowed) return;

  assert.equal(
    releaseMemoryIpRateLimit(state, {
      ...claim,
      token: "another-token",
    }),
    false,
  );
  assert.equal(releaseMemoryIpRateLimit(state, claim), true);
  assert.equal(
    claimMemoryIpRateLimit(
      state,
      input({ limit: 1 }),
      NOW,
      "retry-token",
    ).allowed,
    true,
  );
});

test("Redis/メモリ用キーに生IPやdiscriminatorを含めない", () => {
  const key = ipRateLimitStorageKey(
    input({
      ipHash: "203.0.113.10",
      discriminator: "tokaido",
    }),
  );
  assert.equal(key.includes("203.0.113.10"), false);
  assert.equal(key.includes("tokaido"), false);
});
