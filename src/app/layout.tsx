import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { adsenseClientId } from "@/lib/adsense";
import "./globals.css";

const roundedBrandFont = localFont({
  src: "./fonts/m-plus-rounded-brand-routes-700.woff2",
  display: "swap",
  fallback: [
    "Hiragino Maru Gothic ProN",
    "Hiragino Kaku Gothic ProN",
    "Yu Gothic UI",
    "Noto Sans JP",
    "sans-serif",
  ],
  style: "normal",
  variable: "--font-rounded-web",
  weight: "700",
});

const title = "Train Live Map｜JR東日本・関東版";
const description =
  "JR東日本の関東エリアを走る在来線の列車位置と運行状況を地図上で確認できる非公式Webアプリ。";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const metadataBase = (() => {
  try {
    return new URL(configuredSiteUrl || "https://train-live-map.vercel.app");
  } catch {
    return new URL("https://train-live-map.vercel.app");
  }
})();
const imageUrl = new URL(
  "/og-train-live-map-jr-east-kanto.png",
  metadataBase,
).toString();

export const metadata: Metadata = {
  metadataBase,
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
    <html lang="ja" className={roundedBrandFont.variable}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        <AppErrorBoundary>{children}</AppErrorBoundary>
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
