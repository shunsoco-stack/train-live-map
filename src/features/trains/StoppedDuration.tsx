"use client";

import { elapsedSeconds, formatDurationJa } from "@/lib/time";
import { useNow } from "@/lib/useNow";

interface StoppedDurationProps {
  stoppedSince: string | null;
  /** 先頭に付けるラベル(既定: "停止中") */
  prefix?: string;
  className?: string;
}

/**
 * stoppedSince から現在時刻までの停止時間を 1 秒ごとに更新表示する。
 * 例: 「停止中 42秒」「停止中 3分18秒」
 */
export function StoppedDuration({
  stoppedSince,
  prefix = "停止中",
  className,
}: StoppedDurationProps) {
  const now = useNow(1000);
  if (!stoppedSince) return null;
  const seconds = elapsedSeconds(stoppedSince, now) ?? 0;
  return (
    <span className={className}>
      {prefix} {formatDurationJa(seconds)}
    </span>
  );
}
