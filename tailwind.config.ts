import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        rise: "#ff4d5e",
        fall: "#3f82ff",
        neutral: "#d6dde8",
        accent: "#8b7cff",
        success: "#31c48d",
        warning: "#f5b942",
        danger: "#ff5d6c",
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "Noto Sans KR",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
