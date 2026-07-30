import { FlaskConical, Radio } from "lucide-react";
import type { ProviderSource } from "@/types/train";

/**
 * データ取得元(実データ ODPT / モック)を示すバッジ。
 * モック時は「モックデータ使用中」、実データ時は「ODPT ライブ(推定位置)」を表示する。
 */
export function DataSourceBadge({
  source,
  className = "",
}: {
  source: ProviderSource | null;
  className?: string;
}) {
  if (!source) return null;

  if (source === "odpt") {
    return (
      <span
        className={`inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border border-orange-400/60 bg-orange-400/10 px-2 py-0.5 text-[11px] font-semibold text-orange-100 shadow-sm ${className}`}
        title="ODPT の実データを表示中。位置は駅間からの推定を含みます。"
        aria-label="ODPTの実データを表示中。位置は駅間からの推定を含みます"
      >
        <Radio className="h-3 w-3" aria-hidden />
        <span>ODPT ライブ</span>
        <span className="hidden min-[390px]:inline">(推定位置)</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200 shadow-sm ${className}`}
      title="表示中の列車位置はモック(擬似)データです"
      aria-label="表示中の列車位置はモックデータです"
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      <span className="min-[360px]:hidden">モック</span>
      <span className="hidden min-[360px]:inline">モックデータ使用中</span>
    </span>
  );
}
