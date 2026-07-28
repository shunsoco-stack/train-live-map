"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Layers3,
  Loader2,
  Search,
  Star,
  X,
} from "lucide-react";
import type { RailwayFilterOption } from "@/types/railway";

const FAVORITE_LINES_STORAGE_KEY = "train-live-map:favorite-lines";

interface RailwayFilterSheetProps {
  options: RailwayFilterOption[];
  visibleIds: ReadonlySet<string>;
  onChange: (ids: Set<string>) => void;
  loading: boolean;
}

export function RailwayFilterSheet({
  options,
  visibleIds,
  onChange,
  loading,
}: RailwayFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(FAVORITE_LINES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          const knownIds = new Set(options.map((option) => option.id));
          setFavoriteIds(
            new Set(
              parsed.filter(
                (id): id is string =>
                  typeof id === "string" && knownIds.has(id),
              ),
            ),
          );
        }
      }
    } catch {
      // 保存値が壊れている場合は、お気に入りなしで開始する。
    } finally {
      setFavoritesLoaded(true);
    }
  }, [options]);

  useEffect(() => {
    if (!favoritesLoaded) return;
    window.localStorage.setItem(
      FAVORITE_LINES_STORAGE_KEY,
      JSON.stringify([...favoriteIds]),
    );
  }, [favoriteIds, favoritesLoaded]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const availableOptions = useMemo(
    () => options.filter((option) => option.available),
    [options],
  );
  const selectedCount = availableOptions.filter((option) =>
    visibleIds.has(option.id),
  ).length;

  const grouped = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ja");
    const filtered = options.filter((option) => {
      if (favoritesOnly && !favoriteIds.has(option.id)) return false;
      if (!normalizedQuery) return true;
      return [option.name, option.category, ...option.aliases].some((value) =>
        value.toLocaleLowerCase("ja").includes(normalizedQuery),
      );
    });
    const groups = new Map<string, RailwayFilterOption[]>();
    for (const option of filtered) {
      const group = groups.get(option.category) ?? [];
      group.push(option);
      groups.set(option.category, group);
    }
    return [...groups.entries()];
  }, [favoriteIds, favoritesOnly, options, query]);

  const toggle = (id: string) => {
    const next = new Set(visibleIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto absolute bottom-[4.5rem] right-3 z-20 flex min-h-11 items-center gap-2 rounded-full border border-orange-300/70 bg-rail-surface/95 px-3.5 text-sm font-bold text-rail-text shadow-xl backdrop-blur transition hover:border-rail-accent"
        aria-label={`表示路線を選ぶ。${selectedCount}路線を表示中`}
      >
        <Layers3 className="h-4 w-4 text-rail-accent" aria-hidden />
        <span>路線</span>
        <span className="min-w-6 rounded-full bg-rail-accent px-1.5 py-0.5 text-center text-xs tabular-nums text-black">
          {selectedCount}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="railway-filter-title"
        >
          <button
            type="button"
            aria-label="路線選択を閉じる"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
          />

          <section className="safe-bottom relative flex max-h-[82dvh] w-full max-w-lg flex-col rounded-t-3xl border border-rail-border bg-rail-surface shadow-2xl">
            <div className="flex justify-center pt-2.5">
              <span className="h-1 w-10 rounded-full bg-rail-border" aria-hidden />
            </div>

            <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-2">
              <div>
                <h2 id="railway-filter-title" className="text-lg font-bold text-rail-text">
                  表示する路線
                </h2>
                <p className="mt-0.5 text-xs text-rail-muted">
                  {selectedCount} / {availableOptions.length} 路線を表示中
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="閉じる"
                className="flex h-10 w-10 items-center justify-center rounded-full text-rail-muted hover:bg-white/5"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="px-4 pb-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rail-muted"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="路線名を検索"
                  className="h-11 w-full rounded-xl border border-rail-border bg-black/20 pl-9 pr-3 text-sm text-rail-text outline-none placeholder:text-rail-muted focus:border-rail-accent"
                />
              </div>

              <button
                type="button"
                aria-pressed={favoritesOnly}
                onClick={() => setFavoritesOnly((current) => !current)}
                className={`mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                  favoritesOnly
                    ? "border-yellow-300 bg-yellow-300/15 text-yellow-200"
                    : "border-rail-border bg-black/20 text-rail-muted hover:border-yellow-300/70"
                }`}
              >
                <Star
                  className="h-4 w-4"
                  fill={favoritesOnly ? "currentColor" : "none"}
                  aria-hidden
                />
                <span>お気に入り</span>
                <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs tabular-nums">
                  {favoriteIds.size}
                </span>
              </button>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onChange(new Set(availableOptions.map((option) => option.id)))
                  }
                  className="min-h-10 rounded-xl border border-rail-accent bg-rail-accent/15 px-3 text-sm font-semibold text-orange-200"
                >
                  すべて表示
                </button>
                <button
                  type="button"
                  onClick={() => onChange(new Set())}
                  className="min-h-10 rounded-xl border border-rail-border bg-black/20 px-3 text-sm font-semibold text-rail-muted"
                >
                  すべて隠す
                </button>
              </div>
            </div>

            <div className="overflow-y-auto border-t border-rail-border px-4 pb-5">
              {loading && (
                <div className="flex items-center gap-2 py-3 text-xs text-rail-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  利用可能な路線を確認中…
                </div>
              )}

              {grouped.map(([category, categoryOptions]) => (
                <div key={category} className="pt-4">
                  <h3 className="mb-2 text-xs font-bold text-orange-200">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {categoryOptions.map((option) => {
                      const selected = visibleIds.has(option.id);
                      const favorite = favoriteIds.has(option.id);
                      const unavailable = !option.available;
                      const note =
                        option.coverageNote ??
                        (unavailable ? "現在は位置情報を取得できません" : null);

                      return (
                        <div
                          key={option.id}
                          className={`flex min-h-12 overflow-hidden rounded-xl border transition ${
                            selected
                              ? "border-orange-300 bg-orange-400/15"
                              : "border-rail-border bg-black/15"
                          } hover:border-orange-300/70`}
                        >
                          <button
                            type="button"
                            disabled={unavailable}
                            aria-pressed={selected}
                            onClick={() => toggle(option.id)}
                            className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left ${
                              unavailable
                                ? "cursor-not-allowed opacity-45"
                                : ""
                            }`}
                          >
                            <span
                              className="h-3 w-3 shrink-0 rounded-full ring-2 ring-black/30"
                              style={{ backgroundColor: option.color }}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-rail-text">
                                {option.name}
                              </span>
                              {note && (
                                <span className="mt-0.5 block text-[10px] leading-tight text-rail-muted">
                                  {note}
                                </span>
                              )}
                            </span>
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                selected
                                  ? "border-orange-300 bg-rail-accent text-black"
                                  : "border-rail-border text-transparent"
                              }`}
                              aria-hidden
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          </button>
                          <button
                            type="button"
                            aria-pressed={favorite}
                            aria-label={`${option.name}をお気に入り${
                              favorite ? "から解除" : "に登録"
                            }`}
                            onClick={() => toggleFavorite(option.id)}
                            className={`flex w-12 shrink-0 items-center justify-center border-l transition ${
                              favorite
                                ? "border-yellow-300/30 bg-yellow-300/10 text-yellow-300"
                                : "border-rail-border text-rail-muted hover:bg-white/5 hover:text-yellow-200"
                            }`}
                          >
                            <Star
                              className="h-5 w-5"
                              fill={favorite ? "currentColor" : "none"}
                              aria-hidden
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {grouped.length === 0 && (
                <p className="py-8 text-center text-sm text-rail-muted">
                  {favoritesOnly && favoriteIds.size === 0
                    ? "路線右端の☆からお気に入りを登録できます。"
                    : "該当する路線がありません。"}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
