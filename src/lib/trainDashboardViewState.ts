export type TrainDashboardViewState =
  | "loading"
  | "no-selection"
  | "no-trains"
  | "no-filter-results"
  | "error"
  | "ready";

interface TrainDashboardViewStateInput {
  loading: boolean;
  visibleLineCount: number;
  trainCount: number;
  filteredTrainCount?: number;
  hasLoadedData: boolean;
  error: string | null;
}

export function resolveTrainDashboardViewState({
  loading,
  visibleLineCount,
  trainCount,
  filteredTrainCount = trainCount,
  hasLoadedData,
  error,
}: TrainDashboardViewStateInput): TrainDashboardViewState {
  if (visibleLineCount === 0) return "no-selection";
  if (loading) return "loading";
  if (hasLoadedData && trainCount === 0) return "no-trains";
  if (
    hasLoadedData &&
    trainCount > 0 &&
    filteredTrainCount === 0
  ) {
    return "no-filter-results";
  }
  if (error) return "error";
  return "ready";
}
