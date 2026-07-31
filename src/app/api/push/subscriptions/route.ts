import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRailwayCatalogLine } from "@/data/railwayCatalog";
import { isAllowedPushEndpoint } from "@/lib/communityPush";
import {
  getPushSubscriptionStore,
  MAX_STORED_PUSH_SUBSCRIPTIONS,
  PUSH_MUTATION_RATE_WINDOW_SECONDS,
  type PushSubscriptionStore,
} from "@/server/pushSubscriptionStore";
import {
  abusePreventionSecret,
  clientAddress,
  pseudonymousHash,
  readLimitedJsonBody,
  validateMutationRequest,
} from "@/server/requestSecurity";
import type {
  DeletePushSubscriptionRequest,
  SavePushSubscriptionRequest,
  SavePushSubscriptionResponse,
  WebPushSubscriptionData,
} from "@/types/push";

export const dynamic = "force-dynamic";

const MAX_SUBSCRIBED_LINES = 20;
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,256}$/;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function errorResponse(
  message: string,
  status: number,
  headers: Record<string, string> = {},
) {
  return NextResponse.json(
    { error: message },
    { status, headers: { ...NO_STORE_HEADERS, ...headers } },
  );
}

function isLocalRequest(request: NextRequest): boolean {
  return /^(localhost|127\.0\.0\.1)$/.test(request.nextUrl.hostname);
}

function subscriptionId(endpoint: string): string {
  return createHash("sha256")
    .update(endpoint)
    .digest("hex")
    .slice(0, 32);
}

function decodedKeyLength(value: string): number | null {
  if (!KEY_PATTERN.test(value)) return null;
  try {
    return Buffer.from(value, "base64url").byteLength;
  } catch {
    return null;
  }
}

function validateSubscription(
  input: unknown,
): WebPushSubscriptionData | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const keys =
    value.keys && typeof value.keys === "object"
      ? (value.keys as Record<string, unknown>)
      : null;
  const endpoint =
    typeof value.endpoint === "string" ? value.endpoint : "";
  const p256dh = typeof keys?.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys?.auth === "string" ? keys.auth : "";
  const expirationTime = value.expirationTime;

  if (
    endpoint.length > 2048 ||
    !isAllowedPushEndpoint(endpoint) ||
    decodedKeyLength(p256dh) !== 65 ||
    decodedKeyLength(auth) !== 16 ||
    (expirationTime !== null &&
      (typeof expirationTime !== "number" ||
        !Number.isFinite(expirationTime) ||
        expirationTime < 0))
  ) {
    return null;
  }
  return {
    endpoint,
    expirationTime: expirationTime as number | null,
    keys: { p256dh, auth },
  };
}

function validateLineIds(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const lineIds = [
    ...new Set(
      input.filter(
        (lineId): lineId is string => typeof lineId === "string",
      ),
    ),
  ];
  if (
    lineIds.length === 0 ||
    lineIds.length > MAX_SUBSCRIBED_LINES ||
    lineIds.some((lineId) => {
      const line = getRailwayCatalogLine(lineId);
      return !line || line.coverage === "unavailable";
    })
  ) {
    return null;
  }
  return lineIds;
}

async function mutationAllowed(
  request: NextRequest,
  store: PushSubscriptionStore,
): Promise<boolean> {
  const local = isLocalRequest(request);
  const secret =
    abusePreventionSecret() ??
    (local ? "train-live-map-local-development-key-only" : null);
  const address = clientAddress(request.headers) ?? (local ? "local" : null);
  if (!secret || !address) return false;
  const sourceHash = pseudonymousHash(
    secret,
    "push-mutation-source-v1",
    address,
  );
  return store.claimMutationRateLimit(sourceHash);
}

export async function POST(request: NextRequest) {
  try {
    const requestCheck = validateMutationRequest(request.headers, request.nextUrl);
    if (!requestCheck.ok) {
      return errorResponse(requestCheck.message, requestCheck.status);
    }

    const store = getPushSubscriptionStore();
    if (!store.persistent && !isLocalRequest(request)) {
      return errorResponse("通知の保存先を準備中です。", 503);
    }
    if (!(await mutationAllowed(request, store))) {
      return errorResponse(
        "短時間の通知設定上限に達しました。少し時間をおいてください。",
        429,
        { "Retry-After": String(PUSH_MUTATION_RATE_WINDOW_SECONDS) },
      );
    }

    const body = await readLimitedJsonBody(request);
    if (!body.ok) return errorResponse(body.message, body.status);
    const input =
      body.value && typeof body.value === "object"
        ? (body.value as Partial<SavePushSubscriptionRequest>)
        : {};
    const subscription = validateSubscription(input.subscription);
    const lineIds = validateLineIds(input.lineIds);
    if (!subscription || !lineIds) {
      return errorResponse("通知設定を確認してください。", 400);
    }

    const id = subscriptionId(subscription.endpoint);
    const now = new Date().toISOString();
    const active = (await store.listActive()).map((item) => item.record);
    const existing = active.find((item) => item.id === id);
    if (!existing && active.length >= MAX_STORED_PUSH_SUBSCRIPTIONS) {
      return errorResponse("通知登録数が上限に達しています。", 503);
    }
    await store.upsert({
      id,
      subscription,
      lineIds,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    const response: SavePushSubscriptionResponse = {
      subscribed: true,
      lineIds,
    };
    return NextResponse.json(response, { headers: NO_STORE_HEADERS });
  } catch {
    return errorResponse("通知設定を保存できませんでした。", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const requestCheck = validateMutationRequest(request.headers, request.nextUrl);
    if (!requestCheck.ok) {
      return errorResponse(requestCheck.message, requestCheck.status);
    }
    const store = getPushSubscriptionStore();
    if (!store.persistent && !isLocalRequest(request)) {
      return errorResponse("通知の保存先を準備中です。", 503);
    }
    if (!(await mutationAllowed(request, store))) {
      return errorResponse(
        "短時間の通知設定上限に達しました。少し時間をおいてください。",
        429,
        { "Retry-After": String(PUSH_MUTATION_RATE_WINDOW_SECONDS) },
      );
    }

    const body = await readLimitedJsonBody(request);
    if (!body.ok) return errorResponse(body.message, body.status);
    const input =
      body.value && typeof body.value === "object"
        ? (body.value as Partial<DeletePushSubscriptionRequest>)
        : {};
    if (
      typeof input.endpoint !== "string" ||
      !isAllowedPushEndpoint(input.endpoint)
    ) {
      return errorResponse("通知設定を確認してください。", 400);
    }
    await store.removeById(subscriptionId(input.endpoint));
    return NextResponse.json(
      { subscribed: false },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return errorResponse("通知設定を解除できませんでした。", 500);
  }
}
