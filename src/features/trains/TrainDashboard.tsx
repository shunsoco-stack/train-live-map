"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { DataSourceNotice } from "@/components/DataSourceNotice";
import { ErrorNotice } from "@/components/ErrorNotice";
import { MapPanel } from "@/features/map/MapPanel";
import { ServiceStatusBar } from "@/features/service-status/ServiceStatusBar";
import { TrainDetailPanel } from "@/features/trains/TrainDetailPanel";
import { TrainFilterBar } from "@/features/trains/TrainFilterBar";
import { useTrainData } from "@/features/trains/useTrainData";
import { useNow } from "@/lib/useNow";
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
  const {
    trains,
    serviceStatus,
    source,
    fallback,
    notice,
    loading,
    error,
    lastUpdatedAt,
    dataUpdatedAt,
    refresh,
  } = useTrainData();
  const now = useNow(1000);

  const [filter, setFilter] = useState<TrainFilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result = {} as Record<TrainFilterKey, number>;
    for (const f of TRAIN_FILTERS) {
      result[f.key] = trains.filter((t) => matchesFilter(t, f.key, now)).length;
    }
    return result;
  }, [trains, now]);

  const filteredTrains = useMemo(
    () => trains.filter((t) => matchesFilter(t, filter, now)),
    [trains, filter, now],
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
          selectedId={selectedId}
          onSelect={setSelectedId}
          now={now}
        />

        {/* 上部オーバーレイ: 運行情報・エラー */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
          <ServiceStatusBar serviceStatus={serviceStatus} />
          <DataSourceNotice notice={notice} fallback={fallback} />
          {error && <ErrorNotice message={error} onRetry={refresh} />}
        </div>

        {/* 下部オーバーレイ: フィルター */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-3 safe-bottom">
          <TrainFilterBar value={filter} onChange={setFilter} counts={counts} />
        </div>

        {/* 初回ロード表示 */}
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-rail-bg/80">
            <div className="flex items-center gap-2 text-rail-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span className="text-sm">列車情報を読み込み中…</span>
            </div>
          </div>
        )}
      </main>

      {/* 詳細ボトムシート */}
      <TrainDetailPanel train={selectedTrain} onClose={() => setSelectedId(null)} />
    </div>
  );
}
