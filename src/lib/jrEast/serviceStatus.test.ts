import assert from "node:assert/strict";
import test from "node:test";
import type { OdptTrainInformation } from "../odpt/types.ts";
import type { ServiceStatus, TrainLocation } from "../../types/train.ts";
import {
  applyFullSuspensionsToTrains,
  JR_EAST_STATUS_DATASET_URL,
  JR_EAST_STATUS_SOURCE_LABEL,
  trainInformationRailwayIds,
  withJrEastStatusSource,
} from "./serviceStatus.ts";

test("アイステイションズ運行情報の単一・複数路線IDを取得する", () => {
  assert.deepEqual(
    trainInformationRailwayIds({
      "odpt:railway": "odpt.Railway:JR-East.Yamanote",
    }),
    ["odpt.Railway:JR-East.Yamanote"],
  );
  assert.deepEqual(
    trainInformationRailwayIds({
      "odpt:railway": [
        "odpt.Railway:JR-East.SaikyoKawagoe",
        "odpt.Railway:JR-East.Rinkai",
      ],
    } as OdptTrainInformation),
    [
      "odpt.Railway:JR-East.SaikyoKawagoe",
      "odpt.Railway:JR-East.Rinkai",
    ],
  );
});

test("運行情報にODPT公式データセットの出典を付ける", () => {
  const status: ServiceStatus = {
    lineId: "saikyo",
    lineName: "埼京線",
    severity: "major",
    message: "上下線で運転を見合わせています。",
    updatedAt: "2026-08-05T08:45:00.000Z",
    dataAccuracy: "actual",
  };
  const sourced = withJrEastStatusSource(status);
  assert.equal(sourced.sourceLabel, JR_EAST_STATUS_SOURCE_LABEL);
  assert.equal(sourced.sourceUrl, JR_EAST_STATUS_DATASET_URL);
});

test("全方向の見合わせ時だけ対象路線の車両を見合わせにする", () => {
  const now = Date.parse("2026-08-05T08:46:00.000Z");
  const train = {
    id: "1",
    lineId: "saikyo",
    status: "delayed",
    speedKmh: 60,
  } as TrainLocation;
  const fullSuspension: ServiceStatus = {
    lineId: "saikyo",
    lineName: "埼京線",
    severity: "major",
    message: "人身事故の影響で、上下線で運転を見合わせています。",
    updatedAt: "2026-08-05T08:45:00.000Z",
    dataAccuracy: "actual",
  };
  const [suspended] = applyFullSuspensionsToTrains(
    [train],
    [fullSuspension],
    now,
  );
  assert.equal(suspended.status, "suspended");
  assert.equal(suspended.speedKmh, 0);

  const partial = {
    ...fullSuspension,
    message: "一部区間で運転を見合わせています。",
  };
  assert.equal(
    applyFullSuspensionsToTrains([train], [partial], now)[0].status,
    "delayed",
  );
});
