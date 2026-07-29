/* JR East Kanto Live Map Web Push service worker. Offline caching is intentionally omitted. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
