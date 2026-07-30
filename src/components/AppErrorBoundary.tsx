"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Train Live Map の画面描画に失敗しました。", error, info);
  }

  private reload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-rail-bg p-6 text-rail-text">
        <section
          role="alert"
          className="app-material w-full max-w-sm rounded-2xl border border-red-500/40 p-5 text-center shadow-xl"
        >
          <AlertOctagon
            className="mx-auto h-8 w-8 text-red-300"
            aria-hidden
          />
          <h1 className="mt-3 text-lg font-bold">
            画面を表示できませんでした
          </h1>
          <p className="mt-2 text-sm leading-6 text-rail-muted">
            一時的な問題が発生しました。再読み込みしてお試しください。
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="pressable mx-auto mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            再読み込み
          </button>
        </section>
      </main>
    );
  }
}
