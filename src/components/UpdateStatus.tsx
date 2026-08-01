"use client";

import { RefreshCw } from "lucide-react";
import { formatTimeJa } from "@/lib/time";

interface UpdateStatusProps {
  /** クライアントが API の取得に成功した時刻。次回更新表示に使用。 */
  lastUpdatedAt: Date | null;
  /** ODPT の dc:date をもとにした、表示中データ自体の時刻。 */
  dataUpdatedAt: Date | null;
}

/**
 * 最終データ更新時刻と、次回更新までの秒数を表示する。
 * 1 秒ごとにカウントダウンを更新。
 */
export function UpdateStatus({
  dataUpdatedAt,
}: UpdateStatusProps) {
  return (
    <div
      className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium tracking-[0.01em] text-rail-muted"
      role="status"
      aria-live="off"
    >
      <RefreshCw className="h-3 w-3" aria-hidden />
      <span>
        <span className="hidden min-[350px]:inline">データ時刻 </span>
        <time className="tabular-nums text-rail-text">
          {dataUpdatedAt ? formatTimeJa(null, dataUpdatedAt) : "--:--:--"}
        </time>
      </span>
    </div>
  );
}
