import { notFound } from "next/navigation";
import { DebugView } from "@/features/dev/DebugView";

// 開発時のみアクセス可能。本番ビルドでは 404。
export const dynamic = "force-dynamic";

export default function DebugPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <DebugView />;
}
