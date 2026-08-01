"use client";

function buildIdFromDocument(): string {
  const value = document
    .querySelector<HTMLMetaElement>('meta[name="train-live-map-build"]')
    ?.content.trim();
  return value || "local";
}

export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Workerはこのブラウザで利用できません");
  }
  const buildId = encodeURIComponent(buildIdFromDocument());
  return navigator.serviceWorker.register(`/sw.js?build=${buildId}`, {
    scope: "/",
  });
}
