"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
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

export function MapPanel(props: MapPanelProps) {
  return (
    <div className="absolute inset-0">
      <TrainMapInner {...props} />
    </div>
  );
}
