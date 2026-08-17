/**
 * Resolves the API origin every client module talks to.
 *
 * Production reads VITE_BOARD_API_BASE and calls the Worker directly. An empty
 * value there means the deployment genuinely has no backend, and the callers'
 * `is…Configured` flags turn the affected features off.
 *
 * Development is the exception this exists for. The Worker only sends CORS
 * headers to kospinow.com, so a page on localhost got a 200 with no
 * Access-Control-Allow-Origin and the browser threw the body away — the ticker
 * stayed empty and everything reading it silently fell back to its offline
 * behaviour. Leaving the variable empty in .env.development points the calls at
 * this page's own origin instead, where the proxy in vite.config.ts forwards
 * them, and no CORS is involved at all.
 *
 * The check is MODE, not DEV: Vitest also sets DEV, and the config tests assert
 * that an absent variable leaves a feature switched off. Only a real `vite dev`
 * server has the proxy that makes a same-origin base work.
 */
export function resolveApiBase(raw: string | undefined): string {
  const base = (raw ?? "").replace(/\/$/, "");
  if (base) return base;

  if (import.meta.env.MODE === "development" && typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}
