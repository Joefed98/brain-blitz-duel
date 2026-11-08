/**
 * offline-delta-check (8 Nov 2026, item 2 of docs/audit-nov-2026/performance.md): what the offline worker
 * downloads, and when. No browser: the real worker text (swPlugin's offlineWorkerSource on the real template) runs
 * against an in-memory Cache Storage, as offline-media-refresh-check does.
 *
 *  1. A worker registered as "/sw.js?fill=later" downloads nothing on install (it only drops kept media whose
 *     bytes changed); nor does any install on Save-Data, a metered or 2G connection, or with a room, daily or
 *     challenge open.
 *  2. The page's FILL message downloads this build's files; a second FILL downloads nothing.
 *  3. A new build downloads only what changed: an app file with the same hash is copied from the last build's
 *     cache, a content-named bundle file kept by any build is copied, the kept pages are fetched, unchanged media
 *     is not fetched, and no kept file is hashed on the phone when the record knows its bytes.
 *  4. The page side: which address a device registers (serviceWorker.ts registrationUrl), and that the handover
 *     keeps either form of the worker.
 *  5. The real build lists a hash for every app file it can (swPlugin), and the page code waits for the first
 *     finished practice round and the download rules before asking (install.ts, packs.ts).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { offlineWorkerSource } from "../src/lib/offline/swPlugin";
import { SW_LATER_URL, SW_URL, isOfflineWorkerUrl, registrationUrl } from "../src/lib/offline/serviceWorker";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}
const sha = (bytes: string) => createHash("sha256").update(bytes).digest("hex");

const ORIGIN = "https://joulz.test";
const keyOf = (r: string | Request) => {
  const url = new URL(typeof r === "string" ? r : r.url, ORIGIN);
  return url.pathname + (typeof r === "string" ? "" : url.search);
};
class FakeCache {
  store = new Map<string, Response>();
  async match(r: string | Request, opts?: { ignoreSearch?: boolean }) {
    const key = keyOf(r);
    const hit = this.store.get(opts?.ignoreSearch ? key.split("?")[0]! : key);
    return hit ? hit.clone() : undefined;
  }
  async put(r: string | Request, res: Response) {
    this.store.set(keyOf(r), res);
  }
  async keys() {
    return [...this.store.keys()].map((k) => new Request(`${ORIGIN}${k}`));
  }
  async delete(r: string | Request) {
    return this.store.delete(keyOf(r));
  }
}
const caches = new Map<string, FakeCache>();
const cacheStorage = {
  async open(name: string) {
    if (!caches.has(name)) caches.set(name, new FakeCache());
    return caches.get(name)!;
  },
  async keys() {
    return [...caches.keys()];
  },
  async delete(name: string) {
    return caches.delete(name);
  },
  async match(r: string | Request, opts?: { ignoreSearch?: boolean }) {
    for (const c of caches.values()) {
      const hit = await c.match(r, opts);
      if (hit) return hit;
    }
    return undefined;
  },
};

/** The server: every path's bytes. */
const server = new Map<string, string>();
const fetched: string[] = [];
const fakeFetch = async (r: string | Request) => {
  const path = keyOf(r).split("?")[0]!;
  fetched.push(path);
  const body = server.get(path);
  return body === undefined ? new Response("", { status: 404 }) : new Response(body, { status: 200 });
};
class SiteRequest extends Request {
  constructor(input: string | Request, init?: RequestInit) {
    super(typeof input === "string" ? new URL(input, ORIGIN).href : input, init);
  }
}
/** crypto with its SHA-256 counted (the phone's hashing). */
let digests = 0;
const countingCrypto = {
  subtle: {
    digest: (alg: string, data: ArrayBuffer) => {
      digests += 1;
      return globalThis.crypto.subtle.digest(alg, data);
    },
  },
};

interface Env {
  search?: string;
  connection?: { saveData?: boolean; metered?: boolean; effectiveType?: string };
  clientUrls?: string[];
}

