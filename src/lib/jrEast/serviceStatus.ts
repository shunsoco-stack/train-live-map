import type { OdptTrainInformation } from "../odpt/types.ts";
import type { ServiceStatus, TrainLocation } from "../../types/train.ts";

export const JR_EAST_STATUS_DATASET_URL =
  "https://ckan.odpt.org/dataset/jr-train-status-information-by-jr-east-i-stations";
export const JR_EAST_STATUS_SOURCE_LABEL =
  "JR東日本アイステイションズ（ODPT）";

const MAX_STATUS_AGE_MS = 10 * 60 * 1000;

/** 運行情報が対象とする路線IDを、単一値・配列の両形式から取り出す。 */
export function trainInformationRailwayIds(
  information: OdptTrainInformation,
): string[] {
  const railway = information["odpt:railway"];
  if (Array.isArray(railway)) return railway.filter(Boolean);
  return railway ? [railway] : [];
}

/** ODPT運行情報の出典をUIへ引き継ぐ。 */
export function withJrEastStatusSource(
  status: ServiceStatus,
): ServiceStatus {
  return {
    ...status,
    sourceLabel: JR_EAST_STATUS_SOURCE_LABEL,
    sourceUrl: JR_EAST_STATUS_DATASET_URL,
  };
}

/** 「全線または全方向が見合わせ」と読める場合だけ全車両を見合わせ表示にする。 */
export function applyFullSuspensionsToTrains(
  trains: readonly TrainLocation[],
  statuses: readonly ServiceStatus[],
  nowMs = Date.now(),
): TrainLocation[] {
  const fullySuspendedLineIds = new Set(
    statuses
      .filter(
        (status) =>
          status.severity === "major" &&
          Number.isFinite(Date.parse(status.updatedAt)) &&
          Date.parse(status.updatedAt) <= nowMs + 2 * 60 * 1000 &&
          nowMs - Date.parse(status.updatedAt) <= MAX_STATUS_AGE_MS &&
          /運転(?:を)?見合わせ|運転見合せ|抑止/.test(status.message) &&
          /全線|内[・･]外回り|内回り[、・･と及び]外回り|上下線/.test(
            status.message,
          ) &&
          !/一部区間|一部列車/.test(status.message),
      )
      .map((status) => status.lineId),
  );

  if (fullySuspendedLineIds.size === 0) return [...trains];
  return trains.map((train) =>
    fullySuspendedLineIds.has(train.lineId)
      ? {
          ...train,
          status: "suspended",
          speedKmh: 0,
        }
      : train,
  );
}
