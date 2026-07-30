import assert from "node:assert/strict";
import test from "node:test";
import type {
  RailwayFilterOption,
  RailwayMapLine,
} from "../types/railway.ts";
import type { TrainLocation } from "../types/train.ts";
import {
  restoreTrainLocations,
  roundTrainCoordinate,
  serializeTrainLocation,
} from "./trainPayload.ts";

function trainFixture(
  overrides: Partial<TrainLocation> = {},
): TrainLocation {
  return {
    id: "train-1",
    lineId: "tokaido",
    lineName: "東海道線",
    lineColor: "#f68b1e",
    trainNumber: "1234E",
    directionKind: "up",
    directionLabel: "上り",
    destination: "東京",
    trainType: "local",
    latitude: 35.681236789,
    longitude: 139.767124321,
    delayMinutes: 0,
    speedKmh: 70,
    status: "running",
    lastUpdatedAt: "2026-07-31T00:00:00.000Z",
    stoppedSince: null,
    dataAccuracy: "estimated",
    routeSegment: {
      fromFraction: 0.123456789,
      toFraction: 0.234567891,
      coordinates: [
        [139.767124321, 35.681236789],
        [139.768987654, 35.682345678],
      ],
    },
    ...overrides,
  };
}

function railwayOption(
  overrides: Partial<RailwayFilterOption> = {},
): RailwayFilterOption {
  return {
    id: "tokaido",
    name: "選択肢の東海道線",
    category: "東海道方面",
    color: "#111111",
    aliases: [],
    coverage: "realtime",
    coverageNote: null,
    kind: "line",
    available: true,
    ...overrides,
  };
}

function railwayLine(
  overrides: Partial<RailwayMapLine> = {},
): RailwayMapLine {
  return {
    id: "tokaido",
    odptId: "odpt.Railway:JR-East.Tokaido",
    name: "路線情報の東海道線",
    color: "#222222",
    coordinates: [
      [
        [139.7, 35.6],
        [139.8, 35.7],
      ],
    ],
    ...overrides,
  };
}

test("列車座標をnumberのまま小数6桁へ丸める", () => {
  assert.equal(roundTrainCoordinate(139.767124321), 139.767124);
  assert.equal(roundTrainCoordinate(35.681236789), 35.681237);
});

test("API境界で座標を丸め、重複する路線名と色を除外する", () => {
  const original = trainFixture();
  const payload = serializeTrainLocation(original);

  assert.equal("lineName" in payload, false);
  assert.equal("lineColor" in payload, false);
  assert.equal(payload.latitude, 35.681237);
  assert.equal(payload.longitude, 139.767124);
  assert.deepEqual(payload.routeSegment?.coordinates, [
    [139.767124, 35.681237],
    [139.768988, 35.682346],
  ]);
  assert.equal(payload.routeSegment?.fromFraction, 0.123456789);
  assert.equal(payload.routeSegment?.toFraction, 0.234567891);
  assert.equal(payload.speedKmh, 70);
  assert.equal(original.latitude, 35.681236789);
  assert.equal(original.routeSegment?.coordinates?.[0][0], 139.767124321);
});

test("routeSegmentがnullでもそのまま転送する", () => {
  const payload = serializeTrainLocation(
    trainFixture({ routeSegment: null }),
  );
  assert.equal(payload.routeSegment, null);
});

test("路線表示情報はrailwayLines、options、catalogの順に復元する", () => {
  const payload = serializeTrainLocation(trainFixture());

  const fromLine = restoreTrainLocations(
    [payload],
    [railwayLine()],
    [railwayOption()],
  )[0];
  assert.equal(fromLine.lineName, "路線情報の東海道線");
  assert.equal(fromLine.lineColor, "#222222");

  const fromOption = restoreTrainLocations(
    [payload],
    [],
    [railwayOption()],
  )[0];
  assert.equal(fromOption.lineName, "選択肢の東海道線");
  assert.equal(fromOption.lineColor, "#111111");

  const fromCatalog = restoreTrainLocations([payload], [], [])[0];
  assert.equal(fromCatalog.lineName, "東海道線");
  assert.equal(fromCatalog.lineColor, "#f68b1e");
});

test("表示情報の復元で推定移動に必要な値を変えない", () => {
  const payload = serializeTrainLocation(trainFixture());
  const restored = restoreTrainLocations(
    [payload],
    [railwayLine()],
    [],
  )[0];

  assert.equal(restored.dataAccuracy, payload.dataAccuracy);
  assert.equal(restored.speedKmh, payload.speedKmh);
  assert.equal(
    restored.routeSegment?.fromFraction,
    payload.routeSegment?.fromFraction,
  );
  assert.equal(
    restored.routeSegment?.toFraction,
    payload.routeSegment?.toFraction,
  );
  assert.deepEqual(
    restored.routeSegment?.coordinates,
    payload.routeSegment?.coordinates,
  );
});
