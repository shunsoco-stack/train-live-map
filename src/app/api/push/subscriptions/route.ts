import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRailwayCatalogLine } from "@/data/railwayCatalog";
import { isAllowedPushEndpoint } from "@/lib/communityPush";
import {
  validatePushLineIds,
  validatePushSubscription,
} from "@/lib/pushSubscription";
import { getPushSubscriptionStore } from "@/server/pushSubscriptionStore";
import type {
  DeletePushSubscriptionRequest,
  SavePushSubscriptionRequest,
  SavePushSubscriptionResponse,
} from "@/types/push";

export const dynamic = "force-dynamic";

function isLocalRequest(request: NextRequest): boolean {
  return /^(localhost|127\.0\.0\.1)$/.test(request.nextUrl.hostname);
}

function subscriptionId(endpoint: string): string {
  return createHash("sha256")
    .update(endpoint)
    .digest("hex")
    .slice(0, 32);
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "通知設定を確認してください。" },
        { status: 400 },
      );
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "通知設定を確認してください。" },
        { status: 400 },
      );
    }
    const requestBody = body as Partial<SavePushSubscriptionRequest>;
    const subscription = validatePushSubscription(requestBody.subscription);
    const lineIds = validatePushLineIds(requestBody.lineIds, (lineId) => {
      const line = getRailwayCatalogLine(lineId);
      return Boolean(line && line.coverage !== "unavailable");
    });
    if (!subscription || !lineIds) {
      return NextResponse.json(
        { error: "通知設定を確認してください。" },
        { status: 400 },
      );
    }

    const store = getPushSubscriptionStore();
    if (!store.persistent && !isLocalRequest(request)) {
      return NextResponse.json(
        { error: "通知の保存先を準備中です。" },
        { status: 503 },
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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "通知設定を確認してください。" },
        { status: 400 },
      );
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "通知設定を確認してください。" },
        { status: 400 },
      );
    }
    const requestBody = body as Partial<DeletePushSubscriptionRequest>;
    if (
      typeof requestBody.endpoint !== "string" ||
      !isAllowedPushEndpoint(requestBody.endpoint)
    ) {
      return NextResponse.json(
        { error: "通知設定を確認してください。" },
        { status: 400 },
      );
    }
    await getPushSubscriptionStore().removeById(
      subscriptionId(requestBody.endpoint),
    );
    return NextResponse.json({ subscribed: false });
  } catch {
    return NextResponse.json(
      { error: "通知設定を解除できませんでした。" },
      { status: 500 },
    );
  }
}
