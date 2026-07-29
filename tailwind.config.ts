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
        // 東海道線のオレンジが映える、暖色系のダークテーマ
        rail: {
          bg: "#1a1008",
          surface: "#24170d",
          border: "#4a2f1a",
          accent: "#f68b1e", // 東海道線オレンジ
          "accent-dark": "#7c2d12",
          text: "#fff7ed",
          muted: "#c7a98b",
        },
        status: {
          running: "#f68b1e",
          warn: "#eab308",
          danger: "#ef4444",
          suspended: "#7f1d1d",
          unknown: "#6b7280",
        },
      },
      fontFamily: {
        sans: [
          "M PLUS Rounded 1c",
          "Hiragino Maru Gothic ProN",
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
