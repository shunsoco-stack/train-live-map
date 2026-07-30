import assert from "node:assert/strict";
import test from "node:test";
import type { TrainLocation } from "../types/train.ts";
import {
  normalizeTrainNumber,
  searchTrainsByNumber,
} from "./trainSearch.ts";

function train(
  id: string,
  trainNumber: string,
  lineId = "tokaido",
): TrainLocation {
  return {
    id,
    lineId,
    lineName: lineId,
    lineColor: "#f68b1e",
    trainNumber,
    directionKind: "up",
    directionLabel: "上り",
    destination: "東京",
    trainType: "local",
    latitude: 35.68,
    longitude: 139.76,
    delayMinutes: 0,
    speedKmh: 0,
    status: "running",
    lastUpdatedAt: "2026-07-31T00:00:00.000Z",
    stoppedSince: null,
    dataAccuracy: "estimated",
    routeSegment: null,
  };
}

test("全角英数字と空白を正規化して検索する", () => {
  assert.equal(normalizeTrainNumber(" １２３４ｅ "), "1234E");
  assert.deepEqual(
    searchTrainsByNumber([train("a", "1234E")], " １２３４"),
    [train("a", "1234E")],
  );
});

test("完全一致を前方一致より先に返す", () => {
  const prefix = train("prefix", "1234E");
  const exact = train("exact", "123");
  assert.deepEqual(
    searchTrainsByNumber([prefix, exact], "123").map(({ id }) => id),
    ["exact", "prefix"],
  );
});

test("同じ列車番号の候補を路線をまたいで残す", () => {
  const results = searchTrainsByNumber(
    [
      train("a", "512M", "tokaido"),
      train("b", "512M", "utsunomiya"),
    ],
    "512M",
  );
  assert.deepEqual(results.map(({ id }) => id), ["a", "b"]);
});

test("空欄と不一致は候補なしを返す", () => {
  const trains = [train("a", "1234E")];
  assert.deepEqual(searchTrainsByNumber(trains, "  "), []);
  assert.deepEqual(searchTrainsByNumber(trains, "999"), []);
});
