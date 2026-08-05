import assert from "node:assert/strict";
import test from "node:test";
import { maskOdptAccessToken } from "./api.ts";

test("URLエンコードされたODPTアクセストークンをログ用URLから除去する", () => {
  const secret = "never-log-this-secret";
  const url = new URL("https://api-challenge.odpt.org/api/v4/odpt:Train");
  url.searchParams.set("odpt:operator", "odpt.Operator:JR-East");
  url.searchParams.set("acl:consumerKey", secret);

  const masked = maskOdptAccessToken(url.toString());
  assert.equal(masked.includes(secret), false);
  assert.match(decodeURIComponent(masked), /acl:consumerKey=\*\*\*/);
});

test("不完全なURLでもODPTアクセストークンを除去する", () => {
  const secret = "another-secret";
  const masked = maskOdptAccessToken(
    `not-a-url?acl%3AconsumerKey=${secret}&x=1`,
  );
  assert.equal(masked.includes(secret), false);
});
