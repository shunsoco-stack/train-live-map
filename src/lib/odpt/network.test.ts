import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import type { OdptConfig } from "./config.ts";
import type { OdptRailway, OdptStation } from "./types.ts";

const apiStubUrl = `data:text/javascript,${encodeURIComponent(`
  function fixtures() {
    const value = globalThis.__trainLiveMapOdptNetworkTestFixtures;
    if (!value) throw new Error("ODPT network test fixtures are missing");
    return value;
  }
  export async function fetchOdptRailways() {
    return { data: fixtures().railways, durationMs: 0, maskedUrl: "test" };
  }
  export async function fetchOdptStations() {
    return { data: fixtures().stations, durationMs: 0, maskedUrl: "test" };
  }
`)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/odpt/api") {
      return { shortCircuit: true, url: apiStubUrl };
    }
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    return {
      shortCircuit: true,
      url: new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href,
    };
  },
});

const { ODPT_RAILWAY_TO_CATALOG } = await import(
  "../../data/railwayCatalog.ts"
);

const CONFIG: OdptConfig = {
  baseUrl: "https://odpt.test/api/v4",
  accessToken: "test-token",
  railway: "odpt.Railway:JR-East.Tokaido",
  operator: "odpt.Operator:JR-East",
  timeoutMs: 1_000,
  retries: 0,
};

const COMBINED_ID = "odpt.Railway:JR-East.SaikyoKawagoe";
const VALID_COMBINED_PATH = [
  [139.728, 35.62],
  [139.7, 35.69],
  [139.625, 35.906],
  [139.58, 35.91],
  [139.483, 35.91],
];

function railway(
  odptId: string,
  index: number,
): OdptRailway {
  const isCombined = odptId === COMBINED_ID;
  const isStandaloneKawagoe =
    odptId === "odpt.Railway:JR-East.Kawagoe";
  return {
    "owl:sameAs": odptId,
    "odpt:railwayTitle": {
      ja: odptId.split(".").pop() ?? odptId,
    },
    "odpt:color": `#${(index + 1).toString(16).padStart(6, "0")}`,
    "ug:region": {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: isCombined
          ? VALID_COMBINED_PATH
          : isStandaloneKawagoe
            ? [[139.5, 35.9], [139.48, 35.91]]
          : [
              [139.6 + index * 0.001, 35.6],
              [139.61 + index * 0.001, 35.61],
            ],
      },
    },
  };
}

const fixtureGlobal = globalThis as typeof globalThis & {
  __trainLiveMapOdptNetworkTestFixtures?: {
    railways: OdptRailway[];
    stations: OdptStation[];
  };
};

await test("公式ODPT路線IDを完全一致で対応付け、結合線形を安全に分割する", async () => {
  const railways = Object.keys(ODPT_RAILWAY_TO_CATALOG).map(railway);
  railways.push(
    railway("odpt.Railway:JR-East.FooYamanoteBar", railways.length),
  );

  const yamanote = railways.find(
    (item) =>
      item["owl:sameAs"] === "odpt.Railway:JR-East.Yamanote",
  );
  if (!yamanote) throw new Error("Yamanote fixture is missing");
  delete yamanote["ug:region"];
  yamanote["odpt:stationOrder"] = [
    {
      "odpt:index": 2,
      "odpt:station": "odpt.Station:JR-East.Yamanote.B",
    },
    {
      "odpt:index": 1,
      "odpt:station": "odpt.Station:JR-East.Yamanote.A",
    },
  ];

  const stations: OdptStation[] = [
    {
      "owl:sameAs": "odpt.Station:JR-East.Yamanote.A",
      "odpt:railway": "odpt.Railway:JR-East.Yamanote",
      "odpt:stationTitle": { ja: "A駅" },
      "geo:long": 139.7,
      "geo:lat": 35.6,
    },
    {
      "owl:sameAs": "odpt.Station:JR-East.Yamanote.B",
      "odpt:railway": "odpt.Railway:JR-East.Yamanote",
      "odpt:stationTitle": { ja: "B駅" },
      "geo:long": 139.8,
      "geo:lat": 35.7,
    },
    {
      "owl:sameAs": "odpt.Station:JR-East.Yamanote.NoCoordinates",
      "odpt:railway": "odpt.Railway:JR-East.Yamanote",
      "odpt:stationTitle": { ja: "座標なし駅" },
    },
  ];

  fixtureGlobal.__trainLiveMapOdptNetworkTestFixtures = {
    railways,
    stations,
  };
  try {
    const { getOdptNetworkContext } = await import(
      "./network.ts?complete-network"
    );
    const context = await getOdptNetworkContext(CONFIG);

    for (const [odptId, expectedCatalogId] of Object.entries(
      ODPT_RAILWAY_TO_CATALOG,
    )) {
      assert.equal(
        context.catalogIdByOdptRailwayId.get(odptId),
        expectedCatalogId,
        odptId,
      );
    }
    assert.equal(
      context.catalogIdByOdptRailwayId.has(
        "odpt.Railway:JR-East.FooYamanoteBar",
      ),
      false,
    );

    assert.deepEqual(
      context.lineByCatalogId.get("yamanote")?.coordinates,
      [[[139.7, 35.6], [139.8, 35.7]]],
    );
    assert.equal(
      context.stationByOdptId.has(
        "odpt.Station:JR-East.Yamanote.NoCoordinates",
      ),
      false,
    );

    const saikyo = context.lineByCatalogId.get("saikyo");
    const kawagoe = context.lineByCatalogId.get("kawagoe");
    assert.ok(saikyo);
    assert.ok(kawagoe);
    assert.equal(
      saikyo.coordinates.flat().some(([longitude]) => longitude < 139.55),
      false,
    );
    assert.equal(
      kawagoe.coordinates
        .flat()
        .some(([, latitude]) => latitude < 35.87),
      false,
    );
  } finally {
    delete fixtureGlobal.__trainLiveMapOdptNetworkTestFixtures;
  }
});

await test("埼京・川越線形を分割できない場合は結合線形を描画しない", async () => {
  const unsplittable: OdptRailway[] = [
    {
      "owl:sameAs": COMBINED_ID,
      "odpt:railwayTitle": { ja: "埼京線・川越線" },
      "ug:region": {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [139.728, 35.62],
            [139.7, 35.69],
            [139.66, 35.82],
          ],
        },
      },
    },
  ];
  fixtureGlobal.__trainLiveMapOdptNetworkTestFixtures = {
    railways: unsplittable,
    stations: [],
  };
  try {
    const { getOdptNetworkContext } = await import(
      "./network.ts?unsplittable-network"
    );
    const context = await getOdptNetworkContext(CONFIG);

    assert.equal(
      context.catalogIdByOdptRailwayId.get(COMBINED_ID),
      "saikyo",
    );
    assert.equal(context.lineByCatalogId.has("saikyo"), false);
    assert.equal(context.lineByCatalogId.has("kawagoe"), false);
    assert.deepEqual(
      context.response.lines.map((line) => line.id),
      ["tokaido"],
    );
  } finally {
    delete fixtureGlobal.__trainLiveMapOdptNetworkTestFixtures;
  }
});
