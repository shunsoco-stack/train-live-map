"use client";

import { useEffect, useRef } from "react";
import {
  adsenseBannerSlotId,
  adsenseClientId,
  isAdsenseBannerEnabled,
} from "@/lib/adsense";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

/**
 * 地図を覆わない、画面下部の小さな AdSense ディスプレイ広告枠。
 * 必要な環境変数が揃うまで DOM 自体を描画しない。
 */
export function AdSenseBanner() {
  const adRef = useRef<HTMLModElement | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (
      !isAdsenseBannerEnabled ||
      requestedRef.current ||
      adRef.current?.dataset.adsbygoogleStatus
    ) {
      return;
    }

    requestedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      requestedRef.current = false;
    }
  }, []);

  if (
    !isAdsenseBannerEnabled ||
    adsenseClientId === null ||
    adsenseBannerSlotId === null
  ) {
    return null;
  }

  return (
    <aside
      aria-label="広告"
      className="shrink-0 border-t border-rail-border bg-rail-surface/95 px-3 py-1"
    >
      <div className="mx-auto w-[320px] max-w-full">
        <span className="block h-2.5 text-[8px] leading-2.5 text-rail-muted">
          広告
        </span>
        <ins
          ref={adRef}
          className="adsbygoogle block overflow-hidden rounded-md"
          style={{
            display: "inline-block",
            width: "320px",
            maxWidth: "100%",
            height: "50px",
          }}
          data-ad-client={adsenseClientId}
          data-ad-slot={adsenseBannerSlotId}
        />
      </div>
    </aside>
  );
}
