"use client";

import { RefreshCw } from "lucide-react";
import { formatTimeJa } from "@/lib/time";

interface UpdateStatusProps {
  /** ODPT の dc:date をもとにした、表示中データ自体の時刻。 */
  dataUpdatedAt: Date | null;
}

/** 表示中の列車データ自体の更新時刻を表示する。 */
export function UpdateStatus({ dataUpdatedAt }: UpdateStatusProps) {
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
