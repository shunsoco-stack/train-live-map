import type {
  ServiceStatusApiResponse,
  TrainsApiResponse,
} from "@/types/train";

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

export function fetchTrains(signal?: AbortSignal): Promise<TrainsApiResponse> {
  return getJson<TrainsApiResponse>("/api/trains", signal);
}

export function fetchServiceStatus(
  signal?: AbortSignal,
): Promise<ServiceStatusApiResponse> {
  return getJson<ServiceStatusApiResponse>("/api/service-status", signal);
}
