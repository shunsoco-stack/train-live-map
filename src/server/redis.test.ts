import assert from "node:assert/strict";
import test from "node:test";
import {
  REDIS_COMMAND_TIMEOUT_MS,
  RedisCommandError,
  redisCommand,
  type RedisConfiguration,
} from "./redis.ts";

const SECRET_CONFIG: RedisConfiguration = {
  url: "https://secret-redis.example.test",
  token: "secret-token-value",
};

test("本番のRedisタイムアウトは4秒", () => {
  assert.equal(REDIS_COMMAND_TIMEOUT_MS, 4_000);
});

function pendingFetch(
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener(
      "abort",
      () => reject(new DOMException("aborted", "AbortError")),
      { once: true },
    );
  });
}

test("Redisが応答しない場合は指定時間で中断する", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = pendingFetch;
  const startedAt = Date.now();
  try {
    await assert.rejects(
      redisCommand(SECRET_CONFIG, ["PING"], 20),
      (error) =>
        error instanceof RedisCommandError &&
        error.message === "Redisへの接続がタイムアウトしました",
    );
    assert.ok(Date.now() - startedAt < 500);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Redis例外にURL・トークン・コマンドを含めない", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("server error", { status: 500 });
  try {
    await assert.rejects(
      redisCommand(SECRET_CONFIG, ["SET", "private-key", "value"]),
      (error) => {
        assert.ok(error instanceof RedisCommandError);
        assert.doesNotMatch(error.message, /secret-redis/);
        assert.doesNotMatch(error.message, /secret-token/);
        assert.doesNotMatch(error.message, /private-key/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("正常なRedis JSON応答からresultを返す", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ result: "PONG" });
  try {
    assert.equal(
      await redisCommand<string>(SECRET_CONFIG, ["PING"]),
      "PONG",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
