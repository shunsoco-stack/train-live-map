import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleRailwayBounds } from "./mapViewport.ts";
import type { RailwayMapLine } from "../types/railway.ts";

const lines: RailwayMapLine[] = [
  {
    id: "tokaido",
    odptId: "odpt.Railway:JR-East.Tokaido",
    name: "東海道線",
    color: "#f68b1e",
    coordinates: [
      [
        [139.76, 35.68],
        [139.62, 35.47],
      ],
    ],
    stations: [],
  },
  {
    id: "far-away",
    odptId: "test",
    name: "非表示路線",
    color: "#000000",
    coordinates: [
      [
        [130, 30],
        [145, 45],
      ],
    ],
    stations: [],
  },
];

test("表示中の路線だけから地図範囲を計算する", () => {
  assert.deepEqual(
    getVisibleRailwayBounds(lines, new Set(["tokaido"])),
    [
      [139.62, 35.47],
      [139.76, 35.68],
    ],
  );
});

test("表示中の路線がなければ地図範囲を返さない", () => {
  assert.equal(getVisibleRailwayBounds(lines, new Set()), null);
});

test("一点だけの路線でも地図を拡大しすぎない範囲を返す", () => {
  const pointLine: RailwayMapLine = {
    ...lines[0],
    coordinates: [[[139.7, 35.6]]],
  };
  const bounds = getVisibleRailwayBounds(
    [pointLine],
    new Set(["tokaido"]),
  );

  assert.ok(bounds);
  assert.ok(bounds[1][0] - bounds[0][0] >= 0.019);
  assert.ok(bounds[1][1] - bounds[0][1] >= 0.019);
});
