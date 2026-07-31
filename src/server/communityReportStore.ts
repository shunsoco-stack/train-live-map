import { randomUUID } from "node:crypto";
import {
  COMMUNITY_REPORT_COOLDOWN_SECONDS,
  COMMUNITY_REPORT_WINDOW_MS,
} from "@/lib/communityReports";
import {
  redisCommand,
  redisConfiguration,
  type RedisConfiguration,
} from "@/server/redis";
import type { CommunityReportRecord } from "@/types/community";

const REPORTS_KEY = "train-live-map:community-reports:v1";
const REPORTS_TTL_SECONDS = 60 * 60;
const MAX_STORED_REPORTS = 20_000;
export const COMMUNITY_SOURCE_RATE_WINDOW_SECONDS = 5 * 60;
export const COMMUNITY_SOURCE_RATE_MAX_REPORTS = 2;

interface StoredReport {
  member: string;
  record: CommunityReportRecord;
}

export interface CommunityReportStore {
  persistent: boolean;
  listActive(now?: number): Promise<StoredReport[]>;
  claimRateLimit(
    reporterHash: string,
    lineId: string,
  ): Promise<boolean>;
  claimSourceRateLimit(sourceHash: string, now?: number): Promise<boolean>;
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

  constructor(private readonly config: RedisConfiguration) {}

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

  async claimRateLimit(
    reporterHash: string,
    lineId: string,
  ): Promise<boolean> {
    const result = await redisCommand<string | null>(this.config, [
      "SET",
      `${REPORTS_KEY}:rate:${reporterHash}:${lineId}`,
      "1",
      "NX",
      "EX",
      COMMUNITY_REPORT_COOLDOWN_SECONDS,
    ]);
    return result === "OK";
  }

  async claimSourceRateLimit(
    sourceHash: string,
    now = Date.now(),
  ): Promise<boolean> {
    const key = `${REPORTS_KEY}:source-rate:${sourceHash}`;
    const cutoff = now - COMMUNITY_SOURCE_RATE_WINDOW_SECONDS * 1000;
    const script = [
      "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])",
      "local count = redis.call('ZCARD', KEYS[1])",
      "if count >= tonumber(ARGV[2]) then return 0 end",
      "redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])",
      "redis.call('EXPIRE', KEYS[1], ARGV[5])",
      "return 1",
    ].join("; ");
    const allowed = await redisCommand<number>(this.config, [
      "EVAL",
      script,
      1,
      key,
      cutoff,
      COMMUNITY_SOURCE_RATE_MAX_REPORTS,
      now,
      `${now}:${randomUUID()}`,
      COMMUNITY_SOURCE_RATE_WINDOW_SECONDS + 5,
    ]);
    return allowed === 1;
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
  rateLimits: Map<string, number>;
  sourceRateLimits: Map<string, number[]>;
}

const memoryGlobal = globalThis as typeof globalThis & {
  __trainLiveMapCommunityReports?: MemoryState;
};

function memoryState(): MemoryState {
  if (!memoryGlobal.__trainLiveMapCommunityReports) {
    memoryGlobal.__trainLiveMapCommunityReports = {
      reports: [],
      rateLimits: new Map(),
      sourceRateLimits: new Map(),
    };
  }
  return memoryGlobal.__trainLiveMapCommunityReports;
}

class MemoryCommunityReportStore implements CommunityReportStore {
  public readonly persistent = false;

  async listActive(now = Date.now()): Promise<StoredReport[]> {
    const state = memoryState();
    const cutoff = now - COMMUNITY_REPORT_WINDOW_MS;
    state.reports = state.reports.filter(
      (item) => Date.parse(item.record.createdAt) >= cutoff,
    );
    return [...state.reports];
  }

  async claimRateLimit(
    reporterHash: string,
    lineId: string,
  ): Promise<boolean> {
    const state = memoryState();
    const key = `${reporterHash}:${lineId}`;
    const now = Date.now();
    const expiresAt = state.rateLimits.get(key) ?? 0;
    if (expiresAt > now) return false;
    state.rateLimits.set(
      key,
      now + COMMUNITY_REPORT_COOLDOWN_SECONDS * 1000,
    );
    return true;
  }

  async claimSourceRateLimit(
    sourceHash: string,
    now = Date.now(),
  ): Promise<boolean> {
    const state = memoryState();
    const cutoff = now - COMMUNITY_SOURCE_RATE_WINDOW_SECONDS * 1000;
    const active = (state.sourceRateLimits.get(sourceHash) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );
    if (active.length >= COMMUNITY_SOURCE_RATE_MAX_REPORTS) {
      state.sourceRateLimits.set(sourceHash, active);
      return false;
    }
    active.push(now);
    state.sourceRateLimits.set(sourceHash, active);
    return true;
  }

  async save(
    report: CommunityReportRecord,
    now = Date.now(),
  ): Promise<void> {
    const state = memoryState();
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

export function getCommunityReportStore(): CommunityReportStore {
  const config = redisConfiguration();
  return config
    ? new RedisCommunityReportStore(config)
    : new MemoryCommunityReportStore();
}
