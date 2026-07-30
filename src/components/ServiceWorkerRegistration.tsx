"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations
              .filter(
                (registration) =>
                  new URL(registration.scope).origin === location.origin,
              )
              .map((registration) => registration.unregister()),
          ),
        )
        .catch(() => undefined);
      return;
    }

    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (!cancelled) void registration.update();
      })
      .catch((error: unknown) => {
        console.error("オフライン機能を準備できませんでした。", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
