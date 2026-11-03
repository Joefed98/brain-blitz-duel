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
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { MEDIA_DIRS } from "../src/lib/offline/assets";
import { offlineWorkerSource } from "../src/lib/offline/swPlugin";

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
const realSource = offlineWorkerSource({ version: "check", bundleFiles: [], publicFiles: files.map((f) => f.path), mediaHashes: realHashes });
const realConfig = JSON.parse(realSource.match(/const CONFIG = (\{.*?\});\n/s)![1]!) as { media: string[]; mediaHash: Record<string, string> };
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

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL offline-media-refresh-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`PASS offline-media-refresh-check: ${passes} assertions`);
