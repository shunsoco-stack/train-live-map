import Image from "next/image";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { DataUsageNotice } from "@/components/DataUsageNotice";
import { UpdateStatus } from "@/components/UpdateStatus";
import type { ProviderSource } from "@/types/train";

interface AppHeaderProps {
  lastUpdatedAt: Date | null;
  dataUpdatedAt: Date | null;
  source: ProviderSource | null;
}

/** アプリ上部のヘッダー(アプリ名・サブタイトル・データ元・更新状況)。 */
export function AppHeader({
  lastUpdatedAt,
  dataUpdatedAt,
  source,
}: AppHeaderProps) {
  return (
    <header className="app-material safe-top pointer-events-auto relative z-20 border-b border-rail-border/70 px-3 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Image
            src="/icons/train-live-map-jr-east-kanto-192.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-[0.65rem] shadow-md"
            aria-hidden
          />
          <div className="leading-tight">
            <h1 className="font-rounded text-[0.95rem] font-bold tracking-[-0.015em] text-rail-text">
              Train Live Map
            </h1>
            <p className="text-[0.6875rem] font-medium tracking-[0.015em] text-rail-muted">
              JR東日本・関東版（非公式）
            </p>
          </div>
        </div>
        <DataSourceBadge source={source} />
      </div>
      <div className="mt-1 flex min-h-9 items-center justify-between gap-2">
        <UpdateStatus
          lastUpdatedAt={lastUpdatedAt}
          dataUpdatedAt={dataUpdatedAt}
        />
        <DataUsageNotice source={source} />
      </div>
    </header>
  );
}
