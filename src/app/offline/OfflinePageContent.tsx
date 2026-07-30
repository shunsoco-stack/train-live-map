"use client";

import { useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import {
  safeGetBrowserStorage,
  safeReadStorage,
} from "@/lib/browserGuidance";
import {
  LAST_TRAIN_DATA_AT_STORAGE_KEY,
  parseLastTrainDataAt,
} from "@/lib/offline";

export function OfflinePageContent() {
  const [lastDataAt, setLastDataAt] = useState<Date | null>(null);

  useEffect(() => {
    setLastDataAt(
      parseLastTrainDataAt(
        safeReadStorage(
          safeGetBrowserStorage("localStorage"),
          LAST_TRAIN_DATA_AT_STORAGE_KEY,
        ),
      ),
    );
    const reconnect = () => window.location.replace("/");
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, []);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-rail-bg p-6 text-rail-text safe-top safe-bottom">
      <section className="app-material w-full max-w-sm rounded-3xl border border-rail-border p-6 text-center shadow-xl">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300">
          <WifiOff className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold">オフラインです</h1>
        <p className="mt-2 text-sm leading-7 text-rail-muted">
          接続が戻ると自動で再取得します。古い列車位置を表示しないため、列車データはオフライン保存していません。
        </p>
        <p className="mt-3 text-xs text-rail-muted">
          最後に取得した時刻:{" "}
          {lastDataAt
            ? new Intl.DateTimeFormat("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }).format(lastDataAt)
            : "記録なし"}
        </p>
        <button
          type="button"
          onClick={() => window.location.replace("/")}
          className="pressable mx-auto mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          再接続を確認
        </button>
      </section>
    </main>
  );
}
