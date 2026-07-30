import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://train-live-map.vercel.app";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dev/debug"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
