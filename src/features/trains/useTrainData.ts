"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchServiceStatus, fetchTrains } from "@/lib/apiClient";
import type { ProviderSource, ServiceStatus, TrainLocation } from "@/types/train";

/** データ再取得間隔(ミリ秒)。5〜10秒の範囲。 */
export const REFRESH_MS = 7000;

interface TrainDataState {
  trains: TrainLocation[];
  serviceStatus: ServiceStatus | null;
  isMock: boolean;
  /** 実際に使われたデータ取得元 */
  source: ProviderSource;
  /** 実データ失敗によるモックフォールバックか */
  fallback: boolean;
  /** モック表示中などの注意書き */
  notice: string | null;
  /** 初回ロード中か */
  loading: boolean;
  /** 直近の取得でエラーが発生したか */
  error: string | null;
  /** 最終データ更新時刻(クライアントで取得成功した時刻) */
  lastUpdatedAt: Date | null;
}

interface UseTrainDataResult extends TrainDataState {
  /** 手動再取得 */
  refresh: () => void;
}

/**
 * 列車データと運行情報を定期取得するフック。
 * - 列車位置: REFRESH_MS ごとにポーリング
 * - 運行情報: 初回 + 30 秒ごと
 * - 失敗しても直前のデータを保持し、画面が真っ白にならないようにする
 */
export function useTrainData(): UseTrainDataResult {
  const [state, setState] = useState<TrainDataState>({
    trains: [],
    serviceStatus: null,
    isMock: true,
    source: "mock",
    fallback: false,
    notice: null,
    loading: true,
    error: null,
    lastUpdatedAt: null,
  });

  const loadTrains = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchTrains(signal);
      setState((prev) => ({
        ...prev,
        trains: data.trains,
        isMock: data.isMock,
        source: data.source,
        fallback: data.fallback,
        notice: data.notice,
        loading: false,
        error: null,
        lastUpdatedAt: new Date(),
      }));
    } catch (err) {
      if (signal?.aborted) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          err instanceof Error
            ? err.message
            : "列車情報の取得に失敗しました",
      }));
    }
  }, []);

  const loadServiceStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchServiceStatus(signal);
      setState((prev) => ({
        ...prev,
        serviceStatus: data.serviceStatus,
      }));
    } catch {
      // 運行情報の失敗は致命的でないため、静かに無視(既存表示を維持)
    }
  }, []);

  const refresh = useCallback(() => {
    void loadTrains();
    void loadServiceStatus();
  }, [loadTrains, loadServiceStatus]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    // 初回取得
    void loadTrains(signal);
    void loadServiceStatus(signal);

    // 列車位置のポーリング
    const trainTimer = setInterval(() => {
      void loadTrains(signal);
    }, REFRESH_MS);

    // 運行情報のポーリング(30秒ごと)
    const statusTimer = setInterval(() => {
      void loadServiceStatus(signal);
    }, 30000);

    return () => {
      controller.abort();
      clearInterval(trainTimer);
      clearInterval(statusTimer);
    };
  }, [loadTrains, loadServiceStatus]);

  return { ...state, refresh };
}
