import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

interface LegalPageShellProps {
  title: string;
  lead: string;
  children: ReactNode;
}

export function LegalPageShell({ title, lead, children }: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-rail-bg px-4 py-8 text-rail-text sm:py-12">
      <article className="app-sheet mx-auto max-w-3xl rounded-3xl border px-5 py-6 sm:px-9 sm:py-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300">
          <Image src="/icons/train-live-map-jr-east-kanto-192.png" alt="" width={40} height={40} className="rounded-xl" />
          <span><span className="block text-sm font-bold">Train Live Map</span><span className="block text-xs text-rail-muted">JR東日本・関東版（非公式）</span></span>
        </Link>
        <h1 className="mt-6 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-7 text-rail-muted">{lead}</p>
        <div className="legal-content mt-8 space-y-7 text-sm leading-7 text-rail-muted">{children}</div>
        <nav className="mt-10 flex flex-wrap gap-4 border-t border-rail-border pt-5 text-sm font-semibold">
          <Link href="/" className="text-orange-300 hover:text-orange-200">アプリへ戻る</Link>
          <Link href="/privacy" className="text-orange-300 hover:text-orange-200">プライバシーポリシー</Link>
          <Link href="/terms" className="text-orange-300 hover:text-orange-200">利用規約・免責</Link>
        </nav>
      </article>
    </main>
  );
}
