"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { AdSenseBanner } from "@/components/AdSenseBanner";
import { AppHeader } from "@/components/AppHeader";
import { BrowserGuidance } from "@/components/BrowserGuidance";
import { DataSourceNotice } from "@/components/DataSourceNotice";
import { ErrorNotice } from "@/components/ErrorNotice";
import { CommunityReportSheet } from "@/features/community/CommunityReportSheet";
import { MapPanel } from "@/features/map/MapPanel";
import { RailwayFilterSheet } from "@/features/railways/RailwayFilterSheet";
import {
  resolveRailwaySelection,
  SELECTION_DEFAULT_VERSION_KEY,
  SELECTION_DEFAULT_VERSION,
  VISIBLE_LINES_STORAGE_KEY,
} from "@/features/railways/railwaySelection";
import { useRailwayNetwork } from "@/features/railways/useRailwayNetwork";
import { ServiceStatusBar } from "@/features/service-status/ServiceStatusBar";
import { TrainDetailPanel } from "@/features/trains/TrainDetailPanel";
import { TrainFilterBar } from "@/features/trains/TrainFilterBar";
import { useTrainData } from "@/features/trains/useTrainData";
import {
  safeGetBrowserStorage,
  safeReadStorage,
  safeWriteStorage,
} from "@/lib/browserGuidance";
import { useNow } from "@/lib/useNow";
import { applyServerClockOffset } from "@/lib/time";
import { serviceStatusesForVisibleLines } from "@/lib/serviceStatus";
import {
  matchesFilter,
  TRAIN_FILTERS,
  type TrainFilterKey,
} from "@/lib/trainStatus";

/**
 * アプリ全体を束ねるクライアントコンポーネント。
 * データ取得・状態管理・レイアウトを担う。
 */
export function TrainDashboard() {
  const [visibleLineIds, setVisibleLineIds] = useState<Set<string>>(
    () => new Set(["tokaido"]),
  );
  const railwaySelectionReady = useRef(false);
  const {
    trains,
    serviceStatuses,
    source,
    fallback,
    notice,
    loading,
    error,
    lastUpdatedAt,
    dataUpdatedAt,
    serverClockOffsetMs,
    refresh,
  } = useTrainData(visibleLineIds);
  const {
    lines: railwayLines,
    options: railwayOptions,
    loading: railwayLoading,
    source: railwaySource,
  } = useRailwayNetwork();
  const clientNow = useNow(1000);
  const now = useMemo(
    () => applyServerClockOffset(clientNow, serverClockOffsetMs),
    [clientNow, serverClockOffsetMs],
  );

  const [filter, setFilter] = useState<TrainFilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (railwayLoading || railwaySelectionReady.current) return;
    const storage = safeGetBrowserStorage("localStorage");
    const storedValue = safeReadStorage(storage, VISIBLE_LINES_STORAGE_KEY);
    const savedDefaultVersion = safeReadStorage(
      storage,
      SELECTION_DEFAULT_VERSION_KEY,
    );

    const decision = resolveRailwaySelection(
      storedValue,
      railwayOptions,
      railwaySource,
      savedDefaultVersion,
    );
    if (!decision.shouldFinalize || decision.visibleIds === null) return;

    setVisibleLineIds(decision.visibleIds);
    railwaySelectionReady.current = true;
    if (decision.shouldPersistSelection) {
      safeWriteStorage(
        storage,
        VISIBLE_LINES_STORAGE_KEY,
        JSON.stringify([...decision.visibleIds]),
      );
    }
    if (decision.shouldPersistVersion) {
      safeWriteStorage(
        storage,
        SELECTION_DEFAULT_VERSION_KEY,
        SELECTION_DEFAULT_VERSION,
      );
    }
  }, [railwayLoading, railwayOptions, railwaySource]);

  const handleVisibleLineIdsChange = useCallback((next: Set<string>) => {
    setVisibleLineIds(next);
    if (!railwaySelectionReady.current) return;
    safeWriteStorage(
      safeGetBrowserStorage("localStorage"),
      VISIBLE_LINES_STORAGE_KEY,
      JSON.stringify([...next]),
    );
  }, []);

  const trainsOnVisibleLines = useMemo(
    () => trains.filter((train) => visibleLineIds.has(train.lineId)),
    [trains, visibleLineIds],
  );

  const counts = useMemo(() => {
    const result = {} as Record<TrainFilterKey, number>;
    for (const f of TRAIN_FILTERS) {
      result[f.key] = trainsOnVisibleLines.filter((t) =>
        matchesFilter(t, f.key, now),
      ).length;
    }
    return result;
  }, [trainsOnVisibleLines, now]);

  const filteredTrains = useMemo(
    () => trainsOnVisibleLines.filter((t) => matchesFilter(t, filter, now)),
    [trainsOnVisibleLines, filter, now],
  );

  const visibleServiceStatuses = useMemo(
    () =>
      serviceStatusesForVisibleLines(
        serviceStatuses,
        visibleLineIds,
      ),
    [serviceStatuses, visibleLineIds],
  );

  const selectedTrain = useMemo(
    () => trains.find((t) => t.id === selectedId) ?? null,
    [trains, selectedId],
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-rail-bg">
      <AppHeader
        lastUpdatedAt={lastUpdatedAt}
        dataUpdatedAt={dataUpdatedAt}
        source={source}
      />

      <main className="relative flex-1">
        {/* 地図(画面の中心) */}
        <MapPanel
          trains={filteredTrains}
          railwayLines={railwayLines}
          visibleLineIds={visibleLineIds}
          selectedId={selectedId}
          onSelect={setSelectedId}
          now={now}
        />

        <RailwayFilterSheet
          options={railwayOptions}
          visibleIds={visibleLineIds}
          onChange={handleVisibleLineIdsChange}
          loading={railwayLoading}
        />

        <CommunityReportSheet
          options={railwayOptions}
          visibleLineIds={visibleLineIds}
        />

        {/* 上部オーバーレイ: 運行情報・エラー */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
          <div className="flex max-h-36 flex-col gap-2 overflow-y-auto">
            {visibleServiceStatuses.map((status) => (
              <ServiceStatusBar
                key={status.lineId}
                serviceStatus={status}
              />
            ))}
          </div>
          <DataSourceNotice notice={notice} fallback={fallback} />
          {error && <ErrorNotice message={error} onRetry={refresh} />}
        </div>

        {/* 下部オーバーレイ: フィルター */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-3 safe-bottom">
          <TrainFilterBar value={filter} onChange={setFilter} counts={counts} />
        </div>

        <BrowserGuidance
          hideSafariInstallGuidance={loading || selectedTrain !== null}
        />

        {/* 初回ロード表示 */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-rail-bg/80">
            <div className="flex items-center gap-2 text-rail-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span className="text-sm">列車情報を読み込み中…</span>
            </div>
          </div>
        )}

        {!loading && !error && trains.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[9] flex items-center justify-center p-6">
            <section
              className="app-material pointer-events-auto max-w-sm rounded-2xl border border-rail-border p-5 text-center shadow-xl"
              aria-live="polite"
            >
              <h2 className="text-base font-bold text-rail-text">
                現在表示できる列車情報がありません
              </h2>
              <p className="mt-2 text-sm leading-6 text-rail-muted">
                終電後、または一時的に運行中の列車情報がない可能性があります。
              </p>
              <button
                type="button"
                onClick={refresh}
                className="pressable mx-auto mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                再読み込み
              </button>
            </section>
          </div>
        )}
      </main>

      <AdSenseBanner />

      {/* 詳細ボトムシート */}
      <TrainDetailPanel
        train={selectedTrain}
        now={now}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
