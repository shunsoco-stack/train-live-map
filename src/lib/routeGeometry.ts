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

/** 2 点間の方位角(度)。北=0、東=90、南=180、西=270。 */
export function bearingDegrees(from: LngLat, to: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const dLng = toRad(lng2 - lng1);
  const lat1r = toRad(lat1);
  const lat2r = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(lat2r);
  const x =
    Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** 任意のポリライン上で、指定座標に最も近い区間の方位角を返す。 */
export function headingOnPolyline(
  index: PolylineIndex,
  longitude: number,
  latitude: number,
  reverse: boolean,
): number {
  const { points } = index;
  if (points.length < 2) return 0;

  const p: LngLat = [longitude, latitude];
  let bestIndex = 1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i++) {
    const distance = distanceSqToSegment(p, points[i - 1], points[i]);
    if (distance < bestDist) {
      bestDist = distance;
      bestIndex = i;
    }
  }

  const heading = bearingDegrees(points[bestIndex - 1], points[bestIndex]);
  return reverse ? (heading + 180) % 360 : heading;
}

/**
 * 点から線分への距離の二乗(平面近似)。
 * 対象範囲が狭いため、経度を cos(緯度) で補正した平面座標で十分な精度が得られる。
 */
function distanceSqToSegment(p: LngLat, a: LngLat, b: LngLat): number {
  const k = Math.cos((p[1] * Math.PI) / 180);
  const px = p[0] * k;
  const py = p[1];
  const ax = a[0] * k;
  const ay = a[1];
  const bx = b[0] * k;
  const by = b[1];
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.min(1, Math.max(0, t));
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

/**
 * 指定座標に最も近い線路上の区間から、進行方向の方位角(度)を求める。
 *
 * 路線座標は 東京 → 横浜 の順に並んでいるため、その向きが「下り(outbound)」。
 * reverse=true(上り / inbound)の場合は 180 度反転する。
 * 列車アイコンの向き(前後)を示すために使用する。
 */
export function headingAtPosition(longitude: number, latitude: number, reverse: boolean): number {
  return headingOnPolyline(
    getRouteIndex(),
    longitude,
    latitude,
    reverse,
  );
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
