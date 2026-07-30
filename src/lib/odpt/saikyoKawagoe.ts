import type { LngLat } from "../../types/geo.ts";

/** 埼京線〜川越線の直通系統（大崎〜川越側）。 */
export const SAIKYO_KAWAGOE_RAILWAY_ID =
  "odpt.Railway:JR-East.SaikyoKawagoe";
/** 川越線の単独系統（川越〜高麗川側）。 */
export const KAWAGOE_RAILWAY_ID = "odpt.Railway:JR-East.Kawagoe";

export const KAWAGOE_SECTION_MAX_LONGITUDE = 139.62;
export const KAWAGOE_SECTION_MIN_LATITUDE = 35.87;

export type SaikyoKawagoeLineId = "saikyo" | "kawagoe";

export function isKawagoeSection([longitude, latitude]: LngLat): boolean {
  return (
    longitude < KAWAGOE_SECTION_MAX_LONGITUDE &&
    latitude > KAWAGOE_SECTION_MIN_LATITUDE
  );
}

/**
 * ODPT路線IDと現在位置から、埼京線・川越線の表示所属を決める。
 * 単独の川越線は位置によらず川越線、直通系統だけを現在区間で分ける。
 */
export function classifySaikyoKawagoeTrain(
  railwayId: string,
  positions: readonly LngLat[],
): SaikyoKawagoeLineId | null {
  if (railwayId === KAWAGOE_RAILWAY_ID) return "kawagoe";
  if (railwayId !== SAIKYO_KAWAGOE_RAILWAY_ID) return null;
  return positions.some(isKawagoeSection) ? "kawagoe" : "saikyo";
}

function copyPath(path: readonly LngLat[]): LngLat[] {
  return path.map(([longitude, latitude]) => [longitude, latitude]);
}

/**
 * 大崎〜川越の結合線形を、大宮付近の境界で埼京線側と川越線側へ分ける。
 * 境界が1か所に定まらない線形は誤描画を避けるため採用しない。
 */
function splitCombinedPath(
  path: readonly LngLat[],
): { saikyo: LngLat[]; kawagoe: LngLat[] } | null {
  if (path.length < 3) return null;

  const sections = path.map(isKawagoeSection);
  const transitions: number[] = [];
  for (let index = 1; index < sections.length; index += 1) {
    if (sections[index] !== sections[index - 1]) transitions.push(index);
  }
  if (transitions.length !== 1) return null;

  const boundary = transitions[0];
  const before = Math.max(0, boundary - 1);
  if (sections[0]) {
    return {
      kawagoe: copyPath(path.slice(0, boundary + 1)),
      saikyo: copyPath(path.slice(before)),
    };
  }
  return {
    saikyo: copyPath(path.slice(0, boundary + 1)),
    kawagoe: copyPath(path.slice(before)),
  };
}

export function splitSaikyoKawagoePaths(paths: readonly LngLat[][]): {
  saikyo: LngLat[][];
  kawagoe: LngLat[][];
} {
  const result: { saikyo: LngLat[][]; kawagoe: LngLat[][] } = {
    saikyo: [],
    kawagoe: [],
  };
  for (const path of paths) {
    const split = splitCombinedPath(path);
    if (!split) continue;
    result.saikyo.push(split.saikyo);
    result.kawagoe.push(split.kawagoe);
  }
  return result;
}
