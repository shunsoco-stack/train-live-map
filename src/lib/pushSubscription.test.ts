import assert from "node:assert/strict";
import test from "node:test";
import {
  validatePushLineIds,
  validatePushSubscription,
} from "./pushSubscription.ts";

const validSubscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  expirationTime: null,
  keys: {
    p256dh: "abcdefgh",
    auth: "abcdefgh",
  },
};

test("Push購読のexpirationTimeはnullか有限数だけを受理する", () => {
  assert.deepEqual(
    validatePushSubscription(validSubscription),
    validSubscription,
  );
  assert.deepEqual(
    validatePushSubscription({
      ...validSubscription,
      expirationTime: 1_800_000_000_000,
    }),
    {
      ...validSubscription,
      expirationTime: 1_800_000_000_000,
    },
  );

  for (const expirationTime of [
    undefined,
    "1800000000000",
    true,
    [],
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    const candidate = { ...validSubscription } as Record<string, unknown>;
    if (expirationTime === undefined) {
      delete candidate.expirationTime;
    } else {
      candidate.expirationTime = expirationTime;
    }
    assert.equal(validatePushSubscription(candidate), null);
  }
});

test("Push購読路線は文字列だけの有効な配列に限定する", () => {
  const allowed = new Set(["tokaido", "yamanote"]);
  const isAllowed = (lineId: string) => allowed.has(lineId);

  assert.deepEqual(
    validatePushLineIds(["tokaido", "tokaido", "yamanote"], isAllowed),
    ["tokaido", "yamanote"],
  );
  assert.equal(validatePushLineIds(["tokaido", true], isAllowed), null);
  assert.equal(validatePushLineIds([], isAllowed), null);
  assert.equal(validatePushLineIds(["unknown"], isAllowed), null);
});
