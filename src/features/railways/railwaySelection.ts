import type {
  RailwayFilterOption,
  RailwaysApiResponse,
} from "../../types/railway.ts";

export const VISIBLE_LINES_STORAGE_KEY = "train-live-map:visible-lines";
export const SELECTION_DEFAULT_VERSION_KEY =
  "train-live-map:visible-lines-default-version";
export const SELECTION_DEFAULT_VERSION = "2";
export const FALLBACK_RETRY_DELAY_MS = 30_000;

export interface RailwaySelectionDecision {
  visibleIds: Set<string> | null;
  shouldFinalize: boolean;
  shouldPersistSelection: boolean;
  shouldPersistVersion: boolean;
}

function defaultVisibleIds(
  options: readonly RailwayFilterOption[],
): Set<string> {
  const selectedCategories = new Set<string>();
  const selectedIds = new Set<string>();

  for (const option of options) {
    if (!option.available || selectedCategories.has(option.category)) continue;
    selectedCategories.add(option.category);
    selectedIds.add(option.id);
  }

  return selectedIds;
}

function defaultDecision(
  options: readonly RailwayFilterOption[],
): RailwaySelectionDecision {
  return {
    visibleIds: defaultVisibleIds(options),
    shouldFinalize: true,
    shouldPersistSelection: true,
    shouldPersistVersion: true,
  };
}

/**
 * 路線一覧が実データで確定するまで、保存済み選択には一切触れない。
 * 実データ取得後は未知の文字列IDも保持し、将来その路線が復旧・追加された際に
 * 元の選択へ戻れるようにする。
 */
export function resolveRailwaySelection(
  storedValue: string | null,
  options: readonly RailwayFilterOption[],
  source: RailwaysApiResponse["source"],
  savedDefaultVersion: string | null,
): RailwaySelectionDecision {
  if (source === "fallback") {
    return {
      visibleIds: null,
      shouldFinalize: false,
      shouldPersistSelection: false,
      shouldPersistVersion: false,
    };
  }

  if (storedValue === null) return defaultDecision(options);

  let parsed: unknown;
  try {
    parsed = JSON.parse(storedValue);
  } catch {
    return defaultDecision(options);
  }
  if (
    !Array.isArray(parsed) ||
    !parsed.every((id): id is string => typeof id === "string")
  ) {
    return defaultDecision(options);
  }

  const restored = new Set(parsed);
  const availableIds = new Set(
    options.filter((option) => option.available).map((option) => option.id),
  );
  const defaultIds = defaultVisibleIds(options);
  const isLegacyAllSelection =
    savedDefaultVersion !== SELECTION_DEFAULT_VERSION &&
    availableIds.size > defaultIds.size &&
    [...availableIds].every((id) => restored.has(id));

  if (isLegacyAllSelection) {
    const migrated = new Set(
      [...restored].filter((id) => !availableIds.has(id)),
    );
    for (const id of defaultIds) migrated.add(id);
    return {
      visibleIds: migrated,
      shouldFinalize: true,
      shouldPersistSelection: true,
      shouldPersistVersion: true,
    };
  }

  return {
    visibleIds: restored,
    shouldFinalize: true,
    shouldPersistSelection: false,
    shouldPersistVersion:
      savedDefaultVersion !== SELECTION_DEFAULT_VERSION,
  };
}

export function shouldRetryFallbackRailwayNetwork(
  source: RailwaysApiResponse["source"],
  retryCount: number,
): boolean {
  return source === "fallback" && retryCount < 1;
}
