"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-rail-bg p-6 text-rail-text">
      <section role="alert" className="app-sheet w-full max-w-md rounded-3xl border p-6 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-orange-300" aria-hidden />
        <h1 className="mt-4 text-xl font-bold">画面を表示できませんでした</h1>
        <p className="mt-2 text-sm leading-6 text-rail-muted">
          一時的な問題の可能性があります。列車情報を再読み込みしてください。
        </p>
        <button type="button" onClick={reset} className="pressable mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rail-accent px-5 text-sm font-bold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200">
          <RefreshCw className="h-4 w-4" aria-hidden />
          再読み込み
        </button>
      </section>
    </main>
  );
}
