import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedMutationOrigin } from "./requestOrigin.ts";

const requestOrigin = "https://train-live-map.example";

test("自身のOriginまたはRefererだけを許可する", () => {
  assert.equal(
    isAllowedMutationOrigin({
      requestOrigin,
      originHeader: requestOrigin,
      refererHeader: null,
    }),
    true,
  );
  assert.equal(
    isAllowedMutationOrigin({
      requestOrigin,
      originHeader: null,
      refererHeader: `${requestOrigin}/settings/notifications`,
    }),
    true,
  );
  assert.equal(
    isAllowedMutationOrigin({
      requestOrigin,
      originHeader: "https://evil.example.com",
      refererHeader: `${requestOrigin}/`,
    }),
    false,
  );
});

test("OriginもRefererも無い変更リクエストは拒否する", () => {
  assert.equal(
    isAllowedMutationOrigin({
      requestOrigin,
      originHeader: null,
      refererHeader: null,
    }),
    false,
  );
});

test("VERCEL_URLのhttpsオリジンをプレビュー用に許可する", () => {
  assert.equal(
    isAllowedMutationOrigin({
      requestOrigin,
      originHeader:
        "https://train-live-map-git-feature-example.vercel.app",
      refererHeader: null,
      vercelUrl: "train-live-map-git-feature-example.vercel.app",
    }),
    true,
  );
  assert.equal(
    isAllowedMutationOrigin({
      requestOrigin,
      originHeader: "https://another-preview.vercel.app",
      refererHeader: null,
      vercelUrl: "train-live-map-git-feature-example.vercel.app",
    }),
    false,
  );
});

test("不正なURLやhttp/https以外のオリジンを拒否する", () => {
  for (const originHeader of [
    "null",
    "not a url",
    "file:///tmp/index.html",
  ]) {
    assert.equal(
      isAllowedMutationOrigin({
        requestOrigin,
        originHeader,
        refererHeader: null,
      }),
      false,
    );
  }
});
