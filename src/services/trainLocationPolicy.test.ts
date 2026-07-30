import assert from "node:assert/strict";
import test from "node:test";
import {
  isMockAllowed,
  MOCK_NOTICE_EMPTY,
  MOCK_NOTICE_FALLBACK,
  MOCK_NOTICE_NO_TOKEN,
  NO_RUNNING_TRAINS_NOTICE,
  resolveProviderResult,
} from "./trainLocationPolicy.ts";

const production = { NODE_ENV: "production" };
const development = { NODE_ENV: "development" };

test("モック利用可否を実行環境と明示フラグで判定する", () => {
  assert.equal(isMockAllowed(development), true);
  assert.equal(isMockAllowed({ NODE_ENV: "test" }), true);
  assert.equal(isMockAllowed(production), false);
  assert.equal(
    isMockAllowed({ NODE_ENV: "production", ALLOW_MOCK_DATA: "1" }),
    true,
  );
  assert.equal(
    isMockAllowed({ NODE_ENV: "production", ALLOW_MOCK_DATA: "0" }),
    false,
  );
});

test("本番の実データ成功時はモックを呼ばない", async () => {
  let mockCalls = 0;
  const result = await resolveProviderResult({
    environment: production,
    realCall: async () => ["real"],
    mockCall: async () => {
      mockCalls += 1;
      return ["mock"];
    },
    isEmpty: (value) => value.length === 0,
  });

  assert.deepEqual(result, {
    value: ["real"],
    source: "odpt",
    isMock: false,
    fallback: false,
    notice: null,
  });
  assert.equal(mockCalls, 0);
});

test("本番の0件はODPTの空結果として返す", async () => {
  let mockCalls = 0;
  const result = await resolveProviderResult<string[]>({
    environment: production,
    realCall: async () => [],
    mockCall: async () => {
      mockCalls += 1;
      return ["mock"];
    },
    isEmpty: (value) => value.length === 0,
  });

  assert.deepEqual(result, {
    value: [],
    source: "odpt",
    isMock: false,
    fallback: false,
    notice: NO_RUNNING_TRAINS_NOTICE,
  });
  assert.equal(mockCalls, 0);
});

test("本番の取得失敗時は元の例外を再送出してモックを呼ばない", async () => {
  let mockCalls = 0;
  const failure = new Error("ODPT unavailable");
  await assert.rejects(
    resolveProviderResult({
      environment: production,
      realCall: async () => {
        throw failure;
      },
      mockCall: async () => {
        mockCalls += 1;
        return ["mock"];
      },
    }),
    failure,
  );
  assert.equal(mockCalls, 0);
});

test("本番でプロバイダ未設定なら例外にしてモックを呼ばない", async () => {
  let mockCalls = 0;
  await assert.rejects(
    resolveProviderResult({
      environment: production,
      realCall: null,
      mockCall: async () => {
        mockCalls += 1;
        return ["mock"];
      },
    }),
    /実データプロバイダが設定されていません/,
  );
  assert.equal(mockCalls, 0);
});

test("開発環境のプロバイダ未設定時は従来どおりモックを使う", async () => {
  const result = await resolveProviderResult({
    environment: development,
    realCall: null,
    mockCall: async () => ["mock"],
  });
  assert.deepEqual(result, {
    value: ["mock"],
    source: "mock",
    isMock: true,
    fallback: false,
    notice: MOCK_NOTICE_NO_TOKEN,
  });
});

test("開発環境の失敗時はモックへフォールバックする", async () => {
  const result = await resolveProviderResult({
    environment: development,
    realCall: async () => {
      throw new Error("ODPT unavailable");
    },
    mockCall: async () => ["mock"],
  });
  assert.deepEqual(result, {
    value: ["mock"],
    source: "mock",
    isMock: true,
    fallback: true,
    notice: MOCK_NOTICE_FALLBACK,
  });
});

test("開発環境の0件時は動作確認用モックへフォールバックする", async () => {
  const result = await resolveProviderResult<string[]>({
    environment: development,
    realCall: async () => [],
    mockCall: async () => ["mock"],
    isEmpty: (value) => value.length === 0,
  });
  assert.deepEqual(result, {
    value: ["mock"],
    source: "mock",
    isMock: true,
    fallback: true,
    notice: MOCK_NOTICE_EMPTY,
  });
});
