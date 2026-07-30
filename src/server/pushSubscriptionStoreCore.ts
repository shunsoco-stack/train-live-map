import type { PushSubscriptionRecord } from "../types/push.ts";

/**
 * v1 はJSON全体をmemberにしたZSETであり、Hashとして再利用できない。
 * 自動移行は行わず、新規保存・再保存された購読をv2へ格納する。
 */
export const PUSH_SUBSCRIPTIONS_KEY =
  "train-live-map:push-subscriptions:v2";
export const PUSH_SUBSCRIPTION_RETENTION_MS =
  180 * 24 * 60 * 60 * 1000;
export const PUSH_SUBSCRIPTION_TTL_SECONDS =
  181 * 24 * 60 * 60;
export const MAX_PUSH_SUBSCRIPTIONS = 50_000;

const CLEANUP_BATCH_SIZE = 500;
const UPSERT_SUBSCRIPTION_SCRIPT = `
local exists = redis.call("HEXISTS", KEYS[1], ARGV[1])
if exists == 0 and redis.call("HLEN", KEYS[1]) >= tonumber(ARGV[3]) then
  return 0
end
redis.call("HSET", KEYS[1], ARGV[1], ARGV[2])
redis.call("EXPIRE", KEYS[1], tonumber(ARGV[4]))
return 1
`.trim();

export interface StoredSubscription {
  member: string;
  record: PushSubscriptionRecord;
}

export type PushSubscriptionUpsertResult =
  | "saved"
  | "capacity";

export interface RedisCommandExecutor {
  <T>(command: Array<string | number>): Promise<T>;
}

interface StoreOptions {
  key?: string;
  maxSubscriptions?: number;
}

function parseStoredSubscription(
  id: string,
  member: string,
): StoredSubscription | null {
  try {
    const record = JSON.parse(member) as PushSubscriptionRecord;
    if (
      !record ||
      record.id !== id ||
      typeof record.subscription?.endpoint !== "string" ||
      !Array.isArray(record.lineIds) ||
      record.lineIds.some((lineId) => typeof lineId !== "string") ||
      typeof record.createdAt !== "string" ||
      typeof record.updatedAt !== "string"
    ) {
      return null;
    }
    return { member, record };
  } catch {
    return null;
  }
}

export class RedisPushSubscriptionDataStore {
  private readonly execute: RedisCommandExecutor;
  private readonly key: string;
  private readonly maxSubscriptions: number;

  constructor(
    execute: RedisCommandExecutor,
    options: StoreOptions = {},
  ) {
    this.execute = execute;
    this.key = options.key ?? PUSH_SUBSCRIPTIONS_KEY;
    this.maxSubscriptions =
      options.maxSubscriptions ?? MAX_PUSH_SUBSCRIPTIONS;
  }

  async listActive(now = Date.now()): Promise<StoredSubscription[]> {
    const values =
      (await this.execute<string[] | null>([
        "HGETALL",
        this.key,
      ])) ?? [];
    const cutoff = now - PUSH_SUBSCRIPTION_RETENTION_MS;
    const active: StoredSubscription[] = [];
    const cleanupIds = new Set<string>();

    for (let index = 0; index < values.length; index += 2) {
      const id = values[index];
      const member = values[index + 1];
      if (typeof id !== "string" || typeof member !== "string") {
        if (typeof id === "string") cleanupIds.add(id);
        continue;
      }

      const stored = parseStoredSubscription(id, member);
      const updatedAt = stored
        ? Date.parse(stored.record.updatedAt)
        : Number.NaN;
      if (
        !stored ||
        !Number.isFinite(updatedAt) ||
        updatedAt < cutoff
      ) {
        cleanupIds.add(id);
        continue;
      }
      active.push(stored);
    }

    const ids = [...cleanupIds];
    for (
      let index = 0;
      index < ids.length;
      index += CLEANUP_BATCH_SIZE
    ) {
      await this.execute<number>([
        "HDEL",
        this.key,
        ...ids.slice(index, index + CLEANUP_BATCH_SIZE),
      ]);
    }
    return active;
  }

  async getById(
    id: string,
  ): Promise<PushSubscriptionRecord | null> {
    const member = await this.execute<string | null>([
      "HGET",
      this.key,
      id,
    ]);
    if (typeof member !== "string") return null;

    const stored = parseStoredSubscription(id, member);
    if (stored) return stored.record;

    await this.execute<number>(["HDEL", this.key, id]);
    return null;
  }

  async upsert(
    record: PushSubscriptionRecord,
  ): Promise<PushSubscriptionUpsertResult> {
    const result = await this.execute<number>([
      "EVAL",
      UPSERT_SUBSCRIPTION_SCRIPT,
      1,
      this.key,
      record.id,
      JSON.stringify(record),
      this.maxSubscriptions,
      PUSH_SUBSCRIPTION_TTL_SECONDS,
    ]);
    return result === 1 ? "saved" : "capacity";
  }

  async removeById(id: string): Promise<void> {
    await this.execute<number>(["HDEL", this.key, id]);
  }
}

export class MemoryPushSubscriptionDataStore {
  private readonly subscriptions: Map<string, StoredSubscription>;
  private readonly maxSubscriptions: number;

  constructor(
    subscriptions = new Map<
      string,
      StoredSubscription
    >(),
    maxSubscriptions = MAX_PUSH_SUBSCRIPTIONS,
  ) {
    this.subscriptions = subscriptions;
    this.maxSubscriptions = maxSubscriptions;
  }

  async listActive(now = Date.now()): Promise<StoredSubscription[]> {
    const cutoff = now - PUSH_SUBSCRIPTION_RETENTION_MS;
    const active: StoredSubscription[] = [];

    for (const [id, stored] of this.subscriptions) {
      const updatedAt = Date.parse(stored.record.updatedAt);
      if (!Number.isFinite(updatedAt) || updatedAt < cutoff) {
        this.subscriptions.delete(id);
        continue;
      }
      active.push(stored);
    }
    return active;
  }

  async getById(
    id: string,
  ): Promise<PushSubscriptionRecord | null> {
    return this.subscriptions.get(id)?.record ?? null;
  }

  async upsert(
    record: PushSubscriptionRecord,
  ): Promise<PushSubscriptionUpsertResult> {
    if (
      !this.subscriptions.has(record.id) &&
      this.subscriptions.size >= this.maxSubscriptions
    ) {
      return "capacity";
    }
    const member = JSON.stringify(record);
    this.subscriptions.set(record.id, { member, record });
    return "saved";
  }

  async removeById(id: string): Promise<void> {
    this.subscriptions.delete(id);
  }

  size(): number {
    return this.subscriptions.size;
  }
}
