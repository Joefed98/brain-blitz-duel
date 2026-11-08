/**
 * offline-media-refresh-check (3 Nov 2026): a phone that already keeps media (tiles, sounds) gets
 * the new bytes when a build changes a file under the same name.
 *
 * Joe's iPhone showed Moon Climb's, Iron Wall's and Ringer's old tiles after their redraws: the
 * service worker's shared media cache answers /tiles/<type>.webp?v=<hash> ignoring the search, and
 * install fetched only paths it lacked, so a changed file kept its first copy for good. The build
 * now puts each media file's SHA-256 in the worker's config and install fetches any kept copy whose
 * bytes differ. This check runs the real worker text (swPlugin's offlineWorkerSource on the real
 * template) against an in-memory Cache Storage: an unchanged kept file is not fetched, a changed
 * one is fetched and served, a missing one is fetched, and every public media file has a hash.
 * 7 Nov 2026: the 135 sounds copied from Lovable's asset store (sources.json) are lazy media, out of the
 * install download as they were on /__l5e/: kept once played, across builds, dropped when their bytes change.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { MEDIA_DIRS } from "../src/lib/offline/assets";
import { lazyMediaPaths, offlineWorkerSource } from "../src/lib/offline/swPlugin";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

// 1. The real build: every media file in public/ carries its hash.
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
const files = walk("public").map((full) => ({ full, path: `/${relative("public", full).split(sep).join("/")}` }));
const isMedia = (p: string) => MEDIA_DIRS.some((d) => p.startsWith(`/${d}/`));
const realHashes = Object.fromEntries(files.filter((f) => isMedia(f.path)).map((f) => [f.path, sha(readFileSync(f.full))]));
// As offlineWorkerPlugin builds it (lazyMedia from lazyMediaPaths()).
const realSource = offlineWorkerSource({
  version: "check",
  bundleFiles: [],
  publicFiles: files.map((f) => f.path),
  mediaHashes: realHashes,
  lazyMedia: lazyMediaPaths(),
});
const realConfig = JSON.parse(realSource.match(/const CONFIG = (\{.*?\});\n/s)![1]!) as {
  media: string[];
  lazyMedia: string[];
  mediaHash: Record<string, string>;
};
for (const path of ["/tiles/ricochet.webp", "/tiles/bastion.webp", "/tiles/alleyroll.webp", "/sounds/music_matchup.mp3"])
  check(realConfig.media.includes(path) && realConfig.mediaHash[path] === realHashes[path], `${path}: listed with its hash`);
check(realConfig.media.every((p) => typeof realConfig.mediaHash[p] === "string"), "every media file has a hash");

// 2. The worker against an in-memory Cache Storage.
const server = new Map<string, string>([
  ["/tiles/same.webp", "same bytes"],
  ["/tiles/changed.webp", "new tile"],
  ["/tiles/new.webp", "brand new"],
  ["/index.css", "css"],
]);
const source = offlineWorkerSource({
  version: "b2",
  bundleFiles: [],
  publicFiles: ["/tiles/same.webp", "/tiles/changed.webp", "/tiles/new.webp", "/index.css"],
  mediaHashes: Object.fromEntries([...server].filter(([p]) => p.startsWith("/tiles/")).map(([p, b]) => [p, sha(b)])),
});

const keyOf = (r: string | Request) => new URL(typeof r === "string" ? r : r.url, "https://joulz.test").pathname + (typeof r === "string" ? "" : new URL(r.url).search);
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
    return [...this.store.keys()].map((k) => new Request(`https://joulz.test${k}`));
  }
  async delete(r: Request) {
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
// A phone on the previous build keeps the old copies.
const media = await cacheStorage.open("joulz-media-v1");
await media.put("/tiles/same.webp", new Response("same bytes"));
await media.put("/tiles/changed.webp", new Response("old tile"));

const fetched: string[] = [];
const fakeFetch = async (r: string | Request) => {
  const path = keyOf(r).split("?")[0]!;
  fetched.push(path);
  // App files and kept pages always answer; media answers only for the files this build has.
  const body = server.get(path) ?? (path.startsWith("/tiles/") ? undefined : "page");
  return body === undefined ? new Response("", { status: 404 }) : new Response(body, { status: 200 });
};
/** The worker builds requests from site paths, as a browser resolves them against the worker's origin. */
class SiteRequest extends Request {
  constructor(input: string | Request, init?: RequestInit) {
    super(typeof input === "string" ? new URL(input, "https://joulz.test").href : input, init);
  }
}
const listeners = new Map<string, (event: unknown) => void>();
const self = {
  addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn),
  location: { origin: "https://joulz.test" },
  clients: { claim: async () => {} },
  skipWaiting: async () => {},
};
new Function("self", "caches", "fetch", "Request", "Response", "crypto", "URL", source)(self, cacheStorage, fakeFetch, SiteRequest, Response, globalThis.crypto, URL);
let installed: Promise<unknown> = Promise.resolve();
listeners.get("install")!({ waitUntil: (p: Promise<unknown>) => (installed = p) });
await installed.catch((e) => failures.push(`install failed: ${e}`));

check(!fetched.includes("/tiles/same.webp"), "an unchanged kept tile is not fetched again");
check(fetched.includes("/tiles/changed.webp"), "a changed kept tile is fetched again");
check(fetched.includes("/tiles/new.webp"), "a new tile is fetched");
const served = await (await media.match("/tiles/changed.webp?v=abc", { ignoreSearch: true }))?.text();
check(served === "new tile", `the changed tile is served with its new bytes (got ${served})`);

