import type { Station } from "@/types/geo";

/**
 * 東海道線 東京〜横浜間の対象駅。
 * 緯度経度は実際の駅位置に基づく値(概ね駅中心)。
 * 配列の順序は下り(outbound / 東京 → 横浜)方向。
 */
export const STATIONS: Station[] = [
  { id: "tokyo", name: "東京", latitude: 35.681236, longitude: 139.767125 },
  { id: "shimbashi", name: "新橋", latitude: 35.666195, longitude: 139.758587 },
  { id: "shinagawa", name: "品川", latitude: 35.62876, longitude: 139.73876 },
  { id: "kawasaki", name: "川崎", latitude: 35.531264, longitude: 139.696758 },
  { id: "yokohama", name: "横浜", latitude: 35.465816, longitude: 139.622111 },
];

/** 駅 id から駅を引く */
export function getStationById(id: string): Station | undefined {
  return STATIONS.find((s) => s.id === id);
}
