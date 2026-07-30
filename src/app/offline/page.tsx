import type { Metadata } from "next";
import { OfflinePageContent } from "./OfflinePageContent";

export const metadata: Metadata = {
  title: "オフライン｜Train Live Map",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return <OfflinePageContent />;
}
