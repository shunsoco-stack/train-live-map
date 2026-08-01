"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("train-live-map:last-data-updated-v1");
      if (stored) {
        const date = new Date(stored);
        if (!Number.isNaN(date.getTime())) {
          setLastUpdated(date.toLocaleString("ja-JP"));
        }
      }
    } catch {
      // 保存値を読めなくてもオフライン案内は表示する。
    }
    const reconnect = () => window.location.replace("/");
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-rail-bg p-5 text-rail-text">
      <section className="app-sheet w-full max-w-sm rounded-3xl border p-6 text-center">
        <WifiOff className="mx-auto h-10 w-10 text-orange-300" aria-hidden />
        <h1 className="mt-3 text-xl font-black">オフラインです</h1>
        <p className="mt-2 text-sm leading-6 text-rail-muted">接続が戻ると自動で列車情報を再取得します。古い列車位置は安全のため表示しません。</p>
        <p className="mt-3 text-xs text-rail-muted">最後に取得した時刻: {lastUpdated ?? "記録なし"}</p>
        <Link href="/" className="pressable mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rail-accent px-4 text-sm font-bold text-black"><RefreshCw className="h-4 w-4" aria-hidden />再接続を確認</Link>
      </section>
    </main>
  );
}
