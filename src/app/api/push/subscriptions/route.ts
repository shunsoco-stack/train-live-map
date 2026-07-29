import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRailwayCatalogLine } from "@/data/railwayCatalog";
import { isAllowedPushEndpoint } from "@/lib/communityPush";
import { getPushSubscriptionStore } from "@/server/pushSubscriptionStore";
import type {
  DeletePushSubscriptionRequest,
  SavePushSubscriptionRequest,
  SavePushSubscriptionResponse,
  WebPushSubscriptionData,
} from "@/types/push";

export const dynamic = "force-dynamic";

const MAX_SUBSCRIBED_LINES = 20;
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,256}$/;

function isLocalRequest(request: NextRequest): boolean {
  return /^(localhost|127\.0\.0\.1)$/.test(request.nextUrl.hostname);
}

function subscriptionId(endpoint: string): string {
  return createHash("sha256")
    .update(endpoint)
    .digest("hex")
    .slice(0, 32);
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
  const expirationTime =
    value.expirationTime === null ||
    typeof value.expirationTime === "number"
      ? value.expirationTime
      : null;

  if (
    endpoint.length > 2048 ||
    !isAllowedPushEndpoint(endpoint) ||
    !KEY_PATTERN.test(p256dh) ||
    !KEY_PATTERN.test(auth)
  ) {
    return null;
  }
  return { endpoint, expirationTime, keys: { p256dh, auth } };
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

export async function POST(request: NextRequest) {
  try {
    const store = getPushSubscriptionStore();
    if (!store.persistent && !isLocalRequest(request)) {
      return NextResponse.json(
        { error: "通知の保存先を準備中です。" },
        { status: 503 },
      );
    }
    const body = (await request.json()) as SavePushSubscriptionRequest;
    const subscription = validateSubscription(body.subscription);
    const lineIds = validateLineIds(body.lineIds);
    if (!subscription || !lineIds) {
      return NextResponse.json(
        { error: "通知設定を確認してください。" },
        { status: 400 },
      );
    }

    const id = subscriptionId(subscription.endpoint);
    const now = new Date().toISOString();
    const existing = (await store.listActive())
      .map((item) => item.record)
      .find((item) => item.id === id);
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
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "通知設定を保存できませんでした。" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as DeletePushSubscriptionRequest;
    if (
      typeof body.endpoint !== "string" ||
      !isAllowedPushEndpoint(body.endpoint)
    ) {
      return NextResponse.json(
        { error: "通知設定を確認してください。" },
        { status: 400 },
      );
    }
    await getPushSubscriptionStore().removeById(
      subscriptionId(body.endpoint),
    );
    return NextResponse.json({ subscribed: false });
  } catch {
    return NextResponse.json(
      { error: "通知設定を解除できませんでした。" },
      { status: 500 },
    );
  }
}
