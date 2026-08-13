/**
 * Registers public/sw.js.
 *
 * The worker itself intercepts nothing (see its header). Its only job is to make
 * the site installable on Android, where Chrome withholds beforeinstallprompt
 * from sites without one.
 *
 * Registration waits for load: it is never on the critical path, and competing
 * with the first paint for a button that appears seconds later is a bad trade.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      // A failed registration costs the install button, nothing else.
      console.warn("[pwa] service worker registration failed", error);
    });
  });
}