const PAGES = ["/", "/practice", "/profile", "/tournaments"];
const appHashes = () => Object.fromEntries([...server].filter(([p]) => !p.startsWith("/tiles/") && !p.startsWith("/sounds/")).map(([p, b]) => [p, sha(b)]));
const mediaHashes = () => Object.fromEntries([...server].filter(([p]) => p.startsWith("/tiles/") || p.startsWith("/sounds/")).map(([p, b]) => [p, sha(b)]));

/** Boots one build's worker; returns a runner for its events. */
function boot(version: string, env: Env = {}) {
  const own = new Map<string, (event: unknown) => void>();
  const bundleFiles = [...server.keys()].filter((p) => p.startsWith("/assets/")).map((p) => p.slice(1));
  const publicFiles = [...server.keys()].filter((p) => !p.startsWith("/assets/") && !PAGES.includes(p));
  const src = offlineWorkerSource({
    version,
    bundleFiles,
    publicFiles,
    mediaHashes: mediaHashes(),
    lazyMedia: ["/sounds/lazy.mp3"].filter((p) => server.has(p)),
    appHashes: appHashes(),
  });
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => own.set(type, fn),
    location: { origin: ORIGIN, search: env.search ?? "" },
    navigator: env.connection ? { connection: env.connection } : {},
    clients: {
      claim: async () => {},
      matchAll: async () => (env.clientUrls ?? []).map((url) => ({ url })),
    },
    skipWaiting: async () => {},
  };
  new Function("self", "caches", "fetch", "Request", "Response", "crypto", "URL", src)(
    self,
    cacheStorage,
    fakeFetch,
    SiteRequest,
    Response,
    countingCrypto,
    URL,
  );
  const run = async (type: string, extra: Record<string, unknown> = {}) => {
    let p: Promise<unknown> = Promise.resolve();
    own.get(type)!({ waitUntil: (x: Promise<unknown>) => (p = x), respondWith: (x: Promise<unknown>) => (p = x), ...extra });
    return p;
  };
  /** The page's FILL message; resolves with the worker's answer. */
  const fill = () =>
    new Promise<{ type: string; complete: boolean }>((resolve) => {
      void run("message", { data: { type: "FILL" }, ports: [{ postMessage: resolve }] });
    });
  return { run, fill };
}
const reset = () => {
  caches.clear();
  fetched.length = 0;
  digests = 0;
};
const serverFiles = () => {
  server.clear();
  for (const p of PAGES) server.set(p, `page ${p}`);
  server.set("/assets/index-AbCdEf12.js", "chunk index v1");
  server.set("/assets/game-QwErTy34.js", "chunk game v1");
  server.set("/icon-192.png", "icon v1");
  server.set("/manifest.webmanifest", "manifest v1");
  server.set("/tiles/a.webp", "tile a v1");
  server.set("/tiles/b.webp", "tile b v1");
  server.set("/sounds/s.mp3", "sound v1");
  server.set("/sounds/lazy.mp3", "lazy v1");
};
const fetchedSet = () => new Set(fetched);

// 1. A deferred install downloads nothing.
reset();
serverFiles();
{
  const b = boot("v1", { search: "?fill=later" });
  await b.run("install");
  check(fetched.length === 0, `fill=later: install fetches nothing (fetched ${fetched.join(", ")})`);
  await b.run("activate");
  // A sound played and a tile shown under it (the fetch handler keeps media once used).
  await b.run("fetch", { request: { method: "GET", url: `${ORIGIN}/tiles/a.webp?v=1`, mode: "no-cors" } });
  await new Promise((r) => setTimeout(r, 5));
  check(!!(await (await cacheStorage.open("joulz-media-v1")).match("/tiles/a.webp")), "fill=later: a used tile is kept");
  // The page's go-ahead: this build's files.
  fetched.length = 0;
  const answer = await b.fill();
  check(answer.type === "FILLED" && answer.complete === true, "FILL: the worker answers FILLED, complete");
  const got = fetchedSet();
  for (const p of ["/assets/index-AbCdEf12.js", "/assets/game-QwErTy34.js", "/icon-192.png", "/tiles/b.webp", "/sounds/s.mp3", ...PAGES])
    check(got.has(p), `FILL: fetches ${p}`);
  check(!got.has("/tiles/a.webp"), "FILL: a kept tile with unchanged bytes is not fetched again");
  check(!got.has("/sounds/lazy.mp3"), "FILL: lazy media is not fetched");
  fetched.length = 0;
  const again = await b.fill();
  check(again.complete === true && fetched.length === 0, `a second FILL fetches nothing (fetched ${fetched.join(", ")})`);
}

