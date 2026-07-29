"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchCommunityReports,
  submitCommunityReport,
} from "@/lib/apiClient";
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
  try {
    const stored = window.localStorage.getItem(REPORTER_STORAGE_KEY);
    if (stored && /^[A-Za-z0-9_-]{12,100}$/.test(stored)) {
      return stored;
    }
    const created = crypto.randomUUID().replaceAll("-", "");
    window.localStorage.setItem(REPORTER_STORAGE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID().replaceAll("-", "");
  }
}

export function useCommunityReports() {
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
        error:
          error instanceof Error
            ? error.message
            : "みんなの運行情報を取得できませんでした。",
      }));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => {
      void load(controller.signal);
    }, REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
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
        error:
          error instanceof Error
            ? error.message
            : "投票を保存できませんでした。",
      }));
      return false;
    }
  }, []);

  return { ...state, submit, refresh: load };
}
