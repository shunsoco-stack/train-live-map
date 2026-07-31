import assert from "node:assert/strict";
import test from "node:test";
import {
  detectSuspensionSpike,
  isAllowedPushEndpoint,
  SUSPENSION_SPIKE_WINDOW_MS,
} from "./communityPush.ts";
import type { CommunityReportRecord } from "../types/community.ts";

const NOW = Date.UTC(2026, 6, 29, 6, 0, 0);

function report(
  reporterHash: string,
  status: CommunityReportRecord["status"],
  ageMs: number,
  lineId = "tokaido",
  sourceHash = reporterHash,
): CommunityReportRecord {
  return {
    lineId,
    reporterHash,
    sourceHash,
    status,
    delayMinutes: null,
    createdAt: new Date(NOW - ageMs).toISOString(),
  };
}

test("直近5分に見合わせ票が3件かつ60%以上なら急増と判定する", () => {
  const result = detectSuspensionSpike(
    [
      report("a", "suspended", 60_000),
      report("b", "suspended", 90_000),
      report("c", "suspended", 120_000),
      report("d", "on-time", 150_000),
      report("e", "delayed", 180_000),
    ],
    "tokaido",
    NOW,
  );
  assert.equal(result.detected, true);
  assert.equal(result.recentSuspended, 3);
  assert.equal(result.recentTotal, 5);
});

test("見合わせ票が3件未満なら通知しない", () => {
  const result = detectSuspensionSpike(
    [
      report("a", "suspended", 60_000),
      report("b", "suspended", 90_000),
    ],
    "tokaido",
    NOW,
  );
  assert.equal(result.detected, false);
});

test("見合わせ票の比率が60%未満なら通知しない", () => {
  const result = detectSuspensionSpike(
    [
      report("a", "suspended", 60_000),
      report("b", "suspended", 90_000),
      report("c", "suspended", 120_000),
      report("d", "on-time", 150_000),
      report("e", "on-time", 180_000),
      report("f", "on-time", 210_000),
    ],
    "tokaido",
    NOW,
  );
  assert.equal(result.detected, false);
});

test("直前5分にも票が多い場合は2倍以上の増加を必要とする", () => {
  const result = detectSuspensionSpike(
    [
      report("old-a", "suspended", SUSPENSION_SPIKE_WINDOW_MS + 60_000),
      report("old-b", "suspended", SUSPENSION_SPIKE_WINDOW_MS + 90_000),
      report("a", "suspended", 60_000),
      report("b", "suspended", 90_000),
      report("c", "suspended", 120_000),
    ],
    "tokaido",
    NOW,
  );
  assert.equal(result.previousSuspended, 2);
  assert.equal(result.requiredSuspended, 4);
  assert.equal(result.detected, false);
});

test("同じ投稿者の重複レコードは1票として扱う", () => {
  const result = detectSuspensionSpike(
    [
      report("same", "suspended", 60_000),
      report("same", "suspended", 90_000),
      report("b", "suspended", 120_000),
    ],
    "tokaido",
    NOW,
  );
  assert.equal(result.recentSuspended, 2);
  assert.equal(result.detected, false);
});

test("端末IDを変えても同じ接続元は1票として扱う", () => {
  const result = detectSuspensionSpike(
    [
      report("device-a", "suspended", 60_000, "tokaido", "source-a"),
      report("device-b", "suspended", 90_000, "tokaido", "source-a"),
      report("device-c", "suspended", 120_000, "tokaido", "source-b"),
    ],
    "tokaido",
    NOW,
  );
  assert.equal(result.recentSuspended, 2);
  assert.equal(result.detected, false);
});

test("既知のWeb Pushサービスだけを許可する", () => {
  assert.equal(
    isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"),
    true,
  );
  assert.equal(
    isAllowedPushEndpoint("https://web.push.apple.com/Q123"),
    true,
  );
  assert.equal(
    isAllowedPushEndpoint(
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ),
    true,
  );
  assert.equal(
    isAllowedPushEndpoint("https://example.com/internal"),
    false,
  );
  assert.equal(
    isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc"),
    false,
  );
});