// 1a. Deferred builds activating before any FILL keep the last downloaded build's cache (it opens offline).
{
  const b2 = boot("v1-later-2", { search: "?fill=later" });
  await b2.run("install");
  await b2.run("activate");
  const b3 = boot("v1-later-3", { search: "?fill=later" });
  await b3.run("install");
  await b3.run("activate");
  const names = await cacheStorage.keys();
  check(names.includes("joulz-app-v1"), `the last downloaded build's cache survives two deferred builds (${names.join(", ")})`);
  check(!!(await cacheStorage.match("/practice", { ignoreSearch: true })), "…so the kept Practice page still opens offline");
}

// 1b. A deferred install drops a kept copy whose bytes changed.
{
  server.set("/tiles/a.webp", "tile a v2");
  fetched.length = 0;
  const b = boot("v1b", { search: "?fill=later" });
  await b.run("install");
  check(fetched.length === 0, "fill=later after a change: install fetches nothing");
  check(!(await (await cacheStorage.open("joulz-media-v1")).match("/tiles/a.webp")), "fill=later: a changed kept tile's old copy is dropped");
  server.set("/tiles/a.webp", "tile a v1");
}

// 1c. Save-Data, metered, 2G and an open room defer a full worker's install.
for (const [name, env] of [
  ["Save-Data", { connection: { saveData: true, effectiveType: "4g" } }],
  ["a metered connection", { connection: { metered: true } }],
  ["a 2G connection", { connection: { effectiveType: "2g" } }],
  ["an open room", { clientUrls: [`${ORIGIN}/duel/ABCD`] }],
  ["the daily", { clientUrls: [`${ORIGIN}/practice`, `${ORIGIN}/daily`] }],
  ["a challenge", { clientUrls: [`${ORIGIN}/challenge?code=ABCDEF`] }],
] as const) {
  reset();
  serverFiles();
  const b = boot("v1", env as Env);
  await b.run("install");
  check(fetched.length === 0, `${name}: install fetches nothing`);
}
// …and a full worker with none of those downloads on install, as before.
reset();
serverFiles();
{
  const b = boot("v1", { connection: { effectiveType: "4g" }, clientUrls: [`${ORIGIN}/practice`] });
  await b.run("install");
  const got = fetchedSet();
  check(got.has("/assets/index-AbCdEf12.js") && got.has("/tiles/a.webp") && got.has("/sounds/s.mp3"), "a full worker's install downloads on a good connection off a room");
  await b.run("activate");
  check(digests === 0, `a fresh device hashes nothing (${digests} digests)`);
}

