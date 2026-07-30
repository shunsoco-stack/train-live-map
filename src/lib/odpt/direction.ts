import { createLogger } from "../logger.ts";
import type { TrainDirectionKind } from "../../types/train.ts";

export type TokaidoDirection = "inbound" | "outbound";

export interface MappedTrainDirection {
  directionKind: TrainDirectionKind;
  directionLabel: string | null;
}

/**
 * ODPT の railDirection 末尾サフィックスと表示方向の明示対応。
 * 値が増えた場合は実フィードを確認してから追加し、推測で既存方向へ倒さない。
 */
export const ODPT_DIRECTION_BY_SUFFIX: Readonly<
  Record<string, MappedTrainDirection>
> = {
  inbound: { directionKind: "up", directionLabel: "上り" },
  outbound: { directionKind: "down", directionLabel: "下り" },
  innerloop: { directionKind: "inner-loop", directionLabel: "内回り" },
  outerloop: { directionKind: "outer-loop", directionLabel: "外回り" },
  northbound: { directionKind: "north", directionLabel: "北行" },
  southbound: { directionKind: "south", directionLabel: "南行" },
  eastbound: { directionKind: "east", directionLabel: "東行" },
  westbound: { directionKind: "west", directionLabel: "西行" },
};

const UNKNOWN_DIRECTION: MappedTrainDirection = {
  directionKind: "unknown",
  directionLabel: null,
};
const log = createLogger("odpt-direction");
const warnedUnknownDirections = new Set<string>();

/** ODPT railDirection を安全に表示用方向へ変換する。未知値は非表示にする。 */
export function mapOdptRailDirection(
  value: string | null | undefined,
): MappedTrainDirection {
  const suffix = value?.split(/[.:]/).pop()?.toLowerCase() ?? "";
  const mapped = ODPT_DIRECTION_BY_SUFFIX[suffix];
  if (mapped) return mapped;

  if (value && !warnedUnknownDirections.has(value)) {
    warnedUnknownDirections.add(value);
    log.warn("未知の odpt:railDirection を非表示にします", { value });
  }
  return UNKNOWN_DIRECTION;
}

interface DirectionInput {
  odptDirection: string | null | undefined;
  fromStationId: string | null;
  toStationId: string | null;
  destinationStationIds: Array<string | null> | undefined;
  trainNumber: string;
}

function directionFromStationOrder(
  fromStationId: string | null,
  toStationId: string | null,
  stationOrder: readonly string[],
): TokaidoDirection | null {
  if (!fromStationId || !toStationId || fromStationId === toStationId) return null;

  const fromIndex = stationOrder.indexOf(fromStationId);
  const toIndex = stationOrder.indexOf(toStationId);
  if (fromIndex < 0 || toIndex < 0) return null;

  // 駅順は東京 → 横浜（下り）の順。
  return toIndex > fromIndex ? "outbound" : "inbound";
}

function directionFromTrainNumber(trainNumber: string): TokaidoDirection | null {
  const match = trainNumber.match(/^(\d+)/);
  if (!match) return null;

  // JR 東日本の東海道線は、偶数列車が上り・奇数列車が下り。
  return Number(match[1]) % 2 === 0 ? "inbound" : "outbound";
}

export function inferTokaidoDirection(
  input: DirectionInput,
  stationOrder: readonly string[],
): TokaidoDirection {
  const suffix = input.odptDirection?.split(/[.:]/).pop()?.toLowerCase() ?? "";
  if (suffix === "inbound") return "inbound";
  if (suffix === "outbound") return "outbound";

  // Challenge API では railDirection が空になる列車があるため、駅の移動順で補完する。
  const fromStations = directionFromStationOrder(
    input.fromStationId,
    input.toStationId,
    stationOrder,
  );
  if (fromStations) return fromStations;

  // 駅停車中など toStation が無い場合は、区間内の行先駅があればそこから補完する。
  const destinationStationId =
    input.destinationStationIds?.find((stationId): stationId is string => stationId !== null) ??
    null;
  const fromDestination = directionFromStationOrder(
    input.fromStationId,
    destinationStationId,
    stationOrder,
  );
  if (fromDestination) return fromDestination;

  // 直通先など行先が区間外でも、東海道線の列車番号規則で判定できる。
  return directionFromTrainNumber(input.trainNumber) ?? "outbound";
}

/** 東海道線固有の上り・下り判定を共通の方向モデルへ変換する。 */
export function mapTokaidoDirection(
  direction: TokaidoDirection,
): MappedTrainDirection {
  return direction === "inbound"
    ? { directionKind: "up", directionLabel: "上り" }
    : { directionKind: "down", directionLabel: "下り" };
}
