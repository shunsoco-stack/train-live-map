import assert from "node:assert/strict";
import test from "node:test";
import type { TrainLocation } from "../types/train.ts";
import { applyServerClockOffset } from "./time.ts";
import {
  resolveStatusLevel,
  STALE_THRESHOLD_SECONDS,
} from "./trainStatus.ts";

function trainAt(lastUpdatedAt: string): TrainLocation {
  return {
    id: "test-train",
    lineId: "tokaido",
    lineName: "東海道線",
    lineColor: "#f68b1e",
    trainNumber: "100M",
    directionKind: "up",
    directionLabel: "上り",
    destination: "東京",
    trainType: "local",
    latitude: 35.68,
    longitude: 139.76,
    delayMinutes: 0,
    speedKmh: 60,
    status: "running",
    lastUpdatedAt,
    stoppedSince: null,
    dataAccuracy: "estimated",
    routeSegment: null,
  };
}

test("鮮度しきい値300秒までは不明扱いにしない", () => {
  const now = new Date("2026-07-31T12:00:00+09:00");
  assert.equal(STALE_THRESHOLD_SECONDS, 300);
  assert.notEqual(
    resolveStatusLevel(trainAt("2026-07-31T11:55:01+09:00"), now),
    "unknown",
  );
  assert.notEqual(
    resolveStatusLevel(trainAt("2026-07-31T11:55:00+09:00"), now),
    "unknown",
  );
});

test("鮮度しきい値を1秒超えた列車は不明扱いにする", () => {
  const now = new Date("2026-07-31T12:00:00+09:00");
  assert.equal(
    resolveStatusLevel(trainAt("2026-07-31T11:54:59+09:00"), now),
    "unknown",
  );
});

test("端末時計が5分進んでいても補正後は新鮮な列車を不明にしない", () => {
  const clientNow = new Date("2026-07-31T12:05:00+09:00");
  const serverNow = applyServerClockOffset(clientNow, 5 * 60 * 1000);
  assert.notEqual(
    resolveStatusLevel(
      trainAt("2026-07-31T11:58:00+09:00"),
      serverNow,
    ),
    "unknown",
  );
});
