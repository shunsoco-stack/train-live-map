import type { LngLat } from "@/types/geo";

/**
 * 2 座標間の距離(メートル)を Haversine 公式で計算する。
 * 引数は [経度, 緯度] の順。
 */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6371000; // 地球半径(m)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const lat1r = toRad(lat1);
  const lat2r = toRad(lat2);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1r) * Math.cos(lat2r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 線分上の内挿。t=0 で a, t=1 で b。 */
function lerp(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * ポリライン(座標列)に沿った累積距離テーブルを構築する。
 * 一度作って使い回すことで、位置計算を高速化する。
 */
export interface PolylineIndex {
  points: LngLat[];
  /** points[i] までの累積距離(m) */
  cumulative: number[];
  totalLength: number;
}

export function buildPolylineIndex(points: LngLat[]): PolylineIndex {
  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative[i] = cumulative[i - 1] + haversineMeters(points[i - 1], points[i]);
  }
  return {
    points,
    cumulative,
    totalLength: cumulative[cumulative.length - 1] ?? 0,
  };
}

/**
 * ポリライン全体を [0,1] に正規化した位置 fraction から座標を求める。
 * fraction は 0(始点)〜1(終点)。範囲外は端にクランプする。
 * これにより「列車が線路から外れない」ことを保証する。
 */
export function positionAtFraction(index: PolylineIndex, fraction: number): LngLat {
  const clamped = Math.min(1, Math.max(0, fraction));
  const target = clamped * index.totalLength;

  // 該当する線分を二分探索的に線形探索(点数が少ないため線形で十分)
  const { points, cumulative } = index;
  if (points.length === 1) return points[0];

  for (let i = 1; i < points.length; i++) {
    if (target <= cumulative[i]) {
      const segLen = cumulative[i] - cumulative[i - 1];
      const t = segLen === 0 ? 0 : (target - cumulative[i - 1]) / segLen;
      return lerp(points[i - 1], points[i], t);
    }
  }
  return points[points.length - 1];
}
