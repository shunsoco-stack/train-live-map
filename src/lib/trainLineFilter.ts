export const MAX_TRAIN_LINE_FILTER_COUNT = 64;
export const MAX_TRAIN_LINE_ID_LENGTH = 64;

const TRAIN_LINE_ID_PATTERN = /^[a-z0-9-]+$/;

export type TrainLineFilterResult =
  | { valid: true; lineIds: Set<string> | null }
  | { valid: false; lineIds: null };

export function parseTrainLineFilter(
  value: string | null,
  isKnownLineId: (lineId: string) => boolean,
): TrainLineFilterResult {
  if (value === null) return { valid: true, lineIds: null };
  if (value === "") return { valid: true, lineIds: new Set() };

  const requestedIds = value.split(",");
  if (
    requestedIds.length > MAX_TRAIN_LINE_FILTER_COUNT ||
    requestedIds.some(
      (lineId) =>
        lineId.length === 0 ||
        lineId.length > MAX_TRAIN_LINE_ID_LENGTH ||
        !TRAIN_LINE_ID_PATTERN.test(lineId) ||
        !isKnownLineId(lineId),
    )
  ) {
    return { valid: false, lineIds: null };
  }

  return { valid: true, lineIds: new Set(requestedIds) };
}

export function trainsApiUrl(
  lineIds?: Iterable<string>,
): string {
  if (lineIds === undefined) return "/api/trains";
  const normalizedIds = [...new Set(lineIds)].sort();
  const params = new URLSearchParams();
  params.set("lines", normalizedIds.join(","));
  return `/api/trains?${params.toString()}`;
}
