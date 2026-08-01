import type { TrainLocation } from "../types/train.ts";

const MAX_FILTERED_LINES = 44;
const MAX_LINES_QUERY_LENGTH = 1_024;
const LINE_ID_PATTERN = /^[a-z0-9-]{1,64}$/;

export type ParsedLineFilter =
  | { ok: true; lineIds: Set<string> | null }
  | { ok: false };

export function parseRequestedLineIds(raw: string | null): ParsedLineFilter {
  if (raw === null) return { ok: true, lineIds: null };
  if (raw.length > MAX_LINES_QUERY_LENGTH) return { ok: false };
  if (raw === "") return { ok: true, lineIds: new Set() };

  const values = raw.split(",");
  if (
    values.length > MAX_FILTERED_LINES ||
    values.some((value) => !LINE_ID_PATTERN.test(value))
  ) {
    return { ok: false };
  }
  return { ok: true, lineIds: new Set(values) };
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function trainForApi(train: TrainLocation): TrainLocation {
  return {
    ...train,
    latitude: roundCoordinate(train.latitude),
    longitude: roundCoordinate(train.longitude),
    routeSegment: train.routeSegment
      ? {
          ...train.routeSegment,
          coordinates: train.routeSegment.coordinates?.map(
            ([longitude, latitude]) => [
              roundCoordinate(longitude),
              roundCoordinate(latitude),
            ],
          ),
        }
      : null,
  };
}

export function trainsForRequestedLines(
  trains: readonly TrainLocation[],
  lineIds: ReadonlySet<string> | null,
): TrainLocation[] {
  return trains
    .filter((train) => lineIds === null || lineIds.has(train.lineId))
    .map(trainForApi);
}
