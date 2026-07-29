import {
  COMMUNITY_REPORT_COOLDOWN_SECONDS,
  COMMUNITY_REPORT_WINDOW_MS,
} from "@/lib/communityReports";
import type { CommunityReportRecord } from "@/types/community";

const REPORTS_KEY = "train-live-map:community-reports:v1";
const REPORTS_TTL_SECONDS = 60 * 60;

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
  save(report: CommunityReportRecord, now?: number): Promise<void>;
}

interface RedisResponse<T> {
  result: T;
}

function redisConfiguration(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redisCommand<T>(
  config: { url: string; token: string },
  command: Array<string | number>,
): Promise<T> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Redis request failed (${response.status})`);
  }
  const data = (await response.json()) as RedisResponse<T>;
  return data.result;
}

function parseStoredReports(members: readonly string[]): StoredReport[] {
  return members.flatMap((member) => {
    try {
      const record = JSON.parse(member) as CommunityReportRecord;
      if (
        !record ||
        typeof record.lineId !== "string" ||
        typeof record.reporterHash !== "string" ||
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

  constructor(private readonly config: { url: string; token: string }) {}

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
      "EXPIRE",
      REPORTS_KEY,
      REPORTS_TTL_SECONDS,
    ]);
  }
}

interface MemoryState {
  reports: StoredReport[];
  rateLimits: Map<string, number>;
}

const memoryGlobal = globalThis as typeof globalThis & {
  __trainLiveMapCommunityReports?: MemoryState;
};

function memoryState(): MemoryState {
  if (!memoryGlobal.__trainLiveMapCommunityReports) {
    memoryGlobal.__trainLiveMapCommunityReports = {
      reports: [],
      rateLimits: new Map(),
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
  }
}

export function getCommunityReportStore(): CommunityReportStore {
  const config = redisConfiguration();
  return config
    ? new RedisCommunityReportStore(config)
    : new MemoryCommunityReportStore();
}
