"use client";

import { FormEvent, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { TrainLocation } from "@/types/train";

interface TrainSearchProps {
  trains: TrainLocation[];
  onSelect: (id: string) => void;
}

export function TrainSearch({ trains, onSelect }: TrainSearchProps) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  const matches = useMemo(
    () =>
      normalizedQuery
        ? trains
            .filter((train) =>
              train.trainNumber.toLocaleLowerCase("ja").startsWith(normalizedQuery),
            )
            .slice(0, 5)
        : [],
    [normalizedQuery, trains],
  );

  const select = (train: TrainLocation) => {
    setQuery(train.trainNumber);
    setMessage(null);
    setShowResults(false);
    onSelect(train.id);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const first = matches[0];
    if (first) {
      select(first);
    } else if (normalizedQuery) {
      setMessage("一致する列車が見つかりません");
    }
  };

  return (
    <div className="pointer-events-auto relative w-full max-w-[19rem]">
      <form
        onSubmit={submit}
        className="app-material flex min-h-11 items-center rounded-2xl border border-rail-border shadow-lg"
        role="search"
      >
        <Search className="ml-3 h-4 w-4 shrink-0 text-rail-accent" aria-hidden />
        <label htmlFor="train-number-search" className="sr-only">
          列車番号を検索
        </label>
        <input
          id="train-number-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setMessage(null);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="列車番号で検索"
          inputMode="search"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm text-rail-text outline-none placeholder:text-rail-muted"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setMessage(null);
              setShowResults(false);
            }}
            className="pressable mr-1 flex h-11 w-11 items-center justify-center rounded-xl text-rail-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            aria-label="列車番号の検索をクリア"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </form>

      {showResults && normalizedQuery && matches.length > 0 && (
        <ul className="app-sheet absolute left-0 right-0 top-[calc(100%+0.375rem)] overflow-hidden rounded-2xl border shadow-xl">
          {matches.map((train) => (
            <li key={train.id}>
              <button
                type="button"
                onClick={() => select(train)}
                className="pressable flex min-h-11 w-full items-center gap-2 border-b border-rail-border/60 px-3 text-left last:border-b-0 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-300"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: train.lineColor }}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-rail-text">
                    {train.trainNumber}
                  </span>
                  <span className="block truncate text-[11px] text-rail-muted">
                    {train.lineName}・{train.destination}行
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p className="mt-1 rounded-xl bg-red-950/90 px-3 py-2 text-xs text-red-100" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