// 2. A new build: only what changed.
{
  // From the device above (v1 installed and active).
  server.set("/assets/index-ZyXwVu98.js", "chunk index v2");
  server.delete("/assets/index-AbCdEf12.js");
  server.set("/tiles/b.webp", "tile b v2");
  server.set("/manifest.webmanifest", "manifest v2");
  for (const p of PAGES) server.set(p, `page ${p} v2`);
  fetched.length = 0;
  digests = 0;
  const b2 = boot("v2", { connection: { effectiveType: "4g" } });
  await b2.run("install");
  const got = fetchedSet();
  check(got.has("/assets/index-ZyXwVu98.js"), "new build: the changed chunk is fetched");
  check(!got.has("/assets/game-QwErTy34.js"), "new build: an unchanged chunk is copied, not fetched");
  check(!got.has("/icon-192.png"), "new build: an unchanged public file is copied, not fetched");
  check(got.has("/manifest.webmanifest"), "new build: a changed public file is fetched");
  check(PAGES.every((p) => got.has(p)), "new build: the kept pages are fetched");
  check(got.has("/tiles/b.webp") && !got.has("/tiles/a.webp") && !got.has("/sounds/s.mp3"), "new build: only the changed media is fetched");
  check(digests === 0, `new build: no kept file hashed on the phone (${digests} digests)`);
  const app2 = await cacheStorage.open("joulz-app-v2");
  check((await (await app2.match("/assets/game-QwErTy34.js"))?.text()) === "chunk game v1", "new build: the copied chunk is in the new build's cache");
  check((await (await (await cacheStorage.open("joulz-media-v1")).match("/tiles/b.webp"))?.text()) === "tile b v2", "new build: the changed tile is served with its new bytes");
  const fromV1 = fetched.length;
  // The download before this record: a device whose worker kept no record hashes what it keeps, once.
  const media = await cacheStorage.open("joulz-media-v1");
  await media.delete("/__joulz-manifest");
  fetched.length = 0;
  digests = 0;
  const b3 = boot("v3", { connection: { effectiveType: "4g" } });
  await b3.run("install");
  check(digests > 0, `no record: kept media is hashed (${digests} digests)`);
  check(!fetchedSet().has("/tiles/a.webp") && !fetchedSet().has("/sounds/s.mp3"), "no record: unchanged media still not fetched");
  check(!fetchedSet().has("/assets/game-QwErTy34.js"), "no record: a content-named chunk kept by any build is copied");
  console.log(`NOTE new build: ${fromV1} files fetched of ${server.size - 1} listed (the changed ones and the ${PAGES.length} pages)`);
}

// 3. The page side.
check(registrationUrl(null, false) === SW_LATER_URL, "a device that may not download yet registers the deferred worker");
check(registrationUrl(null, true) === SW_URL, "a device that may download registers the full worker");
check(registrationUrl(`${ORIGIN}/sw.js`, false) === SW_URL, "a device with the full worker keeps it");
check(registrationUrl(`${ORIGIN}/sw.js?fill=later`, true) === SW_LATER_URL, "a deferred worker isn't switched (FILL brings the download)");
check(registrationUrl(`${ORIGIN}/old-worker.js`, false) === SW_LATER_URL, "another worker's address is not reused");
check(isOfflineWorkerUrl(`${ORIGIN}/sw.js`) && isOfflineWorkerUrl(`${ORIGIN}/sw.js?fill=later`) && !isOfflineWorkerUrl(`${ORIGIN}/other.js`), "the handover keeps either form of the worker");
const swPage = readFileSync("src/lib/offline/serviceWorker.ts", "utf8");
check(/!isOfflineWorkerUrl\(\(r\.active \?\? r\.waiting \?\? r\.installing\)\?\.scriptURL\)/.test(swPage), "the updater's handover unregisters only other workers");
const install = readFileSync("src/lib/offline/install.ts", "utf8");
check(/offlineDownloadAllowed\(\) && practiceStarted\(\)/.test(install), "install: the full worker only after the first finished round, under the download rules");
check(/fillWorker\(\)[\s\S]*topUpPacks\(\)/.test(install), "sync: the worker's download is asked for with the packs");
const packs = readFileSync("src/lib/offline/packs.ts", "utf8");
check(/if \(liveRoomOnScreen\(\)\) return false;/.test(packs), "downloads wait while a room, daily or challenge is on screen");

// 4. The real build: every app file listed with a hash where it has bytes.
{
  const src = offlineWorkerSource({
    version: "check",
    bundleFiles: ["assets/x-AbCdEf12.js"],
    publicFiles: ["/icon-192.png", "/tiles/a.webp"],
    mediaHashes: { "/tiles/a.webp": "aa" },
    appHashes: { "/assets/x-AbCdEf12.js": "bb", "/icon-192.png": "cc" },
  });
  const config = JSON.parse(src.match(/const CONFIG = (\{.*?\});\n/s)![1]!) as { app: string[]; appHash: Record<string, string> };
  check(config.app.every((p) => typeof config.appHash[p] === "string"), "the worker's config carries each app file's hash");
  check(/appHashes,/.test(readFileSync("src/lib/offline/swPlugin.ts", "utf8")), "offlineWorkerPlugin passes the app files' hashes");
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL offline-delta-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`PASS offline-delta-check: ${passes} assertions`);
