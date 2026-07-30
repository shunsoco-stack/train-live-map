"use client";

import { useMemo, useState } from "react";
import { Search, TrainFront, X } from "lucide-react";
import { searchTrainsByNumber } from "@/lib/trainSearch";
import type { TrainLocation } from "@/types/train";

interface TrainSearchSheetProps {
  trains: readonly TrainLocation[];
  onSelect: (trainId: string) => void;
}

export function TrainSearchSheet({
  trains,
  onSelect,
}: TrainSearchSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchTrainsByNumber(trains, query).slice(0, 20),
    [query, trains],
  );
  const hasQuery = query.trim().length > 0;

  const select = (trainId: string) => {
    onSelect(trainId);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="app-material pressable pointer-events-auto absolute bottom-[8.5rem] left-3 z-20 flex min-h-12 items-center gap-2 rounded-full border border-sky-300/60 px-3.5 text-sm font-bold text-rail-text hover:border-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        aria-label="列車番号で列車を検索"
      >
        <Search className="h-4 w-4 text-sky-300" aria-hidden />
        <span>列車検索</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="train-search-title"
        >
          <button
            type="button"
            aria-label="列車検索を閉じる"
            onClick={() => setOpen(false)}
            className="animate-scrim-enter absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />

          <section className="app-sheet animate-sheet-enter safe-bottom relative flex max-h-[78dvh] w-full max-w-lg flex-col rounded-t-3xl border">
            <div className="flex justify-center pt-2.5">
              <span
                className="h-1.5 w-10 rounded-full bg-orange-100/25"
                aria-hidden
              />
            </div>
            <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-2">
              <div>
                <h2
                  id="train-search-title"
                  className="text-lg font-bold text-rail-text"
                >
                  列車番号で探す
                </h2>
                <p className="mt-0.5 text-xs text-rail-muted">
                  表示中の路線を前方一致で検索します
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="閉じる"
                className="pressable flex h-11 w-11 items-center justify-center rounded-full text-rail-muted hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="px-4 pb-3">
              <label
                htmlFor="train-number-search"
                className="sr-only"
              >
                列車番号
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rail-muted"
                  aria-hidden
                />
                <input
                  id="train-number-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="例: 1234E"
                  autoFocus
                  autoComplete="off"
                  className="h-11 w-full rounded-xl border border-rail-border bg-black/20 pl-9 pr-3 text-sm uppercase text-rail-text outline-none placeholder:normal-case placeholder:text-rail-muted focus:border-sky-300 focus:ring-2 focus:ring-sky-300/25"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
              {!hasQuery && (
                <p className="py-7 text-center text-sm text-rail-muted">
                  列車番号の先頭から入力してください。
                </p>
              )}
              {hasQuery && results.length === 0 && (
                <p
                  role="status"
                  className="py-7 text-center text-sm text-rail-muted"
                >
                  該当する列車がありません。
                </p>
              )}
              {results.length > 0 && (
                <ul className="space-y-2" aria-label="検索結果">
                  {results.map((train) => (
                    <li key={train.id}>
                      <button
                        type="button"
                        onClick={() => select(train.id)}
                        className="pressable flex min-h-14 w-full items-center gap-3 rounded-xl border border-rail-border bg-black/15 px-3 py-2 text-left hover:border-sky-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
                          style={{ backgroundColor: train.lineColor }}
                          aria-hidden
                        >
                          <TrainFront className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-rail-text">
                            {train.trainNumber}
                          </span>
                          <span className="block truncate text-xs text-rail-muted">
                            {train.lineName}・{train.destination}行
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
