export const COMMUNITY_SOURCE_RATE_WINDOW_SECONDS = 5 * 60;
export const COMMUNITY_SOURCE_RATE_MAX_REPORTS = 10;
export const COMMUNITY_IP_LINE_RATE_WINDOW_SECONDS = 60;
export const COMMUNITY_COMMON_LINE_RATE_WINDOW_SECONDS = 120;
export const COMMUNITY_COMMON_GLOBAL_RATE_MAX_REPORTS = 3;
const REPORTER_COOLDOWN_SECONDS = 60;

export type CommunitySubmissionRateLimitResult =
  | "allowed"
  | "reporter"
  | "ip-line"
  | "ip-global";

export interface CommunitySubmissionRateLimitInput {
  reporterHash: string;
  reporterIpHash: string;
  lineId: string;
  commonBucket: boolean;
  now?: number;
}

/** Deterministic in-memory implementation used locally and in unit tests. */
export class MemoryCommunityRateLimiter {
  private readonly reporterRateLimits = new Map<string, number>();
  private readonly ipLineRateLimits = new Map<string, number>();
  private readonly ipGlobalRateLimits = new Map<string, number[]>();

  claim({
    reporterHash,
    reporterIpHash,
    lineId,
    commonBucket,
    now = Date.now(),
  }: CommunitySubmissionRateLimitInput): CommunitySubmissionRateLimitResult {
    const reporterKey = `${reporterHash}:${lineId}`;
    if ((this.reporterRateLimits.get(reporterKey) ?? 0) > now) {
      return "reporter";
    }

    const ipLineKey = `${reporterIpHash}:${lineId}`;
    if ((this.ipLineRateLimits.get(ipLineKey) ?? 0) > now) {
      return "ip-line";
    }

    const cutoff = now - COMMUNITY_SOURCE_RATE_WINDOW_SECONDS * 1000;
    const active = (this.ipGlobalRateLimits.get(reporterIpHash) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );
    const globalMaximum = commonBucket
      ? COMMUNITY_COMMON_GLOBAL_RATE_MAX_REPORTS
      : COMMUNITY_SOURCE_RATE_MAX_REPORTS;
    if (active.length >= globalMaximum) {
      this.ipGlobalRateLimits.set(reporterIpHash, active);
      return "ip-global";
    }

    const lineWindow = commonBucket
      ? COMMUNITY_COMMON_LINE_RATE_WINDOW_SECONDS
      : COMMUNITY_IP_LINE_RATE_WINDOW_SECONDS;
    this.reporterRateLimits.set(
      reporterKey,
      now + REPORTER_COOLDOWN_SECONDS * 1000,
    );
    this.ipLineRateLimits.set(ipLineKey, now + lineWindow * 1000);
    active.push(now);
    this.ipGlobalRateLimits.set(reporterIpHash, active);
    return "allowed";
  }
}
