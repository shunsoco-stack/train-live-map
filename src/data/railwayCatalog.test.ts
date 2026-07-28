import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultVisibleRailwayIds,
  findRailwayCatalogLine,
  railwayFilterOptions,
  RAILWAY_CATALOG,
} from "./railwayCatalog.ts";

test("関東の表示対象を44件保持する", () => {
  assert.equal(RAILWAY_CATALOG.length, 44);
});

test("ODPT路線IDから主要路線を識別する", () => {
  assert.equal(
    findRailwayCatalogLine(
      "odpt.Railway:JR-East.Tokaido",
      "東海道線",
    )?.id,
    "tokaido",
  );
  assert.equal(
    findRailwayCatalogLine(
      "odpt.Railway:JR-East.ChuoSobuLocal",
      "中央・総武線各駅停車",
    )?.id,
    "chuo-sobu-local",
  );
  assert.equal(
    findRailwayCatalogLine(
      "odpt.Railway:JR-East.JobanRapid",
      "常磐線快速電車",
    )?.id,
    "joban-rapid",
  );
});

test("ODPT列車位置情報の対象外路線を選択肢から外す", () => {
  const allIds = new Set(RAILWAY_CATALOG.map((line) => line.id));
  const options = railwayFilterOptions(allIds);
  const optionIds = new Set(options.map((option) => option.id));

  assert.equal(options.length, 41);
  assert.equal(optionIds.has("sagami"), false);
  assert.equal(optionIds.has("tsurumi"), false);
  assert.equal(optionIds.has("hachiko"), false);
});

test("初期表示は各方面の先頭の利用可能路線だけを選ぶ", () => {
  const allIds = new Set(RAILWAY_CATALOG.map((line) => line.id));
  const options = railwayFilterOptions(allIds);

  assert.deepEqual([...defaultVisibleRailwayIds(options)], [
    "yamanote",
    "ueno-tokyo",
    "tokaido",
    "utsunomiya",
    "chuo-rapid",
    "joban",
    "sobu-rapid",
  ]);
});

test("各方面の先頭が利用不可なら次の利用可能路線を選ぶ", () => {
  const availableIds = new Set([
    "shonan-shinjuku",
    "keihin-tohoku",
    "takasaki",
    "chuo-sobu-local",
    "joban-rapid",
    "sobu-main",
  ]);
  const options = railwayFilterOptions(availableIds);

  assert.deepEqual([...defaultVisibleRailwayIds(options)], [
    "shonan-shinjuku",
    "keihin-tohoku",
    "takasaki",
    "chuo-sobu-local",
    "joban-rapid",
    "sobu-main",
  ]);
});
