import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Train Live Map",
    short_name: "Train Map",
    description:
      "関東のJR在来線の列車位置と運行状況を地図上で確認できるWebアプリ。",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1a1008",
    theme_color: "#f68b1e",
    categories: ["navigation", "travel"],
    lang: "ja",
    icons: [
      {
        src: "/icons/train-live-map-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/train-live-map-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/train-live-map-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
