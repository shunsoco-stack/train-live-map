"use client";

import { useEffect, useState } from "react";

/**
 * 一定間隔で「現在時刻」を更新して返すフック。
 * 停止時間などのリアルタイム表示(1秒ごと更新)に使用する。
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
