"use client";

import {
  Component,
  Fragment,
  type ErrorInfo,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import type { TrainLocation } from "@/types/train";
import type { RailwayMapLine } from "@/types/railway";

/**
 * MapLibre は SSR で読み込むと window 参照でエラーになるため、
 * ssr:false で動的インポートし、クライアントでのみ描画する。
 */
const TrainMapInner = dynamic(() => import("@/features/map/TrainMapInner"), {
  ssr: false,
  loading: () => <MapLoading />,
});

function MapLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-rail-bg">
      <div className="flex items-center gap-2 text-rail-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="text-sm">地図を読み込み中…</span>
      </div>
    </div>
  );
}

interface MapPanelProps {
  trains: TrainLocation[];
  railwayLines: RailwayMapLine[];
  visibleLineIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: Date;
}

interface MapErrorBoundaryState {
  failed: boolean;
  retryKey: number;
}

class MapErrorBoundary extends Component<
  { children: ReactNode },
  MapErrorBoundaryState
> {
  state: MapErrorBoundaryState = { failed: false, retryKey: 0 };

  static getDerivedStateFromError(): Partial<MapErrorBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("地図の描画に失敗しました。", error, info);
  }

  private retry = (): void => {
    this.setState((state) => ({
      failed: false,
      retryKey: state.retryKey + 1,
    }));
  };

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-rail-bg p-6">
          <section
            role="alert"
            className="app-material max-w-sm rounded-2xl border border-red-500/40 p-5 text-center shadow-xl"
          >
            <AlertTriangle
              className="mx-auto h-7 w-7 text-red-300"
              aria-hidden
            />
            <h2 className="mt-3 text-base font-bold text-rail-text">
              地図を表示できませんでした
            </h2>
            <p className="mt-2 text-sm leading-6 text-rail-muted">
              列車情報や路線フィルタは引き続き利用できます。
            </p>
            <button
              type="button"
              onClick={this.retry}
              className="pressable mx-auto mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              再試行
            </button>
          </section>
        </div>
      );
    }

    return (
      <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>
    );
  }
}

export function MapPanel(props: MapPanelProps) {
  return (
    <div className="absolute inset-0">
      <MapErrorBoundary>
        <TrainMapInner {...props} />
      </MapErrorBoundary>
    </div>
  );
}
