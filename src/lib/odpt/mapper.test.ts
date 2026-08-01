import assert from "node:assert/strict";
import test from "node:test";
import { odptTrainsToNetworkTrainLocations } from "./mapper.ts";
import type { OdptNetworkContext, OdptStationLookup } from "./network.ts";
import type { OdptTrain } from "./types.ts";

const YAMANOTE = "odpt.Railway:JR-East.Yamanote";
const SAIKYO_KAWAGOE = "odpt.Railway:JR-East.SaikyoKawagoe";
const SHINJUKU = "odpt.Station:JR-East.SaikyoKawagoe.Shinjuku";
const IKEBUKURO = "odpt.Station:JR-East.SaikyoKawagoe.Ikebukuro";
const OMIYA = "odpt.Station:JR-East.SaikyoKawagoe.Omiya";
const KAWAGOE = "odpt.Station:JR-East.SaikyoKawagoe.Kawagoe";

function station(id: string, name: string, position: [number, number]): OdptStationLookup {
  return { id, name, railwayId: SAIKYO_KAWAGOE, position };
}

function network(): OdptNetworkContext {
  const stationByOdptId = new Map<string, OdptStationLookup>([
    [SHINJUKU, station(SHINJUKU, "新宿", [139.7005, 35.6896])],
    [IKEBUKURO, station(IKEBUKURO, "池袋", [139.7109, 35.7295])],
    [OMIYA, station(OMIYA, "大宮", [139.62, 35.906])],
    [KAWAGOE, station(KAWAGOE, "川越", [139.4858, 35.907])],
  ]);
  return {
    response: { lines: [], options: [], generatedAt: "2026-08-01T00:00:00Z", source: "odpt" },
    stationByOdptId,
    catalogIdByOdptRailwayId: new Map([
      [YAMANOTE, "yamanote"],
      [SAIKYO_KAWAGOE, "saikyo"],
    ]),
    lineByCatalogId: new Map(),
  };
}

function train(overrides: Partial<OdptTrain> = {}): OdptTrain {
  return {
    "owl:sameAs": "odpt.Train:JR-East.Yamanote.1000G",
    "odpt:railway": YAMANOTE,
    "odpt:trainNumber": "1000G",
    "odpt:fromStation": SHINJUKU,
    "odpt:toStation": IKEBUKURO,
    "odpt:destinationStation": [IKEBUKURO],
    "odpt:delay": 0,
    "dc:date": "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

test("railDirectionの全表記を上り・下りへ変換する", () => {
  const values: Array<[OdptTrain["odpt:railDirection"], "inbound" | "outbound"]> = [
    ["odpt.RailDirection:Inbound", "inbound"],
    ["odpt.RailwayDirection:Inbound", "inbound"],
    ["odpt.RailDirection:Outbound", "outbound"],
    ["odpt.RailwayDirection:Outbound", "outbound"],
    [null, "outbound"],
  ];
  for (const [railDirection, expected] of values) {
    const [mapped] = odptTrainsToNetworkTrainLocations(
      [train({ "odpt:railDirection": railDirection })],
      network(),
    );
    assert.equal(mapped.direction, expected);
  }
});

test("埼京・川越共通系統を現在の駅間で振り分ける", () => {
  const mapped = odptTrainsToNetworkTrainLocations(
    [
      train({ "owl:sameAs": "saikyo", "odpt:railway": SAIKYO_KAWAGOE, "odpt:fromStation": SHINJUKU, "odpt:toStation": IKEBUKURO }),
      train({ "owl:sameAs": "kawagoe", "odpt:railway": SAIKYO_KAWAGOE, "odpt:fromStation": OMIYA, "odpt:toStation": KAWAGOE }),
    ],
    network(),
  );
  assert.deepEqual(mapped.map((item) => item.lineId), ["saikyo", "kawagoe"]);
});

test("遅延秒からstatusを作り、実測座標と推定座標を区別する", () => {
  const mapped = odptTrainsToNetworkTrainLocations(
    [
      train({ "owl:sameAs": "estimated", "odpt:delay": 60 }),
      train({ "owl:sameAs": "actual", "geo:lat": 35.7, "geo:long": 139.8, "odpt:delay": 0 }),
    ],
    network(),
  );
  assert.deepEqual(mapped.map((item) => [item.status, item.dataAccuracy]), [
    ["delayed", "estimated"],
    ["running", "actual"],
  ]);
});

test("実測座標も既知駅座標も無い列車は除外する", () => {
  const result = odptTrainsToNetworkTrainLocations(
    [train({ "odpt:fromStation": "unknown-from", "odpt:toStation": "unknown-to" })],
    network(),
  );
  assert.deepEqual(result, []);
});
