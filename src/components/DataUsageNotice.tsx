"use client";

import { Info, Mail, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ProviderSource } from "@/types/train";

const CONTACT_EMAIL = "train-live-map-support@gmail.com";

interface DataUsageNoticeProps {
  source: ProviderSource;
}

/**
 * ODPT データの利用条件と、アプリ専用の問い合わせ先を表示する。
 * 公共交通事業者へアプリ利用者が直接問い合わせないよう、常にヘッダーから
 * 確認できる場所に置く。
 */
export function DataUsageNotice({ source }: DataUsageNoticeProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rail-border bg-rail-bg/60 px-2 py-1 text-[11px] font-medium text-rail-muted transition hover:border-orange-600 hover:text-rail-text focus:outline-none focus:ring-2 focus:ring-orange-500"
        aria-haspopup="dialog"
      >
        <Info className="h-3 w-3" aria-hidden />
        データ利用について
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="data-usage-title"
              className="safe-bottom w-full max-w-lg rounded-t-2xl border border-rail-border bg-rail-surface p-5 shadow-2xl sm:rounded-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-orange-300">
                    ODPTデータ利用表示
                  </p>
                  <h2
                    id="data-usage-title"
                    className="mt-1 text-lg font-bold text-rail-text"
                  >
                    データ利用について
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-rail-muted transition hover:bg-rail-bg hover:text-rail-text focus:outline-none focus:ring-2 focus:ring-orange-500"
                  aria-label="閉じる"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm leading-6 text-rail-muted">
                <p>
                  {source === "odpt"
                    ? "このアプリ"
                    : "ODPT実データ表示時、このアプリ"}
                  の公共交通データは、公共交通オープンデータセンターから提供されています。
                </p>
                <p>
                  データは公共交通事業者が提供した情報をもとにしていますが、
                  正確性・完全性は保証されません。
                </p>
                <p>
                  アプリの内容について、公共交通事業者へ直接問い合わせないでください。
                </p>
              </div>

              <div className="mt-5 rounded-xl border border-rail-border bg-rail-bg/70 p-3">
                <p className="text-xs font-semibold text-rail-muted">
                  アプリに関するお問い合わせ
                </p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="mt-1 inline-flex items-center gap-2 break-all text-sm font-medium text-orange-300 underline decoration-orange-700 underline-offset-4 hover:text-orange-200"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  {CONTACT_EMAIL}
                </a>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
