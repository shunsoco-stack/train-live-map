import { randomUUID } from "node:crypto";
import {
  COMMUNITY_REPORT_COOLDOWN_SECONDS,
  COMMUNITY_REPORT_WINDOW_MS,
} from "@/lib/communityReports";
import {
  COMMUNITY_COMMON_GLOBAL_RATE_MAX_REPORTS,
  COMMUNITY_COMMON_LINE_RATE_WINDOW_SECONDS,
  COMMUNITY_IP_LINE_RATE_WINDOW_SECONDS,
  COMMUNITY_SOURCE_RATE_MAX_REPORTS,
  COMMUNITY_SOURCE_RATE_WINDOW_SECONDS,
  MemoryCommunityRateLimiter,
  type CommunitySubmissionRateLimitInput,
  type CommunitySubmissionRateLimitResult,
} from "@/lib/communityRateLimit";
import {
  redisCommand,
  redisConfiguration,
  type RedisConfiguration,
} from "@/server/redis";
import type { CommunityReportRecord } from "@/types/community";

export {
  COMMUNITY_COMMON_LINE_RATE_WINDOW_SECONDS,
  COMMUNITY_IP_LINE_RATE_WINDOW_SECONDS,
  COMMUNITY_SOURCE_RATE_WINDOW_SECONDS,
} from "@/lib/communityRateLimit";

const REPORTS_KEY = "train-live-map:community-reports:v1";
const REPORTS_TTL_SECONDS = 60 * 60;
const MAX_STORED_REPORTS = 20_000;
interface StoredReport {
  member: string;
  record: CommunityReportRecord;
}

export interface CommunityReportStore {
  persistent: boolean;
  listActive(now?: number): Promise<StoredReport[]>;
  claimSubmissionRateLimit(
    input: CommunitySubmissionRateLimitInput,
  ): Promise<CommunitySubmissionRateLimitResult>;
  save(report: CommunityReportRecord, now?: number): Promise<void>;
}

function parseStoredReports(members: readonly string[]): StoredReport[] {
  return members.flatMap((member) => {
    try {
      const record = JSON.parse(member) as CommunityReportRecord;
      if (
        !record ||
        typeof record.lineId !== "string" ||
        typeof record.reporterHash !== "string" ||
        (record.reporterIpHash !== undefined &&
          typeof record.reporterIpHash !== "string") ||
        (record.sourceHash !== undefined &&
          typeof record.sourceHash !== "string") ||
        typeof record.createdAt !== "string"
      ) {
        return [];
      }
      return [{ member, record }];
    } catch {
      return [];
    }
  });
}

class RedisCommunityReportStore implements CommunityReportStore {
  public readonly persistent = true;
  private readonly config: RedisConfiguration;

  constructor(config: RedisConfiguration) {
    this.config = config;
  }

  async listActive(now = Date.now()): Promise<StoredReport[]> {
    const cutoff = now - COMMUNITY_REPORT_WINDOW_MS;
    const members = await redisCommand<string[]>(this.config, [
      "ZRANGEBYSCORE",
      REPORTS_KEY,
      cutoff,
      "+inf",
    ]);
    return parseStoredReports(members ?? []);
  }

  async claimSubmissionRateLimit({
    reporterHash,
    reporterIpHash,
    lineId,
    commonBucket,
    now = Date.now(),
  }: CommunitySubmissionRateLimitInput): Promise<CommunitySubmissionRateLimitResult> {
    const reporterKey = `${REPORTS_KEY}:rate:reporter:${reporterHash}:${lineId}`;
    const ipLineKey = `${REPORTS_KEY}:rate:ip-line:${reporterIpHash}:${lineId}`;
    const ipGlobalKey = `${REPORTS_KEY}:rate:ip-global:${reporterIpHash}`;
    const cutoff = now - COMMUNITY_SOURCE_RATE_WINDOW_SECONDS * 1000;
    const lineWindow = commonBucket
      ? COMMUNITY_COMMON_LINE_RATE_WINDOW_SECONDS
      : COMMUNITY_IP_LINE_RATE_WINDOW_SECONDS;
    const globalMaximum = commonBucket
      ? COMMUNITY_COMMON_GLOBAL_RATE_MAX_REPORTS
      : COMMUNITY_SOURCE_RATE_MAX_REPORTS;
    const script = [
      "if redis.call('EXISTS', KEYS[1]) == 1 then return 1 end",
      "if redis.call('EXISTS', KEYS[2]) == 1 then return 2 end",
      "redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', ARGV[1])",
      "local count = redis.call('ZCARD', KEYS[3])",
      "if count >= tonumber(ARGV[2]) then return 3 end",
      "redis.call('SET', KEYS[1], '1', 'EX', ARGV[5])",
      "redis.call('SET', KEYS[2], '1', 'EX', ARGV[6])",
      "redis.call('ZADD', KEYS[3], ARGV[3], ARGV[4])",
      "redis.call('EXPIRE', KEYS[3], ARGV[7])",
      "return 0",
    ].join("; ");
    const result = await redisCommand<number>(this.config, [
      "EVAL",
      script,
      3,
      reporterKey,
      ipLineKey,
      ipGlobalKey,
      cutoff,
      globalMaximum,
      now,
      `${now}:${randomUUID()}`,
      COMMUNITY_REPORT_COOLDOWN_SECONDS,
      lineWindow,
      COMMUNITY_SOURCE_RATE_WINDOW_SECONDS + 5,
    ]);
    return (["allowed", "reporter", "ip-line", "ip-global"] as const)[
      result ?? 3
    ];
  }

