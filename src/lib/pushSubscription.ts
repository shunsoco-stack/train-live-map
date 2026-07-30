import { isAllowedPushEndpoint } from "./communityPush.ts";
import type { WebPushSubscriptionData } from "../types/push.ts";

const MAX_SUBSCRIBED_LINES = 20;
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,256}$/;

export function validatePushSubscription(
  input: unknown,
): WebPushSubscriptionData | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const keys =
    value.keys &&
    typeof value.keys === "object" &&
    !Array.isArray(value.keys)
      ? (value.keys as Record<string, unknown>)
      : null;
  const endpoint =
    typeof value.endpoint === "string" ? value.endpoint : "";
  const p256dh = typeof keys?.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys?.auth === "string" ? keys.auth : "";
  const expirationTime = value.expirationTime;

  if (
    !(
      expirationTime === null ||
      (typeof expirationTime === "number" &&
        Number.isFinite(expirationTime))
    ) ||
    endpoint.length > 2_048 ||
    !isAllowedPushEndpoint(endpoint) ||
    !KEY_PATTERN.test(p256dh) ||
    !KEY_PATTERN.test(auth)
  ) {
    return null;
  }

  return { endpoint, expirationTime, keys: { p256dh, auth } };
}

export function validatePushLineIds(
  input: unknown,
  isAllowedLineId: (lineId: string) => boolean,
): string[] | null {
  if (!Array.isArray(input)) return null;
  const stringLineIds = input.filter(
    (lineId): lineId is string => typeof lineId === "string",
  );
  if (stringLineIds.length !== input.length) return null;

  const lineIds = [...new Set(stringLineIds)];
  if (
    lineIds.length === 0 ||
    lineIds.length > MAX_SUBSCRIBED_LINES ||
    lineIds.some((lineId) => !isAllowedLineId(lineId))
  ) {
    return null;
  }
  return lineIds;
}
