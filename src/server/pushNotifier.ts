import { createHash } from "node:crypto";
import webpush from "web-push";
import { detectSuspensionSpike } from "@/lib/communityPush";
import { createLogger } from "@/lib/logger";
import { getPushSubscriptionStore } from "@/server/pushSubscriptionStore";
import type { CommunityReportRecord } from "@/types/community";

const logger = createLogger("community-push");
const DEFAULT_VAPID_SUBJECT =
  "mailto:train-live-map-support@gmail.com";
const SEND_BATCH_SIZE = 20;

export interface VapidConfiguration {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function vapidConfiguration(): VapidConfiguration | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT ?? DEFAULT_VAPID_SUBJECT,
  };
}

function statusCodeFromError(error: unknown): number | null {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  return null;
}

interface NotifyInput {
  reports: readonly CommunityReportRecord[];
  lineId: string;
  lineName: string;
  now?: number;
}

export interface NotifyResult {
  detected: boolean;
  attempted: number;
  sent: number;
  removed: number;
}

export async function maybeSendSuspensionSpikeNotification({
  reports,
  lineId,
  lineName,
  now = Date.now(),
}: NotifyInput): Promise<NotifyResult> {
  const spike = detectSuspensionSpike(reports, lineId, now);
  const vapid = vapidConfiguration();
  const store = getPushSubscriptionStore();
  if (!spike.detected || !vapid || !store.persistent) {
    return { detected: spike.detected, attempted: 0, sent: 0, removed: 0 };
  }

  const subscriptions = (await store.listActive(now))
    .map((item) => item.record)
    .filter((record) => record.lineIds.includes(lineId));
  if (subscriptions.length === 0) {
    return { detected: true, attempted: 0, sent: 0, removed: 0 };
  }

  const claimed = await store.claimLineAlert(lineId);
  if (!claimed) {
    return { detected: true, attempted: 0, sent: 0, removed: 0 };
  }

  webpush.setVapidDetails(
    vapid.subject,
    vapid.publicKey,
    vapid.privateKey,
  );
  const payload = JSON.stringify({
    title: `${lineName}で運転見合わせの可能性`,
    body: `直近5分に利用者から${spike.recentSuspended}件の見合わせ報告がありました。公式情報をご確認ください。`,
    icon: "/icons/jr-east-kanto-live-map-192.png",
    badge: "/icons/jr-east-kanto-live-map-192.png",
    url: "/",
    tag: `community-suspension-${lineId}`,
    lineId,
  });
  const topic = createHash("sha256")
    .update(`suspension:${lineId}`)
    .digest("base64url")
    .slice(0, 32);
  let sent = 0;
  let removed = 0;

  for (let index = 0; index < subscriptions.length; index += SEND_BATCH_SIZE) {
    const batch = subscriptions.slice(index, index + SEND_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((record) =>
        webpush.sendNotification(record.subscription, payload, {
          TTL: 10 * 60,
          urgency: "high",
          topic,
        }),
      ),
    );

    for (let offset = 0; offset < results.length; offset += 1) {
      const result = results[offset];
      if (result.status === "fulfilled") {
        sent += 1;
        continue;
      }
      const statusCode = statusCodeFromError(result.reason);
      if (statusCode === 404 || statusCode === 410) {
        await store.removeById(batch[offset].id);
        removed += 1;
      } else {
        logger.warn("Web Push delivery failed", {
          lineId,
          statusCode,
        });
      }
    }
  }

  logger.info("Community suspension spike notification completed", {
    lineId,
    reports: spike.recentSuspended,
    attempted: subscriptions.length,
    sent,
    removed,
  });
  return {
    detected: true,
    attempted: subscriptions.length,
    sent,
    removed,
  };
}
