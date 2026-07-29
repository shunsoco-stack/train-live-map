"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  OctagonX,
  Send,
  UsersRound,
  X,
} from "lucide-react";
import { useCommunityReports } from "@/features/community/useCommunityReports";
import type { RailwayFilterOption } from "@/types/railway";
import type {
  CommunityReportStatus,
  CommunityReportSummary,
} from "@/types/community";

const DELAY_OPTIONS = [1, 3, 5, 10, 15, 20, 30, 45, 60];

interface CommunityReportSheetProps {
  options: RailwayFilterOption[];
  visibleLineIds: ReadonlySet<string>;
}

function summaryLabel(summary: CommunityReportSummary): string {
  if (summary.status === "suspended") {
    return "運転見合わせの報告";
  }
  if (summary.status === "delayed") {
    return `約${summary.delayMinutes ?? "?"}分遅れ`;
  }
  return "平常の報告";
}

function summaryTone(summary: CommunityReportSummary): string {
  if (summary.status === "suspended") {
    return "border-red-400/60 bg-red-400/10 text-red-200";
  }
  if (summary.status === "delayed") {
    return "border-amber-400/60 bg-amber-400/10 text-amber-100";
  }
  return "border-emerald-400/50 bg-emerald-400/10 text-emerald-200";
}

