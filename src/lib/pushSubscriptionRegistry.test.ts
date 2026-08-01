import assert from "node:assert/strict";
import test from "node:test";
import {
  claimSlidingWindowRateLimit,
  MemoryPushSubscriptionRegistry,
} from "./pushSubscriptionRegistry.ts";

type Record = { id: string; updatedAt: string; value: number };
const NOW = Date.UTC(2026, 7, 1, 0, 0, 0);

test("ID指定のupsertは既存件数に関係なく同じレコードを置換する", () => {
  const registry = new MemoryPushSubscriptionRegistry<Record>(10_000);
  for (let index = 0; index < 5_000; index += 1) {
    assert.equal(registry.upsert({ id: `id-${index}`, updatedAt: new Date(NOW).toISOString(), value: index }), true);
  }
  assert.equal(registry.upsert({ id: "id-0", updatedAt: new Date(NOW).toISOString(), value: 99 }), true);
  assert.equal(registry.get("id-0")?.value, 99);
  assert.equal(registry.size(), 5_000);
});

test("ID指定のremoveで対象だけを削除する", () => {
  const registry = new MemoryPushSubscriptionRegistry<Record>(3);
  registry.upsert({ id: "a", updatedAt: new Date(NOW).toISOString(), value: 1 });
  registry.upsert({ id: "b", updatedAt: new Date(NOW).toISOString(), value: 2 });
  assert.equal(registry.remove("a"), true);
  assert.equal(registry.get("a"), null);
  assert.equal(registry.get("b")?.value, 2);
});

test("上限を超える新規登録を拒否し、期限切れは一覧取得時に掃除する", () => {
  const registry = new MemoryPushSubscriptionRegistry<Record>(2);
  registry.upsert({ id: "old", updatedAt: new Date(NOW - 1_000).toISOString(), value: 1 });
  registry.upsert({ id: "active", updatedAt: new Date(NOW).toISOString(), value: 2 });
  assert.equal(registry.upsert({ id: "overflow", updatedAt: new Date(NOW).toISOString(), value: 3 }), false);
  assert.deepEqual(registry.listActive(NOW - 500).map((item) => item.id), ["active"]);
  assert.equal(registry.upsert({ id: "replacement", updatedAt: new Date(NOW).toISOString(), value: 4 }), true);
});

test("Push変更は10分間に5回まで許可し、6回目を拒否する", () => {
  let timestamps: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    const result = claimSlidingWindowRateLimit(timestamps, NOW + index, 600_000, 5);
    assert.equal(result.allowed, true);
    timestamps = result.timestamps;
  }
  assert.equal(
    claimSlidingWindowRateLimit(timestamps, NOW + 5, 600_000, 5).allowed,
    false,
  );
});
