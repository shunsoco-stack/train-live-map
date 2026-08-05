/**
 * ODPT(公共交通オープンデータセンター)接続の設定。
 *
 * アクセストークンなどの秘密情報はコードに直接書かず、
 * すべて環境変数(.env.local)から読み込む。サーバー側でのみ参照する。
 */

export interface OdptConfig {
  /** API のベース URL(例: https://api-challenge.odpt.org/api/v4) */
  baseUrl: string;
  /** アクセストークン(acl:consumerKey)。未設定なら空文字。 */
  accessToken: string;
  /** 対象路線(odpt:railway)。既定は東海道線。 */
  railway: string;
  /** 対象事業者(odpt:operator)。既定は JR 東日本。 */
  operator: string;
  /** リクエストのタイムアウト(ミリ秒) */
  timeoutMs: number;
  /** リトライ回数(初回を除く) */
  retries: number;
}

// JR 東日本の列車ロケーション情報はチャレンジ2026限定データ。
const DEFAULT_BASE_URL = "https://api-challenge.odpt.org/api/v4";
const DEFAULT_RAILWAY = "odpt.Railway:JR-East.Tokaido";
const DEFAULT_OPERATOR = "odpt.Operator:JR-East";

/** JR東日本アイステイションズがODPTへ提供する公式運行情報の事業者ID。 */
export const JR_EAST_TRAIN_INFORMATION_OPERATOR = "odpt.Operator:jre-is";

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** 現在の環境変数から ODPT 設定を読み込む。 */
export function getOdptConfig(): OdptConfig {
  return {
    baseUrl: process.env.ODPT_API_BASE_URL?.trim() || DEFAULT_BASE_URL,
    accessToken: process.env.ODPT_ACCESS_TOKEN?.trim() || "",
    railway: process.env.ODPT_RAILWAY?.trim() || DEFAULT_RAILWAY,
    operator: process.env.ODPT_OPERATOR?.trim() || DEFAULT_OPERATOR,
    timeoutMs: parseIntEnv(process.env.ODPT_TIMEOUT_MS, 8000),
    retries: parseIntEnv(process.env.ODPT_RETRIES, 2),
  };
}

/** ODPT を利用可能か(トークンが設定されているか)。 */
export function isOdptConfigured(config: OdptConfig = getOdptConfig()): boolean {
  return config.accessToken.length > 0;
}
