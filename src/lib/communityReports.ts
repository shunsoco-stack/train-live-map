import type {
  CommunityReportRecord,
  CommunityReportStatus,
  CommunityReportSummary,
  CommunityReportVote,
} from "@/types/community";

export const COMMUNITY_REPORT_WINDOW_MS = 30 * 60 * 1000;
export const COMMUNITY_REPORT_COOLDOWN_SECONDS = 60;

const STATUS_PRIORITY: Record<CommunityReportStatus, number> = {
  "on-time": 0,
  delayed: 1,
  suspended: 2,
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function validateCommunityReportVote(
  input: unknown,
): CommunityReportVote | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const lineId =
    typeof value.lineId === "string" ? value.lineId.trim() : "";
  const status = value.status;
  if (
    !lineId ||
    (status !== "on-time" &&
      status !== "delayed" &&
      status !== "suspended")
  ) {
    return null;
  }

  if (status === "delayed") {
    const delayMinutes = Number(value.delayMinutes);
    if (
      !Number.isInteger(delayMinutes) ||
      delayMinutes < 1 ||
      delayMinutes > 120
    ) {
      return null;
    }
    return { lineId, status, delayMinutes };
  }

  return { lineId, status, delayMinutes: null };
}

/**
 * 直近の匿名投票を路線別に集約する。
 * 同数の場合は、見落としを避けるため重大度の高い報告を優先する。
 */
export function aggregateCommunityReports(
  reports: readonly CommunityReportRecord[],
  now = Date.now(),
): CommunityReportSummary[] {
  const cutoff = now - COMMUNITY_REPORT_WINDOW_MS;
  const byLine = new Map<string, Map<string, CommunityReportRecord>>();

  for (const report of reports) {
    const createdAt = Date.parse(report.createdAt);
    if (!Number.isFinite(createdAt) || createdAt < cutoff || createdAt > now) {
      continue;
    }
    const group = byLine.get(report.lineId) ?? new Map();
    const sourceIdentity =
      report.reporterIpHash ?? report.sourceHash ?? report.reporterHash;
    const previous = group.get(sourceIdentity);
    if (!previous || Date.parse(previous.createdAt) < createdAt) {
      group.set(sourceIdentity, report);
    }
    byLine.set(report.lineId, group);
  }

  return [...byLine.entries()]
    .map(([lineId, reportsBySource]) => {
      const lineReports = [...reportsBySource.values()];
      const counts = {
        onTime: lineReports.filter((item) => item.status === "on-time")
          .length,
        delayed: lineReports.filter((item) => item.status === "delayed")
          .length,
        suspended: lineReports.filter(
          (item) => item.status === "suspended",
        ).length,
      };
      const statusCounts: Array<[CommunityReportStatus, number]> = [
        ["on-time", counts.onTime],
        ["delayed", counts.delayed],
        ["suspended", counts.suspended],
      ];
      const status = statusCounts.sort(
        (a, b) => b[1] - a[1] || STATUS_PRIORITY[b[0]] - STATUS_PRIORITY[a[0]],
      )[0][0];
      const updatedAt = lineReports.reduce(
        (latest, item) =>
          Date.parse(item.createdAt) > Date.parse(latest)
            ? item.createdAt
            : latest,
        lineReports[0].createdAt,
      );

      return {
        lineId,
        status,
        delayMinutes:
          status === "delayed"
            ? median(
                lineReports
                  .filter((item) => item.status === "delayed")
                  .map((item) => item.delayMinutes)
                  .filter((value): value is number => value !== null),
              )
            : null,
        voteCount: lineReports.length,
        counts,
        updatedAt,
      };
    })
    .sort((a, b) => a.lineId.localeCompare(b.lineId));
}
