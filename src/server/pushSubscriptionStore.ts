import { randomUUID } from "node:crypto";
import { SUSPENSION_ALERT_COOLDOWN_SECONDS } from "@/lib/communityPush";
import {
  claimSlidingWindowRateLimit,
  MemoryPushSubscriptionRegistry,
} from "@/lib/pushSubscriptionRegistry";
import {
  redisCommand,
  redisConfiguration,
  type RedisConfiguration,
} from "@/server/redis";
import type { PushSubscriptionRecord } from "@/types/push";

const LEGACY_SUBSCRIPTIONS_KEY = "train-live-map:push-subscriptions:v1";
const SUBSCRIPTIONS_KEY = "train-live-map:push-subscriptions:v2";
const SUBSCRIPTIONS_HASH_KEY = `${SUBSCRIPTIONS_KEY}:records`;
const SUBSCRIPTIONS_INDEX_KEY = `${SUBSCRIPTIONS_KEY}:updated`;
const MIGRATION_MARKER_KEY = `${SUBSCRIPTIONS_KEY}:migration-complete`;
const SUBSCRIPTION_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const SUBSCRIPTION_TTL_SECONDS = 181 * 24 * 60 * 60;
const MIGRATION_BATCH_SIZE = 100;
export const MAX_STORED_PUSH_SUBSCRIPTIONS = 50_000;
export const PUSH_MUTATION_RATE_WINDOW_SECONDS = 10 * 60;
export const PUSH_MUTATION_RATE_MAX_REQUESTS = 5;

export interface StoredSubscription {
  member: string;
  record: PushSubscriptionRecord;
}

export interface PushSubscriptionStore {
  persistent: boolean;
  listActive(now?: number): Promise<StoredSubscription[]>;
  getById(id: string, now?: number): Promise<PushSubscriptionRecord | null>;
  upsert(record: PushSubscriptionRecord, now?: number): Promise<boolean>;
  removeById(id: string): Promise<void>;
  claimLineAlert(lineId: string): Promise<boolean>;
  claimMutationRateLimit(sourceHash: string, now?: number): Promise<boolean>;
}

