export const LAST_TRAIN_DATA_AT_STORAGE_KEY =
  "train-live-map:last-train-data-at:v1";

export function parseLastTrainDataAt(
  value: string | null,
): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
