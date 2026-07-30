"use client";

import { useEffect, useState } from "react";
import {
  safeGetBrowserStorage,
  safeReadStorage,
  safeWriteStorage,
} from "@/lib/browserGuidance";

const ESTIMATED_MOTION_TIP_KEY =
  "train-live-map:estimated-motion-tip:v1";
const TIP_DURATION_MS = 5_000;

interface EstimatedMotionTipProps {
  ready: boolean;
}

export function EstimatedMotionTip({
  ready,
}: EstimatedMotionTipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const storage = safeGetBrowserStorage("localStorage");
    if (safeReadStorage(storage, ESTIMATED_MOTION_TIP_KEY) === "seen") {
      return;
    }

    setVisible(true);
    safeWriteStorage(storage, ESTIMATED_MOTION_TIP_KEY, "seen");
    const timer = window.setTimeout(
      () => setVisible(false),
      TIP_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (!visible) return null;

  return (
    <p
      role="status"
      className="app-material pointer-events-none absolute bottom-[8.25rem] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-sky-300/50 px-3 py-2 text-xs font-semibold text-rail-text shadow-lg"
    >
      アイコンの動きは推定です
    </p>
  );
}
