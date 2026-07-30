import assert from "node:assert/strict";
import test from "node:test";
import type { RailwayFilterOption } from "../../types/railway.ts";
import {
  resolveRailwaySelection,
  SELECTION_DEFAULT_VERSION,
  shouldRetryFallbackRailwayNetwork,
} from "./railwaySelection.ts";

const options: RailwayFilterOption[] = [
  {
    id: "tokaido",
    name: "東海道線",
    category: "東海道方面",
    color: "#f68b1e",
    aliases: [],
    coverage: "realtime",
    coverageNote: null,
    kind: "line",
    available: true,
  },
  {
    id: "yokosuka",
    name: "横須賀線",
    category: "東海道方面",
    color: "#0067c0",
    aliases: [],
    coverage: "realtime",
    coverageNote: null,
    kind: "line",
    available: true,
  },
  {
    id: "keihin-tohoku",
    name: "京浜東北線",
    category: "都心環状・南北",
    color: "#00b2e5",
    aliases: [],
    coverage: "realtime",
    coverageNote: null,
    kind: "line",
    available: true,
  },
];

test("フォールバック中は選択を確定せず保存値にも触れない", () => {
  const result = resolveRailwaySelection(
    JSON.stringify(["keihin-tohoku"]),
    options,
    "fallback",
    SELECTION_DEFAULT_VERSION,
  );

  assert.equal(result.visibleIds, null);
  assert.equal(result.shouldFinalize, false);
  assert.equal(result.shouldPersistSelection, false);
  assert.equal(result.shouldPersistVersion, false);
});

test("ODPT復旧後は未知IDを含む保存済み選択をそのまま復元する", () => {
  const result = resolveRailwaySelection(
    JSON.stringify(["keihin-tohoku", "future-line"]),
    options,
    "odpt",
    SELECTION_DEFAULT_VERSION,
  );

  assert.deepEqual(
    [...(result.visibleIds ?? [])],
    ["keihin-tohoku", "future-line"],
  );
  assert.equal(result.shouldFinalize, true);
  assert.equal(result.shouldPersistSelection, false);
  assert.equal(result.shouldPersistVersion, false);
});

test("空選択は有効な利用者設定として保持する", () => {
  const result = resolveRailwaySelection(
    "[]",
    options,
    "odpt",
    SELECTION_DEFAULT_VERSION,
  );

  assert.deepEqual([...(result.visibleIds ?? [])], []);
  assert.equal(result.shouldPersistSelection, false);
});

test("保存値がないか壊れている場合だけ初期選択を保存する", () => {
  for (const storedValue of [null, "{broken", JSON.stringify([123])]) {
    const result = resolveRailwaySelection(
      storedValue,
      options,
      "odpt",
      null,
    );
    assert.deepEqual(
      [...(result.visibleIds ?? [])],
      ["tokaido", "keihin-tohoku"],
    );
    assert.equal(result.shouldFinalize, true);
    assert.equal(result.shouldPersistSelection, true);
    assert.equal(result.shouldPersistVersion, true);
  }
});

test("旧版の全路線選択は未知IDを失わず軽量な初期選択へ移行する", () => {
  const result = resolveRailwaySelection(
    JSON.stringify([
      "tokaido",
      "yokosuka",
      "keihin-tohoku",
      "future-line",
    ]),
    options,
    "odpt",
    "1",
  );

  assert.deepEqual(
    [...(result.visibleIds ?? [])],
    ["future-line", "tokaido", "keihin-tohoku"],
  );
  assert.equal(result.shouldPersistSelection, true);
  assert.equal(result.shouldPersistVersion, true);
});

test("フォールバック再取得は1回だけ許可する", () => {
  assert.equal(shouldRetryFallbackRailwayNetwork("fallback", 0), true);
  assert.equal(shouldRetryFallbackRailwayNetwork("fallback", 1), false);
  assert.equal(shouldRetryFallbackRailwayNetwork("odpt", 0), false);
});
