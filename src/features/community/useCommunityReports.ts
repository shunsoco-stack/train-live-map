"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiErrorMessage,
  fetchCommunityReports,
  submitCommunityReport,
} from "@/lib/apiClient";
import {
  safeGetBrowserStorage,
  safeReadStorage,
  safeWriteStorage,
} from "@/lib/browserGuidance";
import { PagePollingController } from "@/lib/pagePolling";
import { InFlightRequestGate } from "@/lib/requestGate";
import type {
  CommunityReportSummary,
  CommunityReportVote,
} from "@/types/community";

const REPORTER_STORAGE_KEY = "train-live-map:community-reporter-v1";
const REFRESH_MS = 20_000;

interface CommunityReportState {
  summaries: CommunityReportSummary[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
  success: string | null;
  persistent: boolean;
  votingEnabled: boolean;
  windowMinutes: number;
  cooldownSeconds: number;
}

function reporterId(): string {
  const storage = safeGetBrowserStorage("localStorage");
  const stored = safeReadStorage(storage, REPORTER_STORAGE_KEY);
  if (stored && /^[A-Za-z0-9_-]{12,100}$/.test(stored)) {
    return stored;
  }
  const created = crypto.randomUUID().replaceAll("-", "");
  safeWriteStorage(storage, REPORTER_STORAGE_KEY, created);
  return created;
}

export function useCommunityReports() {
  const requestGate = useRef(new InFlightRequestGate());
  const pollingControllerRef = useRef<PagePollingController | null>(null);
  const [state, setState] = useState<CommunityReportState>({
    summaries: [],
    loading: true,
    submitting: false,
    error: null,
    success: null,
    persistent: false,
    votingEnabled: false,
    windowMinutes: 30,
    cooldownSeconds: 60,
  });

  const load = useCallback(async (signal?: AbortSignal) => {
    const token = requestGate.current.begin();
    if (!token) return;
    try {
      const data = await fetchCommunityReports(signal);
      setState((previous) => ({
        ...previous,
        ...data,
        loading: false,
        error: null,
      }));
    } catch (error) {
      if (signal?.aborted) return;
      setState((previous) => ({
        ...previous,
        loading: false,
        error: apiErrorMessage(
          error,
          "みんなの運行情報を取得できませんでした。",
        ),
      }));
    } finally {
      requestGate.current.release(token);
    }
  }, []);

  useEffect(() => {
    const gate = requestGate.current;
    const polling = new PagePollingController(
      [
        {
          intervalMs: REFRESH_MS,
          run: (signal) => void load(signal),
        },
      ],
      {
        setInterval: (callback, delayMs) =>
          window.setInterval(callback, delayMs),
        clearInterval: (handle) =>
          window.clearInterval(handle as number),
      },
      () => gate.reset(),
    );
    pollingControllerRef.current = polling;

    const onVisibilityChange = () => {
      polling.handleVisibilityChange(
        document.visibilityState === "visible",
        navigator.onLine,
      );
    };
    const onOnline = () =>
      polling.handleOnline(document.visibilityState === "visible");
    const onOffline = () => polling.handleOffline();

    polling.start(
      document.visibilityState === "visible",
      navigator.onLine,
    );
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      polling.stop();
      if (pollingControllerRef.current === polling) {
        pollingControllerRef.current = null;
      }
    };
  }, [load]);

  const submit = useCallback(async (vote: CommunityReportVote) => {
    setState((previous) => ({
      ...previous,
      submitting: true,
      error: null,
      success: null,
    }));
    try {
      const data = await submitCommunityReport(vote, reporterId());
      setState((previous) => ({
        ...previous,
        ...data,
        submitting: false,
        success: "投票しました。ご協力ありがとうございます！",
      }));
      return true;
    } catch (error) {
      setState((previous) => ({
        ...previous,
        submitting: false,
        error: apiErrorMessage(
          error,
          "投票を保存できませんでした。",
        ),
      }));
      return false;
    }
  }, []);

  return { ...state, submit, refresh: load };
}
