import assert from "node:assert/strict";
import test from "node:test";
import { countTrainsByFilter, matchesFilter, resolveStatusLevel, TRAIN_FILTERS } from "./trainStatus.ts";
import type { TrainLocation } from "../types/train.ts";

const NOW = new Date("2026-08-01T12:00:00.000Z");

function train(overrides: Partial<TrainLocation> = {}): TrainLocation {
  return {
    id: "train",
    lineId: "yamanote",
    lineName: "山手線",
    lineColor: "#9acd32",
    trainNumber: "1000G",
    direction: "inbound",
    destination: "東京",
    trainType: "local",
    latitude: 35.68,
    longitude: 139.76,
    delayMinutes: 0,
    speedKmh: 40,
    status: "running",
    lastUpdatedAt: "2026-08-01T11:59:00.000Z",
    stoppedSince: null,
    dataAccuracy: "actual",
    routeSegment: null,
    ...overrides,
  };
}

test("鮮度90秒ちょうどは有効、90秒を超えると不明になる", () => {
  assert.equal(resolveStatusLevel(train({ lastUpdatedAt: "2026-08-01T11:58:30.000Z" }), NOW), "running");
  assert.equal(resolveStatusLevel(train({ lastUpdatedAt: "2026-08-01T11:58:29.000Z" }), NOW), "unknown");
});

test("停止5分の境界で注意から長時間停止へ変わる", () => {
  assert.equal(resolveStatusLevel(train({ status: "stopped", stoppedSince: "2026-08-01T11:55:00.001Z" }), NOW), "warn");
  assert.equal(resolveStatusLevel(train({ status: "stopped", stoppedSince: "2026-08-01T11:55:00.000Z" }), NOW), "danger");
});

test("すべてのフィルターが対応する列車だけを返す", () => {
  const fixtures = [
    train({ id: "running" }),
    train({ id: "delayed", status: "delayed", delayMinutes: 4 }),
    train({ id: "stopped", status: "stopped", stoppedSince: "2026-08-01T11:58:00Z" }),
    train({ id: "suspended", status: "suspended", delayMinutes: 10 }),
  ];
  const expected: Record<string, string[]> = {
    all: ["running", "delayed", "stopped", "suspended"],
    running: ["running", "delayed"],
    stopped: ["stopped"],
    delayed: ["delayed"],
    suspended: ["suspended"],
  };
  for (const filter of TRAIN_FILTERS) {
    assert.deepEqual(
      fixtures.filter((item) => matchesFilter(item, filter.key, NOW)).map((item) => item.id),
      expected[filter.key],
    );
  }
});

test("集計の全件数と主要状態の合計が列車数に一致する", () => {
  const fixtures = [
    train({ id: "running" }),
    train({ id: "delayed", status: "delayed", delayMinutes: 4 }),
    train({ id: "stopped", status: "stopped", stoppedSince: "2026-08-01T11:58:00Z" }),
    train({ id: "suspended", status: "suspended" }),
  ];
  const counts = countTrainsByFilter(fixtures, NOW);
  assert.equal(counts.all, fixtures.length);
  assert.equal(counts.running + counts.stopped + counts.suspended, fixtures.length);
  assert.equal(counts.delayed, 1);
});
