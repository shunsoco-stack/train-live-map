import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiError,
  FetchTimeoutError,
  deletePushSubscription,
  fetchTrains,
  fetchWithTimeout,
  normalizeApiError,
  submitCommunityReport,
} from "./apiClient.ts";

function abortablePendingFetch(
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

test("指定時間を過ぎたfetchを中断する", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = abortablePendingFetch;
  const startedAt = Date.now();
  try {
    await assert.rejects(
      fetchWithTimeout("/api/test", {}, 20),
      (error) =>
        error instanceof FetchTimeoutError &&
        error.name === "TimeoutError",
    );
    assert.ok(Date.now() - startedAt < 500);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("呼び出し側の中断signalもfetchへ伝播する", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = abortablePendingFetch;
  const controller = new AbortController();
  try {
    const request = fetchWithTimeout(
      "/api/test",
      { signal: controller.signal },
      1_000,
    );
    controller.abort();
    await assert.rejects(
      request,
      (error) =>
        error instanceof DOMException && error.name === "AbortError",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("タイムアウト・中断・通信失敗を日本語へ正規化する", () => {
  for (const error of [
    new FetchTimeoutError("raw timeout"),
    new DOMException("The operation was aborted", "AbortError"),
    new DOMException("The operation timed out", "TimeoutError"),
  ]) {
    const normalized = normalizeApiError(error, "既定エラー");
    assert.equal(normalized.kind, "timeout");
    assert.equal(normalized.message, "通信がタイムアウトしました");
  }

  const network = normalizeApiError(
    new TypeError("Failed to fetch"),
    "既定エラー",
  );
  assert.equal(network.kind, "network");
  assert.equal(
    network.message,
    "通信できません。接続を確認してください",
  );
  assert.doesNotMatch(network.message, /Failed to fetch/i);
});

test("未知の例外文は画面へ流さず日本語の既定文言を使う", () => {
  const normalized = normalizeApiError(
    new Error("Unexpected token '<'"),
    "データを取得できませんでした。",
  );
  assert.equal(normalized.kind, "unknown");
  assert.equal(
    normalized.message,
    "データを取得できませんでした。",
  );
  assert.doesNotMatch(normalized.message, /Unexpected token/i);
});

test("ApiErrorのHTTPステータスを保持する", () => {
  const source = new ApiError("http", "しばらくお待ちください。", 429);
  const normalized = normalizeApiError(source, "既定エラー");
  assert.equal(normalized, source);
  assert.equal(normalized.status, 429);
});

test("HTMLのHTTPエラーはJSON解析せず既定の日本語にする", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("<html>Gateway Timeout</html>", {
      status: 504,
      headers: { "Content-Type": "text/html" },
    });
  try {
    await assert.rejects(
      submitCommunityReport(
        { lineId: "tokaido", status: "on-time" },
        "phase2tester01",
      ),
      (error) =>
        error instanceof ApiError &&
        error.kind === "http" &&
        error.status === 504 &&
        error.message === "投票に失敗しました。",
    );
    await assert.rejects(
      deletePushSubscription({
        endpoint: "https://fcm.googleapis.com/test",
      }),
      (error) =>
        error instanceof ApiError &&
        error.status === 504 &&
        error.message === "通知設定を更新できませんでした。",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("JSONのHTTPエラー文言とステータスを保持する", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json(
      { error: "同じ路線には60秒後に再投票できます。" },
      { status: 429 },
    );
  try {
    await assert.rejects(
      submitCommunityReport(
        { lineId: "tokaido", status: "on-time" },
        "phase2tester01",
      ),
      (error) =>
        error instanceof ApiError &&
        error.status === 429 &&
        error.message ===
          "同じ路線には60秒後に再投票できます。",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("成功HTTPの不正JSONは安全な日本語エラーにする", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("<html>not json</html>", { status: 200 });
  try {
    await assert.rejects(
      fetchTrains(["tokaido"]),
      (error) =>
        error instanceof ApiError &&
        error.kind === "invalid-response" &&
        error.status === 200 &&
        error.message ===
          "サーバーからの応答を読み取れませんでした",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
