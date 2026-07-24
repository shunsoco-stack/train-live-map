/** 地理データ関連の型 */

/** GeoJSON 準拠の座標 [経度(lng), 緯度(lat)] の順。※順番を間違えない */
export type LngLat = [number, number];

/** 駅情報 */
export interface Station {
  id: string;
  name: string;
  /** 緯度 */
  latitude: number;
  /** 経度 */
  longitude: number;
}

/** GeoJSON LineString Feature(路線形状) */
export interface RouteLineFeature {
  type: "Feature";
  properties: {
    name: string;
  };
  geometry: {
    type: "LineString";
    coordinates: LngLat[];
  };
}
