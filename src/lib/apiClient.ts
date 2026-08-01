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

/**
 * フロントエンドから Next.js の Route Handler を呼び出すクライアント。
 * UI は必ず API 経由でデータを取得する。
 */

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`リクエスト失敗 (${res.status}): ${url}`);
  }
  return (await res.json()) as T;
}

function lineFilteredUrl(path: string, lineKey: string): string {
  return `${path}?${new URLSearchParams({ lines: lineKey }).toString()}`;
}

export function fetchTrains(
  lineKey: string,
  signal?: AbortSignal,
): Promise<TrainsApiResponse> {
  return getJson<TrainsApiResponse>(lineFilteredUrl("/api/trains", lineKey), signal);
}

export function fetchServiceStatus(
  lineKey: string,
  signal?: AbortSignal,
): Promise<ServiceStatusApiResponse> {
  return getJson<ServiceStatusApiResponse>(
    lineFilteredUrl("/api/service-status", lineKey),
    signal,
  );
}

export function fetchRailways(
  signal?: AbortSignal,
): Promise<RailwaysApiResponse> {
  return getJson<RailwaysApiResponse>("/api/railways", signal);
}

export function fetchCommunityReports(
  signal?: AbortSignal,
): Promise<CommunityReportsApiResponse> {
  return getJson<CommunityReportsApiResponse>(
    "/api/community-reports",
    signal,
  );
}

export async function submitCommunityReport(
  vote: CommunityReportVote,
  reporterId: string,
): Promise<CommunityReportSubmitResponse> {
  const response = await fetch("/api/community-reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Community-Reporter": reporterId,
    },
    body: JSON.stringify(vote),
  });
  const data = (await response.json()) as
    | CommunityReportSubmitResponse
    | { error?: string };
  if (!response.ok) {
    throw new Error(
      "error" in data && data.error
        ? data.error
        : `投票に失敗しました (${response.status})`,
    );
  }
  return data as CommunityReportSubmitResponse;
}

export function fetchPushConfig(
  signal?: AbortSignal,
): Promise<PushConfigResponse> {
  return getJson<PushConfigResponse>("/api/push/config", signal);
}

async function pushSubscriptionRequest<T>(
  method: "POST" | "DELETE",
  body: SavePushSubscriptionRequest | DeletePushSubscriptionRequest,
): Promise<T> {
  const response = await fetch("/api/push/subscriptions", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(
      data.error ?? `通知設定の更新に失敗しました (${response.status})`,
    );
  }
  return data;
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
