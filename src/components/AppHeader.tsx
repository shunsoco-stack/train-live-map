import { TrainFront } from "lucide-react";
import { MockBadge } from "@/components/MockBadge";
import { UpdateStatus } from "@/components/UpdateStatus";

interface AppHeaderProps {
  lastUpdatedAt: Date | null;
  isMock: boolean;
}

/** アプリ上部のヘッダー(アプリ名・サブタイトル・モック表示・更新状況)。 */
export function AppHeader({ lastUpdatedAt, isMock }: AppHeaderProps) {
  return (
    <header className="safe-top pointer-events-auto border-b border-rail-border bg-rail-surface/95 px-3 py-2 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rail-accent-dark text-emerald-200">
            <TrainFront className="h-5 w-5" aria-hidden />
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-bold text-rail-text">Train Live Map</h1>
            <p className="text-[11px] text-rail-muted">東海道線 東京〜横浜</p>
          </div>
        </div>
        {isMock && <MockBadge />}
      </div>
      <div className="mt-1.5">
        <UpdateStatus lastUpdatedAt={lastUpdatedAt} />
      </div>
    </header>
  );
}
