import type { ServiceStatus, TrainLocation } from "@/types/train";

const SEVERITY_ORDER: Record<ServiceStatus["severity"], number> = {
  normal: 0,
  minor: 1,
  major: 2,
};

const TRAIN_STATUS_FALLBACK_MAX_AGE_MS = 2 * 60 * 1000;

/** 運転再開後の文章を「見合わせ中」と誤判定しないよう、文脈を含めて分類する。 */
export function classifyServiceStatusSeverity(
  text: string,
): ServiceStatus["severity"] {
  if (/運転再開|運転を再開|運転が再開|再開し/.test(text)) {
    return /遅れ|遅延|運休|中止/.test(text) ? "minor" : "normal";
  }
  if (
    /運転見合わせ|運転を見合|見合わせています|抑止/.test(text)
  ) {
    return "major";
  }
  if (
    /遅れ|遅延|運休|直通運転を中止|一部列車|運転変更/.test(text)
  ) {
    return "minor";
  }
  return "normal";
}

/**
 * ODPTの運行情報が空でも、最新の列車位置に遅延が明示されている場合は
 * 「平常運転」と断定せず、列車位置情報から推定した遅延表示へ補正する。
 */
export function serviceStatusWithTrainDelayFallback(
  serviceStatus: ServiceStatus,
  trains: readonly TrainLocation[],
  nowMs = Date.now(),
): ServiceStatus {
  if (serviceStatus.severity !== "normal") return serviceStatus;

  const recentLineTrains = trains.filter((train) => {
    if (train.lineId !== serviceStatus.lineId) return false;
    const updatedAtMs = Date.parse(train.lastUpdatedAt);
    return (
      Number.isFinite(updatedAtMs) &&
      updatedAtMs <= nowMs + 30_000 &&
      nowMs - updatedAtMs <= TRAIN_STATUS_FALLBACK_MAX_AGE_MS
    );
  });
  if (recentLineTrains.length === 0) return serviceStatus;

  const delayedTrains = recentLineTrains.filter(
    (train) => train.status === "delayed" || train.delayMinutes > 0,
  );
  if (delayedTrains.length === 0) return serviceStatus;

  const maxDelayMinutes = Math.max(
    ...delayedTrains.map((train) => Math.max(0, train.delayMinutes)),
  );
  const delayedRatio = delayedTrains.length / recentLineTrains.length;
  const major =
    maxDelayMinutes >= 30 ||
    (maxDelayMinutes >= 15 && delayedRatio >= 0.5);
  const updatedAt = delayedTrains.reduce(
    (latest, train) =>
      Date.parse(train.lastUpdatedAt) > Date.parse(latest)
        ? train.lastUpdatedAt
        : latest,
    delayedTrains[0].lastUpdatedAt,
  );

  return {
    ...serviceStatus,
    severity: major ? "major" : "minor",
    message: major
      ? `列車位置情報では最大${maxDelayMinutes}分の大幅な遅れが確認されています。公式の運行情報もあわせてご確認ください。`
      : `列車位置情報では最大${maxDelayMinutes}分程度の遅れが確認されています。`,
    updatedAt,
    dataAccuracy: "estimated",
  };
}

/**
 * 表示中の路線だけに運行情報を絞る。
 * 複数路線に異常がある場合は重大なものを先に並べ、
 * すべて平常なら地図を覆わないよう1件にまとめる。
 */
export function serviceStatusesForVisibleLines(
  serviceStatuses: readonly ServiceStatus[],
  visibleLineIds: ReadonlySet<string>,
): ServiceStatus[] {
  const selected = serviceStatuses.filter((status) =>
    visibleLineIds.has(status.lineId),
  );
  if (selected.length <= 1) return selected;

  const disrupted = selected
    .filter((status) => status.severity !== "normal")
    .sort(
      (a, b) =>
        SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
        Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
        a.lineName.localeCompare(b.lineName, "ja"),
    );
  if (disrupted.length > 0) return disrupted;

  const latestUpdatedAt = selected.reduce(
    (latest, status) =>
      Date.parse(status.updatedAt) > Date.parse(latest)
        ? status.updatedAt
        : latest,
    selected[0].updatedAt,
  );

  return [
    {
      lineId: "__selected-lines__",
      lineName: `選択中の${selected.length}路線`,
      severity: "normal",
      message: "すべて平常どおり運転しています。",
      updatedAt: latestUpdatedAt,
      dataAccuracy: selected.every(
        (status) => status.dataAccuracy === "actual",
      )
        ? "actual"
        : "mock",
    },
  ];
}
