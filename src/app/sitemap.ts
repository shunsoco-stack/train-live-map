import type { MetadataRoute } from "next";

const ORIGIN = "https://train-live-map.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${ORIGIN}/`, changeFrequency: "daily", priority: 1 },
    { url: `${ORIGIN}/privacy`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${ORIGIN}/terms`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
