"use client";

import { useCallback, useEffect, useState } from "react";
import { RAILWAY_CATALOG, railwayFilterOptions } from "@/data/railwayCatalog";
import { ROUTE_COORDINATES_RAW } from "@/data/routeLine";
import { fetchRailways } from "@/lib/apiClient";
import type {
  RailwayFilterOption,
  RailwayMapLine,
} from "@/types/railway";

const fallbackLine: RailwayMapLine = {
  id: "tokaido",
  odptId: "odpt.Railway:JR-East.Tokaido",
  name: "東海道線",
  color: "#f68b1e",
  coordinates: [ROUTE_COORDINATES_RAW],
};

interface RailwayNetworkState {
  lines: RailwayMapLine[];
  options: RailwayFilterOption[];
  loading: boolean;
}

export function useRailwayNetwork(): RailwayNetworkState {
  const [state, setState] = useState<RailwayNetworkState>({
    lines: [fallbackLine],
    options: railwayFilterOptions(new Set(["tokaido"])),
    loading: true,
  });

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetchRailways(signal);
      setState({
        lines: response.lines,
        options: response.options,
        loading: false,
      });
    } catch {
      if (signal?.aborted) return;
      setState((previous) => ({ ...previous, loading: false }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return state;
}

export const ALL_RAILWAY_IDS = RAILWAY_CATALOG.map((line) => line.id);

