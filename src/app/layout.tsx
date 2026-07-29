import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import "@fontsource/m-plus-rounded-1c/400.css";
import "@fontsource/m-plus-rounded-1c/700.css";
import "@fontsource/m-plus-rounded-1c/800.css";
import { adsenseClientId } from "@/lib/adsense";
import "./globals.css";

const title = "Train Live Map｜JR東日本・関東版";
const description =
  "JR東日本の関東エリアを走る在来線の列車位置と運行状況を地図上で確認できる非公式Webアプリ。";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("127.0.0.1") || host?.startsWith("localhost")
      ? "http"
      : "https");
  const origin = host ? `${protocol}://${host}` : "http://127.0.0.1:3000";
  const imageUrl = new URL(
    "/og-train-live-map-jr-east-kanto.png",
    origin,
  ).toString();

  return {
    title,
    description,
    applicationName: "Train Live Map｜JR東日本・関東版",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "Train Live Map",
      statusBarStyle: "black-translucent",
    },
    formatDetection: {
      telephone: false,
    },
    other: adsenseClientId
      ? { "google-adsense-account": adsenseClientId }
      : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1732,
          height: 907,
          alt: "Train Live Map — JR東日本・関東版の非公式アプリ",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b513b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // iOS Safari で快適に使えるよう、ビューポートを固定
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased">
        {children}
        {adsenseClientId && (
          <Script
            id="google-adsense"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
          />
        )}
      </body>
    </html>
  );
}
