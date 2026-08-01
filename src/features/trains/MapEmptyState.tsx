"use client";

import { Layers3, RotateCcw, TrainFront } from "lucide-react";

interface MapEmptyStateProps {
  kind: "no-lines" | "no-trains" | "no-filter-results";
  onChooseLines: () => void;
  onResetFilter: () => void;
  onRetry: () => void;
}

export function MapEmptyState({
  kind,
  onChooseLines,
  onResetFilter,
  onRetry,
}: MapEmptyStateProps) {
  const content =
    kind === "no-lines"
      ? {
          title: "表示する路線が選ばれていません",
          body: "路線を1つ以上選ぶと、列車位置を表示します。",
          action: "路線を選ぶ",
          onAction: onChooseLines,
          icon: Layers3,
        }
      : kind === "no-trains"
        ? {
            title: "列車情報がありません",
            body: "現在、選択した路線の列車位置を取得できませんでした。",
            action: "再読み込み",
            onAction: onRetry,
            icon: RotateCcw,
          }
        : {
            title: "該当する列車がありません",
            body: "別の運行状態を選ぶか、すべての列車に戻してください。",
            action: "すべてに戻す",
            onAction: onResetFilter,
            icon: TrainFront,
          };
  const Icon = content.icon;

  return (
    <section className="app-sheet pointer-events-auto absolute left-1/2 top-1/2 z-20 w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-3xl border p-5 text-center shadow-2xl" role="status" aria-live="polite">
      <Icon className="mx-auto h-8 w-8 text-orange-300" aria-hidden />
      <h2 className="mt-2 text-base font-bold text-rail-text">{content.title}</h2>
      <p className="mt-1 text-xs leading-5 text-rail-muted">{content.body}</p>
      <button type="button" onClick={content.onAction} className="pressable mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-rail-accent px-4 text-sm font-bold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200">
        {content.action}
      </button>
    </section>
  );
}
