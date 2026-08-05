import { getOdptConfig, isOdptConfigured, type OdptConfig } from "./config.ts";
import type {
  OdptRailway,
  OdptStation,
  OdptTrain,
  OdptTrainInformation,
} from "./types.ts";
import { createLogger } from "../logger.ts";

/**
 * ODPT API クライアント。
 *
 * 認証(acl:consumerKey)、タイムアウト、リトライ(指数バックオフ)、
 * エラーハンドリング、ログ出力を担う。返却は生の JSON を型付けしたもの。
 * TrainLocation への変換は mapper 側で行う(責務分離)。
 */

const log = createLogger("odpt.api");

/** ODPT 呼び出しで投げるエラー(HTTP / タイムアウト / 解析) */
export class OdptApiError extends Error {
  public readonly kind: "http" | "timeout" | "parse" | "config" | "network";
  public readonly status?: number;

  constructor(
    message: string,
    kind: "http" | "timeout" | "parse" | "config" | "network",
    status?: number,
  ) {
    super(message);
    this.name = "OdptApiError";
    this.kind = kind;
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface FetchResult<T> {
  data: T;
  /** 通信〜解析にかかった時間(ミリ秒) */
  durationMs: number;
  /** 取得に使った URL(トークンはマスク済み) */
  maskedUrl: string;
}

function buildUrl(config: OdptConfig, path: string, params: Record<string, string>): string {
  const url = new URL(`${config.baseUrl}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("acl:consumerKey", config.accessToken);
  return url.toString();
}

/** URL文字列にエンコードされた場合も含め、ログからアクセストークンを除去する。 */
export function maskOdptAccessToken(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.toLowerCase() === "acl:consumerkey") {
        parsed.searchParams.set(key, "***");
      }
    }
    return parsed.toString();
  } catch {
    return url.replace(
      /(acl(?::|%3A)consumerKey(?:=|%3D))[^&\s]+/gi,
      "$1***",
    );
  }
}

/** 1 回分の fetch(タイムアウト付き)。 */
async function fetchOnce<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new OdptApiError(`HTTP ${res.status} ${res.statusText}`, "http", res.status);
    }
    try {
      return (await res.json()) as T;
    } catch {
      throw new OdptApiError("JSON 解析に失敗しました", "parse", res.status);
    }
  } catch (err) {
    if (err instanceof OdptApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new OdptApiError(`タイムアウト(${timeoutMs}ms)`, "timeout");
    }
    throw new OdptApiError(
      err instanceof Error ? err.message : "通信に失敗しました",
      "network",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** リトライ(指数バックオフ)付きで JSON を取得する。 */
async function fetchWithRetry<T>(
  config: OdptConfig,
  path: string,
  params: Record<string, string>,
): Promise<FetchResult<T>> {
  if (!isOdptConfigured(config)) {
    throw new OdptApiError("ODPT アクセストークンが未設定です", "config");
  }

  const url = buildUrl(config, path, params);
  const maskedUrl = maskOdptAccessToken(url);
  const start = Date.now();

  let lastError: unknown;
  for (let attempt = 0; attempt <= config.retries; attempt++) {
    try {
      log.info("fetch 開始", { path, attempt, url: maskedUrl });
      const data = await fetchOnce<T>(url, config.timeoutMs);
      const durationMs = Date.now() - start;
      log.info("fetch 成功", { path, attempt, durationMs });
      return { data, durationMs, maskedUrl };
    } catch (err) {
      lastError = err;
      const kind = err instanceof OdptApiError ? err.kind : "network";
      const status = err instanceof OdptApiError ? err.status : undefined;
      log.warn("fetch 失敗", {
        path,
        attempt,
        kind,
        status: status ?? null,
        message: err instanceof Error ? err.message : String(err),
      });

      // 認証・設定エラーはリトライしても無駄なので即座に中断
      if (err instanceof OdptApiError && (err.kind === "config" || err.status === 401 || err.status === 403)) {
        break;
      }
      if (attempt < config.retries) {
        const backoff = 2 ** attempt * 500; // 500ms, 1000ms, ...
        await sleep(backoff);
      }
    }
  }

  const durationMs = Date.now() - start;
  log.error("fetch 全リトライ失敗", { path, durationMs });
  if (lastError instanceof OdptApiError) throw lastError;
  throw new OdptApiError("ODPT の取得に失敗しました", "network");
}

/** 指定路線の列車位置(odpt:Train)を取得する。 */
export function fetchOdptTrains(
  railway: string,
  config: OdptConfig = getOdptConfig(),
): Promise<FetchResult<OdptTrain[]>> {
  return fetchWithRetry<OdptTrain[]>(config, "odpt:Train", {
    "odpt:railway": railway,
  });
}

/** 指定事業者の全対象路線の列車位置をまとめて取得する。 */
export function fetchOdptTrainsForOperator(
  operator: string,
  config: OdptConfig = getOdptConfig(),
): Promise<FetchResult<OdptTrain[]>> {
  return fetchWithRetry<OdptTrain[]>(config, "odpt:Train", {
    "odpt:operator": operator,
  });
}

/** 指定路線の運行情報(odpt:TrainInformation)を取得する。 */
export function fetchOdptTrainInformation(
  railway: string,
  config: OdptConfig = getOdptConfig(),
): Promise<FetchResult<OdptTrainInformation[]>> {
  return fetchWithRetry<OdptTrainInformation[]>(config, "odpt:TrainInformation", {
    "odpt:railway": railway,
  });
}

/** 指定事業者の全対象路線の運行情報をまとめて取得する。 */
export function fetchOdptTrainInformationForOperator(
  operator: string,
  config: OdptConfig = getOdptConfig(),
): Promise<FetchResult<OdptTrainInformation[]>> {
  return fetchWithRetry<OdptTrainInformation[]>(
    config,
    "odpt:TrainInformation",
    {
      "odpt:operator": operator,
    },
  );
}

/**
 * 指定事業者の路線一覧(odpt:Railway)を取得する。
 * 「どの路線 ID が利用可能か」を診断するために使用する。
 */
export function fetchOdptRailways(
  operator: string,
  config: OdptConfig = getOdptConfig(),
): Promise<FetchResult<OdptRailway[]>> {
  return fetchWithRetry<OdptRailway[]>(config, "odpt:Railway", {
    "odpt:operator": operator,
  });
}

/** 指定事業者の駅情報を取得する。 */
export function fetchOdptStations(
  operator: string,
  config: OdptConfig = getOdptConfig(),
): Promise<FetchResult<OdptStation[]>> {
  return fetchWithRetry<OdptStation[]>(config, "odpt:Station", {
    "odpt:operator": operator,
  });
}
