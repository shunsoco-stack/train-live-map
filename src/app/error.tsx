"use client";

import { useEffect } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";

interface AppRouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppRouteError({ error, reset }: AppRouteErrorProps) {
  useEffect(() => {
    console.error("画面の表示中に問題が発生しました。", error);
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-rail-bg p-6 text-rail-text">
      <section
        role="alert"
        className="app-material w-full max-w-sm rounded-2xl border border-red-500/40 p-5 text-center shadow-xl"
      >
        <AlertOctagon className="mx-auto h-8 w-8 text-red-300" aria-hidden />
        <h1 className="mt-3 text-lg font-bold">
          表示に問題が発生しました
        </h1>
        <p className="mt-2 text-sm leading-6 text-rail-muted">
          一時的な問題の可能性があります。もう一度お試しください。
        </p>
        <button
          type="button"
          onClick={reset}
          className="pressable mx-auto mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          再読み込み
        </button>
      </section>
    </main>
  );
}
