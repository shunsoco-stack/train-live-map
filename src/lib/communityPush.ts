import type { CommunityReportRecord } from "@/types/community";

export const SUSPENSION_SPIKE_WINDOW_MS = 5 * 60 * 1000;
export const SUSPENSION_SPIKE_MIN_REPORTS = 3;
export const SUSPENSION_SPIKE_MIN_SHARE = 0.6;
export const SUSPENSION_ALERT_COOLDOWN_SECONDS = 30 * 60;

export interface SuspensionSpikeResult {
  detected: boolean;
  recentSuspended: number;
  recentTotal: number;
  previousSuspended: number;
  requiredSuspended: number;
  suspendedShare: number;
}

function reportsInWindow(
  reports: readonly CommunityReportRecord[],
  lineId: string,
  fromExclusive: number,
  toInclusive: number,
): CommunityReportRecord[] {
  const latestByReporter = new Map<string, CommunityReportRecord>();

  for (const report of reports) {
    if (report.lineId !== lineId) continue;
    const createdAt = Date.parse(report.createdAt);
    if (
      !Number.isFinite(createdAt) ||
      createdAt <= fromExclusive ||
      createdAt > toInclusive
    ) {
      continue;
    }
    const sourceIdentity =
      report.reporterIpHash ?? report.sourceHash ?? report.reporterHash;
    const previous = latestByReporter.get(sourceIdentity);
    if (
      !previous ||
      Date.parse(previous.createdAt) < createdAt
    ) {
      latestByReporter.set(sourceIdentity, report);
    }
  }

  return [...latestByReporter.values()];
}

/**
 * 直近5分の見合わせ票が、最低件数・比率・直前5分からの増加幅を
 * すべて満たした場合だけ通知候補とする。
 */
export function detectSuspensionSpike(
  reports: readonly CommunityReportRecord[],
  lineId: string,
  now = Date.now(),
): SuspensionSpikeResult {
  const recent = reportsInWindow(
    reports,
    lineId,
    now - SUSPENSION_SPIKE_WINDOW_MS,
    now,
  );
  const previous = reportsInWindow(
    reports,
    lineId,
    now - SUSPENSION_SPIKE_WINDOW_MS * 2,
    now - SUSPENSION_SPIKE_WINDOW_MS,
  );
  const recentSuspended = recent.filter(
    (report) => report.status === "suspended",
  ).length;
  const previousSuspended = previous.filter(
    (report) => report.status === "suspended",
  ).length;
  const recentTotal = recent.length;
  const suspendedShare =
    recentTotal === 0 ? 0 : recentSuspended / recentTotal;
  const requiredSuspended = Math.max(
    SUSPENSION_SPIKE_MIN_REPORTS,
    previousSuspended * 2,
    previousSuspended + 2,
  );

  return {
    detected:
      recentSuspended >= requiredSuspended &&
      suspendedShare >= SUSPENSION_SPIKE_MIN_SHARE,
    recentSuspended,
    recentTotal,
    previousSuspended,
    requiredSuspended,
    suspendedShare,
  };
}

const PUSH_ENDPOINT_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
]);

/** 任意URLへのサーバー送信を防ぎ、既知のWeb Pushサービスだけを許可する。 */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    return (
      PUSH_ENDPOINT_HOSTS.has(url.hostname) ||
      url.hostname.endsWith(".push.apple.com") ||
      url.hostname.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}
