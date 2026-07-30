const buildId =
  process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
  `local-${process.env.npm_package_version || "development"}`;

const serviceWorkerSource = `
/* Train Live Map app-shell and Web Push service worker. */
const BUILD_ID = ${JSON.stringify(buildId)};
const CACHE_PREFIX = "train-live-map-shell-";
const CACHE_NAME = CACHE_PREFIX + BUILD_ID;
const REQUIRED_SHELL_PATHS = ["/", "/offline"];
const OPTIONAL_SHELL_PATHS = [
  "/manifest.webmanifest",
  "/icons/train-live-map-jr-east-kanto-192.png",
  "/icons/train-live-map-jr-east-kanto-512.png"
];

async function fetchAndCache(cache, path) {
  try {
    const response = await fetch(new Request(path, { cache: "reload" }));
    if (response.ok && response.type !== "opaque") {
      await cache.put(path, response.clone());
    }
    return response;
  } catch {
    return null;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const requiredResponses = await Promise.all(
      REQUIRED_SHELL_PATHS.map((path) => fetchAndCache(cache, path)),
    );
    if (requiredResponses.some((response) => !response || !response.ok)) {
      throw new Error("Required app-shell HTML could not be cached");
    }
    await Promise.all(
      OPTIONAL_SHELL_PATHS.map((path) => fetchAndCache(cache, path)),
    );
    const assetPaths = new Set();
    for (const response of requiredResponses) {
      const contentType = response && response.headers.get("content-type");
      if (!response || !contentType || !contentType.includes("text/html")) {
        continue;
      }
      const html = await response.clone().text();
      const matches =
        html.match(/\\/_next\\/static\\/[^"'\\s<>]+/g) || [];
      for (const path of matches) assetPaths.add(path.replaceAll("&amp;", "&"));
    }
    if (assetPaths.size === 0) {
      throw new Error("App-shell assets were not found");
    }
    const assetResponses = await Promise.all(
      [...assetPaths].map((path) => fetchAndCache(cache, path)),
    );
    if (assetResponses.some((response) => !response || !response.ok)) {
      throw new Error("Required app-shell assets could not be cached");
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map((name) => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.status >= 500) {
          throw new Error("Navigation request failed");
        }
        if (response.ok && url.pathname === "/") {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/", response.clone());
        }
        return response;
      } catch {
        return (
          (await caches.match("/offline")) ||
          (await caches.match(request)) ||
          Response.error()
        );
      }
    })());
    return;
  }

  const isAppAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest";
  if (!isAppAsset) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type !== "opaque") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title =
    typeof data.title === "string"
      ? data.title
      : "運転見合わせの可能性";
  const options = {
    body:
      typeof data.body === "string"
        ? data.body
        : "利用者から見合わせ報告が増えています。公式情報をご確認ください。",
    icon: data.icon || "/icons/train-live-map-jr-east-kanto-192.png",
    badge: data.badge || "/icons/train-live-map-jr-east-kanto-192.png",
    tag: data.tag || "community-suspension",
    renotify: true,
    data: {
      url: data.url || "/",
      lineId: data.lineId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        for (const windowClient of windows) {
          if (new URL(windowClient.url).origin === self.location.origin) {
            if ("navigate" in windowClient) {
              await windowClient.navigate(targetUrl);
            }
            return windowClient.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
`;

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(serviceWorkerSource, {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
    },
  });
}
