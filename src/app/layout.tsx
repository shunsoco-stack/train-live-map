import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { adsenseClientId } from "@/lib/adsense";
import "./globals.css";

const title = "Train Live Map｜関東のJR在来線";
const description =
  "関東のJR在来線の列車位置と運行状況を地図上で確認できるWebアプリ。";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("127.0.0.1") || host?.startsWith("localhost")
      ? "http"
      : "https");
  const origin = host ? `${protocol}://${host}` : "http://127.0.0.1:3000";
  const imageUrl = new URL("/og.png", origin).toString();

  return {
    title,
    description,
    applicationName: "Train Live Map",
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
          alt: "Train Live Map — 関東のJR在来線",
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
  themeColor: "#1a1008",
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
