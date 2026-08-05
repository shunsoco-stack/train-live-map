import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyServiceStatusSeverity,
  serviceStatusesForVisibleLines,
  serviceStatusWithTrainDelayFallback,
} from "./serviceStatus.ts";
import type { ServiceStatus, TrainLocation } from "../types/train.ts";

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

function train(
  id: string,
  delayMinutes: number,
  lastUpdatedAt = "2026-07-31T08:45:00.000Z",
): TrainLocation {
  return {
    id,
    lineId: "saikyo",
    lineName: "埼京線",
    lineColor: "#00ac9a",
    trainNumber: id,
    direction: "inbound",
    destination: "大宮",
    trainType: "local",
    latitude: 35.7,
    longitude: 139.7,
    delayMinutes,
    speedKmh: 0,
    status: delayMinutes > 0 ? "delayed" : "running",
    lastUpdatedAt,
    stoppedSince: null,
    dataAccuracy: "actual",
    routeSegment: null,
  };
}

test("運転再開後の遅延を見合わせ中と誤判定しない", () => {
  assert.equal(
    classifyServiceStatusSeverity(
      "運転を見合わせていましたが、運転を再開し、一部列車に遅れがでています。",
    ),
    "minor",
  );
});

test("現在の運転見合わせは重大情報に分類する", () => {
  assert.equal(
    classifyServiceStatusSeverity(
      "人身事故の影響で、上下線で運転を見合わせています。",
    ),
    "major",
  );
});

test("運転再開見込は再開済みではなく見合わせ中と判定する", () => {
  assert.equal(
    classifyServiceStatusSeverity(
      "10時40分頃運転再開見込。内・外回り電車で運転を見合わせています。",
    ),
    "major",
  );
});

test("直通運転中止は全線見合わせではなく遅延情報に分類する", () => {
  assert.equal(
    classifyServiceStatusSeverity(
      "一部列車に遅れがでています。川越線への直通運転を中止しています。",
    ),
    "minor",
  );
});

test("ODPT運行情報が空でも最新列車の大幅遅延を平常扱いしない", () => {
  const result = serviceStatusWithTrainDelayFallback(
    status("saikyo", "埼京線"),
    [train("1", 72), train("2", 43), train("3", 0)],
    Date.parse("2026-07-31T08:45:30.000Z"),
  );

  assert.equal(result.severity, "major");
  assert.match(result.message, /最大72分の大幅な遅れ/);
  assert.equal(result.dataAccuracy, "estimated");
});

test("ODPTが異常を返した場合は列車位置による推定で上書きしない", () => {
  const official = status("saikyo", "埼京線", "major");
  const result = serviceStatusWithTrainDelayFallback(
    official,
    [train("1", 72)],
    Date.parse("2026-07-31T08:45:30.000Z"),
  );

  assert.deepEqual(result, official);
});

test("古い列車位置は運行状況の補完に使わない", () => {
  const normal = status("saikyo", "埼京線");
  const result = serviceStatusWithTrainDelayFallback(
    normal,
    [train("1", 72, "2026-07-31T08:40:00.000Z")],
    Date.parse("2026-07-31T08:45:30.000Z"),
  );

  assert.deepEqual(result, normal);
});

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
