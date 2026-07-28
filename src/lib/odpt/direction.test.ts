import assert from "node:assert/strict";
import test from "node:test";
import { inferTokaidoDirection } from "./direction.ts";

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
