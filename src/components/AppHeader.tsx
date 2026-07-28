import { TrainFront } from "lucide-react";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { DataUsageNotice } from "@/components/DataUsageNotice";
import { UpdateStatus } from "@/components/UpdateStatus";
import type { ProviderSource } from "@/types/train";

interface AppHeaderProps {
  lastUpdatedAt: Date | null;
  dataUpdatedAt: Date | null;
  source: ProviderSource;
}

/** アプリ上部のヘッダー(アプリ名・サブタイトル・データ元・更新状況)。 */
export function AppHeader({
  lastUpdatedAt,
  dataUpdatedAt,
  source,
}: AppHeaderProps) {
  return (
    <header className="safe-top pointer-events-auto border-b border-rail-border bg-rail-surface/95 px-3 py-2 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rail-accent-dark text-orange-100">
            <TrainFront className="h-5 w-5" aria-hidden />
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-bold text-rail-text">Train Live Map</h1>
            <p className="text-[11px] text-rail-muted">関東のJR在来線</p>
          </div>
        </div>
        <DataSourceBadge source={source} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <UpdateStatus
          lastUpdatedAt={lastUpdatedAt}
          dataUpdatedAt={dataUpdatedAt}
        />
        <DataUsageNotice source={source} />
      </div>
    </header>
  );
}
