import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JR東日本 関東ライブマップ",
    short_name: "JR関東マップ",
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
        src: "/icons/jr-east-kanto-live-map-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/jr-east-kanto-live-map-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/jr-east-kanto-live-map-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
