import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Train Live Map｜JR東日本・関東版",
    short_name: "Train Live Map",
    description:
      "JR東日本の関東エリアを走る在来線の列車位置と運行状況を地図上で確認できる非公式Webアプリ。",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    background_color: "#071b14",
    theme_color: "#0b8f50",
    categories: ["navigation", "travel"],
    lang: "ja",
    icons: [
      {
        src: "/icons/train-live-map-jr-east-kanto-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/train-live-map-jr-east-kanto-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/train-live-map-jr-east-kanto-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
