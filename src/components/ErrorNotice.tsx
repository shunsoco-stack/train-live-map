"use client";

import { AlertOctagon, RefreshCw } from "lucide-react";

interface ErrorNoticeProps {
  message: string;
  onRetry?: () => void;
}

/** データ取得失敗時に表示する通知。画面が真っ白にならないようにする。 */
export function ErrorNotice({ message, onRetry }: ErrorNoticeProps) {
  return (
    <div
      role="alert"
      className="pointer-events-auto flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/15 px-3 py-2 text-xs text-red-100"
    >
      <AlertOctagon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex min-h-[36px] items-center gap-1 rounded-md border border-red-400/50 px-2 py-1 font-medium hover:bg-red-500/20"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          再取得
        </button>
      )}
    </div>
  );
}
