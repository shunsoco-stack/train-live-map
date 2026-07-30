import assert from "node:assert/strict";
import test from "node:test";
import {
  inferTokaidoDirection,
  mapOdptRailDirection,
  mapTokaidoDirection,
  ODPT_DIRECTION_BY_SUFFIX,
} from "./direction.ts";

const STATION_ORDER = ["tokyo", "shimbashi", "shinagawa", "kawasaki", "yokohama"];

const baseInput = {
  odptDirection: null,
  fromStationId: null,
  toStationId: null,
  destinationStationIds: undefined,
  trainNumber: "----",
};

test("ODPTの明示方向を優先する", () => {
  assert.equal(
    inferTokaidoDirection(
      { ...baseInput, odptDirection: "odpt.RailwayDirection:Inbound" },
      STATION_ORDER,
    ),
    "inbound",
  );
});

test("ODPTの明示された下り方向を優先する", () => {
  assert.equal(
    inferTokaidoDirection(
      { ...baseInput, odptDirection: "odpt.RailDirection:Outbound" },
      STATION_ORDER,
    ),
    "outbound",
  );
});

test("駅の移動順から上りを補完する", () => {
  assert.equal(
    inferTokaidoDirection(
      { ...baseInput, fromStationId: "kawasaki", toStationId: "shinagawa" },
      STATION_ORDER,
    ),
    "inbound",
  );
});

test("駅の移動順から下りを補完する", () => {
  assert.equal(
    inferTokaidoDirection(
      { ...baseInput, fromStationId: "shinagawa", toStationId: "kawasaki" },
      STATION_ORDER,
    ),
    "outbound",
  );
});

test("停車中は区間内の行先から方向を補完する", () => {
  assert.equal(
    inferTokaidoDirection(
      {
        ...baseInput,
        fromStationId: "shinagawa",
        destinationStationIds: ["yokohama"],
      },
      STATION_ORDER,
    ),
    "outbound",
  );
});

test("直通先行きの偶数列車を上りとして補完する", () => {
  assert.equal(
    inferTokaidoDirection(
      {
        ...baseInput,
        destinationStationIds: [null],
        trainNumber: "1620E",
      },
      STATION_ORDER,
    ),
    "inbound",
  );
});

test("直通先行きの奇数列車を下りとして補完する", () => {
  assert.equal(
    inferTokaidoDirection(
      {
        ...baseInput,
        destinationStationIds: [null],
        trainNumber: "1579E",
      },
      STATION_ORDER,
    ),
    "outbound",
  );
});

test("ODPT方向サフィックスを全ケース明示的に変換する", () => {
  const cases = [
    ["Inbound", "up", "上り"],
    ["Outbound", "down", "下り"],
    ["InnerLoop", "inner-loop", "内回り"],
    ["OuterLoop", "outer-loop", "外回り"],
    ["Northbound", "north", "北行"],
    ["Southbound", "south", "南行"],
    ["Eastbound", "east", "東行"],
    ["Westbound", "west", "西行"],
  ] as const;

  assert.equal(cases.length, Object.keys(ODPT_DIRECTION_BY_SUFFIX).length);
  for (const [suffix, directionKind, directionLabel] of cases) {
    assert.deepEqual(
      mapOdptRailDirection(`odpt.RailDirection:JR-East.${suffix}`),
      { directionKind, directionLabel },
    );
  }
});

test("未知または欠損した方向は unknown として表示しない", () => {
  assert.deepEqual(mapOdptRailDirection(null), {
    directionKind: "unknown",
    directionLabel: null,
  });
  assert.deepEqual(
    mapOdptRailDirection("odpt.RailDirection:JR-East.FutureDirection"),
    { directionKind: "unknown", directionLabel: null },
  );
});

test("未知方向の警告は同じ値につき1回だけ出す", () => {
  const originalWarn = console.warn;
  let warnings = 0;
  console.warn = () => {
    warnings += 1;
  };
  try {
    const value = "odpt.RailDirection:JR-East.TestUnknownDirection";
    mapOdptRailDirection(value);
    mapOdptRailDirection(value);
    assert.equal(warnings, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test("東海道線の既存判定を上り・下りの共通モデルへ変換する", () => {
  assert.deepEqual(mapTokaidoDirection("inbound"), {
    directionKind: "up",
    directionLabel: "上り",
  });
  assert.deepEqual(mapTokaidoDirection("outbound"), {
    directionKind: "down",
    directionLabel: "下り",
  });
});
