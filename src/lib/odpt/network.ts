import { ROUTE_COORDINATES_RAW } from "@/data/routeLine";
import {
  findRailwayCatalogLine,
  getRailwayCatalogLine,
  railwayFilterOptions,
} from "@/data/railwayCatalog";
import { fetchOdptRailways, fetchOdptStations } from "@/lib/odpt/api";
import {
  getOdptConfig,
  isOdptConfigured,
  type OdptConfig,
} from "@/lib/odpt/config";
import type { OdptRailway, OdptStation } from "@/lib/odpt/types";
import type { LngLat } from "@/types/geo";
import type {
  RailwaysApiResponse,
  RailwayMapLine,
} from "@/types/railway";

const CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_POINTS_PER_PATH = 240;

export interface OdptStationLookup {
  id: string;
  name: string;
  railwayId: string;
  position: LngLat;
}

export interface OdptNetworkContext {
  response: RailwaysApiResponse;
  stationByOdptId: Map<string, OdptStationLookup>;
  catalogIdByOdptRailwayId: Map<string, string>;
  lineByCatalogId: Map<string, RailwayMapLine>;
}

interface NetworkCache {
  expiresAt: number;
  value: Promise<OdptNetworkContext>;
}

let networkCache: NetworkCache | null = null;

function pickLocalized(
  value: string | { ja?: string; en?: string } | undefined,
  fallback = "",
): string {
  if (typeof value === "string") return value;
  return value?.ja ?? value?.en ?? fallback;
}

function isLngLat(value: unknown): value is LngLat {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

function simplifyPath(path: LngLat[]): LngLat[] {
  if (path.length <= MAX_POINTS_PER_PATH) return path;
  const step = (path.length - 1) / (MAX_POINTS_PER_PATH - 1);
  return Array.from({ length: MAX_POINTS_PER_PATH }, (_, index) => {
    return path[Math.round(index * step)];
  });
}

function regionPaths(railway: OdptRailway): LngLat[][] {
  const geometry = railway["ug:region"]?.geometry;
  const coordinates = geometry?.coordinates;

  if (geometry?.type === "LineString" && Array.isArray(coordinates)) {
    const path = coordinates.filter(isLngLat);
    return path.length >= 2 ? [simplifyPath(path)] : [];
  }

  if (geometry?.type === "MultiLineString" && Array.isArray(coordinates)) {
    return coordinates
      .filter(Array.isArray)
      .map((path) => path.filter(isLngLat))
      .filter((path) => path.length >= 2)
      .map(simplifyPath);
  }

  return [];
}

function odptId(value: { "@id"?: string; "owl:sameAs"?: string }): string {
  return value["owl:sameAs"] ?? value["@id"] ?? "";
}

function stationLookup(station: OdptStation): OdptStationLookup | null {
  const id = odptId(station);
  const latitude = station["geo:lat"];
  const longitude = station["geo:long"];
  if (
    !id ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    id,
    name: pickLocalized(
      station["odpt:stationTitle"],
      station["dc:title"] ?? id.split(".").pop() ?? "",
    ),
    railwayId: station["odpt:railway"] ?? "",
    position: [longitude, latitude],
  };
}

function fallbackPathFromStations(
  railway: OdptRailway,
  stationByOdptId: ReadonlyMap<string, OdptStationLookup>,
): LngLat[][] {
  const path = [...(railway["odpt:stationOrder"] ?? [])]
    .sort((a, b) => (a["odpt:index"] ?? 0) - (b["odpt:index"] ?? 0))
    .map((station) => station["odpt:station"])
    .filter((id): id is string => Boolean(id))
    .map((id) => stationByOdptId.get(id)?.position)
    .filter((position): position is LngLat => Boolean(position));
  return path.length >= 2 ? [simplifyPath(path)] : [];
}

function isKawagoeSection([longitude, latitude]: LngLat): boolean {
  return longitude < 139.62 && latitude > 35.87;
}

function clipKawagoePaths(
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
      const start = Math.max(0, Math.min(...selected) - 1);
      const end = Math.min(path.length - 1, Math.max(...selected) + 1);
      return path.slice(start, end + 1);
    })
    .filter((path) => path.length >= 2);
}

