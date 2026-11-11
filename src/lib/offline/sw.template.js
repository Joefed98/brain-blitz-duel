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
 *    The sounds once hosted by Lovable (CONFIG.lazyMedia, 7 Nov 2026) are not fetched on install: each is
 *    kept in the media cache once played (the fetch handler), across builds, and dropped when its bytes change.
 *  - What install downloads (8 Nov 2026, the performance audit's item 2). A worker registered as
 *    "/sw.js?fill=later" (a device that hasn't finished a practice round, or is on Save-Data, a metered or
 *    2G-class connection, Battery saver, or a room: serviceWorker.ts) downloads nothing on install; nor does any
 *    install on Save-Data, a metered or 2G-class connection, or while a room, daily or challenge is open. Either
 *    way it only drops kept media whose bytes changed. The page asks for the download later with a FILL message,
 *    once offline practice may download (packs.ts offlineDownloadAllowed).
 *  - A download takes only what changed (fill()): a file this build lists under the same hash as the last
 *    download (CONFIG.appHash, CONFIG.mediaHash, against MANIFEST_KEY's record) is copied from the cache that
 *    holds it, or kept where it is, not fetched; a content-hashed bundle file already kept by any build is
 *    copied. So a new build fetches its changed chunks and the kept pages. Kept media is hashed on the phone
 *    only when the record doesn't know its bytes (a device from before the record, a file kept once played).
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
/** The last download's record (in the media cache): what each kept file's bytes are, and where the app files are. */
const MANIFEST_KEY = "/__joulz-manifest";
/** Screens a download never competes with (a live round's sends and its realtime socket). */
const ROOM_PATHS = ["/duel", "/daily", "/challenge"];
const SLOW_CONNECTIONS = ["slow-2g", "2g"];
/** How long a download waits for the Google-hosted font (best effort). */
const FONT_TIMEOUT_MS = 10000;
/** A bundle file named by its content (Vite's "[name]-[hash].ext"): the same name is the same bytes. */
const IMMUTABLE = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (await fillDeferred()) {
        // Nothing downloaded now; a kept copy whose bytes changed is dropped, so its next use fetches the new one.
        await dropStaleMedia();
        return;
      }
      // Every app file and kept page must be stored, or this build isn't installed (the browser tries again later).
      await fill(true);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // The newest two builds' app caches stay (a page still on the previous build loads its own chunks).
      const keep = await rememberBuild();
      // …and the last downloaded build's, so a build that deferred its download still opens offline on it.
      const filled = (await readManifest()).filled;
      if (filled && typeof filled.appCache === "string") keep.push(filled.appCache);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(APP_PREFIX) && !keep.includes(n)).map((n) => caches.delete(n)));
      // Media this build no longer lists (a removed sound) is dropped; a played lazy file is kept.
      const media = await caches.open(MEDIA_CACHE);
      const listed = new Set([...CONFIG.media, ...(CONFIG.lazyMedia || []), BUILD_KEY, MANIFEST_KEY]);
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
  if (data.type === "FILL") {
    // The page's go-ahead for the download (serviceWorker.ts requestWorkerFill): this build's files, only what changed.
    const port = event.ports && event.ports[0];
    // Not while a newer build's worker installs or waits: this outgoing build's download would overwrite the new
    // one's record, and the running FILL holds the waiting worker's activation (serviceWorker.ts requestWorkerFill).
    const reg = self.registration;
    if (reg && (reg.installing || reg.waiting)) {
      if (port) port.postMessage({ type: "FILL_LATER" });
      return;
    }
    const work = fillOnce().then(
      (complete) => port && port.postMessage({ type: "FILLED", complete }),
      () => port && port.postMessage({ type: "FILLED", complete: false }),
    );
    if (typeof event.waitUntil === "function") event.waitUntil(work);
  }
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
  // Same-origin app files are kept by path: one with a query string is served but not kept (the cache stays bounded).
  const keep = cacheName !== APP_CACHE || ignoreSearch || new URL(request.url).search === "";
  if (keep && response && (response.ok || response.type === "opaque")) {
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

/** Fetches and stores each path (8 at a time); the paths that failed. Throws when `required` and any failed. */
async function addAll(cache, paths, required) {
  const queue = paths.slice();
  const failures = [];
  const failed = new Set();
  const worker = async () => {
    while (queue.length > 0) {
      const path = queue.shift();
      try {
        const response = await fetch(new Request(path, { cache: "reload", credentials: "same-origin" }));
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        await cache.put(path, response);
      } catch (error) {
        failures.push(String(error));
        failed.add(path);
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  if (required && failures.length > 0) throw new Error(`offline install: ${failures.slice(0, 3).join(", ")}`);
  return failed;
}

/** Whether this install downloads nothing now (the page sends FILL later): see the header. */
async function fillDeferred() {
  const search = String((self.location && self.location.search) || "");
  if (/(?:^|[?&])fill=later(?:&|$)/.test(search)) return true;
  try {
    const connection = self.navigator && self.navigator.connection;
    if (
      connection &&
      (connection.saveData === true || connection.metered === true || SLOW_CONNECTIONS.includes(String(connection.effectiveType || "")))
    )
      return true;
  } catch {
    /* no Network Information API: download */
  }
  try {
    if (self.clients && typeof self.clients.matchAll === "function") {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const inRoom = open.some((client) => {
        const path = new URL(client.url).pathname;
        return ROOM_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
      });
      if (inRoom) return true;
    }
  } catch {
    /* can't tell: download */
  }
  return false;
}

async function readManifest() {
  try {
    const hit = await (await caches.open(MEDIA_CACHE)).match(MANIFEST_KEY);
    const value = hit ? JSON.parse(await hit.text()) : null;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

async function writeManifest(manifest) {
  try {
    await (await caches.open(MEDIA_CACHE)).put(MANIFEST_KEY, new Response(JSON.stringify(manifest)));
  } catch {
    /* the next download hashes what it can't look up */
  }
}

/**
 * Which kept media is out of date: a kept copy whose recorded bytes (the manifest) differ from this build's hash;
 * one the record doesn't know is hashed here (the only hashing on the phone).
 */
async function mediaState(media, manifest) {
  const hashes = CONFIG.mediaHash || {};
  const known = manifest.media && typeof manifest.media === "object" ? manifest.media : {};
  const have = new Set((await media.keys()).map((r) => new URL(r.url).pathname));
  const lazy = CONFIG.lazyMedia || [];
  const unknownKept = [...CONFIG.media, ...lazy].filter((p) => have.has(p) && hashes[p] && !(p in known));
  const staleUnknown = await staleMedia(media, unknownKept);
  const isStale = (p) => !!hashes[p] && (p in known ? known[p] !== hashes[p] : staleUnknown.has(p));
  return { hashes, known, have, lazy, isStale };
}

/** Drops every kept media copy whose bytes changed (no download) and records the rest. */
async function dropStaleMedia() {
  const manifest = await readManifest();
  const media = await caches.open(MEDIA_CACHE);
  const { hashes, have, lazy, isStale } = await mediaState(media, manifest);
  const record = {};
  for (const path of [...CONFIG.media, ...lazy]) {
    if (!have.has(path) || !hashes[path]) continue;
    if (isStale(path)) await media.delete(path);
    else record[path] = hashes[path];
  }
  await writeManifest({ ...manifest, media: record });
}

/** A copy of `path` from any app cache (a content-named bundle file is the same bytes in every build). */
async function matchAnyApp(path) {
  for (const name of await caches.keys()) {
    if (!name.startsWith(APP_PREFIX)) continue;
    const hit = await (await caches.open(name)).match(path);
    if (hit) return hit;
  }
  return null;
}

/**
 * This build's download, only what changed: app files (required on install) and media, then the record. True
 * when everything was stored.
 */
async function fill(required) {
  const manifest = await readManifest();
  const prev = manifest.filled && typeof manifest.filled === "object" ? manifest.filled : null;
  const appHash = CONFIG.appHash || {};
  const app = await caches.open(APP_CACHE);
  const names = await caches.keys();
  const prevApp = prev && prev.appCache && names.includes(prev.appCache) ? await caches.open(prev.appCache) : null;
  const prevHashes = (prev && prev.app) || {};
  const storedApp = {};
  const fetchApp = [];
  for (const path of CONFIG.app) {
    const hash = appHash[path];
    if (hash && prevHashes[path] === hash && prevApp) {
      if (prev.appCache === APP_CACHE && (await app.match(path))) {
        storedApp[path] = hash;
        continue;
      }
      const hit = await prevApp.match(path);
      if (hit) {
        await app.put(path, hit);
        storedApp[path] = hash;
        continue;
      }
    }
    if (IMMUTABLE.test(path)) {
      const hit = await matchAnyApp(path);
      if (hit) {
        await app.put(path, hit);
        if (hash) storedApp[path] = hash;
        continue;
      }
    }
    fetchApp.push(path);
  }
  // The kept pages name this build's files: always fetched.
  const failedApp = await addAll(app, [...fetchApp, ...CONFIG.pages], required);
  for (const path of fetchApp) if (!failedApp.has(path) && appHash[path]) storedApp[path] = appHash[path];

  // Media is shared between builds: only what's missing or changed is fetched.
  const media = await caches.open(MEDIA_CACHE);
  const { hashes, known, have, lazy, isStale } = await mediaState(media, manifest);
  const failedMedia = await addAll(media, CONFIG.media.filter((p) => !have.has(p) || isStale(p)), false);
  // Media kept only once played (CONFIG.lazyMedia) is never fetched here; a kept copy whose bytes changed is
  // dropped, so the next play fetches the new one.
  const record = {};
  for (const path of CONFIG.media) {
    if (!hashes[path]) continue;
    if (failedMedia.has(path)) {
      // Still the old bytes where they were known; otherwise unknown (hashed next time).
      if (have.has(path) && path in known) record[path] = known[path];
      continue;
    }
    record[path] = hashes[path];
  }
  for (const path of lazy) {
    if (!have.has(path) || !hashes[path]) continue;
    if (isStale(path)) await media.delete(path);
    else record[path] = hashes[path];
  }
  // Best effort and bounded: a font host that doesn't answer never holds the download's record back.
  await withTimeout(cacheGoogleFonts(), FONT_TIMEOUT_MS).catch(() => {});
  const complete = failedApp.size === 0 && failedMedia.size === 0;
  await writeManifest({ media: record, filled: { version: CONFIG.version, appCache: APP_CACHE, app: storedApp, complete } });
  return complete;
}

let filling = null;
/** One download at a time; nothing to do when this build's download already completed. */
function fillOnce() {
  if (!filling) {
    filling = (async () => {
      const manifest = await readManifest();
      const done = manifest.filled && manifest.filled.version === CONFIG.version && manifest.filled.complete === true;
      return done ? true : fill(false);
    })().finally(() => {
      filling = null;
    });
  }
  return filling;
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
@font-face{font-family:Archivo;src:url("/fonts/archivo-var-latin.woff2") format("woff2");font-weight:100 900;font-display:swap}
html,body{margin:0;height:100%;background:#07070A;color:#F5F5F7;font-family:Archivo,system-ui,-apple-system,sans-serif}
main{box-sizing:border-box;min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:calc(env(safe-area-inset-top) + 24px) 24px calc(env(safe-area-inset-bottom) + 24px);text-align:center}
h1{margin:0;font-size:26px;font-weight:800}p{margin:0;max-width:300px;font-size:15px;line-height:1.4;color:#BDBDCC}
a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 28px;border-radius:14px;background:linear-gradient(180deg,#F7D77E,#E2B23F);color:#151006;font-weight:800;font-size:16px;text-decoration:none}
</style></head><body><main data-offline-page><h1>You're offline</h1><p>Rooms, tournaments, the daily and challenges need a connection. Practice still works.</p><a href="/practice" data-offline-practice>Go to Practice</a></main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
