import assert from "node:assert/strict";
import test from "node:test";
import {
  claimMemoryIpRateLimit,
  createMemoryIpRateLimitState,
} from "./ipRateLimiter.ts";
import {
  MemoryPushSubscriptionDataStore,
  PUSH_SUBSCRIPTION_RETENTION_MS,
  RedisPushSubscriptionDataStore,
  type RedisCommandExecutor,
} from "./pushSubscriptionStoreCore.ts";
import type { PushSubscriptionRecord } from "../types/push.ts";

const NOW = Date.UTC(2026, 6, 31);

function record(
  id: string,
  overrides: Partial<PushSubscriptionRecord> = {},
): PushSubscriptionRecord {
  const timestamp = new Date(NOW).toISOString();
  return {
    id,
    subscription: {
      endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
      expirationTime: null,
      keys: {
        p256dh: "abcdefgh",
        auth: "abcdefgh",
      },
    },
    lineIds: ["tokaido"],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

test("メモリ版のupsertとremoveByIdはMapのID操作で置換する", async () => {
  const store = new MemoryPushSubscriptionDataStore();
  for (let index = 0; index < 1_000; index += 1) {
    assert.equal(
      await store.upsert(record(`id-${index}`)),
      "saved",
    );
  }

  assert.equal(store.size(), 1_000);
  assert.equal(
    await store.upsert(
      record("id-500", { lineIds: ["yamanote"] }),
    ),
    "saved",
  );
  assert.equal(store.size(), 1_000);
  assert.deepEqual(
    (await store.getById("id-500"))?.lineIds,
    ["yamanote"],
  );

  await store.removeById("id-500");
  assert.equal(store.size(), 999);
  assert.equal(await store.getById("id-500"), null);
});

test("上限では新規だけを拒否し既存購読の更新を許可する", async () => {
  const store = new MemoryPushSubscriptionDataStore(
    new Map(),
    2,
  );
  assert.equal(await store.upsert(record("first")), "saved");
  assert.equal(await store.upsert(record("second")), "saved");
  assert.equal(await store.upsert(record("third")), "capacity");
  assert.equal(
    await store.upsert(
      record("first", { lineIds: ["yamanote"] }),
    ),
    "saved",
  );
  assert.deepEqual(
    (await store.getById("first"))?.lineIds,
    ["yamanote"],
  );
});

test("Redis版の通常更新と削除は件数非依存の固定コマンドになる", async () => {
  const commands: Array<Array<string | number>> = [];
  const savedRecord = record("saved");
  const execute: RedisCommandExecutor = async <T>(
    command: Array<string | number>,
  ) => {
    commands.push(command);
    if (command[0] === "HGET") {
      return JSON.stringify(savedRecord) as T;
    }
    return 1 as T;
  };
  const store = new RedisPushSubscriptionDataStore(execute);

  assert.deepEqual(await store.getById("saved"), savedRecord);
  assert.equal(await store.upsert(savedRecord), "saved");
  await store.removeById("saved");

  assert.deepEqual(
    commands.map((command) => command[0]),
    ["HGET", "EVAL", "HDEL"],
  );
  assert.equal(commands[1][2], 1);
  assert.equal(commands[1][4], "saved");
  assert.equal(
    JSON.parse(String(commands[1][5])).id,
    "saved",
  );
  const script = String(commands[1][1]);
  assert.match(script, /HEXISTS/);
  assert.match(script, /HLEN/);
  assert.match(script, /HSET/);
  assert.equal(commands[1][6], 50_000);
});

test("Redis Hashの一覧取得時に期限切れと不正値をまとめて削除する", async () => {
  const active = record("active");
  const stale = record("stale", {
    updatedAt: new Date(
      NOW - PUSH_SUBSCRIPTION_RETENTION_MS - 1,
    ).toISOString(),
  });
  const commands: Array<Array<string | number>> = [];
  const execute: RedisCommandExecutor = async <T>(
    command: Array<string | number>,
  ) => {
    commands.push(command);
    if (command[0] === "HGETALL") {
      return [
        active.id,
        JSON.stringify(active),
        stale.id,
        JSON.stringify(stale),
        "broken",
        "{not-json",
      ] as T;
    }
    return 1 as T;
  };
  const store = new RedisPushSubscriptionDataStore(execute);

  const listed = await store.listActive(NOW);
  assert.deepEqual(
    listed.map((item) => item.record.id),
    ["active"],
  );
  assert.deepEqual(commands[1].slice(0, 2), [
    "HDEL",
    "train-live-map:push-subscriptions:v2",
  ]);
  assert.deepEqual(new Set(commands[1].slice(2)), new Set([
    "stale",
    "broken",
  ]));
});

test("Push購読用IP枠は10分に5回まで許可する", () => {
  const state = createMemoryIpRateLimitState();
  const input = {
    scope: "push-subscription",
    ipHash: "hashed-ip",
    limit: 5,
    windowSeconds: 600,
  };

  for (let index = 0; index < 5; index += 1) {
    assert.equal(
      claimMemoryIpRateLimit(
        state,
        input,
        NOW,
        `token-${index}`,
      ).allowed,
      true,
    );
  }
  assert.equal(
    claimMemoryIpRateLimit(
      state,
      input,
      NOW,
      "token-six",
    ).allowed,
    false,
  );
});
