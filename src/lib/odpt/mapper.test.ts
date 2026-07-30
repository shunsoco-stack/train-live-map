import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import type { RailwayMapLine } from "../../types/railway.ts";
import type { OdptTrain } from "./types.ts";
import type {
  OdptNetworkContext,
  OdptStationLookup,
} from "./network.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    return {
      shortCircuit: true,
      url: new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href,
    };
  },
});

const {
  odptInformationToServiceStatus,
  odptTrainsToNetworkTrainLocations,
} = await import("./mapper.ts");

const YAMANOTE_RAILWAY = "odpt.Railway:JR-East.Yamanote";
const TOKAIDO_RAILWAY = "odpt.Railway:JR-East.Tokaido";
const SAIKYO_KAWAGOE_RAILWAY =
  "odpt.Railway:JR-East.SaikyoKawagoe";
const KAWAGOE_RAILWAY = "odpt.Railway:JR-East.Kawagoe";

const STATION_IDS = {
  yamanoteA: "odpt.Station:JR-East.Yamanote.Osaki",
  yamanoteB: "odpt.Station:JR-East.Yamanote.Shinagawa",
  tokaidoTokyo: "odpt.Station:JR-East.Tokaido.Tokyo",
  tokaidoYokohama: "odpt.Station:JR-East.Tokaido.Yokohama",
  saikyoOsaki: "odpt.Station:JR-East.SaikyoKawagoe.Osaki",
  saikyoShinjuku:
    "odpt.Station:JR-East.SaikyoKawagoe.Shinjuku",
  kawagoeOmiya: "odpt.Station:JR-East.SaikyoKawagoe.Omiya",
  kawagoeKawagoe:
    "odpt.Station:JR-East.SaikyoKawagoe.Kawagoe",
} as const;

function station(
  id: string,
  name: string,
  railwayId: string,
  position: [number, number],
): OdptStationLookup {
  return { id, name, railwayId, position };
}

function mapLine(
  id: string,
  odptId: string,
  color: string,
): RailwayMapLine {
  return {
    id,
    odptId,
    name: id,
    color,
    coordinates: [[[139.6, 35.6], [139.7, 35.7]]],
  };
}

function networkContext(): OdptNetworkContext {
  const stations = [
    station(
      STATION_IDS.yamanoteA,
      "大崎",
      YAMANOTE_RAILWAY,
      [139.728, 35.62],
    ),
    station(
      STATION_IDS.yamanoteB,
      "品川",
      YAMANOTE_RAILWAY,
      [139.739, 35.628],
    ),
    station(
      STATION_IDS.tokaidoTokyo,
      "東京",
      TOKAIDO_RAILWAY,
      [139.767, 35.681],
    ),
    station(
      STATION_IDS.tokaidoYokohama,
      "横浜",
      TOKAIDO_RAILWAY,
      [139.622, 35.466],
    ),
    station(
      STATION_IDS.saikyoOsaki,
      "大崎",
      SAIKYO_KAWAGOE_RAILWAY,
      [139.728, 35.62],
    ),
    station(
      STATION_IDS.saikyoShinjuku,
      "新宿",
      SAIKYO_KAWAGOE_RAILWAY,
      [139.7, 35.69],
    ),
    station(
      STATION_IDS.kawagoeOmiya,
      "大宮",
      SAIKYO_KAWAGOE_RAILWAY,
      [139.61, 35.89],
    ),
    station(
      STATION_IDS.kawagoeKawagoe,
      "川越",
      SAIKYO_KAWAGOE_RAILWAY,
      [139.483, 35.91],
    ),
  ];
  const lines = [
    mapLine("yamanote", YAMANOTE_RAILWAY, "#91c300"),
    mapLine("tokaido", TOKAIDO_RAILWAY, "#f68b1e"),
    mapLine("saikyo", SAIKYO_KAWAGOE_RAILWAY, "#00ac9a"),
    mapLine("kawagoe", KAWAGOE_RAILWAY, "#00ac9a"),
  ];

  return {
    response: {
      lines,
      options: [],
      generatedAt: "2026-07-31T00:00:00.000Z",
      source: "odpt",
    },
    stationByOdptId: new Map(
      stations.map((item) => [item.id, item]),
    ),
    catalogIdByOdptRailwayId: new Map([
      [YAMANOTE_RAILWAY, "yamanote"],
      [TOKAIDO_RAILWAY, "tokaido"],
      [SAIKYO_KAWAGOE_RAILWAY, "saikyo"],
      [KAWAGOE_RAILWAY, "kawagoe"],
    ]),
    lineByCatalogId: new Map(lines.map((item) => [item.id, item])),
  };
}

function train(
  id: string,
  overrides: Partial<OdptTrain> = {},
): OdptTrain {
  return {
    "owl:sameAs": `odpt.Train:JR-East.Yamanote.${id}`,
    "dc:date": "2026-07-31T00:00:00.000Z",
    "odpt:railway": YAMANOTE_RAILWAY,
    "odpt:trainNumber": id,
    "odpt:trainType": "odpt.TrainType:JR-East.Local",
    "odpt:fromStation": STATION_IDS.yamanoteA,
    "odpt:toStation": STATION_IDS.yamanoteB,
    "odpt:destinationStation": [STATION_IDS.yamanoteB],
    "odpt:delay": 0,
    ...overrides,
  };
}

