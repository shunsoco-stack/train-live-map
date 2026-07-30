import Link from "next/link";
import type { ReactNode } from "react";

interface LegalPageLayoutProps {
  title: string;
  lead: string;
  children: ReactNode;
}

export function LegalPageLayout({
  title,
  lead,
  children,
}: LegalPageLayoutProps) {
  return (
    <main className="min-h-[100dvh] bg-rail-bg px-4 py-8 text-rail-text safe-top safe-bottom">
      <article className="app-material mx-auto max-w-2xl rounded-3xl border border-rail-border p-5 shadow-xl sm:p-8">
        <Link
          href="/"
          className="pressable inline-flex min-h-11 items-center rounded-full border border-rail-border px-4 text-sm font-semibold text-rail-text hover:border-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          地図へ戻る
        </Link>
        <h1 className="mt-6 text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-rail-muted">{lead}</p>
        <div className="legal-content mt-7 space-y-7 text-sm leading-7">
          {children}
        </div>
        <p className="mt-8 border-t border-rail-border pt-5 text-xs text-rail-muted">
          最終更新日: 2026年7月31日
        </p>
      </article>
    </main>
  );
}
