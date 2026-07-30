"use client";

import { useEffect, useRef, useState } from "react";
import { RAILWAY_CATALOG, railwayFilterOptions } from "@/data/railwayCatalog";
import { ROUTE_COORDINATES_RAW } from "@/data/routeLine";
import {
  FALLBACK_RETRY_DELAY_MS,
  shouldRetryFallbackRailwayNetwork,
} from "@/features/railways/railwaySelection";
import { fetchRailways } from "@/lib/apiClient";
import type {
  RailwayFilterOption,
  RailwayMapLine,
  RailwaysApiResponse,
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
  source: RailwaysApiResponse["source"];
}

export function useRailwayNetwork(): RailwayNetworkState {
  const [reloadKey, setReloadKey] = useState(0);
  const retryCount = useRef(0);
  const [state, setState] = useState<RailwayNetworkState>({
    lines: [fallbackLine],
    options: railwayFilterOptions(new Set(["tokaido"])),
    loading: true,
    source: "fallback",
  });

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true }));
    void fetchRailways(controller.signal)
      .then((response) => {
        setState({
          lines: response.lines,
          options: response.options,
          loading: false,
          source: response.source,
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          loading: false,
          source: "fallback",
        }));
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (
      state.loading ||
      !shouldRetryFallbackRailwayNetwork(state.source, retryCount.current)
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      retryCount.current += 1;
      setReloadKey((current) => current + 1);
    }, FALLBACK_RETRY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state.loading, state.source]);

  return state;
}

export const ALL_RAILWAY_IDS = RAILWAY_CATALOG.map((line) => line.id);