function parseStoredRecord(value: string): PushSubscriptionRecord | null {
  try {
    const record = JSON.parse(value) as PushSubscriptionRecord;
    if (
      !record ||
      typeof record.id !== "string" ||
      typeof record.subscription?.endpoint !== "string" ||
      !Array.isArray(record.lineIds) ||
      typeof record.createdAt !== "string" ||
      typeof record.updatedAt !== "string"
    ) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

function parseLegacyMembers(members: readonly string[]): PushSubscriptionRecord[] {
  return members.flatMap((member) => {
    const record = parseStoredRecord(member);
    return record ? [record] : [];
  });
}

function hashEntries(value: unknown): Array<[string, string]> {
  if (Array.isArray(value)) {
    const entries: Array<[string, string]> = [];
    for (let index = 0; index + 1 < value.length; index += 2) {
      if (typeof value[index] === "string" && typeof value[index + 1] === "string") {
        entries.push([value[index], value[index + 1]]);
      }
    }
    return entries;
  }
  if (value && typeof value === "object") {
    return Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
  }
  return [];
}

async function batchedDelete(
  config: RedisConfiguration,
  ids: readonly string[],
): Promise<void> {
  for (let index = 0; index < ids.length; index += MIGRATION_BATCH_SIZE) {
    const batch = ids.slice(index, index + MIGRATION_BATCH_SIZE);
    await redisCommand<number>(config, ["HDEL", SUBSCRIPTIONS_HASH_KEY, ...batch]);
    await redisCommand<number>(config, ["ZREM", SUBSCRIPTIONS_INDEX_KEY, ...batch]);
  }
}

class RedisPushSubscriptionStore implements PushSubscriptionStore {
  public readonly persistent = true;
  private readonly config: RedisConfiguration;

  constructor(config: RedisConfiguration) {
    this.config = config;
  }

  private async ensureMigrated(now = Date.now()): Promise<void> {
    const complete = await redisCommand<number>(this.config, ["EXISTS", MIGRATION_MARKER_KEY]);
    if (complete === 1) return;

    const claimed = await redisCommand<string | null>(this.config, [
      "SET", MIGRATION_MARKER_KEY, "in-progress", "NX", "EX", 60,
    ]);
    if (claimed !== "OK") return;

    try {
      const members = await redisCommand<string[]>(this.config, [
        "ZRANGEBYSCORE",
        LEGACY_SUBSCRIPTIONS_KEY,
        now - SUBSCRIPTION_RETENTION_MS,
        "+inf",
      ]);
      const records = parseLegacyMembers(members ?? []).slice(
        -MAX_STORED_PUSH_SUBSCRIPTIONS,
      );
      for (let index = 0; index < records.length; index += MIGRATION_BATCH_SIZE) {
        const batch = records.slice(index, index + MIGRATION_BATCH_SIZE);
        await redisCommand<number>(this.config, [
          "HSET",
          SUBSCRIPTIONS_HASH_KEY,
          ...batch.flatMap((record) => [record.id, JSON.stringify(record)]),
        ]);
        await redisCommand<number>(this.config, [
          "ZADD",
          SUBSCRIPTIONS_INDEX_KEY,
          ...batch.flatMap((record) => [Date.parse(record.updatedAt) || now, record.id]),
        ]);
      }
      if (records.length > 0) {
        await redisCommand<number>(this.config, ["EXPIRE", SUBSCRIPTIONS_HASH_KEY, SUBSCRIPTION_TTL_SECONDS]);
        await redisCommand<number>(this.config, ["EXPIRE", SUBSCRIPTIONS_INDEX_KEY, SUBSCRIPTION_TTL_SECONDS]);
      }
      await redisCommand<string>(this.config, ["SET", MIGRATION_MARKER_KEY, "done"]);
    } catch (error) {
      await redisCommand<number>(this.config, ["DEL", MIGRATION_MARKER_KEY]);
      throw error;
    }
  }

  private async purgeExpired(now: number): Promise<void> {
    const expired = await redisCommand<string[]>(this.config, [
      "ZRANGEBYSCORE",
      SUBSCRIPTIONS_INDEX_KEY,
      "-inf",
      now - SUBSCRIPTION_RETENTION_MS,
    ]);
    if ((expired?.length ?? 0) > 0) await batchedDelete(this.config, expired);
  }

  async listActive(now = Date.now()): Promise<StoredSubscription[]> {
    await this.ensureMigrated(now);
    await this.purgeExpired(now);
    const raw = await redisCommand<unknown>(this.config, ["HGETALL", SUBSCRIPTIONS_HASH_KEY]);
    const cutoff = now - SUBSCRIPTION_RETENTION_MS;
    return hashEntries(raw).flatMap(([, member]) => {
      const record = parseStoredRecord(member);
      return record && Date.parse(record.updatedAt) >= cutoff
        ? [{ member, record }]
        : [];
    });
  }

  async getById(id: string, now = Date.now()): Promise<PushSubscriptionRecord | null> {
    await this.ensureMigrated(now);
    const member = await redisCommand<string | null>(this.config, ["HGET", SUBSCRIPTIONS_HASH_KEY, id]);
    if (!member) return null;
    const record = parseStoredRecord(member);
    if (!record || Date.parse(record.updatedAt) < now - SUBSCRIPTION_RETENTION_MS) {
      await this.removeById(id);
      return null;
    }
    return record;
  }

  async upsert(record: PushSubscriptionRecord, now = Date.now()): Promise<boolean> {
    await this.ensureMigrated(now);
    const script = [
      "local exists = redis.call('HEXISTS', KEYS[1], ARGV[1])",
      "if exists == 0 and redis.call('HLEN', KEYS[1]) >= tonumber(ARGV[4]) then return 0 end",
      "redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])",
      "redis.call('ZADD', KEYS[2], ARGV[3], ARGV[1])",
      "redis.call('EXPIRE', KEYS[1], ARGV[5])",
      "redis.call('EXPIRE', KEYS[2], ARGV[5])",
      "return 1",
    ].join("; ");
    const saved = await redisCommand<number>(this.config, [
      "EVAL", script, 2, SUBSCRIPTIONS_HASH_KEY, SUBSCRIPTIONS_INDEX_KEY,
      record.id, JSON.stringify(record), now, MAX_STORED_PUSH_SUBSCRIPTIONS,
      SUBSCRIPTION_TTL_SECONDS,
    ]);
    return saved === 1;
  }

  async removeById(id: string): Promise<void> {
    await this.ensureMigrated();
    await redisCommand<number>(this.config, ["HDEL", SUBSCRIPTIONS_HASH_KEY, id]);
    await redisCommand<number>(this.config, ["ZREM", SUBSCRIPTIONS_INDEX_KEY, id]);
  }

  async claimLineAlert(lineId: string): Promise<boolean> {
    const result = await redisCommand<string | null>(this.config, [
      "SET", `${SUBSCRIPTIONS_KEY}:alert:${lineId}`, "1", "NX", "EX",
      SUSPENSION_ALERT_COOLDOWN_SECONDS,
    ]);
    return result === "OK";
  }

  async claimMutationRateLimit(sourceHash: string, now = Date.now()): Promise<boolean> {
    const key = `${SUBSCRIPTIONS_KEY}:mutation-rate:${sourceHash}`;
    const cutoff = now - PUSH_MUTATION_RATE_WINDOW_SECONDS * 1000;
    const script = [
      "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])",
      "local count = redis.call('ZCARD', KEYS[1])",
      "if count >= tonumber(ARGV[2]) then return 0 end",
      "redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])",
      "redis.call('EXPIRE', KEYS[1], ARGV[5])",
      "return 1",
    ].join("; ");
    const allowed = await redisCommand<number>(this.config, [
      "EVAL", script, 1, key, cutoff, PUSH_MUTATION_RATE_MAX_REQUESTS, now,
      `${now}:${randomUUID()}`, PUSH_MUTATION_RATE_WINDOW_SECONDS + 5,
    ]);
    return allowed === 1;
  }
}

interface MemoryState {
  registry: MemoryPushSubscriptionRegistry<PushSubscriptionRecord>;
  alertCooldowns: Map<string, number>;
  mutationRateLimits: Map<string, number[]>;
}

const memoryGlobal = globalThis as typeof globalThis & {
  __trainLiveMapPushSubscriptions?: MemoryState;
};

function createMemoryState(): MemoryState {
  return {
    registry: new MemoryPushSubscriptionRegistry(MAX_STORED_PUSH_SUBSCRIPTIONS),
    alertCooldowns: new Map(),
    mutationRateLimits: new Map(),
  };
}

function memoryState(): MemoryState {
  memoryGlobal.__trainLiveMapPushSubscriptions ??= createMemoryState();
  return memoryGlobal.__trainLiveMapPushSubscriptions;
}

class MemoryPushSubscriptionStore implements PushSubscriptionStore {
  public readonly persistent = false;
  private readonly state: MemoryState;

  constructor(state: MemoryState = memoryState()) {
    this.state = state;
  }

  async listActive(now = Date.now()): Promise<StoredSubscription[]> {
    return this.state.registry
      .listActive(now - SUBSCRIPTION_RETENTION_MS)
      .map((record) => ({ member: JSON.stringify(record), record }));
  }

  async getById(id: string, now = Date.now()): Promise<PushSubscriptionRecord | null> {
    const record = this.state.registry.get(id);
    if (!record) return null;
    if (Date.parse(record.updatedAt) < now - SUBSCRIPTION_RETENTION_MS) {
      this.state.registry.remove(id);
      return null;
    }
    return record;
  }

  async upsert(record: PushSubscriptionRecord): Promise<boolean> {
    return this.state.registry.upsert(record);
  }

  async removeById(id: string): Promise<void> {
    this.state.registry.remove(id);
  }

  async claimLineAlert(lineId: string): Promise<boolean> {
    const now = Date.now();
    const expiresAt = this.state.alertCooldowns.get(lineId) ?? 0;
    if (expiresAt > now) return false;
    this.state.alertCooldowns.set(lineId, now + SUSPENSION_ALERT_COOLDOWN_SECONDS * 1000);
    return true;
  }

  async claimMutationRateLimit(sourceHash: string, now = Date.now()): Promise<boolean> {
    const result = claimSlidingWindowRateLimit(
      this.state.mutationRateLimits.get(sourceHash) ?? [],
      now,
      PUSH_MUTATION_RATE_WINDOW_SECONDS * 1000,
      PUSH_MUTATION_RATE_MAX_REQUESTS,
    );
    this.state.mutationRateLimits.set(sourceHash, result.timestamps);
    return result.allowed;
  }
}

export function createMemoryPushSubscriptionStore(): PushSubscriptionStore {
  return new MemoryPushSubscriptionStore(createMemoryState());
}

export function getPushSubscriptionStore(): PushSubscriptionStore {
  const config = redisConfiguration();
  return config ? new RedisPushSubscriptionStore(config) : new MemoryPushSubscriptionStore();
}
