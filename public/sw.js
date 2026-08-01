/* Train Live Map: app-shell offline fallback + Web Push. API responses are never cached. */

const buildId = new URL(self.location.href).searchParams.get("build") || "local";
const CACHE_PREFIX = "train-live-map-shell-";
const CACHE_NAME = `${CACHE_PREFIX}${buildId}`;
const CORE_URLS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/train-live-map-jr-east-kanto-192.png",
  "/icons/train-live-map-jr-east-kanto-512.png",
];

async function cacheHtmlAndAssets(cache, path) {
  const response = await fetch(path, { cache: "reload" });
  if (!response.ok) return;
  await cache.put(path, response.clone());
  const html = await response.text();
  const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith("/_next/static/"));
  await Promise.all(
    [...new Set(assetUrls)].map(async (url) => {
      try {
        const asset = await fetch(url, { cache: "reload" });
        if (asset.ok) await cache.put(url, asset);
      } catch {
        // One optional asset must not abort installation of the offline page.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all([
        cacheHtmlAndAssets(cache, "/"),
        cacheHtmlAndAssets(cache, "/offline"),
        ...CORE_URLS.slice(2).map(async (url) => {
          try {
            await cache.add(url);
          } catch {
            // Keep installation resilient when an optional icon is unavailable.
          }
        }),
      ]);
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (
          (await cache.match("/offline")) ||
          new Response("オフラインです", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }),
    );
    return;
  }

  const isShellAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest";
  if (!isShellAsset) return;
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" ? data.title : "運転見合わせの可能性";
  const options = {
    body:
      typeof data.body === "string"
        ? data.body
        : "利用者から見合わせ報告が増えています。公式情報をご確認ください。",
    icon: data.icon || "/icons/train-live-map-jr-east-kanto-192.png",
    badge: data.badge || "/icons/train-live-map-jr-east-kanto-192.png",
    tag: data.tag || "community-suspension",
    renotify: true,
    data: { url: data.url || "/", lineId: data.lineId || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let targetUrl = `${self.location.origin}/`;
  try {
    const candidate = new URL(event.notification.data?.url || "/", self.location.origin);
    if (candidate.origin === self.location.origin) targetUrl = candidate.href;
  } catch {
    // Keep the same-origin fallback for malformed notification payloads.
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      for (const windowClient of windows) {
        if (new URL(windowClient.url).origin === self.location.origin) {
          if ("navigate" in windowClient) await windowClient.navigate(targetUrl);
          return windowClient.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
