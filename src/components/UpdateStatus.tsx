"use client";

import { RefreshCw } from "lucide-react";
import { formatTimeJa } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { REFRESH_MS } from "@/features/trains/useTrainData";

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
  lastUpdatedAt,
  dataUpdatedAt,
}: UpdateStatusProps) {
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
        データ時刻{" "}
        <time className="tabular-nums text-rail-text">
          {dataUpdatedAt ? formatTimeJa(null, dataUpdatedAt) : "--:--:--"}
        </time>
      </span>
      <span className="hidden min-[390px]:inline" aria-hidden>
        /
      </span>
      <span className="hidden min-[390px]:inline">
        次回更新まで{" "}
        <span className="tabular-nums text-rail-text">
          {nextInSec === null ? "--" : `${nextInSec}秒`}
        </span>
      </span>
    </div>
  );
}
