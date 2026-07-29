import {
  SUSPENSION_ALERT_COOLDOWN_SECONDS,
} from "@/lib/communityPush";
import {
  redisCommand,
  redisConfiguration,
  type RedisConfiguration,
} from "@/server/redis";
import type { PushSubscriptionRecord } from "@/types/push";

const SUBSCRIPTIONS_KEY = "train-live-map:push-subscriptions:v1";
const SUBSCRIPTION_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const SUBSCRIPTION_TTL_SECONDS = 181 * 24 * 60 * 60;

interface StoredSubscription {
  member: string;
  record: PushSubscriptionRecord;
}

export interface PushSubscriptionStore {
  persistent: boolean;
  listActive(now?: number): Promise<StoredSubscription[]>;
  upsert(
    record: PushSubscriptionRecord,
    now?: number,
  ): Promise<void>;
  removeById(id: string): Promise<void>;
  claimLineAlert(lineId: string): Promise<boolean>;
}

function parseStoredSubscriptions(
  members: readonly string[],
): StoredSubscription[] {
  return members.flatMap((member) => {
    try {
      const record = JSON.parse(member) as PushSubscriptionRecord;
      if (
        !record ||
        typeof record.id !== "string" ||
        typeof record.subscription?.endpoint !== "string" ||
        !Array.isArray(record.lineIds) ||
        typeof record.updatedAt !== "string"
      ) {
        return [];
      }
      return [{ member, record }];
    } catch {
      return [];
    }
  });
}

class RedisPushSubscriptionStore implements PushSubscriptionStore {
  public readonly persistent = true;

  constructor(private readonly config: RedisConfiguration) {}

  async listActive(now = Date.now()): Promise<StoredSubscription[]> {
    const cutoff = now - SUBSCRIPTION_RETENTION_MS;
    const members = await redisCommand<string[]>(this.config, [
      "ZRANGEBYSCORE",
      SUBSCRIPTIONS_KEY,
      cutoff,
      "+inf",
    ]);
    return parseStoredSubscriptions(members ?? []);
  }

  async upsert(
    record: PushSubscriptionRecord,
    now = Date.now(),
  ): Promise<void> {
    await this.removeById(record.id);
    const member = JSON.stringify(record);
    await redisCommand<number>(this.config, [
      "ZADD",
      SUBSCRIPTIONS_KEY,
      now,
      member,
    ]);
    await redisCommand<number>(this.config, [
      "ZREMRANGEBYSCORE",
      SUBSCRIPTIONS_KEY,
      "-inf",
      now - SUBSCRIPTION_RETENTION_MS,
    ]);
    await redisCommand<number>(this.config, [
      "EXPIRE",
      SUBSCRIPTIONS_KEY,
      SUBSCRIPTION_TTL_SECONDS,
    ]);
  }

  async removeById(id: string): Promise<void> {
    const active = await this.listActive();
    const targets = active.filter((item) => item.record.id === id);
    for (const target of targets) {
      await redisCommand<number>(this.config, [
        "ZREM",
        SUBSCRIPTIONS_KEY,
        target.member,
      ]);
    }
  }

  async claimLineAlert(lineId: string): Promise<boolean> {
    const result = await redisCommand<string | null>(this.config, [
      "SET",
      `${SUBSCRIPTIONS_KEY}:alert:${lineId}`,
      "1",
      "NX",
      "EX",
      SUSPENSION_ALERT_COOLDOWN_SECONDS,
    ]);
    return result === "OK";
  }
}

interface MemoryState {
  subscriptions: StoredSubscription[];
  alertCooldowns: Map<string, number>;
}

const memoryGlobal = globalThis as typeof globalThis & {
  __trainLiveMapPushSubscriptions?: MemoryState;
};

function memoryState(): MemoryState {
  if (!memoryGlobal.__trainLiveMapPushSubscriptions) {
    memoryGlobal.__trainLiveMapPushSubscriptions = {
      subscriptions: [],
      alertCooldowns: new Map(),
    };
  }
  return memoryGlobal.__trainLiveMapPushSubscriptions;
}

class MemoryPushSubscriptionStore implements PushSubscriptionStore {
  public readonly persistent = false;

  async listActive(now = Date.now()): Promise<StoredSubscription[]> {
    const state = memoryState();
    const cutoff = now - SUBSCRIPTION_RETENTION_MS;
    state.subscriptions = state.subscriptions.filter(
      (item) => Date.parse(item.record.updatedAt) >= cutoff,
    );
    return [...state.subscriptions];
  }

  async upsert(
    record: PushSubscriptionRecord,
    now = Date.now(),
  ): Promise<void> {
    await this.removeById(record.id);
    const state = memoryState();
    const member = JSON.stringify(record);
    state.subscriptions.push({ member, record });
    await this.listActive(now);
  }

  async removeById(id: string): Promise<void> {
    const state = memoryState();
    state.subscriptions = state.subscriptions.filter(
      (item) => item.record.id !== id,
    );
  }

  async claimLineAlert(lineId: string): Promise<boolean> {
    const state = memoryState();
    const now = Date.now();
    const expiresAt = state.alertCooldowns.get(lineId) ?? 0;
    if (expiresAt > now) return false;
    state.alertCooldowns.set(
      lineId,
      now + SUSPENSION_ALERT_COOLDOWN_SECONDS * 1000,
    );
    return true;
  }
}

export function getPushSubscriptionStore(): PushSubscriptionStore {
  const config = redisConfiguration();
  return config
    ? new RedisPushSubscriptionStore(config)
    : new MemoryPushSubscriptionStore();
}
