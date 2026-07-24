import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 鉄道アプリらしい落ち着いたダークテーマ
        rail: {
          bg: "#0a1512",
          surface: "#0f1f1a",
          border: "#1c332b",
          accent: "#10b981", // emerald
          "accent-dark": "#065f46", // dark green
          text: "#e6f2ed",
          muted: "#8fae9f",
        },
        status: {
          running: "#22c55e",
          warn: "#eab308",
          danger: "#ef4444",
          suspended: "#7f1d1d",
          unknown: "#6b7280",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Hiragino Kaku Gothic ProN",
          "Yu Gothic UI",
          "Noto Sans JP",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
