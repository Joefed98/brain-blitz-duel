/* Joulz's phone notifications in the service worker (wave 2 train B, session B2; docs/push-notifications.md). Appended
 * by the build (swPlugin.ts) after the offline worker (sw.template.js), whose install, activate, message and fetch
 * handlers it leaves exactly as they are: this part only listens for "push" and "notificationclick".
 *
 *  - push: the server's payload (src/lib/push/messages.ts PushPayload, encrypted for this device) is shown as a
 *    notification. A push with no readable payload shows nothing.
 *  - notificationclick: focuses an open Joulz window and takes it to the notification's link, or opens one; the link
 *    carries ?notif=<event> so the page records notification_opened. Only same-site paths are opened.
 */
self.addEventListener("push", (event) => {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }
  if (!payload || typeof payload.title !== "string") return;
  const url = typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//") ? payload.url : "/";
  const kind = typeof payload.event === "string" && /^[a-z_]{1,40}$/.test(payload.event) ? payload.event : "";
  const link = kind ? `${url}${url.includes("?") ? "&" : "?"}notif=${kind}` : url;
  event.waitUntil(
    self.registration.showNotification(payload.title.slice(0, 80), {
      body: typeof payload.body === "string" ? payload.body.slice(0, 160) : "",
      icon: "/app-icon-192.png",
      badge: "/favicon-32.png",
      tag: typeof payload.tag === "string" ? payload.tag.slice(0, 64) : undefined,
      data: { link },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  const target = new URL(link, self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of open) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          await client.focus();
          if (typeof client.navigate === "function") await client.navigate(target.href);
          else client.postMessage({ type: "NOTIFICATION_OPEN", link: target.href });
          return;
        } catch {
          /* try the next window, or open one */
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
