"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { safeReadStorage, safeWriteStorage } from "@/lib/browserGuidance";

const STORAGE_KEY = "train-live-map-estimated-motion-hint-v1";

export function EstimatedMotionHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (safeReadStorage(window.localStorage, STORAGE_KEY) !== null) return;
    setVisible(true);
    safeWriteStorage(window.localStorage, STORAGE_KEY, new Date().toISOString());
    const timer = window.setTimeout(() => setVisible(false), 6_000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="app-material pointer-events-none absolute bottom-[8.25rem] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-orange-300/50 px-3 py-2 text-xs font-bold text-rail-text shadow-xl" role="status">
      <Sparkles className="h-4 w-4 text-orange-300" aria-hidden />
      アイコンの動きは推定です
    </div>
  );
}
