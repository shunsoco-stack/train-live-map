import assert from "node:assert/strict";
import test from "node:test";
import {
  SAFARI_INSTALL_DISMISS_DURATION_MS,
  isIOSSafari,
  isIOSDevice,
  isXInAppBrowser,
  safeGetBrowserStorage,
  safeReadStorage,
  safeWriteStorage,
  selectBrowserGuidance,
  shouldShowSafariInstallGuidance,
  type StorageLike,
} from "./browserGuidance.ts";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPADOS_DESKTOP_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

test("iPhone Safariではホーム画面追加案内を選ぶ", () => {
  assert.equal(
    selectBrowserGuidance({ userAgent: IPHONE_SAFARI }),
    "safari-install",
  );
});

test("iPad Safariではホーム画面追加案内を選ぶ", () => {
  assert.equal(
    selectBrowserGuidance({ userAgent: IPAD_SAFARI }),
    "safari-install",
  );
});

test("iPadOSのデスクトップ形式UAでもSafariと判定する", () => {
  assert.equal(isIOSDevice(IPADOS_DESKTOP_SAFARI, 5), true);
  assert.equal(isIOSSafari(IPADOS_DESKTOP_SAFARI, 5), true);
  assert.equal(
    selectBrowserGuidance({
      userAgent: IPADOS_DESKTOP_SAFARI,
      maxTouchPoints: 5,
    }),
    "safari-install",
  );
});

test("macOS Safariでは案内しない", () => {
  assert.equal(isIOSSafari(MAC_SAFARI, 0), false);
  assert.equal(selectBrowserGuidance({ userAgent: MAC_SAFARI }), "none");
});

for (const [name, token] of [
  ["iOS Chrome", "CriOS/126.0.0.0"],
  ["iOS Firefox", "FxiOS/128.0"],
  ["iOS Edge", "EdgiOS/126.0"],
  ["Opera iOS", "OPiOS/4.2.0"],
  ["Googleアプリ", "GSA/330.0.678391666"],
  ["Facebook", "FBAN/FBIOS;FBAV/470.0"],
  ["Instagram", "Instagram 340.0.0.0"],
  ["LINE", "Line/14.12.0"],
] as const) {
  test(`${name}ではSafari案内を表示しない`, () => {
    const userAgent = IPHONE_SAFARI.replace(
      "Version/18.0",
      `Version/18.0 ${token}`,
    );
    assert.equal(isIOSSafari(userAgent), false);
    assert.equal(selectBrowserGuidance({ userAgent }), "none");
  });
}

test("XのiOSとAndroidではX案内を選ぶ", () => {
  const iosX =
    "Twitter for iPhone/10.60 iOS/18.0 (Apple;iPhone15,4;;;;;1;2026)";
  const androidX =
    "Mozilla/5.0 TwitterAndroid/10.60.0 Android/15";
  assert.equal(isXInAppBrowser(iosX), true);
  assert.equal(isXInAppBrowser(androidX), true);
  assert.equal(selectBrowserGuidance({ userAgent: iosX }), "x-in-app");
  assert.equal(selectBrowserGuidance({ userAgent: androidX }), "x-in-app");
});

test("一般的なAndroid WebViewをXと誤判定しない", () => {
  const androidWebView =
    "Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36";
  assert.equal(isXInAppBrowser(androidWebView), false);
  assert.equal(
    selectBrowserGuidance({ userAgent: androidWebView }),
    "none",
  );
});

test("ホーム画面起動中はすべて非表示", () => {
  assert.equal(
    selectBrowserGuidance({
      userAgent: "Twitter for iPhone/10.60",
      navigatorStandalone: true,
    }),
    "none",
  );
  assert.equal(
    selectBrowserGuidance({
      userAgent: IPHONE_SAFARI,
      displayModeStandalone: true,
    }),
    "none",
  );
});

test("X案内を閉じた同一セッションではSafari案内へ切り替えない", () => {
  const hybridUserAgent = `${IPHONE_SAFARI} Twitter for iPhone/10.60`;
  assert.equal(
    selectBrowserGuidance({
      userAgent: hybridUserAgent,
      xGuidanceDismissed: true,
    }),
    "none",
  );
});

test("Safari案内は閉じて14日未満なら非表示、14日後は再表示", () => {
  const now = Date.UTC(2026, 6, 29);
  assert.equal(
    shouldShowSafariInstallGuidance(
      String(now - SAFARI_INSTALL_DISMISS_DURATION_MS + 1),
      now,
    ),
    false,
  );
  assert.equal(
    shouldShowSafariInstallGuidance(
      String(now - SAFARI_INSTALL_DISMISS_DURATION_MS),
      now,
    ),
    true,
  );
});

test("不正または未来の保存日時は安全に再表示する", () => {
  const now = Date.UTC(2026, 6, 29);
  assert.equal(shouldShowSafariInstallGuidance("not-a-date", now), true);
  assert.equal(shouldShowSafariInstallGuidance(String(now + 1), now), true);
});

test("トップページ以外ではSafari案内を表示しない", () => {
  assert.equal(
    selectBrowserGuidance({
      userAgent: IPHONE_SAFARI,
      isTopPage: false,
    }),
    "none",
  );
});

test("ストレージ利用不可でも読み書きが例外にならない", () => {
  const blockedStorage: StorageLike = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  assert.equal(safeReadStorage(blockedStorage, "key"), null);
  assert.equal(safeWriteStorage(blockedStorage, "key", "value"), false);
});

test("ブラウザのストレージgetterが例外でも安全に扱う", () => {
  const blockedHost = Object.defineProperties(
    {},
    {
      localStorage: {
        get() {
          throw new Error("blocked");
        },
      },
      sessionStorage: {
        get() {
          throw new Error("blocked");
        },
      },
    },
  );

  assert.equal(
    safeGetBrowserStorage(
      "localStorage",
      blockedHost as never,
    ),
    null,
  );
  assert.equal(
    safeGetBrowserStorage(
      "sessionStorage",
      blockedHost as never,
    ),
    null,
  );
});
