import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://train-live-map.vercel.app";
  const lastModified = new Date("2026-07-31T00:00:00.000Z");
  return ["/", "/privacy", "/terms"].map((path) => ({
    url: new URL(path, siteUrl).toString(),
    lastModified,
    changeFrequency: path === "/" ? "daily" : "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
