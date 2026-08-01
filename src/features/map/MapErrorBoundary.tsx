"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { MapPinned, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  retryKey: number;
}

export class MapErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, retryKey: 0 };

  public static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Map rendering failed", error.name, info.componentStack);
  }

  private retry = () => {
    this.setState((state) => ({ hasError: false, retryKey: state.retryKey + 1 }));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="absolute inset-0 flex items-center justify-center bg-rail-bg p-6 text-rail-text">
          <div className="app-sheet w-full max-w-sm rounded-3xl border p-6 text-center">
            <MapPinned className="mx-auto h-9 w-9 text-orange-300" aria-hidden />
            <h2 className="mt-3 text-lg font-bold">地図を表示できませんでした</h2>
            <p className="mt-2 text-sm leading-6 text-rail-muted">列車情報はそのままです。地図だけを再読み込みできます。</p>
            <button type="button" onClick={this.retry} className="pressable mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rail-accent px-4 text-sm font-bold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200">
              <RefreshCw className="h-4 w-4" aria-hidden />
              地図を再読み込み
            </button>
          </div>
        </div>
      );
    }

    return <div key={this.state.retryKey} className="absolute inset-0">{this.props.children}</div>;
  }
}
