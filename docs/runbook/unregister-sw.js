/*
 * Runbook: the "unregister" service worker (13 Nov 2026; steps in docs/runbook/service-worker-off.md).
 * Never built into the app. Deployed in place of /sw.js only when the offline worker must be taken off every phone.
 *
 * On install it takes over at once; on activate it deletes the app's own caches (names starting "joulz-"), keeps
 * IndexedDB (queued offline practice runs and packs stay on the phone), unregisters itself and reloads every open
 * window of the app, which then loads straight from the network. It answers no fetch, so nothing is served from it.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(names.filter((n) => n.startsWith("joulz-")).map((n) => caches.delete(n)));
      } catch (e) {
        // Caches unavailable: unregistering is what matters.
      }
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        try {
          await client.navigate(client.url);
        } catch (e) {
          // A window that can't be navigated picks up the change on its next load.
        }
      }
    })(),
  );
});
