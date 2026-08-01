"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deletePushSubscription,
  fetchPushConfig,
  savePushSubscription,
} from "@/lib/apiClient";
import {
  isIOSDevice,
  isStandaloneMode,
  safeReadStorage,
  safeWriteStorage,
} from "@/lib/browserGuidance";
import { registerAppServiceWorker } from "@/lib/serviceWorker";
import type { WebPushSubscriptionData } from "@/types/push";

const PUSH_LINES_STORAGE_KEY = "train-live-map:push-lines-v1";

export type PushNotificationStatus =
  | "checking"
  | "available"
  | "unsupported"
  | "ios-install-required"
  | "denied"
  | "disabled"
  | "error";

interface PushNotificationState {
  status: PushNotificationStatus;
  publicKey: string | null;
  registration: ServiceWorkerRegistration | null;
  subscribedLineIds: string[];
  busy: boolean;
  error: string | null;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function readStoredLineIds(): string[] {
  const stored = safeReadStorage(
    typeof window === "undefined" ? null : window.localStorage,
    PUSH_LINES_STORAGE_KEY,
  );
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter(
              (lineId): lineId is string =>
                typeof lineId === "string",
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

function storeLineIds(lineIds: readonly string[]): void {
  safeWriteStorage(
    window.localStorage,
    PUSH_LINES_STORAGE_KEY,
    JSON.stringify(lineIds),
  );
}

function applicationServerKey(publicKey: string): ArrayBuffer {
  const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
  const base64 = (publicKey + padding)
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = window.atob(base64);
  const bytes = Uint8Array.from(raw, (character) =>
    character.charCodeAt(0),
  );
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function subscriptionData(
  subscription: PushSubscription,
): WebPushSubscriptionData {
  const value = subscription.toJSON();
  if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) {
    throw new Error("通知端末の情報を取得できませんでした。");
  }
  return {
    endpoint: value.endpoint,
    expirationTime: value.expirationTime ?? null,
    keys: {
      p256dh: value.keys.p256dh,
      auth: value.keys.auth,
    },
  };
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    status: "checking",
    publicKey: null,
    registration: null,
    subscribedLineIds: [],
    busy: false,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function initialize() {
      try {
        const config = await fetchPushConfig(controller.signal);
        if (controller.signal.aborted) return;
        if (!config.enabled || !config.publicKey) {
          setState((previous) => ({
            ...previous,
            status: "disabled",
          }));
          return;
        }

        const navigatorWithStandalone =
          navigator as NavigatorWithStandalone;
        const standalone = isStandaloneMode({
          navigatorStandalone: navigatorWithStandalone.standalone,
          displayModeStandalone: window.matchMedia(
            "(display-mode: standalone)",
          ).matches,
        });
        if (
          isIOSDevice(navigator.userAgent, navigator.maxTouchPoints) &&
          !standalone
        ) {
          setState((previous) => ({
            ...previous,
            status: "ios-install-required",
            publicKey: config.publicKey,
          }));
          return;
        }
        if (
          !("serviceWorker" in navigator) ||
          !("PushManager" in window) ||
          !("Notification" in window)
        ) {
          setState((previous) => ({
            ...previous,
            status: "unsupported",
            publicKey: config.publicKey,
          }));
          return;
        }
        if (Notification.permission === "denied") {
          setState((previous) => ({
            ...previous,
            status: "denied",
            publicKey: config.publicKey,
          }));
          return;
        }

        await registerAppServiceWorker();
        const ready = await navigator.serviceWorker.ready;
        const subscription =
          await ready.pushManager.getSubscription();
        const subscribedLineIds = readStoredLineIds();

        if (subscription && subscribedLineIds.length > 0) {
          await savePushSubscription({
            subscription: subscriptionData(subscription),
            lineIds: subscribedLineIds,
          });
        } else if (subscription) {
          await deletePushSubscription({
            endpoint: subscription.endpoint,
          });
          await subscription.unsubscribe();
        }

        if (!controller.signal.aborted) {
          setState({
            status: "available",
            publicKey: config.publicKey,
            registration: ready,
            subscribedLineIds,
            busy: false,
            error: null,
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "通知機能を準備できませんでした。",
        }));
      }
    }

    void initialize();
    return () => controller.abort();
  }, []);

  const toggleLine = useCallback(
    async (lineId: string) => {
      const { publicKey, registration, subscribedLineIds } = state;
      if (
        !publicKey ||
        !registration ||
        state.status !== "available" ||
        state.busy
      ) {
        return false;
      }

      setState((previous) => ({
        ...previous,
        busy: true,
        error: null,
      }));
      try {
        const currentlySubscribed =
          subscribedLineIds.includes(lineId);
        const nextLineIds = currentlySubscribed
          ? subscribedLineIds.filter((id) => id !== lineId)
          : [...new Set([...subscribedLineIds, lineId])];

        // iOSでは通知許可が直接のタップ操作に紐づく必要があるため、
        // 有効化時は他の非同期処理より先に許可を求める。
        if (
          !currentlySubscribed &&
          Notification.permission !== "granted"
        ) {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            setState((previous) => ({
              ...previous,
              status: "denied",
              busy: false,
              error:
                "通知が許可されていません。ブラウザの設定をご確認ください。",
            }));
            return false;
          }
        }

        let subscription =
          await registration.pushManager.getSubscription();
        if (nextLineIds.length === 0) {
          if (subscription) {
            await deletePushSubscription({
              endpoint: subscription.endpoint,
            });
            await subscription.unsubscribe();
          }
        } else {
          if (!subscription) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: applicationServerKey(publicKey),
            });
          }
          await savePushSubscription({
            subscription: subscriptionData(subscription),
            lineIds: nextLineIds,
          });
        }

        storeLineIds(nextLineIds);
        setState((previous) => ({
          ...previous,
          subscribedLineIds: nextLineIds,
          busy: false,
          error: null,
        }));
        return true;
      } catch (error) {
        setState((previous) => ({
          ...previous,
          busy: false,
          error:
            error instanceof Error
              ? error.message
              : "通知設定を更新できませんでした。",
        }));
        return false;
      }
    },
    [state],
  );

  return {
    status: state.status,
    busy: state.busy,
    error: state.error,
    subscribedLineIds: state.subscribedLineIds,
    isSubscribed: (lineId: string) =>
      state.subscribedLineIds.includes(lineId),
    toggleLine,
  };
}
