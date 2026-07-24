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
      role="tablist"
      aria-label="列車の絞り込み"
      className="pointer-events-auto flex gap-1.5 overflow-x-auto pb-0.5"
    >
      {TRAIN_FILTERS.map((f) => {
        const active = f.key === value;
        return (
          <button
            key={f.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(f.key)}
            className={`flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors ${
              active
                ? "border-rail-accent bg-rail-accent text-black"
                : "border-rail-border bg-rail-surface/90 text-rail-text hover:border-rail-accent/60"
            }`}
          >
            <span>{f.label}</span>
            <span
              className={`min-w-[1.25rem] rounded-full px-1 text-center text-[11px] tabular-nums ${
                active ? "bg-black/20 text-black" : "bg-black/30 text-rail-muted"
              }`}
            >
              {counts[f.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
