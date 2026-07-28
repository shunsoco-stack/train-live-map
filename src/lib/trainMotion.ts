interface AdvanceEstimatedFractionArgs {
  currentFraction: number;
  fromFraction: number;
  toFraction: number;
  speedKmh: number;
  routeLengthMeters: number;
  elapsedMs: number;
  maxSegmentProgress?: number;
}

/**
 * 観測中の駅間から出ない範囲で、列車の推定位置を進行方向へ少し進める。
 * ODPT に連続座標はないため、次駅の直前で止めて新しい駅間情報を待つ。
 */
export function advanceEstimatedFraction({
  currentFraction,
  fromFraction,
  toFraction,
  speedKmh,
  routeLengthMeters,
  elapsedMs,
  maxSegmentProgress = 0.88,
}: AdvanceEstimatedFractionArgs): number {
  if (
    !Number.isFinite(currentFraction) ||
    !Number.isFinite(fromFraction) ||
    !Number.isFinite(toFraction) ||
    speedKmh <= 0 ||
    routeLengthMeters <= 0 ||
    elapsedMs <= 0 ||
    fromFraction === toFraction
  ) {
    return currentFraction;
  }

  const progress = Math.min(1, Math.max(0, maxSegmentProgress));
  const targetFraction = fromFraction + (toFraction - fromFraction) * progress;
  const metersPerSecond = (speedKmh * 1000) / 3600;
  const stepFraction = (metersPerSecond * (elapsedMs / 1000)) / routeLengthMeters;

  if (targetFraction > currentFraction) {
    return Math.min(targetFraction, currentFraction + stepFraction);
  }
  return Math.max(targetFraction, currentFraction - stepFraction);
}
