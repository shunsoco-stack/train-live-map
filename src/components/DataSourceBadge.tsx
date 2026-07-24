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
  source: ProviderSource;
  className?: string;
}) {
  if (source === "odpt") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ${className}`}
        title="ODPT の実データを表示中。位置は駅間からの推定を含みます。"
      >
        <Radio className="h-3 w-3" aria-hidden />
        ODPT ライブ(推定位置)
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ${className}`}
      title="表示中の列車位置はモック(擬似)データです"
    >
      <FlaskConical className="h-3 w-3" aria-hidden />
      モックデータ使用中
    </span>
  );
}