// 3. The sounds once hosted by Lovable (7 Nov 2026): out of the install download, kept once played, across
// builds, and dropped (not fetched) on install when a build changes their bytes.
const lazyReal = lazyMediaPaths();
check(
  /lazyMedia: lazyMediaPaths\(\)/.test(readFileSync("src/lib/offline/swPlugin.ts", "utf8")),
  "offlineWorkerPlugin passes lazyMediaPaths() to the worker",
);
check(lazyReal.length === 135, `135 copied Lovable sounds are lazy (got ${lazyReal.length})`);
check(
  lazyReal.every((p) => !realConfig.media.includes(p) && realConfig.lazyMedia.includes(p)),
  "the real build lists every copied Lovable sound as lazy, none in the install download",
);
check(realConfig.lazyMedia.length === lazyReal.length, "nothing else is lazy");
check(lazyReal.every((p) => typeof realConfig.mediaHash[p] === "string"), "every lazy sound has a hash");
const installBytes = realConfig.media.reduce((sum, p) => sum + statSync(join("public", p)).size, 0);
const lazyBytes = lazyReal.reduce((sum, p) => sum + statSync(join("public", p)).size, 0);
check(lazyBytes > 60 * 1048576, `the lazy sounds are the bulk that left the install (${(lazyBytes / 1048576).toFixed(1)} MB)`);
console.log(
  `NOTE install download: ${realConfig.media.length} media files, ${(installBytes / 1048576).toFixed(1)} MB; ` +
    `lazy: ${lazyReal.length} files, ${(lazyBytes / 1048576).toFixed(1)} MB`,
);

caches.clear();
fetched.length = 0;
server.set("/sounds/lazy.mp3", "lovable bytes");
server.set("/sounds/eager.mp3", "eager bytes");
function boot(version: string, hashes: Record<string, string>) {
  const own = new Map<string, (event: unknown) => void>();
  const selfB = { ...self, addEventListener: (type: string, fn: (event: unknown) => void) => own.set(type, fn) };
  const src = offlineWorkerSource({
    version,
    bundleFiles: [],
    publicFiles: ["/sounds/lazy.mp3", "/sounds/eager.mp3", "/index.css"],
    mediaHashes: hashes,
    lazyMedia: ["/sounds/lazy.mp3"],
  });
  new Function("self", "caches", "fetch", "Request", "Response", "crypto", "URL", src)(selfB, cacheStorage, fakeFetch, SiteRequest, Response, globalThis.crypto, URL);
  const run = async (type: string, extra: Record<string, unknown> = {}) => {
    let p: Promise<unknown> = Promise.resolve();
    own.get(type)!({ waitUntil: (x: Promise<unknown>) => (p = x), respondWith: (x: Promise<unknown>) => (p = x), ...extra });
    return p;
  };
  return run;
}
const b1 = boot("l1", { "/sounds/lazy.mp3": sha("lovable bytes"), "/sounds/eager.mp3": sha("eager bytes") });
await b1("install").catch((e) => failures.push(`lazy install failed: ${e}`));
check(!fetched.includes("/sounds/lazy.mp3"), "install does not fetch a lazy sound");
check(fetched.includes("/sounds/eager.mp3"), "install still fetches the other sounds");
await b1("activate");
fetched.length = 0;
const req = { method: "GET", url: "https://joulz.test/sounds/lazy.mp3", mode: "no-cors" };
const res = (await b1("fetch", { request: req })) as Response;
check((await res.text()) === "lovable bytes", "a played lazy sound is served");
await new Promise((r) => setTimeout(r, 5));
const mediaC = await cacheStorage.open("joulz-media-v1");
check(!!(await mediaC.match("/sounds/lazy.mp3", { ignoreSearch: true })), "a played lazy sound is kept in the media cache");
fetched.length = 0;
await b1("fetch", { request: req });
check(!fetched.includes("/sounds/lazy.mp3"), "a kept lazy sound plays from the cache");
// The next build, same bytes: the played copy stays through install and activate, and is not fetched.
const b2 = boot("l2", { "/sounds/lazy.mp3": sha("lovable bytes"), "/sounds/eager.mp3": sha("eager bytes") });
fetched.length = 0;
await b2("install");
await b2("activate");
check(!fetched.includes("/sounds/lazy.mp3"), "a new build does not fetch a lazy sound");
check(!!(await mediaC.match("/sounds/lazy.mp3")), "a played lazy sound is kept across builds");
// A build that changes its bytes (the audio pass): the old copy is dropped, not fetched, then the next play fetches it.
server.set("/sounds/lazy.mp3", "re-levelled bytes");
const b3 = boot("l3", { "/sounds/lazy.mp3": sha("re-levelled bytes"), "/sounds/eager.mp3": sha("eager bytes") });
fetched.length = 0;
await b3("install");
await b3("activate");
check(!fetched.includes("/sounds/lazy.mp3"), "a changed lazy sound is not fetched on install");
check(!(await mediaC.match("/sounds/lazy.mp3")), "a changed lazy sound's old copy is dropped");
const res3 = (await b3("fetch", { request: req })) as Response;
check((await res3.text()) === "re-levelled bytes", "the next play gets the changed lazy sound");

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL offline-media-refresh-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`PASS offline-media-refresh-check: ${passes} assertions`);
