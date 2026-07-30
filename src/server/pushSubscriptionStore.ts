import {
  SUSPENSION_ALERT_COOLDOWN_SECONDS,
} from "@/lib/communityPush";
import {
  redisCommand,
  redisConfiguration,
  type RedisConfiguration,
} from "@/server/redis";
import {
  MemoryPushSubscriptionDataStore,
  PUSH_SUBSCRIPTIONS_KEY,
  RedisPushSubscriptionDataStore,
  type PushSubscriptionUpsertResult,
  type RedisCommandExecutor,
  type StoredSubscription,
} from "@/server/pushSubscriptionStoreCore";
import type { PushSubscriptionRecord } from "@/types/push";

export interface PushSubscriptionStore {
  persistent: boolean;
  listActive(now?: number): Promise<StoredSubscription[]>;
  getById(id: string): Promise<PushSubscriptionRecord | null>;
  upsert(
    record: PushSubscriptionRecord,
  ): Promise<PushSubscriptionUpsertResult>;
  removeById(id: string): Promise<void>;
  claimLineAlert(lineId: string): Promise<boolean>;
}

class RedisPushSubscriptionStore implements PushSubscriptionStore {
  public readonly persistent = true;
  private readonly dataStore: RedisPushSubscriptionDataStore;

  constructor(private readonly config: RedisConfiguration) {
    const execute: RedisCommandExecutor = <T>(
      command: Array<string | number>,
    ) => redisCommand<T>(config, command);
    this.dataStore = new RedisPushSubscriptionDataStore(execute);
  }

  listActive(now = Date.now()): Promise<StoredSubscription[]> {
    return this.dataStore.listActive(now);
  }

  getById(id: string): Promise<PushSubscriptionRecord | null> {
    return this.dataStore.getById(id);
  }

  upsert(
    record: PushSubscriptionRecord,
  ): Promise<PushSubscriptionUpsertResult> {
    return this.dataStore.upsert(record);
  }

  removeById(id: string): Promise<void> {
    return this.dataStore.removeById(id);
  }

  async claimLineAlert(lineId: string): Promise<boolean> {
    const result = await redisCommand<string | null>(this.config, [
      "SET",
      `${PUSH_SUBSCRIPTIONS_KEY}:alert:${lineId}`,
      "1",
      "NX",
      "EX",
      SUSPENSION_ALERT_COOLDOWN_SECONDS,
    ]);
    return result === "OK";
  }
}

interface MemoryState {
  subscriptions: Map<string, StoredSubscription>;
  alertCooldowns: Map<string, number>;
}

const memoryGlobal = globalThis as typeof globalThis & {
  __trainLiveMapPushSubscriptionsV2?: MemoryState;
};

function memoryState(): MemoryState {
  if (!memoryGlobal.__trainLiveMapPushSubscriptionsV2) {
    memoryGlobal.__trainLiveMapPushSubscriptionsV2 = {
      subscriptions: new Map(),
      alertCooldowns: new Map(),
    };
  }
  return memoryGlobal.__trainLiveMapPushSubscriptionsV2;
}

class MemoryPushSubscriptionStore implements PushSubscriptionStore {
  public readonly persistent = false;
  private readonly dataStore: MemoryPushSubscriptionDataStore;

  constructor() {
    this.dataStore = new MemoryPushSubscriptionDataStore(
      memoryState().subscriptions,
    );
  }

  listActive(now = Date.now()): Promise<StoredSubscription[]> {
    return this.dataStore.listActive(now);
  }

  getById(id: string): Promise<PushSubscriptionRecord | null> {
    return this.dataStore.getById(id);
  }

  upsert(
    record: PushSubscriptionRecord,
  ): Promise<PushSubscriptionUpsertResult> {
    return this.dataStore.upsert(record);
  }

  removeById(id: string): Promise<void> {
    return this.dataStore.removeById(id);
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
