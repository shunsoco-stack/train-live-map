import type { LngLat } from "@/types/geo";

export type RailwayCoverage = "realtime" | "limited" | "unavailable" | "unknown";

export interface RailwayCatalogLine {
  id: string;
  name: string;
  category: string;
  color: string;
  aliases: string[];
  coverage: RailwayCoverage;
  coverageNote: string | null;
  kind: "line" | "service";
}

export interface RailwayMapLine {
  id: string;
  odptId: string;
  name: string;
  color: string;
  coordinates: LngLat[][];
}

export interface RailwayFilterOption extends RailwayCatalogLine {
  available: boolean;
}

export interface RailwaysApiResponse {
  lines: RailwayMapLine[];
  options: RailwayFilterOption[];
  generatedAt: string;
  source: "odpt" | "fallback";
}