test("mapperがODPT方向8パターンを共通方向モデルへ結線する", () => {
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
  const mapped = odptTrainsToNetworkTrainLocations(
    cases.map(([suffix], index) =>
      train(`direction-${index}`, {
        "odpt:railDirection":
          `odpt.RailDirection:JR-East.${suffix}`,
      }),
    ),
    networkContext(),
  );

  assert.equal(mapped.length, cases.length);
  for (let index = 0; index < cases.length; index += 1) {
    assert.equal(mapped[index].directionKind, cases[index][1]);
    assert.equal(mapped[index].directionLabel, cases[index][2]);
  }
});

test("東海道線だけは駅順による上り・下り補完へ結線する", () => {
  const [mapped] = odptTrainsToNetworkTrainLocations(
    [
      train("tokaido-down", {
        "owl:sameAs": "odpt.Train:JR-East.Tokaido.101M",
        "odpt:railway": TOKAIDO_RAILWAY,
        "odpt:fromStation": STATION_IDS.tokaidoTokyo,
        "odpt:toStation": STATION_IDS.tokaidoYokohama,
        "odpt:railDirection": null,
      }),
    ],
    networkContext(),
  );

  assert.equal(mapped.lineId, "tokaido");
  assert.equal(mapped.directionKind, "down");
  assert.equal(mapped.directionLabel, "下り");
});

test("埼京・川越直通系統を現在区間で振り分ける", () => {
  const mapped = odptTrainsToNetworkTrainLocations(
    [
      train("saikyo-section", {
        "odpt:railway": SAIKYO_KAWAGOE_RAILWAY,
        "odpt:fromStation": STATION_IDS.saikyoOsaki,
        "odpt:toStation": STATION_IDS.saikyoShinjuku,
      }),
      train("kawagoe-section", {
        "odpt:railway": SAIKYO_KAWAGOE_RAILWAY,
        "odpt:fromStation": STATION_IDS.kawagoeOmiya,
        "odpt:toStation": STATION_IDS.kawagoeKawagoe,
      }),
      train("standalone-kawagoe", {
        "odpt:railway": KAWAGOE_RAILWAY,
        "odpt:fromStation": STATION_IDS.saikyoOsaki,
        "odpt:toStation": STATION_IDS.saikyoShinjuku,
      }),
    ],
    networkContext(),
  );

  assert.deepEqual(
    mapped.map((item) => item.lineId),
    ["saikyo", "kawagoe", "kawagoe"],
  );
});

test("実測・駅間推定・停車位置を区別し、位置を作れない列車を除外する", () => {
  const mapped = odptTrainsToNetworkTrainLocations(
    [
      train("actual-delayed", {
        "geo:long": 139.71,
        "geo:lat": 35.65,
        "odpt:fromStation": null,
        "odpt:toStation": null,
        "odpt:delay": 30,
      }),
      train("estimated-running", { "odpt:delay": 29 }),
      train("at-station", {
        "odpt:toStation": null,
      }),
      train("no-position", {
        "odpt:fromStation":
          "odpt.Station:JR-East.Yamanote.UnknownA",
        "odpt:toStation":
          "odpt.Station:JR-East.Yamanote.UnknownB",
      }),
    ],
    networkContext(),
  );

  assert.deepEqual(
    mapped.map((item) => item.trainNumber),
    ["actual-delayed", "estimated-running", "at-station"],
  );
  assert.deepEqual(
    mapped.map((item) => item.dataAccuracy),
    ["actual", "estimated", "estimated"],
  );
  assert.deepEqual(
    mapped.map((item) => item.status),
    ["delayed", "running", "running"],
  );
  assert.equal(mapped[0].delayMinutes, 1);
  assert.equal(mapped[0].routeSegment, null);
  assert.deepEqual(mapped[1].routeSegment?.coordinates, [
    [139.728, 35.62],
    [139.739, 35.628],
  ]);
  assert.equal(mapped[2].speedKmh, 0);
  assert.equal(mapped[2].longitude, 139.728);
  assert.equal(mapped[2].latitude, 35.62);
});

test("運行情報は最新内容からmajor/minor/normalを生成し公式精度を保つ", () => {
  const major = odptInformationToServiceStatus(
    [
      {
        "dc:date": "2026-07-31T00:00:00.000Z",
        "odpt:trainInformationText": { ja: "一部列車に遅れ" },
      },
      {
        "dc:date": "2026-07-31T00:01:00.000Z",
        "odpt:trainInformationStatus": "運転見合わせ",
        "odpt:trainInformationText": "運転を見合わせています。",
      },
    ],
    "山手線",
    "yamanote",
  );
  const normal = odptInformationToServiceStatus([], "山手線", "yamanote");

  assert.deepEqual(
    {
      severity: major.severity,
      message: major.message,
      updatedAt: major.updatedAt,
      dataAccuracy: major.dataAccuracy,
    },
    {
      severity: "major",
      message: "運転を見合わせています。",
      updatedAt: "2026-07-31T00:01:00.000Z",
      dataAccuracy: "actual",
    },
  );
  assert.equal(normal.severity, "normal");
  assert.equal(normal.dataAccuracy, "actual");
});
