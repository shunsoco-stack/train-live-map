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
  const tone = fallback
    ? "border-red-500/50 bg-red-500/15 text-red-100"
    : "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs backdrop-blur ${tone}`}
    >
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{notice}</span>
    </div>
  );
}
