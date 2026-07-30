"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("アプリ全体の表示に失敗しました。", error);
  }, [error]);

  return (
    <html lang="ja">
      <body>
        <main
          role="alert"
          style={{
            alignItems: "center",
            background: "#101924",
            color: "#fffaf0",
            display: "flex",
            fontFamily:
              'system-ui, "Hiragino Maru Gothic ProN", sans-serif',
            justifyContent: "center",
            minHeight: "100dvh",
            padding: "24px",
          }}
        >
          <section style={{ maxWidth: "360px", textAlign: "center" }}>
            <h1 style={{ fontSize: "20px", margin: 0 }}>
              表示に問題が発生しました
            </h1>
            <p style={{ color: "#bdc8d5", lineHeight: 1.7 }}>
              アプリを読み込めませんでした。もう一度お試しください。
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                background: "#f97316",
                border: 0,
                borderRadius: "12px",
                color: "white",
                cursor: "pointer",
                font: "inherit",
                fontWeight: 700,
                minHeight: "44px",
                padding: "10px 18px",
              }}
            >
              再読み込み
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
