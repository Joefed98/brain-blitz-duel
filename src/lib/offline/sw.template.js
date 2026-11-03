/* Joulz's service worker (offline practice, 31 Oct 2026). Written by hand; the build (swPlugin.ts) fills in
 * CONFIG with this build's id, its app files, its media files and the pages to keep, and writes the result
 * to /sw.js. It never runs in the dev server.
 *
 *  - App files (JS, CSS, the kept pages, icons, fonts) live in one cache per build, "joulz-app-<build>".
 *    A new build's worker installs beside the old one and waits; the page tells it to take over only when
 *    no run is on screen (serviceWorker.ts), so a run in progress is never interrupted. The newest two
 *    builds' caches are kept, so a page still on the previous build can load its own lazy chunks.
 *  - Media (sounds and music, tile images, the word list) is the same file under the same name from build to
 *    build, so it lives in one shared cache, "joulz-media-v1": a new build only downloads what changed. A
 *    file is "changed" when it is missing or its kept bytes' SHA-256 differs from CONFIG.mediaHash (3 Nov
 *    2026: before that a redrawn tile or a replaced recording kept its old copy for good, since requests
 *    ignore the ?v= hash and install fetched only missing paths).
 *  - Navigations go to the network first (a fresh page whenever there is signal), then to the kept page
 *    for that path, then to a small offline page that points to Practice (rooms, tournaments, the daily
 *    and challenges need a connection).
 *  - Server calls, and anything not a GET, are never touched.
 */
const CONFIG = __OFFLINE_CONFIG__;

const APP_CACHE = `joulz-app-${CONFIG.version}`;
const MEDIA_CACHE = "joulz-media-v1";
const FONT_CACHE = "joulz-fonts-v1";
const APP_PREFIX = "joulz-app-";
/** How long a navigation waits for the network before the kept page is used (a weak signal underground). */
const NAV_TIMEOUT_MS = 4000;
const MEDIA_PREFIXES = ["/sounds/", "/tiles/", "/wordfall/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const app = await caches.open(APP_CACHE);
      // Every app file and kept page must be stored, or this build isn't installed (the browser tries again later).
      await addAll(app, [...CONFIG.app, ...CONFIG.pages], true);
      // Media is shared between builds: only what this cache lacks is fetched.
      const media = await caches.open(MEDIA_CACHE);
      const have = new Set((await media.keys()).map((r) => new URL(r.url).pathname));
      const stale = await staleMedia(media, CONFIG.media.filter((path) => have.has(path)));
      await addAll(media, CONFIG.media.filter((path) => !have.has(path) || stale.has(path)), false);
      await cacheGoogleFonts();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // The newest two builds' app caches stay (a page still on the previous build loads its own chunks).
      const keep = await rememberBuild();
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(APP_PREFIX) && !keep.includes(n)).map((n) => caches.delete(n)));
      // Media this build no longer lists (a removed sound) is dropped.
      const media = await caches.open(MEDIA_CACHE);
      const listed = new Set([...CONFIG.media, BUILD_KEY]);
      await Promise.all(
        (await media.keys()).filter((r) => !listed.has(new URL(r.url).pathname)).map((r) => media.delete(r)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") void self.skipWaiting();
  if (data.type === "VERSION" && event.ports && event.ports[0]) event.ports[0].postMessage({ version: CONFIG.version });
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api/")) return;
    if (url.pathname === "/sw.js") return;
    if (request.mode === "navigate") {
      event.respondWith(navigation(request, url));
      return;
    }
    if (MEDIA_PREFIXES.some((p) => url.pathname.startsWith(p))) {
      event.respondWith(cacheFirst(request, MEDIA_CACHE, true));
      return;
    }
    event.respondWith(cacheFirst(request, APP_CACHE, false));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(request, FONT_CACHE, false));
  }
});

async function navigation(request, url) {
  try {
    const response = await withTimeout(fetch(request), NAV_TIMEOUT_MS);
    if (response) return response;
  } catch {
    /* no signal: the kept page below */
  }
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (CONFIG.pages.includes(path)) {
    const kept = await caches.match(path, { ignoreSearch: true });
    if (kept) return kept;
  }
  return offlinePage();
}

