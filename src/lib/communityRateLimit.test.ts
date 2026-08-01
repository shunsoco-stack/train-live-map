import assert from "node:assert/strict";
import test from "node:test";
import {
  MemoryCommunityRateLimiter,
  COMMUNITY_COMMON_LINE_RATE_WINDOW_SECONDS,
  COMMUNITY_SOURCE_RATE_MAX_REPORTS,
} from "./communityRateLimit.ts";

const NOW = Date.UTC(2026, 7, 1, 0, 0, 0);

test("同じIPと路線は端末IDを変えても60秒に1回だけ許可する", () => {
  const limiter = new MemoryCommunityRateLimiter();
  assert.equal(limiter.claim({ reporterHash: "device-a", reporterIpHash: "ip-a", lineId: "line-a", commonBucket: false, now: NOW }), "allowed");
  assert.equal(limiter.claim({ reporterHash: "device-b", reporterIpHash: "ip-a", lineId: "line-a", commonBucket: false, now: NOW + 1 }), "ip-line");
});

test("同じIPは端末IDと路線を変えても5分間に10回まで", () => {
  const limiter = new MemoryCommunityRateLimiter();
  for (let index = 0; index < COMMUNITY_SOURCE_RATE_MAX_REPORTS; index += 1) {
    assert.equal(limiter.claim({ reporterHash: `device-${index}`, reporterIpHash: "ip-a", lineId: `line-${index}`, commonBucket: false, now: NOW + index }), "allowed");
  }
  assert.equal(limiter.claim({ reporterHash: "device-11", reporterIpHash: "ip-a", lineId: "line-11", commonBucket: false, now: NOW + 10 }), "ip-global");
});

test("IP不明時は拒否せず、より厳しい共通バケットへ入れる", () => {
  const limiter = new MemoryCommunityRateLimiter();
  assert.equal(limiter.claim({ reporterHash: "device-a", reporterIpHash: "missing-ip", lineId: "line-a", commonBucket: true, now: NOW }), "allowed");
  assert.equal(limiter.claim({ reporterHash: "device-b", reporterIpHash: "missing-ip", lineId: "line-a", commonBucket: true, now: NOW + 61_000 }), "ip-line");
  assert.equal(COMMUNITY_COMMON_LINE_RATE_WINDOW_SECONDS, 120);
});

test("端末ハッシュの路線別クールダウンも維持する", () => {
  const limiter = new MemoryCommunityRateLimiter();
  assert.equal(limiter.claim({ reporterHash: "same-device", reporterIpHash: "ip-a", lineId: "line-a", commonBucket: false, now: NOW }), "allowed");
  assert.equal(limiter.claim({ reporterHash: "same-device", reporterIpHash: "ip-b", lineId: "line-a", commonBucket: false, now: NOW + 1 }), "reporter");
});
