import { NextRequest, NextResponse } from "next/server";
import { getPushSubscriptionStore } from "@/server/pushSubscriptionStore";
import { vapidConfiguration } from "@/server/pushNotifier";
import type { PushConfigResponse } from "@/types/push";

export const dynamic = "force-dynamic";

function isLocalRequest(request: NextRequest): boolean {
  return /^(localhost|127\.0\.0\.1)$/.test(request.nextUrl.hostname);
}

export async function GET(request: NextRequest) {
  const vapid = vapidConfiguration();
  const store = getPushSubscriptionStore();
  const enabled =
    vapid !== null && (store.persistent || isLocalRequest(request));
  const response: PushConfigResponse = {
    enabled,
    publicKey: enabled ? vapid.publicKey : null,
  };
  return NextResponse.json(response);
}
