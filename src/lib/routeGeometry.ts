import type { LngLat } from "@/types/geo";
import { ROUTE_COORDINATES_RAW } from "@/data/routeLine";
import {
  buildPolylineIndex,
  positionAtFraction,
  type PolylineIndex,
} from "@/lib/geo";

/**
 * 路線ジオメトリの共通ユーティリティ。
 *
 * 駅 id からルート上のフラクション(0〜1)や座標を求める処理を集約し、
 * モックプロバイダと ODPT の位置推定の両方から利用する。
 */

// ルート上の各駅に対応する座標インデックス(routeLine.ts の配列順に対応)
export const STATION_ROUTE_INDEX: Record<string, number> = {
  tokyo: 0,
  shimbashi: 2,
  shinagawa: 5,
  kawasaki: 9,
  yokohama: 13,
};

let indexSingleton: PolylineIndex | null = null;

/** 路線ポリラインの累積距離インデックス(生成は一度だけ)。 */
export function getRouteIndex(): PolylineIndex {
  if (!indexSingleton) {
    indexSingleton = buildPolylineIndex(ROUTE_COORDINATES_RAW);
  }
  return indexSingleton;
}

/** 駅 id をルート全体のフラクション(0〜1)に変換する。未知の駅は null。 */
export function stationFractionById(stationId: string): number | null {
  const index = getRouteIndex();
  const idx = STATION_ROUTE_INDEX[stationId];
  if (idx === undefined || index.totalLength === 0) return null;
  return index.cumulative[idx] / index.totalLength;
}

/** フラクションから座標 [経度, 緯度] を求める。 */
export function coordinateAtFraction(fraction: number): LngLat {
  return positionAtFraction(getRouteIndex(), fraction);
}

/** 駅 id の座標 [経度, 緯度] を求める。未知の駅は null。 */
export function coordinateAtStation(stationId: string): LngLat | null {
  const f = stationFractionById(stationId);
  if (f === null) return null;
  return coordinateAtFraction(f);
}

/**
 * 2 駅間を ratio(0=from, 1=to)で内挿した座標を求める。
 * どちらかの駅が未知の場合は、既知の駅の座標にフォールバックする。
 * 両方未知なら null(対象区間外)。
 */
export function coordinateBetweenStations(
  fromStationId: string | null,
  toStationId: string | null,
  ratio = 0.5,
): { position: LngLat; resolved: "both" | "from" | "to" } | null {
  const fromF = fromStationId ? stationFractionById(fromStationId) : null;
  const toF = toStationId ? stationFractionById(toStationId) : null;

  if (fromF !== null && toF !== null) {
    const clamped = Math.min(1, Math.max(0, ratio));
    const f = fromF + (toF - fromF) * clamped;
    return { position: coordinateAtFraction(f), resolved: "both" };
  }
  if (fromF !== null) {
    return { position: coordinateAtFraction(fromF), resolved: "from" };
  }
  if (toF !== null) {
    return { position: coordinateAtFraction(toF), resolved: "to" };
  }
  return null;
}
