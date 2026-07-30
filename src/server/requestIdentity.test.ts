import assert from "node:assert/strict";
import test from "node:test";
import {
  extractForwardedIp,
  FALLBACK_REPORTER_HASH_SALT,
  hashCommunityReporter,
  hashReporterIp,
  resolveReporterHashSalt,
} from "./requestIdentity.ts";

test("X-Forwarded-Forの先頭IPだけを採用する", () => {
  assert.equal(
    extractForwardedIp("203.0.113.10, 198.51.100.20"),
    "203.0.113.10",
  );
  assert.equal(extractForwardedIp("2001:db8::1"), "2001:db8::1");
  assert.equal(extractForwardedIp("not-an-ip"), null);
  assert.equal(extractForwardedIp(null), null);
});

test("未設定ソルトは警告して後方互換の既定値へフォールバックする", () => {
  let warned = false;
  assert.equal(
    resolveReporterHashSalt(undefined, () => {
      warned = true;
    }),
    FALLBACK_REPORTER_HASH_SALT,
  );
  assert.equal(warned, true);
  assert.equal(resolveReporterHashSalt(" secret-salt "), "secret-salt");
});

test("投稿者IDとIPをソルト付きで不可逆化する", () => {
  assert.equal(
    hashCommunityReporter("reporter-1234", FALLBACK_REPORTER_HASH_SALT),
    "af39dc19de646d721a99b2df4869fa20",
  );
  assert.notEqual(
    hashReporterIp("203.0.113.10", "salt-a"),
    hashReporterIp("203.0.113.10", "salt-b"),
  );
  assert.equal(
    hashReporterIp(null, "salt-a"),
    hashReporterIp(null, "salt-a"),
  );
  assert.equal(hashReporterIp("203.0.113.10", "salt-a").length, 64);
});
