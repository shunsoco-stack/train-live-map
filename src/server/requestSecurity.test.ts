import assert from "node:assert/strict";
import test from "node:test";
import {
  clientAddress,
  pseudonymousHash,
  readLimitedJsonBody,
  validateMutationRequest,
} from "./requestSecurity.ts";

const requestUrl = new URL("https://train-live-map.vercel.app/api/example");

test("same-origin JSON mutation is accepted", () => {
  const headers = new Headers({
    origin: "https://train-live-map.vercel.app",
    "sec-fetch-site": "same-origin",
    "content-type": "application/json; charset=utf-8",
    "content-length": "12",
  });
  assert.deepEqual(validateMutationRequest(headers, requestUrl), { ok: true });
});

test("cross-site browser mutation is rejected", () => {
  const result = validateMutationRequest(
    new Headers({
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site",
      "content-type": "application/json",
    }),
    requestUrl,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 403);
});

test("cross-site referer is rejected when Origin is absent", () => {
  const result = validateMutationRequest(
    new Headers({
      referer: "https://attacker.example/form",
      "content-type": "application/json",
    }),
    requestUrl,
    undefined,
    [],
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 403);
});

test("configured Vercel deployment origin is accepted", () => {
  const result = validateMutationRequest(
    new Headers({
      origin: "https://train-live-map-preview.vercel.app",
      "content-type": "application/json",
    }),
    requestUrl,
    undefined,
    ["train-live-map-preview.vercel.app"],
  );
  assert.deepEqual(result, { ok: true });
});

test("simple cross-site text body is rejected", () => {
  const result = validateMutationRequest(
    new Headers({ "content-type": "text/plain" }),
    requestUrl,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 415);
});

test("declared and actual oversized bodies are rejected", async () => {
  const declared = validateMutationRequest(
    new Headers({
      "content-type": "application/json",
      "content-length": "200",
    }),
    requestUrl,
    100,
  );
  assert.equal(declared.ok, false);
  if (!declared.ok) assert.equal(declared.status, 413);

  const actual = await readLimitedJsonBody(
    new Request(requestUrl, {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(200) }),
    }),
    100,
  );
  assert.equal(actual.ok, false);
  if (!actual.ok) assert.equal(actual.status, 413);
});

test("malformed JSON is a client error", async () => {
  const result = await readLimitedJsonBody(
    new Request(requestUrl, { method: "POST", body: "{" }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("platform address is preferred and hashes are keyed", () => {
  const headers = new Headers({
    "x-vercel-forwarded-for": "203.0.113.7",
    "x-forwarded-for": "198.51.100.2, 198.51.100.3",
  });
  assert.equal(clientAddress(headers), "203.0.113.7");
  const first = pseudonymousHash("s".repeat(32), "test", "203.0.113.7");
  const second = pseudonymousHash("t".repeat(32), "test", "203.0.113.7");
  assert.notEqual(first, second);
  assert.equal(first.includes("203.0.113.7"), false);
});
