"use client";

import { Info, Mail, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
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
        className="pressable inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-rail-border bg-rail-bg/55 px-2.5 py-1 text-[11px] font-semibold text-rail-muted hover:border-orange-500/70 hover:text-rail-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        aria-haspopup="dialog"
      >
        <Info className="h-3 w-3" aria-hidden />
        データ利用について
      </button>

      {open &&
        createPortal(
          <div
            className="animate-scrim-enter fixed inset-0 z-[100] flex items-end justify-center bg-black/65 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="data-usage-title"
              className="app-sheet animate-sheet-enter safe-bottom max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border p-5 sm:rounded-2xl"
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
                  className="pressable flex h-11 w-11 items-center justify-center rounded-full text-rail-muted hover:bg-rail-bg hover:text-rail-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
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
                  運転見合わせなどの運行情報には、ODPTで提供される
                  <a
                    href="https://ckan.odpt.org/dataset/jr-train-status-information-by-jr-east-i-stations"
                    target="_blank"
                    rel="noreferrer"
                    className="mx-1 text-orange-300 underline underline-offset-4"
                  >
                    JR東日本アイステイションズの運行情報
                  </a>
                  を使用します。
                </p>
                <p>
                  列車アイコンの移動は駅間情報から推定したアニメーションであり、
                  GPSによる実測位置・軌跡ではありません。
                </p>
                <p>
                  「みんなの運行情報」は利用者による匿名の参考投稿であり、
                  鉄道会社の公式情報ではありません。端末内のランダムIDは、
                  連続投稿の防止と直近30分の集計にのみ使用します。短時間の
                  大量投稿を防ぐため、接続元はサーバー内で復元できない識別子へ
                  変換し、元のIPアドレスを投票データには保存しません。
                </p>
                <p>
                  急増通知を有効にした場合は、ブラウザが発行する通知用の
                  接続情報と選択した路線を保存します。通知は直近の利用者投稿から
                  運転見合わせの可能性を推定するもので、公式発表ではありません。
                  通知用情報は最終更新から最大180日間保持し、通知を解除した場合は
                  サーバーから削除します。
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
              <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
                <Link href="/privacy" onClick={() => setOpen(false)} className="text-orange-300 underline underline-offset-4">プライバシーポリシー</Link>
                <Link href="/terms" onClick={() => setOpen(false)} className="text-orange-300 underline underline-offset-4">利用規約・免責</Link>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
