"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Ellipsis,
  ExternalLink,
  Share2,
  SquarePlus,
  X,
} from "lucide-react";
import {
  SAFARI_INSTALL_DISMISSED_STORAGE_KEY,
  X_BROWSER_GUIDANCE_STORAGE_KEY,
  safeReadStorage,
  safeWriteStorage,
  selectBrowserGuidance,
  type BrowserGuidanceKind,
  type StorageLike,
} from "@/lib/browserGuidance";

interface BrowserGuidanceProps {
  hideSafariInstallGuidance?: boolean;
}

function getBrowserStorage(
  key: "localStorage" | "sessionStorage",
): StorageLike | null {
  try {
    return window[key];
  } catch {
    return null;
  }
}

export function BrowserGuidance({
  hideSafariInstallGuidance = false,
}: BrowserGuidanceProps) {
  const [guidance, setGuidance] =
    useState<BrowserGuidanceKind>("none");
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const continueButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const preview =
      /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
        ? new URLSearchParams(window.location.search).get(
            "browser-guidance-preview",
          )
        : null;
    if (preview === "x" || preview === "safari") {
      setGuidance(preview === "x" ? "x-in-app" : "safari-install");
      return;
    }

    const sessionStorage = getBrowserStorage("sessionStorage");
    const localStorage = getBrowserStorage("localStorage");
    const navigatorWithStandalone = window.navigator as Navigator & {
      standalone?: boolean;
    };

    setGuidance(
      selectBrowserGuidance({
        userAgent: window.navigator.userAgent,
        maxTouchPoints: window.navigator.maxTouchPoints,
        navigatorStandalone: navigatorWithStandalone.standalone === true,
        displayModeStandalone: window.matchMedia(
          "(display-mode: standalone)",
        ).matches,
        xGuidanceDismissed:
          safeReadStorage(
            sessionStorage,
            X_BROWSER_GUIDANCE_STORAGE_KEY,
          ) === "dismissed",
        safariDismissedAt: safeReadStorage(
          localStorage,
          SAFARI_INSTALL_DISMISSED_STORAGE_KEY,
        ),
        isTopPage: window.location.pathname === "/",
      }),
    );
  }, []);

  const dismissXGuidance = useCallback(() => {
    safeWriteStorage(
      getBrowserStorage("sessionStorage"),
      X_BROWSER_GUIDANCE_STORAGE_KEY,
      "dismissed",
    );
    setGuidance("none");
  }, []);

  const dismissSafariGuidance = useCallback(() => {
    safeWriteStorage(
      getBrowserStorage("localStorage"),
      SAFARI_INSTALL_DISMISSED_STORAGE_KEY,
      String(Date.now()),
    );
    setGuidance("none");
  }, []);

  useEffect(() => {
    if (guidance !== "x-in-app") return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (!dialog.open) dialog.showModal();
    const frame = window.requestAnimationFrame(() =>
      continueButtonRef.current?.focus(),
    );

    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog.open) dialog.close();
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [guidance]);

  return (
    <>
      {guidance === "x-in-app" && (
        <dialog
          ref={dialogRef}
          className="browser-guidance-dialog app-sheet w-[calc(100%-2rem)] max-w-sm rounded-3xl border p-0 text-left text-rail-text"
          aria-labelledby="x-browser-guidance-title"
          aria-describedby="x-browser-guidance-description"
          onCancel={(event) => {
            event.preventDefault();
            dismissXGuidance();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              dismissXGuidance();
            }
          }}
        >
          <div className="p-5">
            <div className="flex items-start gap-3">
              <Image
                src="/icons/train-live-map-jr-east-kanto-192.png"
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-[0.9rem] shadow-lg"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-[0.02em] text-orange-200">
                  Train Live Map｜JR東日本・関東版
                </p>
                <h2
                  id="x-browser-guidance-title"
                  className="mt-0.5 text-lg font-bold tracking-[-0.015em]"
                >
                  Xアプリ内で開いています
                </h2>
              </div>
            </div>

            <p
              id="x-browser-guidance-description"
              className="mt-4 text-sm leading-6 text-rail-muted"
            >
              より快適にご覧いただくには、Xの「…」メニューから「ブラウザで開く」または「Safariで開く」を選ぶのがおすすめです。
            </p>

            <div
              className="mt-4 flex items-center gap-2 rounded-2xl border border-orange-300/25 bg-black/20 px-3 py-2.5 text-xs font-semibold text-orange-100"
              aria-hidden
            >
              <Ellipsis className="h-5 w-5 shrink-0" />
              <ChevronRight className="h-4 w-4 shrink-0 text-rail-muted" />
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span>ブラウザで開く</span>
            </div>

            <button
              ref={continueButtonRef}
              type="button"
              onClick={dismissXGuidance}
              className="pressable mt-5 min-h-11 w-full rounded-xl bg-rail-accent px-4 text-sm font-bold text-black shadow-lg shadow-orange-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 focus-visible:ring-offset-2 focus-visible:ring-offset-rail-surface"
            >
              このまま見る
            </button>
          </div>
        </dialog>
      )}

      {guidance === "safari-install" &&
        !hideSafariInstallGuidance && (
          <section
            role="region"
            aria-labelledby="safari-install-guidance-title"
            className="browser-guidance-card app-material pointer-events-auto z-30 rounded-2xl border border-orange-300/35 p-3.5 text-rail-text"
          >
            <div className="flex items-start gap-3">
              <Image
                src="/icons/train-live-map-jr-east-kanto-192.png"
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-xl shadow-md"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <h2
                  id="safari-install-guidance-title"
                  className="text-[0.9375rem] font-bold tracking-[-0.01em]"
                >
                  ホーム画面からすぐ開けます
                </h2>
                <p className="mt-1 text-xs leading-5 text-rail-muted">
                  Safariの共有メニューから追加すると、このアプリをホーム画面からすぐ開けます。
                </p>
              </div>
              <button
                type="button"
                onClick={dismissSafariGuidance}
                className="pressable -mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-rail-muted hover:bg-white/5 hover:text-rail-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                aria-label="ホーム画面への追加案内を閉じる"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <ol
              className="mt-3 flex items-center gap-1 text-[0.6875rem] font-bold text-orange-100"
              aria-label="共有、ホーム画面に追加、追加の順に操作します"
            >
              <li className="flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-orange-400/12 px-1.5">
                <Share2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>共有</span>
              </li>
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-rail-muted"
                aria-hidden
              />
              <li className="flex min-h-9 min-w-0 flex-[1.65] items-center justify-center gap-1 rounded-lg bg-orange-400/12 px-1.5">
                <SquarePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">ホーム画面に追加</span>
              </li>
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-rail-muted"
                aria-hidden
              />
              <li className="flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-lg bg-orange-400/12 px-1.5">
                追加
              </li>
            </ol>

            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-[0.6875rem] leading-4 text-rail-muted">
                共有が見つからない場合は「…」→「共有」を選んでください。
              </p>
              <button
                type="button"
                onClick={dismissSafariGuidance}
                className="pressable min-h-11 shrink-0 rounded-xl px-3 text-xs font-bold text-orange-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                あとで
              </button>
            </div>
          </section>
        )}
    </>
  );
}