function fallbackContext(): OdptNetworkContext {
  const catalog = getRailwayCatalogLine("tokaido");
  if (!catalog) throw new Error("東海道線の定義が見つかりません");

  const line: RailwayMapLine = {
    id: catalog.id,
    odptId: "odpt.Railway:JR-East.Tokaido",
    name: catalog.name,
    color: catalog.color,
    coordinates: [ROUTE_COORDINATES_RAW],
  };
  const availableIds = new Set([line.id]);

  return {
    response: {
      lines: [line],
      options: railwayFilterOptions(availableIds),
      generatedAt: new Date().toISOString(),
      source: "fallback",
    },
    stationByOdptId: new Map(),
    catalogIdByOdptRailwayId: new Map([[line.odptId, line.id]]),
    lineByCatalogId: new Map([[line.id, line]]),
  };
}

async function loadNetwork(config: OdptConfig): Promise<OdptNetworkContext> {
  const [railwayResult, stationResult] = await Promise.all([
    fetchOdptRailways(config.operator, config),
    fetchOdptStations(config.operator, config),
  ]);

  const stationByOdptId = new Map<string, OdptStationLookup>();
  for (const station of stationResult.data) {
    const lookup = stationLookup(station);
    if (lookup) stationByOdptId.set(lookup.id, lookup);
  }

  const catalogIdByOdptRailwayId = new Map<string, string>();
  const lineByCatalogId = new Map<string, RailwayMapLine>();
  const availableIds = new Set<string>();

  for (const railway of railwayResult.data) {
    const railwayId = odptId(railway);
    if (!railwayId) continue;
    const title = pickLocalized(
      railway["odpt:railwayTitle"],
      railway["dc:title"] ?? railwayId.split(".").pop() ?? "",
    );
    const matchedCatalog = findRailwayCatalogLine(railwayId, title);
    if (!matchedCatalog) continue;

    const paths = regionPaths(railway);
    const coordinates =
      paths.length > 0
        ? paths
        : fallbackPathFromStations(railway, stationByOdptId);
    const isCombinedSaikyoKawagoe = railwayId.endsWith(".Kawagoe");
    const catalogs = isCombinedSaikyoKawagoe
      ? ["saikyo", "kawagoe"]
          .map((id) => getRailwayCatalogLine(id))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [matchedCatalog];

    catalogIdByOdptRailwayId.set(
      railwayId,
      isCombinedSaikyoKawagoe ? "saikyo" : matchedCatalog.id,
    );

    for (const catalog of catalogs) {
      availableIds.add(catalog.id);
      const lineCoordinates = isCombinedSaikyoKawagoe
        ? clipKawagoePaths(
            coordinates,
            catalog.id === "kawagoe" ? "kawagoe" : "saikyo",
          )
        : coordinates;
      if (lineCoordinates.length === 0) continue;

      const existing = lineByCatalogId.get(catalog.id);
      if (existing) {
        existing.coordinates.push(...lineCoordinates);
        continue;
      }

      lineByCatalogId.set(catalog.id, {
        id: catalog.id,
        odptId: railwayId,
        name: catalog.name,
        color: railway["odpt:color"] || catalog.color,
        coordinates: lineCoordinates,
      });
    }
  }

  // APIで取得できない環境でも、東海道線だけは既存の線形で表示可能にする。
  const tokaido = fallbackContext().response.lines[0];
  if (!lineByCatalogId.has("tokaido")) {
    lineByCatalogId.set("tokaido", tokaido);
  }
  availableIds.add("tokaido");
  catalogIdByOdptRailwayId.set(tokaido.odptId, tokaido.id);

  const lines = [...lineByCatalogId.values()];
  return {
    response: {
      lines,
      options: railwayFilterOptions(availableIds),
      generatedAt: new Date().toISOString(),
      source: "odpt",
    },
    stationByOdptId,
    catalogIdByOdptRailwayId,
    lineByCatalogId,
  };
}

export async function getOdptNetworkContext(
  config: OdptConfig = getOdptConfig(),
): Promise<OdptNetworkContext> {
  if (!isOdptConfigured(config)) return fallbackContext();

  const now = Date.now();
  if (networkCache && networkCache.expiresAt > now) {
    return networkCache.value;
  }

  const value = loadNetwork(config).catch((error) => {
    networkCache = null;
    throw error;
  });
  networkCache = { expiresAt: now + CACHE_MS, value };
  return value;
}

export function getFallbackRailwayNetwork(): RailwaysApiResponse {
  return fallbackContext().response;
}
