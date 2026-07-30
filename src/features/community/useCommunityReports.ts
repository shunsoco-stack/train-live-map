"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiErrorMessage,
  fetchCommunityReports,
  submitCommunityReport,
} from "@/lib/apiClient";
import {
  safeGetBrowserStorage,
} from "@/lib/browserGuidance";
import {
  COMMUNITY_REPORT_SUCCESS_DURATION_MS,
  resolveReporterIdentity,
} from "@/lib/communityReportUi";
import { PagePollingController } from "@/lib/pagePolling";
import { InFlightRequestGate } from "@/lib/requestGate";
import type {
  CommunityReportSummary,
  CommunityReportVote,
} from "@/types/community";

const REFRESH_MS = 20_000;

interface CommunityReportState {
  summaries: CommunityReportSummary[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
  success: string | null;
  successLineId: string | null;
  persistent: boolean;
  votingEnabled: boolean;
  windowMinutes: number;
  cooldownSeconds: number;
  reporterIdentityReady: boolean;
  reporterId: string | null;
  lastVotedAtByLine: Record<string, number>;
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
    successLineId: null,
    persistent: false,
    votingEnabled: false,
    windowMinutes: 30,
    cooldownSeconds: 60,
    reporterIdentityReady: false,
    reporterId: null,
    lastVotedAtByLine: {},
  });

  useEffect(() => {
    const identity = resolveReporterIdentity(
      safeGetBrowserStorage("localStorage"),
      () => crypto.randomUUID().replaceAll("-", ""),
    );
    setState((previous) => ({
      ...previous,
      reporterIdentityReady: true,
      reporterId: identity.reporterId,
    }));
  }, []);

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

  useEffect(() => {
    if (!state.success) return;
    const timer = window.setTimeout(() => {
      setState((previous) =>
        previous.success
          ? {
              ...previous,
              success: null,
              successLineId: null,
            }
          : previous,
      );
    }, COMMUNITY_REPORT_SUCCESS_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [state.success]);

  const clearSuccess = useCallback(() => {
    setState((previous) =>
      previous.success
        ? {
            ...previous,
            success: null,
            successLineId: null,
          }
        : previous,
    );
  }, []);

  const submit = useCallback(async (vote: CommunityReportVote) => {
    if (!state.reporterId) return false;
    setState((previous) => ({
      ...previous,
      submitting: true,
      error: null,
      success: null,
      successLineId: null,
    }));
    try {
      const data = await submitCommunityReport(
        vote,
        state.reporterId,
      );
      const votedAt = Date.now();
      setState((previous) => ({
        ...previous,
        ...data,
        submitting: false,
        success: "投票しました。ご協力ありがとうございます！",
        successLineId: vote.lineId,
        lastVotedAtByLine: {
          ...previous.lastVotedAtByLine,
          [vote.lineId]: votedAt,
        },
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
  }, [state.reporterId]);

  return {
    ...state,
    reporterIdentityAvailable: state.reporterId !== null,
    submit,
    clearSuccess,
    refresh: load,
  };
}
