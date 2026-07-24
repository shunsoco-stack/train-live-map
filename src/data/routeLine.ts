import type { LngLat, RouteLineFeature } from "@/types/geo";

/**
 * 東海道線 東京〜横浜間の走行ルート(概略)。
 *
 * 駅同士を単純な直線で結ぶのではなく、実際の線路の曲がりに近づけるため
 * 駅間に中間点を追加した GeoJSON LineString。座標は [経度, 緯度] の順。
 *
 * MVP のため細かい線路形状(分岐・カーブ半径)は再現していない。
 * より正確な形状が必要になった場合はこの座標列を差し替える。
 */
const ROUTE_COORDINATES: LngLat[] = [
  [139.767125, 35.681236], // 東京
  [139.763, 35.6745],
  [139.758587, 35.666195], // 新橋
  [139.749, 35.648],
  [139.74354, 35.6357],
  [139.73876, 35.62876], // 品川
  [139.7277, 35.6072], // 大井町付近
  [139.7156, 35.5757], // 蒲田付近
  [139.703, 35.545],
  [139.696758, 35.531264], // 川崎
  [139.6725, 35.5085],
  [139.6598, 35.5008], // 鶴見付近
  [139.6357, 35.478],
  [139.622111, 35.465816], // 横浜
];

export const ROUTE_LINE: RouteLineFeature = {
  type: "Feature",
  properties: {
    name: "東海道線(東京〜横浜)",
  },
  geometry: {
    type: "LineString",
    coordinates: ROUTE_COORDINATES,
  },
};

export const ROUTE_COORDINATES_RAW = ROUTE_COORDINATES;