async function cacheFirst(request, cacheName, ignoreSearch) {
  const hit = await caches.match(request, { ignoreSearch });
  if (hit) return hit;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    const copy = response.clone();
    void caches.open(cacheName).then((cache) => cache.put(ignoreSearch ? stripSearch(request.url) : request, copy)).catch(() => {});
  }
  return response;
}

/** Kept media whose bytes no longer match this build's hash (each kept copy hashed on the phone). */
async function staleMedia(cache, paths) {
  const stale = new Set();
  const hashes = CONFIG.mediaHash || {};
  for (const path of paths) {
    const want = hashes[path];
    if (!want) continue;
    try {
      const hit = await cache.match(path, { ignoreSearch: true });
      if (!hit) {
        stale.add(path);
        continue;
      }
      const digest = await crypto.subtle.digest("SHA-256", await hit.arrayBuffer());
      const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      if (hex !== want) stale.add(path);
    } catch {
      stale.add(path);
    }
  }
  return stale;
}

function stripSearch(href) {
  const url = new URL(href);
  url.search = "";
  return url.href;
}

async function addAll(cache, paths, required) {
  const queue = paths.slice();
  const failures = [];
  const worker = async () => {
    while (queue.length > 0) {
      const path = queue.shift();
      try {
        const response = await fetch(new Request(path, { cache: "reload", credentials: "same-origin" }));
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        await cache.put(path, response);
      } catch (error) {
        failures.push(String(error));
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  if (required && failures.length > 0) throw new Error(`offline install: ${failures.slice(0, 3).join(", ")}`);
}

/** The Google-hosted font families the page asks for (best effort; the self-hosted fonts are app files). */
async function cacheGoogleFonts() {
  if (!CONFIG.googleFonts) return;
  try {
    const cache = await caches.open(FONT_CACHE);
    const css = await fetch(CONFIG.googleFonts, { mode: "cors" });
    if (!css.ok) return;
    const text = await css.clone().text();
    await cache.put(CONFIG.googleFonts, css);
    const files = Array.from(text.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g), (m) => m[1]);
    await Promise.all(
      files.map(async (file) => {
        const response = await fetch(file, { mode: "cors" });
        if (response.ok) await cache.put(file, response);
      }),
    );
  } catch {
    /* the fonts fall back to the system's; nothing else depends on them */
  }
}

const BUILD_KEY = "/__joulz-builds";
/** Adds this build to the list of activated builds (oldest first) and returns the last two. */
async function rememberBuild() {
  let builds = [];
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const hit = await cache.match(BUILD_KEY);
    builds = hit ? JSON.parse(await hit.text()) : [];
    if (!Array.isArray(builds)) builds = [];
    builds = builds.filter((n) => n !== APP_CACHE).concat(APP_CACHE).slice(-2);
    await cache.put(BUILD_KEY, new Response(JSON.stringify(builds)));
  } catch {
    builds = [APP_CACHE];
  }
  return builds;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function offlinePage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#0B0B0F"><title>Joulz – offline</title><style>
html,body{margin:0;height:100%;background:#07070A;color:#F5F5F7;font-family:Manrope,system-ui,-apple-system,sans-serif}
main{box-sizing:border-box;min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:calc(env(safe-area-inset-top) + 24px) 24px calc(env(safe-area-inset-bottom) + 24px);text-align:center}
h1{margin:0;font-size:26px;font-weight:800}p{margin:0;max-width:300px;font-size:15px;line-height:1.4;color:#BDBDCC}
a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 28px;border-radius:14px;background:linear-gradient(180deg,#F7D77E,#E2B23F);color:#151006;font-weight:800;font-size:16px;text-decoration:none}
</style></head><body><main data-offline-page><h1>You're offline</h1><p>Rooms, tournaments, the daily and challenges need a connection. Practice still works.</p><a href="/practice" data-offline-practice>Go to Practice</a></main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
