import assert from "node:assert/strict";
import test from "node:test";
import { serviceStatusesForVisibleLines } from "./serviceStatus.ts";
import type { ServiceStatus } from "../types/train.ts";

function status(
  lineId: string,
  lineName: string,
  severity: ServiceStatus["severity"] = "normal",
): ServiceStatus {
  return {
    lineId,
    lineName,
    severity,
    message:
      severity === "normal"
        ? "平常どおり運転しています。"
        : `${lineName}に遅れがでています。`,
    updatedAt: "2026-07-29T00:00:00.000Z",
    dataAccuracy: "actual",
  };
}

test("選択していない東海道線の運行情報を表示しない", () => {
  const result = serviceStatusesForVisibleLines(
    [
      status("tokaido", "東海道線", "minor"),
      status("yamanote", "山手線"),
    ],
    new Set(["yamanote"]),
  );
  assert.deepEqual(result.map((item) => item.lineId), ["yamanote"]);
});

test("複数選択時は異常のある路線だけを重大度順に表示する", () => {
  const result = serviceStatusesForVisibleLines(
    [
      status("yamanote", "山手線"),
      status("chuo-rapid", "中央線快速電車", "minor"),
      status("keihin-tohoku", "京浜東北線", "major"),
    ],
    new Set(["yamanote", "chuo-rapid", "keihin-tohoku"]),
  );
  assert.deepEqual(
    result.map((item) => item.lineId),
    ["keihin-tohoku", "chuo-rapid"],
  );
});

test("複数の選択路線がすべて平常なら1件にまとめる", () => {
  const result = serviceStatusesForVisibleLines(
    [status("yamanote", "山手線"), status("tokaido", "東海道線")],
    new Set(["yamanote", "tokaido"]),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].lineName, "選択中の2路線");
  assert.equal(result[0].message, "すべて平常どおり運転しています。");
});

test("表示路線が空なら運行情報も表示しない", () => {
  assert.deepEqual(
    serviceStatusesForVisibleLines(
      [status("tokaido", "東海道線")],
      new Set(),
    ),
    [],
  );
});
