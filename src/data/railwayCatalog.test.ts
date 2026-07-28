import assert from "node:assert/strict";
import test from "node:test";
import { findRailwayCatalogLine, RAILWAY_CATALOG } from "./railwayCatalog.ts";

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

