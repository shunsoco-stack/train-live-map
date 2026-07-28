import type { RailwayMapLine } from "@/types/railway";

export type MapBounds = [[number, number], [number, number]];

/** 路線情報の取得前にも、東京周辺から大きく外れない初期表示。 */
export const DEFAULT_MAP_BOUNDS: MapBounds = [
  [139.15, 35.15],
  [140.05, 35.95],
];

const MIN_COORDINATE_SPAN = 0.02;

function isValidPosition(position: unknown): position is [number, number] {
  return (
    Array.isArray(position) &&
    position.length >= 2 &&
    typeof position[0] === "number" &&
    typeof position[1] === "number" &&
    Number.isFinite(position[0]) &&
    Number.isFinite(position[1]) &&
    Math.abs(position[0]) <= 180 &&
    Math.abs(position[1]) <= 90
  );
}

/**
 * 表示中の路線だけが自然に収まる地図範囲を返す。
 * 非表示路線や不正な座標は、初期カメラ位置へ影響させない。
 */
export function getVisibleRailwayBounds(
  lines: readonly RailwayMapLine[],
  visibleIds: ReadonlySet<string>,
): MapBounds | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const line of lines) {
    if (!visibleIds.has(line.id)) continue;
    for (const path of line.coordinates) {
      for (const position of path) {
        if (!isValidPosition(position)) continue;
        west = Math.min(west, position[0]);
        south = Math.min(south, position[1]);
        east = Math.max(east, position[0]);
        north = Math.max(north, position[1]);
      }
    }
  }

  if (![west, south, east, north].every(Number.isFinite)) return null;

  if (east - west < MIN_COORDINATE_SPAN) {
    const center = (east + west) / 2;
    west = center - MIN_COORDINATE_SPAN / 2;
    east = center + MIN_COORDINATE_SPAN / 2;
  }
  if (north - south < MIN_COORDINATE_SPAN) {
    const center = (north + south) / 2;
    south = center - MIN_COORDINATE_SPAN / 2;
    north = center + MIN_COORDINATE_SPAN / 2;
  }

  return [
    [west, south],
    [east, north],
  ];
}