export function CommunityReportSheet({
  options,
  visibleLineIds,
}: CommunityReportSheetProps) {
  const [open, setOpen] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [status, setStatus] =
    useState<CommunityReportStatus>("on-time");
  const [delayMinutes, setDelayMinutes] = useState(5);
  const {
    summaries,
    loading,
    submitting,
    error,
    success,
    persistent,
    votingEnabled,
    windowMinutes,
    cooldownSeconds,
    submit,
  } = useCommunityReports();

  const visibleOptions = useMemo(
    () =>
      options.filter(
        (option) =>
          option.available && visibleLineIds.has(option.id),
      ),
    [options, visibleLineIds],
  );

  useEffect(() => {
    if (
      selectedLineId &&
      visibleOptions.some((option) => option.id === selectedLineId)
    ) {
      return;
    }
    setSelectedLineId(visibleOptions[0]?.id ?? "");
  }, [selectedLineId, visibleOptions]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const summary = summaries.find(
    (item) => item.lineId === selectedLineId,
  );
  const visibleVoteCount = summaries
    .filter((item) => visibleLineIds.has(item.lineId))
    .reduce((total, item) => total + item.voteCount, 0);
  const selectedLine = visibleOptions.find(
    (option) => option.id === selectedLineId,
  );

  const submitVote = async () => {
    if (!selectedLineId || !votingEnabled) return;
    await submit({
      lineId: selectedLineId,
      status,
      delayMinutes: status === "delayed" ? delayMinutes : null,
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="app-material pressable pointer-events-auto absolute bottom-[4.75rem] left-3 z-20 flex min-h-12 items-center gap-2 rounded-full border border-sky-300/65 px-3.5 text-sm font-bold text-rail-text hover:border-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        aria-label={`みんなの運行情報を開く。表示路線に${visibleVoteCount}件の投稿`}
      >
        <UsersRound className="h-4 w-4 text-sky-300" aria-hidden />
        <span>みんな</span>
        {visibleVoteCount > 0 && (
          <span className="min-w-6 rounded-full bg-sky-300 px-1.5 py-0.5 text-center text-xs tabular-nums text-slate-950">
            {visibleVoteCount > 99 ? "99+" : visibleVoteCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-report-title"
          >
            <button
              type="button"
              aria-label="みんなの運行情報を閉じる"
              onClick={() => setOpen(false)}
              className="animate-scrim-enter absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            />

            <section className="app-sheet animate-sheet-enter safe-bottom relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl border">
              <div className="flex justify-center pt-2.5">
                <span
                  className="h-1.5 w-10 rounded-full bg-orange-100/25"
                  aria-hidden
                />
              </div>

              <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-2">
                <div>
                  <p className="text-xs font-semibold text-sky-300">
                    直近{windowMinutes}分の利用者投稿
                  </p>
                  <h2
                    id="community-report-title"
                    className="mt-0.5 text-lg font-bold tracking-[-0.015em] text-rail-text"
                  >
                    みんなの運行情報
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="閉じる"
                  className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-rail-muted hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div className="overflow-y-auto border-t border-rail-border px-4 pb-6 pt-4">
                <div className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden
                  />
                  <p>
                    利用者による参考情報で、公式の運行情報ではありません。
                    安全に関わる判断は鉄道会社の案内を確認してください。
                  </p>
                </div>

                {visibleOptions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-rail-muted">
                    先に「路線」から表示する路線を選んでください。
                  </p>
                ) : (
                  <>
                    <label className="mt-4 block text-xs font-bold text-rail-muted">
                      投票する路線
                      <select
                        value={selectedLineId}
                        onChange={(event) =>
                          setSelectedLineId(event.target.value)
                        }
                        className="mt-1.5 h-11 w-full rounded-xl border border-rail-border bg-rail-bg px-3 text-sm font-semibold text-rail-text outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-300/25"
                      >
                        {visibleOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div
                      className={`mt-3 rounded-2xl border p-3 ${
                        summary
                          ? summaryTone(summary)
                          : "border-rail-border bg-black/15 text-rail-muted"
                      }`}
                      aria-live="polite"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                selectedLine?.color ?? "#94a3b8",
                            }}
                            aria-hidden
                          />
                          <p className="truncate text-sm font-bold">
                            {selectedLine?.name}
                          </p>
                        </div>
                        {summary && (
                          <span className="shrink-0 text-xs font-semibold tabular-nums">
                            {summary.voteCount}票
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-base font-bold">
                        {loading
                          ? "集計を確認中…"
                          : summary
                            ? summaryLabel(summary)
                            : "まだ投稿はありません"}
                      </p>
                      {summary && (
                        <p className="mt-1 text-[11px] opacity-80">
                          平常 {summary.counts.onTime}・遅延{" "}
                          {summary.counts.delayed}・見合わせ{" "}
                          {summary.counts.suspended}
                        </p>
                      )}
                    </div>

                    {!votingEnabled && (
                      <div className="mt-3 rounded-xl border border-orange-400/40 bg-orange-400/10 p-3 text-xs leading-5 text-orange-100">
                        共有投票の保存先を準備中です。閲覧はできますが、
                        現在は新しい投票を受け付けていません。
                      </div>
                    )}

                    <fieldset
                      className="mt-4"
                      disabled={!votingEnabled || submitting}
                    >
                      <legend className="text-xs font-bold text-rail-muted">
                        今の状況
                      </legend>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {[
                          {
                            value: "on-time" as const,
                            label: "平常",
                            icon: CheckCircle2,
                            active:
                              "border-emerald-300 bg-emerald-300/15 text-emerald-200",
                          },
                          {
                            value: "delayed" as const,
                            label: "遅延",
                            icon: Clock3,
                            active:
                              "border-amber-300 bg-amber-300/15 text-amber-100",
                          },
                          {
                            value: "suspended" as const,
                            label: "見合わせ",
                            icon: OctagonX,
                            active:
                              "border-red-300 bg-red-300/15 text-red-200",
                          },
                        ].map((item) => {
                          const Icon = item.icon;
                          const selected = status === item.value;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setStatus(item.value)}
                              className={`pressable flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                                selected
                                  ? item.active
                                  : "border-rail-border bg-black/15 text-rail-muted"
                              }`}
                            >
                              <Icon className="h-5 w-5" aria-hidden />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    {status === "delayed" && (
                      <fieldset
                        className="mt-4"
                        disabled={!votingEnabled || submitting}
                      >
                        <legend className="text-xs font-bold text-rail-muted">
                          何分くらい遅れていますか？
                        </legend>
                        <div className="mt-2 grid grid-cols-5 gap-2">
                          {DELAY_OPTIONS.map((minutes) => (
                            <button
                              key={minutes}
                              type="button"
                              aria-pressed={delayMinutes === minutes}
                              onClick={() => setDelayMinutes(minutes)}
                              className={`pressable min-h-11 rounded-xl border px-1 text-xs font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                                delayMinutes === minutes
                                  ? "border-amber-300 bg-amber-300/15 text-amber-100"
                                  : "border-rail-border bg-black/15 text-rail-muted"
                              }`}
                            >
                              {minutes}分
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    )}

                    {error && (
                      <p
                        role="alert"
                        className="mt-3 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-xs text-red-200"
                      >
                        {error}
                      </p>
                    )}
                    {success && (
                      <p
                        role="status"
                        className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-xs text-emerald-200"
                      >
                        {success}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={
                        !selectedLineId ||
                        !votingEnabled ||
                        submitting
                      }
                      onClick={() => void submitVote()}
                      className="pressable mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-300 px-4 text-sm font-bold text-slate-950 shadow-lg shadow-sky-950/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {submitting ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <Send className="h-4 w-4" aria-hidden />
                      )}
                      {submitting ? "投票中…" : "この内容で投票"}
                    </button>

                    <p className="mt-2 text-center text-[11px] leading-4 text-rail-muted">
                      同じ路線は{cooldownSeconds}秒後に更新できます。
                      投稿は{windowMinutes}分で集計から外れます。
                      {!persistent && votingEnabled
                        ? " 現在は開発用の一時保存です。"
                        : ""}
                    </p>
                  </>
                )}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
