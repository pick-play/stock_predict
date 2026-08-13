/*
 * The smallest service worker that does nothing.
 *
 * It exists for one reason: Chrome will not fire beforeinstallprompt — the event
 * behind "홈 화면에 추가" — unless the site registers a service worker with a
 * fetch handler. Without this file the install button could never appear on
 * Android, however correct the manifest is.
 *
 * It deliberately caches nothing. This site's whole purpose is a price that is
 * current; a cache-first worker would happily serve yesterday's numbers and a
 * stale bundle after a deploy, which is a worse failure than having no offline
 * mode at all. The fetch handler below returns without calling respondWith, so
 * every request goes to the network exactly as it would with no worker present.
 *
 * The activate step deletes any cache that exists, so if a future version ever
 * adds caching and is then rolled back, the leftovers cannot outlive it.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

// Required for installability. Intentionally passes everything through.
self.addEventListener("fetch", () => {});
