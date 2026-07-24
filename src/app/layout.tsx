import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Train Live Map｜東海道線 東京〜横浜",
  description:
    "東海道線 東京〜横浜間の電車位置を地図上で確認できる検証用アプリ(モックデータ)。",
};

export const viewport: Viewport = {
  themeColor: "#0a1512",
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
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