  async save(
    report: CommunityReportRecord,
    now = Date.now(),
  ): Promise<void> {
    const active = await this.listActive(now);
    const previousMembers = active
      .filter(
        (item) =>
          item.record.reporterHash === report.reporterHash &&
          item.record.lineId === report.lineId,
      )
      .map((item) => item.member);
    for (const member of previousMembers) {
      await redisCommand<number>(this.config, [
        "ZREM",
        REPORTS_KEY,
        member,
      ]);
    }

    const member = JSON.stringify(report);
    await redisCommand<number>(this.config, [
      "ZADD",
      REPORTS_KEY,
      now,
      member,
    ]);
    await redisCommand<number>(this.config, [
      "ZREMRANGEBYSCORE",
      REPORTS_KEY,
      "-inf",
      now - COMMUNITY_REPORT_WINDOW_MS,
    ]);
    await redisCommand<number>(this.config, [
      "ZREMRANGEBYRANK",
      REPORTS_KEY,
      0,
      -(MAX_STORED_REPORTS + 1),
    ]);
    await redisCommand<number>(this.config, [
      "EXPIRE",
      REPORTS_KEY,
      REPORTS_TTL_SECONDS,
    ]);
  }
}

interface MemoryState {
  reports: StoredReport[];
  rateLimiter: MemoryCommunityRateLimiter;
}

const memoryGlobal = globalThis as typeof globalThis & {
  __trainLiveMapCommunityReports?: MemoryState;
};

function memoryState(): MemoryState {
  if (!memoryGlobal.__trainLiveMapCommunityReports) {
    memoryGlobal.__trainLiveMapCommunityReports = {
      reports: [],
      rateLimiter: new MemoryCommunityRateLimiter(),
    };
  }
  return memoryGlobal.__trainLiveMapCommunityReports;
}

class MemoryCommunityReportStore implements CommunityReportStore {
  public readonly persistent = false;
  private readonly state: MemoryState;

  constructor(state: MemoryState = memoryState()) {
    this.state = state;
  }

  async listActive(now = Date.now()): Promise<StoredReport[]> {
    const state = this.state;
    const cutoff = now - COMMUNITY_REPORT_WINDOW_MS;
    state.reports = state.reports.filter(
      (item) => Date.parse(item.record.createdAt) >= cutoff,
    );
    return [...state.reports];
  }

  async claimSubmissionRateLimit({
    ...input
  }: CommunitySubmissionRateLimitInput): Promise<CommunitySubmissionRateLimitResult> {
    return this.state.rateLimiter.claim(input);
  }

  async save(
    report: CommunityReportRecord,
    now = Date.now(),
  ): Promise<void> {
    const state = this.state;
    await this.listActive(now);
    state.reports = state.reports.filter(
      (item) =>
        !(
          item.record.reporterHash === report.reporterHash &&
          item.record.lineId === report.lineId
        ),
    );
    const member = JSON.stringify(report);
    state.reports.push({ member, record: report });
    if (state.reports.length > MAX_STORED_REPORTS) {
      state.reports = state.reports.slice(-MAX_STORED_REPORTS);
    }
  }
}

export function createMemoryCommunityReportStore(): CommunityReportStore {
  return new MemoryCommunityReportStore({
    reports: [],
    rateLimiter: new MemoryCommunityRateLimiter(),
  });
}

export function getCommunityReportStore(): CommunityReportStore {
  const config = redisConfiguration();
  return config
    ? new RedisCommunityReportStore(config)
    : new MemoryCommunityReportStore();
}
