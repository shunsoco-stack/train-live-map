export const X_BROWSER_GUIDANCE_STORAGE_KEY =
  "train-live-map-x-browser-guidance-v1";
export const SAFARI_INSTALL_DISMISSED_STORAGE_KEY =
  "train-live-map-safari-install-dismissed-v1";
export const SAFARI_INSTALL_DISMISS_DURATION_MS =
  14 * 24 * 60 * 60 * 1000;

export type BrowserGuidanceKind = "none" | "x-in-app" | "safari-install";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type BrowserStorageKey = "localStorage" | "sessionStorage";

export type BrowserStorageHost = {
  readonly [key in BrowserStorageKey]: StorageLike;
};

export interface BrowserGuidanceSignals {
  userAgent: string;
  maxTouchPoints?: number;
  navigatorStandalone?: boolean;
  displayModeStandalone?: boolean;
  xGuidanceDismissed?: boolean;
  safariDismissedAt?: string | null;
  now?: number;
  isTopPage?: boolean;
}

const IOS_SAFARI_EXCLUSIONS =
  /(CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|FB_IAB|Facebook|Instagram|Line\/|Twitter for iPhone|Twitter for iPad|MicroMessenger|TikTok|Snapchat|DuckDuckGo|Pinterest|LinkedInApp)/i;

/** iPhone / iPad / iPod と、デスクトップ形式UAのiPadOSを判定する。 */
export function isIOSDevice(
  userAgent: string,
  maxTouchPoints = 0,
): boolean {
  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  );
}

/** X公式アプリが付与する明示的なUAだけを対象にする。 */
export function isXInAppBrowser(userAgent: string): boolean {
  return /Twitter for iPhone|Twitter for iPad|TwitterAndroid/i.test(
    userAgent,
  );
}

/** iOS / iPadOSの通常Safari。iOS版他ブラウザとアプリ内ブラウザは除外する。 */
export function isIOSSafari(
  userAgent: string,
  maxTouchPoints = 0,
): boolean {
  if (!isIOSDevice(userAgent, maxTouchPoints)) return false;
  if (!/AppleWebKit/i.test(userAgent)) return false;
  if (!/Version\/[\d.]+/i.test(userAgent) || !/Safari\//i.test(userAgent)) {
    return false;
  }
  return !IOS_SAFARI_EXCLUSIONS.test(userAgent);
}

/** PWAまたはiOSのホーム画面から起動しているかを判定する。 */
export function isStandaloneMode(
  signals: Pick<
    BrowserGuidanceSignals,
    "navigatorStandalone" | "displayModeStandalone"
  >,
): boolean {
  return (
    signals.navigatorStandalone === true ||
    signals.displayModeStandalone === true
  );
}

/** Safari案内の14日間の非表示期限を判定する。 */
export function shouldShowSafariInstallGuidance(
  dismissedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!dismissedAt) return true;
  const timestamp = Number(dismissedAt);
  if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > now) {
    return true;
  }
  return now - timestamp >= SAFARI_INSTALL_DISMISS_DURATION_MS;
}

/**
 * 表示案内を優先順位どおりに1つだけ選ぶ。
 * Xを同一セッションで閉じた場合は、Safari案内へフォールスルーしない。
 */
export function selectBrowserGuidance(
  signals: BrowserGuidanceSignals,
): BrowserGuidanceKind {
  if (isStandaloneMode(signals)) return "none";

  if (isXInAppBrowser(signals.userAgent)) {
    return signals.xGuidanceDismissed ? "none" : "x-in-app";
  }

  if (
    signals.isTopPage !== false &&
    isIOSSafari(signals.userAgent, signals.maxTouchPoints) &&
    shouldShowSafariInstallGuidance(
      signals.safariDismissedAt,
      signals.now,
    )
  ) {
    return "safari-install";
  }

  return "none";
}

export function safeReadStorage(
  storage: StorageLike | null | undefined,
  key: string,
): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeGetBrowserStorage(
  key: BrowserStorageKey,
  host: BrowserStorageHost | null | undefined =
    typeof window === "undefined" ? null : window,
): StorageLike | null {
  try {
    return host?.[key] ?? null;
  } catch {
    return null;
  }
}

export function safeWriteStorage(
  storage: StorageLike | null | undefined,
  key: string,
  value: string,
): boolean {
  try {
    storage?.setItem(key, value);
    return storage != null;
  } catch {
    return false;
  }
}
