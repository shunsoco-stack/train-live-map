import assert from "node:assert/strict";
import test from "node:test";
import {
  applyServerClockOffset,
  calculateServerClockOffsetMs,
} from "./time.ts";

test("API生成時刻から端末とサーバーの時計差を算出する", () => {
  const clientReceivedAt = Date.parse("2026-07-31T12:05:00+09:00");
  assert.equal(
    calculateServerClockOffsetMs(
      clientReceivedAt,
      "2026-07-31T12:00:00+09:00",
    ),
    5 * 60 * 1000,
  );
});

test("時計差を端末時刻へ適用してサーバー基準時刻へ戻す", () => {
  const corrected = applyServerClockOffset(
    new Date("2026-07-31T12:05:00+09:00"),
    5 * 60 * 1000,
  );
  assert.equal(corrected.toISOString(), "2026-07-31T03:00:00.000Z");
});

test("不正なAPI生成時刻では時計差を更新しない", () => {
  assert.equal(calculateServerClockOffsetMs(Date.now(), "not-a-date"), null);
});
