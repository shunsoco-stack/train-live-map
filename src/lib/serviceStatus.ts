import type { ServiceStatus } from "@/types/train";

const SEVERITY_ORDER: Record<ServiceStatus["severity"], number> = {
  normal: 0,
  minor: 1,
  major: 2,
};

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
