import assert from "node:assert/strict";
import test from "node:test";
import {
  REPORTER_STORAGE_KEY,
  remainingVoteCooldownSeconds,
  resolveReporterIdentity,
} from "./communityReportUi.ts";
import type { StorageLike } from "./browserGuidance.ts";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("保存済み端末IDを再利用する", () => {
  const storage = memoryStorage();
  storage.setItem(REPORTER_STORAGE_KEY, "persistedReporter01");
  let factoryCalled = false;

  assert.deepEqual(
    resolveReporterIdentity(storage, () => {
      factoryCalled = true;
      return "newReporter0001";
    }),
    { reporterId: "persistedReporter01", persistent: true },
  );
  assert.equal(factoryCalled, false);
});

test("新しい端末IDは書き込みと読み戻し成功後だけ有効にする", () => {
  const storage = memoryStorage();
  assert.deepEqual(
    resolveReporterIdentity(storage, () => "newReporter0001"),
    { reporterId: "newReporter0001", persistent: true },
  );
  assert.equal(
    storage.getItem(REPORTER_STORAGE_KEY),
    "newReporter0001",
  );
});

test("ストレージなし・書込例外・読み戻し不能では投票IDを返さない", () => {
  const blocked: StorageLike = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  const noOp: StorageLike = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  for (const storage of [null, blocked, noOp]) {
    assert.deepEqual(
      resolveReporterIdentity(storage, () => "newReporter0001"),
      { reporterId: null, persistent: false },
    );
  }
});

test("クールダウン残秒を境界値どおり切り上げる", () => {
  const votedAt = 1_000_000;
  assert.equal(
    remainingVoteCooldownSeconds(votedAt, 60, votedAt),
    60,
  );
  assert.equal(
    remainingVoteCooldownSeconds(votedAt, 60, votedAt + 1),
    60,
  );
  assert.equal(
    remainingVoteCooldownSeconds(votedAt, 60, votedAt + 59_001),
    1,
  );
  assert.equal(
    remainingVoteCooldownSeconds(votedAt, 60, votedAt + 60_000),
    0,
  );
  assert.equal(
    remainingVoteCooldownSeconds(votedAt, 60, votedAt + 60_001),
    0,
  );
});

test("端末時計が戻ってもクールダウンを短縮しない", () => {
  assert.equal(
    remainingVoteCooldownSeconds(1_000_000, 60, 900_000),
    60,
  );
  assert.equal(
    remainingVoteCooldownSeconds(null, 60, 1_000_000),
    0,
  );
});
