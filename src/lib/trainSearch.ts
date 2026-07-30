import type { TrainLocation } from "../types/train.ts";

export function normalizeTrainNumber(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase();
}

/**
 * 列車番号の完全一致を先頭にし、その後へ前方一致を並べる。
 * 同じ番号が複数路線にある場合は候補を残し、呼び出し側で選べるようにする。
 */
export function searchTrainsByNumber(
  trains: readonly TrainLocation[],
  query: string,
): TrainLocation[] {
  const normalizedQuery = normalizeTrainNumber(query);
  if (!normalizedQuery) return [];

  const exact: TrainLocation[] = [];
  const prefix: TrainLocation[] = [];
  for (const train of trains) {
    const trainNumber = normalizeTrainNumber(train.trainNumber);
    if (trainNumber === normalizedQuery) exact.push(train);
    else if (trainNumber.startsWith(normalizedQuery)) prefix.push(train);
  }
  return [...exact, ...prefix];
}
