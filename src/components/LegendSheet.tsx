"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleHelp, X } from "lucide-react";
import { createPortal } from "react-dom";
import { ODPT_DIRECTION_BY_SUFFIX } from "@/lib/odpt/direction";
import {
  STATUS_APPEARANCES,
  TRAIN_FILTERS,
} from "@/lib/trainStatus";

function faceForLevel(
  level: (typeof STATUS_APPEARANCES)[number]["level"],
): string {
  if (level === "running") return "🙂";
  if (level === "suspended") return "😭";
  return "😟";
}

export function LegendSheet() {
  const [open, setOpen] = useState(false);
  const directions = useMemo(() => {
    const seen = new Set<string>();
    return Object.values(ODPT_DIRECTION_BY_SUFFIX).filter((direction) => {
      if (
        !direction.directionLabel ||
        seen.has(direction.directionKind)
      ) {
        return false;
      }
      seen.add(direction.directionKind);
      return true;
    });
  }, []);

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
        aria-label="列車アイコンと表示の凡例を開く"
        aria-haspopup="dialog"
        className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-rail-border bg-rail-bg/55 text-rail-muted hover:border-sky-300/70 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        <CircleHelp className="h-5 w-5" aria-hidden />
      </button>

      {open &&
        createPortal(
          <div
            className="animate-scrim-enter fixed inset-0 z-[100] flex items-end justify-center bg-black/65 backdrop-blur-[2px] sm:items-center sm:p-4"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="legend-title"
              className="app-sheet animate-sheet-enter safe-bottom max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border p-5 sm:rounded-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-sky-300">
                    地図の見かた
                  </p>
                  <h2
                    id="legend-title"
                    className="mt-1 text-lg font-bold text-rail-text"
                  >
                    列車アイコンの凡例
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="凡例を閉じる"
                  className="pressable flex h-11 w-11 items-center justify-center rounded-full text-rail-muted hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <section className="mt-5">
                <h3 className="text-sm font-bold text-rail-text">
                  表情・状態記号
                </h3>
                <ul className="mt-2 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
                  {STATUS_APPEARANCES.map((appearance) => (
                    <li
                      key={appearance.level}
                      className="flex min-h-11 items-center gap-3 rounded-xl border border-rail-border bg-black/15 px-3"
                    >
                      <span className="text-xl" aria-hidden>
                        {faceForLevel(appearance.level)}
                      </span>
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-black text-white"
                        style={{
                          backgroundColor: appearance.ring,
                          borderColor: appearance.color,
                        }}
                        aria-hidden
                      >
                        {appearance.symbol}
                      </span>
                      <span className="text-xs font-semibold text-rail-text">
                        {appearance.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-5">
                <h3 className="text-sm font-bold text-rail-text">
                  絞り込み
                </h3>
                <p className="mt-2 text-xs leading-6 text-rail-muted">
                  {TRAIN_FILTERS.map(({ label }) => label).join("・")}
                  の件数は、同じ状態判定から自動集計しています。
                </p>
              </section>

              <section className="mt-5">
                <h3 className="text-sm font-bold text-rail-text">
                  進行方向
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {directions.map((direction) => (
                    <span
                      key={direction.directionKind}
                      className="rounded-full border border-sky-300/40 bg-sky-400/10 px-2.5 py-1 text-xs font-semibold text-sky-100"
                    >
                      {direction.directionLabel}
                    </span>
                  ))}
                </div>
              </section>

              <section className="mt-5 space-y-2 text-xs leading-6 text-rail-muted">
                <h3 className="text-sm font-bold text-rail-text">
                  色と位置情報
                </h3>
                <p>
                  線路と電車本体の色は路線カラーです。方向バッジの色は進行方向の識別用です。
                </p>
                <p>
                  「実測」は提供座標、「推定」は駅間情報からの補間、「モック」は検証用データです。アイコンの滑らかな移動はGPS軌跡ではありません。
                </p>
              </section>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
