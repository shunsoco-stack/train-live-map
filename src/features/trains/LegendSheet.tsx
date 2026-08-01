"use client";

import { useEffect, useRef } from "react";
import { Compass, MapPin, Sparkles, X } from "lucide-react";
import { TRAIN_STATUS_LEGEND } from "@/lib/trainStatus";

interface LegendSheetProps {
  open: boolean;
  onClose: () => void;
}

export function LegendSheet({ open, onClose }: LegendSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="legend-title">
      <button type="button" onClick={onClose} className="animate-scrim-enter absolute inset-0 bg-black/55" aria-label="凡例を閉じる" />
      <section className="app-sheet animate-sheet-enter safe-bottom relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border px-4 pb-5 pt-2">
        <div className="flex justify-center"><span className="h-1.5 w-10 rounded-full bg-orange-100/25" aria-hidden /></div>
        <div className="mt-1 flex items-center justify-between">
          <h2 id="legend-title" className="text-lg font-bold text-rail-text">地図の見かた</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="pressable flex h-11 w-11 items-center justify-center rounded-full text-rail-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300" aria-label="地図の凡例を閉じる">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <h3 className="mt-2 text-sm font-bold text-rail-text">列車の状態</h3>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {TRAIN_STATUS_LEGEND.map((item) => (
            <li key={item.level} className="flex min-h-11 items-center gap-2 rounded-2xl border border-rail-border/70 bg-black/10 px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-black text-white" style={{ backgroundColor: item.ring, borderColor: item.color }} aria-hidden>
                {item.symbol}
              </span>
              <span className="text-xs font-semibold leading-4 text-rail-text">{item.label}</span>
            </li>
          ))}
        </ul>

        <h3 className="mt-4 flex items-center gap-2 text-sm font-bold text-rail-text"><Compass className="h-4 w-4 text-orange-300" aria-hidden />進行方向</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-white">
          <span className="rounded-full border border-blue-300 bg-blue-900 px-3 py-1.5">↑ 上り</span>
          <span className="rounded-full border border-orange-300 bg-orange-900 px-3 py-1.5">↓ 下り</span>
          <span className="rounded-full border border-rail-border px-3 py-1.5 text-rail-muted">内回り／外回り</span>
          <span className="rounded-full border border-rail-border px-3 py-1.5 text-rail-muted">北行／南行</span>
        </div>

        <div className="mt-4 rounded-2xl border border-orange-300/30 bg-orange-950/30 p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-rail-text"><Sparkles className="h-4 w-4 text-orange-300" aria-hidden />アイコンの位置</p>
          <p className="mt-1 text-xs leading-5 text-rail-muted">ODPTの駅間情報をもとにした推定位置です。GPSで測った正確な現在地ではなく、ゆっくりした動きも推定アニメーションです。</p>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-rail-muted"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden />現在地ボタンで取得した位置は、地図を移動するためだけに端末内で使い、サーバーへ送信しません。</p>
      </section>
    </div>
  );
}
