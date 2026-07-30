import assert from "node:assert/strict";
import test from "node:test";
import type { TrainLocation } from "../types/train.ts";
import { applyServerClockOffset } from "./time.ts";
import {
  matchesFilter,
  resolveStatusLevel,
  STALE_THRESHOLD_SECONDS,
  TRAIN_FILTERS,
  type TrainFilterKey,
} from "./trainStatus.ts";

function trainAt(
  lastUpdatedAt: string,
  overrides: Partial<TrainLocation> = {},
): TrainLocation {
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
    ...overrides,
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

test("4フィルタが遅延なし・遅延あり・情報が古いを排他的に分類する", () => {
  const now = new Date("2026-07-31T12:00:00+09:00");
  const trains = {
    onTime: trainAt("2026-07-31T11:59:00+09:00"),
    delayed: trainAt("2026-07-31T11:59:00+09:00", {
      delayMinutes: 3,
      status: "delayed",
    }),
    stale: trainAt("2026-07-31T11:50:00+09:00", {
      delayMinutes: 3,
      status: "delayed",
    }),
  };
  const expected: Record<keyof typeof trains, TrainFilterKey[]> = {
    onTime: ["all", "on-time"],
    delayed: ["all", "delayed"],
    stale: ["all", "stale"],
  };

  assert.deepEqual(
    TRAIN_FILTERS.map((filter) => filter.label),
    ["すべて", "遅延なし", "遅延あり", "情報が古い"],
  );
  for (const [name, train] of Object.entries(trains) as Array<
    [keyof typeof trains, TrainLocation]
  >) {
    const matching = TRAIN_FILTERS.filter((filter) =>
      matchesFilter(train, filter.key, now),
    ).map((filter) => filter.key);
    assert.deepEqual(matching, expected[name]);
  }
});

test("3分類の件数合計がすべての件数と一致する", () => {
  const now = new Date("2026-07-31T12:00:00+09:00");
  const trains = [
    trainAt("2026-07-31T11:59:00+09:00"),
    trainAt("2026-07-31T11:59:00+09:00", {
      delayMinutes: 3,
      status: "delayed",
    }),
    trainAt("2026-07-31T11:50:00+09:00", {
      delayMinutes: 3,
      status: "delayed",
    }),
  ];
  const count = (filter: TrainFilterKey) =>
    trains.filter((train) => matchesFilter(train, filter, now)).length;

  assert.equal(
    count("on-time") + count("delayed") + count("stale"),
    count("all"),
  );
  for (const train of trains) {
    const detailMatches = (["on-time", "delayed", "stale"] as const).filter(
      (filter) => matchesFilter(train, filter, now),
    );
    assert.equal(detailMatches.length, 1);
  }
});
