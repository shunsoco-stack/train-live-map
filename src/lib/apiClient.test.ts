import assert from "node:assert/strict";
import test from "node:test";
import {
  FetchTimeoutError,
  fetchWithTimeout,
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
