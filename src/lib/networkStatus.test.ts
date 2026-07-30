import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFLINE_ERROR_MESSAGE,
  errorMessageForConnection,
} from "./networkStatus.ts";

test("オフライン時は通信例外より専用の日本語案内を優先する", () => {
  assert.equal(
    errorMessageForConnection(false, "Failed to fetch"),
    OFFLINE_ERROR_MESSAGE,
  );
  assert.doesNotMatch(
    errorMessageForConnection(false, "Failed to fetch") ?? "",
    /Failed to fetch/i,
  );
});

test("オンライン時は正規化済みの取得エラーを表示する", () => {
  assert.equal(
    errorMessageForConnection(
      true,
      "通信できません。接続を確認してください",
    ),
    "通信できません。接続を確認してください",
  );
  assert.equal(errorMessageForConnection(true, null), null);
});
