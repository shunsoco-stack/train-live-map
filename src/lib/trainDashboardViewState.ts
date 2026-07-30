export type TrainDashboardViewState =
  | "loading"
  | "no-selection"
  | "no-trains"
  | "error"
  | "ready";

interface TrainDashboardViewStateInput {
  loading: boolean;
  visibleLineCount: number;
  trainCount: number;
  hasLoadedData: boolean;
  error: string | null;
}

export function resolveTrainDashboardViewState({
  loading,
  visibleLineCount,
  trainCount,
  hasLoadedData,
  error,
}: TrainDashboardViewStateInput): TrainDashboardViewState {
  if (visibleLineCount === 0) return "no-selection";
  if (loading) return "loading";
  if (hasLoadedData && trainCount === 0) return "no-trains";
  if (error) return "error";
  return "ready";
}
