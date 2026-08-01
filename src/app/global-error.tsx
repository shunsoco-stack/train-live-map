"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, background: "#071b14", color: "#fffaf0", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
          <section role="alert" style={{ maxWidth: 420, textAlign: "center" }}>
            <h1>アプリを起動できませんでした</h1>
            <p style={{ color: "#d6c8bb", lineHeight: 1.7 }}>通信状況を確認して、もう一度お試しください。</p>
            <button type="button" onClick={reset} style={{ minHeight: 44, border: 0, borderRadius: 12, padding: "0 20px", background: "#f7941d", color: "#1e1208", fontWeight: 700 }}>
              再読み込み
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
