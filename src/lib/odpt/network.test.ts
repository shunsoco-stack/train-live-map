import assert from "node:assert/strict";
import test from "node:test";
import { buildOdptNetworkContext } from "./network.ts";
import type { OdptRailway, OdptStation } from "./types.ts";

const YAMANOTE = "odpt.Railway:JR-East.Yamanote";
const COMBINED = "odpt.Railway:JR-East.SaikyoKawagoe";

function station(id: string, railwayId: string, name: string, longitude: number, latitude: number): OdptStation {
  return { "owl:sameAs": id, "odpt:railway": railwayId, "odpt:stationTitle": { ja: name }, "geo:long": longitude, "geo:lat": latitude };
}

test("ODPT路線IDをカタログIDへ対応付ける", () => {
  const railways: OdptRailway[] = [{
    "owl:sameAs": YAMANOTE,
    "odpt:railwayTitle": { ja: "山手線" },
    "ug:region": { type: "Feature", geometry: { type: "LineString", coordinates: [[139.7, 35.6], [139.8, 35.7]] } },
  }];
  const context = buildOdptNetworkContext(railways, []);
  assert.equal(context.catalogIdByOdptRailwayId.get(YAMANOTE), "yamanote");
  assert.equal(context.lineByCatalogId.get("yamanote")?.name, "山手線");
});

test("埼京・川越共通線形と駅を大宮境界で分割する", () => {
  const ids = {
    shinjuku: `${COMBINED}.Shinjuku`,
    omiya: `${COMBINED}.Omiya`,
    kawagoe: `${COMBINED}.Kawagoe`,
  };
  const railways: OdptRailway[] = [{
    "owl:sameAs": COMBINED,
    "odpt:railwayTitle": { ja: "埼京線・川越線" },
    "odpt:stationOrder": [
      { "odpt:index": 1, "odpt:station": ids.shinjuku },
      { "odpt:index": 2, "odpt:station": ids.omiya },
      { "odpt:index": 3, "odpt:station": ids.kawagoe },
    ],
    "ug:region": { type: "Feature", geometry: { type: "LineString", coordinates: [[139.70, 35.69], [139.62, 35.906], [139.48, 35.91]] } },
  }];
  const stations = [
    station(ids.shinjuku, COMBINED, "新宿", 139.70, 35.69),
    station(ids.omiya, COMBINED, "大宮", 139.62, 35.906),
    station(ids.kawagoe, COMBINED, "川越", 139.48, 35.91),
  ];
  const context = buildOdptNetworkContext(railways, stations);
  assert.equal(context.catalogIdByOdptRailwayId.get(COMBINED), "saikyo");
  assert.deepEqual(context.lineByCatalogId.get("saikyo")?.stations.map((item) => item.name), ["新宿", "大宮"]);
  assert.deepEqual(context.lineByCatalogId.get("kawagoe")?.stations.map((item) => item.name), ["大宮", "川越"]);
  assert.equal(context.lineByCatalogId.get("saikyo")?.coordinates[0].length, 2);
  assert.equal(context.lineByCatalogId.get("kawagoe")?.coordinates[0].length, 2);
});
