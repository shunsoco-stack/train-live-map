import { FlaskConical } from "lucide-react";

/** 「モックデータ使用中」であることを明示するバッジ。 */
export function MockBadge({ className = "" }: { className?: string }) {
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
