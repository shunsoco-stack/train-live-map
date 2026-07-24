"use client";

import { RefreshCw } from "lucide-react";
import { formatTimeJa } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { REFRESH_MS } from "@/features/trains/useTrainData";

interface UpdateStatusProps {
  lastUpdatedAt: Date | null;
}

/**
 * 最終データ更新時刻と、次回更新までの秒数を表示する。
 * 1 秒ごとにカウントダウンを更新。
 */
export function UpdateStatus({ lastUpdatedAt }: UpdateStatusProps) {
  const now = useNow(1000);

  const nextInSec = lastUpdatedAt
    ? Math.max(
        0,
        Math.ceil(
          (lastUpdatedAt.getTime() + REFRESH_MS - now.getTime()) / 1000,
        ),
      )
    : null;

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-rail-muted">
      <RefreshCw className="h-3 w-3" aria-hidden />
      <span>
        最終更新{" "}
        <time className="tabular-nums text-rail-text">
          {lastUpdatedAt ? formatTimeJa(null, lastUpdatedAt) : "--:--:--"}
        </time>
      </span>
      <span aria-hidden>/</span>
      <span>
        次回更新まで{" "}
        <span className="tabular-nums text-rail-text">
          {nextInSec === null ? "--" : `${nextInSec}秒`}
        </span>
      </span>
    </div>
  );
}
