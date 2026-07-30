"use client";

import { TRAIN_FILTERS, type TrainFilterKey } from "@/lib/trainStatus";

interface TrainFilterBarProps {
  value: TrainFilterKey;
  onChange: (key: TrainFilterKey) => void;
  counts: Record<TrainFilterKey, number>;
}

/**
 * 列車の絞り込みフィルター。
 * スマホでも押しやすいよう、十分なタップ領域(高さ)を確保する。
 */
export function TrainFilterBar({ value, onChange, counts }: TrainFilterBarProps) {
  return (
    <div
      role="radiogroup"
      aria-label="列車の絞り込み"
      className="scrollbar-none pointer-events-auto flex snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5"
    >
      {TRAIN_FILTERS.map((f) => {
        const active = f.key === value;
        const count = counts[f.key];
        const disabled = count === 0;
        return (
          <button
            key={f.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${f.label} ${count}件`}
            disabled={disabled}
            onClick={() => onChange(f.key)}
            className={`pressable flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 text-sm font-semibold shadow-lg backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-45 ${
              active
                ? "border-orange-300 bg-rail-accent text-black shadow-orange-950/30"
                : "app-material border-rail-border text-rail-text hover:border-rail-accent/60"
            }`}
          >
            <span>{f.label}</span>
            <span
              aria-hidden="true"
              className={`min-w-[1.25rem] rounded-full px-1 text-center text-[11px] tabular-nums ${
                active ? "bg-black/20 text-black" : "bg-black/30 text-rail-muted"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
