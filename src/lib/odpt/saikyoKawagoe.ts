import type { LngLat } from "@/types/geo";
import type { RailwayMapStation } from "@/types/railway";

/** ODPTで大崎〜川越を一体として返す埼京線・川越線系統。 */
export function isSaikyoKawagoeRailway(railwayId: string): boolean {
  return railwayId.endsWith(".SaikyoKawagoe");
}

export function isKawagoeSection(
  [longitude, latitude]: readonly [number, number],
): boolean {
  return longitude < 139.62 && latitude > 35.87;
}

/**
 * 大崎〜川越の線形を大宮付近で分割する。
 * 川越線側には接続点となる大宮側の隣接点を1点だけ含める。
 */
export function splitSaikyoKawagoePaths(
  paths: LngLat[][],
  section: "saikyo" | "kawagoe",
): LngLat[][] {
  return paths
    .map((path) => {
      const selected = path
        .map((position, index) => ({
          index,
          matches:
            section === "kawagoe"
              ? isKawagoeSection(position)
              : !isKawagoeSection(position),
        }))
        .filter((entry) => entry.matches)
        .map((entry) => entry.index);
      if (selected.length === 0) return [];

      let start = Math.min(...selected);
      let end = Math.max(...selected);
      if (section === "kawagoe") {
        if (start > 0 && !isKawagoeSection(path[start - 1])) start -= 1;
        if (
          end < path.length - 1 &&
          !isKawagoeSection(path[end + 1])
        ) {
          end += 1;
        }
      }
      return path.slice(start, end + 1);
    })
    .filter((path) => path.length >= 2);
}

/**
 * 駅一覧も同じ境界で分割する。
 * 川越線側には境界の非川越側駅（大宮）を含め、路線が途切れて見えないようにする。
 */
export function splitSaikyoKawagoeStations(
  stations: RailwayMapStation[],
  section: "saikyo" | "kawagoe",
): RailwayMapStation[] {
  if (section === "saikyo") {
    return stations.filter((station) => !isKawagoeSection(station.position));
  }

  const includedIds = new Set(
    stations
      .filter((station) => isKawagoeSection(station.position))
      .map((station) => station.id),
  );
  for (let index = 1; index < stations.length; index += 1) {
    const previous = stations[index - 1];
    const current = stations[index];
    const previousIsKawagoe = isKawagoeSection(previous.position);
    const currentIsKawagoe = isKawagoeSection(current.position);
    if (previousIsKawagoe === currentIsKawagoe) continue;
    includedIds.add(previousIsKawagoe ? current.id : previous.id);
  }

  return stations.filter((station) => includedIds.has(station.id));
}
