import type {
  ServiceStatusApiResponse,
  TrainsApiResponse,
} from "@/types/train";
import type { RailwaysApiResponse } from "@/types/railway";
import type {
  CommunityReportsApiResponse,
  CommunityReportSubmitResponse,
  CommunityReportVote,
} from "@/types/community";
import type {
  DeletePushSubscriptionRequest,
  PushConfigResponse,
  SavePushSubscriptionRequest,
  SavePushSubscriptionResponse,
} from "@/types/push";
import { trainsApiUrl } from "./trainLineFilter.ts";

/**
 * フロントエンドから Next.js の Route Handler を呼び出すクライアント。
 * UI は必ず API 経由でデータを取得する。
 */

export const API_FETCH_TIMEOUT_MS = 8_000;

export type ApiErrorKind =
  | "timeout"
  | "network"
  | "http"
  | "invalid-response"
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(
    kind: ApiErrorKind,
    message: string,
    status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export class FetchTimeoutError extends Error {
  override name = "TimeoutError";
}

export function normalizeApiError(
  error: unknown,
  fallbackMessage: string,
): ApiError {
  if (error instanceof ApiError) return error;
  if (
    error instanceof FetchTimeoutError ||
    (error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError"))
  ) {
    return new ApiError(
      "timeout",
      "通信がタイムアウトしました",
      undefined,
      { cause: error },
    );
  }
  if (error instanceof TypeError) {
    return new ApiError(
      "network",
      "通信できません。接続を確認してください",
      undefined,
      { cause: error },
    );
  }
  return new ApiError(
    "unknown",
    fallbackMessage,
    undefined,
    { cause: error },
  );
}

export function apiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  return normalizeApiError(error, fallbackMessage).message;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = API_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;
  const abortFromCaller = () => controller.abort();

  if (callerSignal?.aborted) {
    controller.abort();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, {
      once: true,
    });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new FetchTimeoutError("通信がタイムアウトしました");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

async function getJson<T>(
  url: string,
  signal?: AbortSignal,
  cache: RequestCache = "no-store",
  fallbackMessage = "データを取得できませんでした。",
): Promise<T> {
  try {
    const response = await fetchWithTimeout(url, { signal, cache });
    return await responseJson<T>(response, fallbackMessage);
  } catch (error) {
    throw normalizeApiError(error, fallbackMessage);
  }
}

async function responseErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const data = (await response.json()) as unknown;
    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      typeof (data as { error?: unknown }).error === "string" &&
      (data as { error: string }).error.trim()
    ) {
      return (data as { error: string }).error;
    }
  } catch {
    // HTMLや空本文のエラー応答では、利用者向けの既定文言を使う。
  }
  return fallbackMessage;
}

async function responseJson<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  if (!response.ok) {
    throw new ApiError(
      "http",
      await responseErrorMessage(response, fallbackMessage),
      response.status,
    );
  }
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new ApiError(
      "invalid-response",
      "サーバーからの応答を読み取れませんでした",
      response.status,
      { cause: error },
    );
  }
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  try {
    const response = await fetchWithTimeout(url, init);
    return await responseJson<T>(response, fallbackMessage);
  } catch (error) {
    throw normalizeApiError(error, fallbackMessage);
  }
}

export function fetchTrains(
  lineIds?: Iterable<string>,
  signal?: AbortSignal,
): Promise<TrainsApiResponse> {
  return getJson<TrainsApiResponse>(
    trainsApiUrl(lineIds),
    signal,
    "default",
    "列車情報を取得できませんでした。",
  );
}

export function fetchServiceStatus(
  signal?: AbortSignal,
): Promise<ServiceStatusApiResponse> {
  return getJson<ServiceStatusApiResponse>(
    "/api/service-status",
    signal,
    "default",
    "運行情報を取得できませんでした。",
  );
}

export function fetchRailways(
  signal?: AbortSignal,
): Promise<RailwaysApiResponse> {
  return getJson<RailwaysApiResponse>(
    "/api/railways",
    signal,
    "no-store",
    "路線情報を取得できませんでした。",
  );
}

export function fetchCommunityReports(
  signal?: AbortSignal,
): Promise<CommunityReportsApiResponse> {
  return getJson<CommunityReportsApiResponse>(
    "/api/community-reports",
    signal,
    "no-store",
    "みんなの運行情報を取得できませんでした。",
  );
}

export async function submitCommunityReport(
  vote: CommunityReportVote,
  reporterId: string,
): Promise<CommunityReportSubmitResponse> {
  return requestJson<CommunityReportSubmitResponse>(
    "/api/community-reports",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Community-Reporter": reporterId,
      },
      body: JSON.stringify(vote),
    },
    "投票に失敗しました。",
  );
}

export function fetchPushConfig(
  signal?: AbortSignal,
): Promise<PushConfigResponse> {
  return getJson<PushConfigResponse>(
    "/api/push/config",
    signal,
    "no-store",
    "通知機能を準備できませんでした。",
  );
}

async function pushSubscriptionRequest<T>(
  method: "POST" | "DELETE",
  body: SavePushSubscriptionRequest | DeletePushSubscriptionRequest,
): Promise<T> {
  return requestJson<T>(
    "/api/push/subscriptions",
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "通知設定を更新できませんでした。",
  );
}

export function savePushSubscription(
  body: SavePushSubscriptionRequest,
): Promise<SavePushSubscriptionResponse> {
  return pushSubscriptionRequest("POST", body);
}

export function deletePushSubscription(
  body: DeletePushSubscriptionRequest,
): Promise<{ subscribed: false }> {
  return pushSubscriptionRequest("DELETE", body);
}
