/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const WORKER_ORIGIN = "https://stock-predict-board.kospinow.workers.dev";

export default defineConfig({
  plugins: [react()],
  base: "/",

  /*
   * Dev-only proxy to the deployed Worker.
   *
   * The Worker answers /api/markets and friends only for the origins in
   * ALLOWED_ORIGIN — kospinow.com and www — so a page served from localhost got
   * a 200 with no Access-Control-Allow-Origin and the browser dropped it. The
   * ticker went empty, and anything reading the feed silently fell back to its
   * offline behaviour. That is how "국내장 거래 중" survived the holiday fix in
   * local testing: the market data that knew better never reached the page.
   *
   * Proxying makes the browser call its own origin, so there is no preflight and
   * no allowlist to widen. Production is untouched: it talks to the Worker
   * directly, from an origin the Worker already trusts.
   */
  server: {
    proxy: {
      "/api": {
        target: WORKER_ORIGIN,
        changeOrigin: true,
        // The chat room is a WebSocket on the same prefix.
        ws: true,
        headers: { Origin: "https://kospinow.com" },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
