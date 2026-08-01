"use client";

import { useEffect } from "react";
import { registerAppServiceWorker } from "@/lib/serviceWorker";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    void registerAppServiceWorker().catch(() => {
      // 非対応環境や登録拒否でも、オンライン時の通常機能は継続する。
    });
  }, []);

  return null;
}
