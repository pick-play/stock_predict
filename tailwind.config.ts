import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#080b10",
        "surface-1": "#0d1118",
        "surface-2": "#121824",
        "surface-3": "#18202e",
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
