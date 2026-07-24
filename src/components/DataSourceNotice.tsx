import { Info } from "lucide-react";

/**
 * データ取得元に関する注意書きバナー。
 * 「現在モックデータを表示しています」などをユーザーに明示する。
 */
export function DataSourceNotice({
  notice,
  fallback,
}: {
  notice: string | null;
  fallback: boolean;
}) {
  if (!notice) return null;
  // 明るい地図の上でも読めるよう、不透明なダークカードで表示する。
  const accent = fallback ? "border-red-500/70 text-red-300" : "border-amber-500/60 text-amber-300";
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-2 rounded-lg border bg-rail-surface/95 px-3 py-1.5 text-xs text-rail-text shadow-lg backdrop-blur ${accent}`}
    >
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{notice}</span>
    </div>
  );
}
