/**
 * The build step that writes /sw.js (offline practice, 31 Oct 2026). Node only: imported by vite.config.ts,
 * never by the app. On the client build it fills the hand-written worker (sw.template.js) with this build's
 * id (so every Publish is a new worker and a new app cache), every file the client bundle wrote, the public
 * files (app files and media apart) and the pages to keep. Nothing here runs in the dev server, which has
 * no worker.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { GOOGLE_FONTS_CSS, MEDIA_DIRS, OFFLINE_PAGES, keepPublicFile } from "./assets";

interface BundleLike {
  [fileName: string]: unknown;
}

/** A bundle entry's bytes (a chunk's code or an asset's source), or null. */
function bundleBytes(entry: unknown): string | Uint8Array | null {
  const e = entry as { code?: unknown; source?: unknown } | null;
  if (typeof e?.code === "string") return e.code;
  if (typeof e?.source === "string" || e?.source instanceof Uint8Array) return e.source;
  return null;
}

const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");

interface PluginLike {
  name: string;
  apply: "build";
  configResolved(config: { publicDir: string }): void;
  generateBundle(this: { environment?: { name?: string }; emitFile(file: { type: "asset"; fileName: string; source: string }): void }, options: unknown, bundle: BundleLike): void;
  writeBundle(this: { environment?: { name?: string } }, options: { dir?: string }, bundle: BundleLike): void;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** The worker's text for a build: the template with its config filled in. */
export function offlineWorkerSource(opts: {
  version: string;
  bundleFiles: string[];
  publicFiles: string[];
  /** Each media file's SHA-256 (hex): a kept copy whose bytes differ is fetched again on install. */
  mediaHashes?: Record<string, string>;
  /** Media kept only once played, never fetched on install (lazyMediaPaths: the sounds once on Lovable). */
  lazyMedia?: string[];
  /**
   * Each app file's SHA-256 (hex, by site path): a later build's download copies a file whose hash is unchanged
   * from the cache that keeps it instead of fetching it (8 Nov 2026).
   */
  appHashes?: Record<string, string>;
}): string {
  const isMedia = (path: string) => MEDIA_DIRS.some((dir) => path.startsWith(`/${dir}/`));
  const publicFiles = opts.publicFiles.filter(keepPublicFile);
  const app = [
    ...opts.bundleFiles.filter((f) => !f.endsWith(".map") && f !== "sw.js").map((f) => `/${f}`),
    ...publicFiles.filter((p) => !isMedia(p)),
  ];
  const lazy = new Set(opts.lazyMedia ?? []);
  const config = {
    version: opts.version,
    app: [...new Set(app)].sort(),
    media: publicFiles.filter((p) => isMedia(p) && !lazy.has(p)).sort(),
    lazyMedia: publicFiles.filter((p) => isMedia(p) && lazy.has(p)).sort(),
    mediaHash: Object.fromEntries(
      publicFiles.filter(isMedia).sort().flatMap((p) => (opts.mediaHashes?.[p] ? [[p, opts.mediaHashes[p]]] : [])),
    ),
    appHash: Object.fromEntries(
      [...new Set(app)].sort().flatMap((p) => (opts.appHashes?.[p] ? [[p, opts.appHashes[p]]] : [])),
    ),
    pages: [...OFFLINE_PAGES],
    googleFonts: GOOGLE_FONTS_CSS,
  };
  const template = readFileSync(new URL("./sw.template.js", import.meta.url), "utf8");
  // Phone notifications (wave 2 B2): the push and notificationclick listeners, after the offline worker, which is
  // unchanged (they add no install, activate, message or fetch handler).
  const push = readFileSync(new URL("../push/sw.push.js", import.meta.url), "utf8");
  return `${template.replace("__OFFLINE_CONFIG__", JSON.stringify(config))}\n${push}`;
}

/**
 * The sounds and music copied from Lovable's asset store into public/sounds/ (7 Nov 2026, Route B prep;
 * assets-archive/lovable-sounds/sources.json). Served from /__l5e/ they were never part of the install
 * download, only kept once played; they stay that way (about 67 MB, beyond the 60 MB offline budget if all
 * were fetched on install), and the media cache keeps a played one across builds.
 */
export function lazyMediaPaths(
  sourcesFile: string | URL = new URL("../../../assets-archive/lovable-sounds/sources.json", import.meta.url),
): string[] {
  const sources = JSON.parse(readFileSync(sourcesFile, "utf8")) as { keptAs: string }[];
  return sources
    .map((s) => s.keptAs)
    .filter((p) => p.startsWith("public/"))
    .map((p) => p.slice("public".length))
    .sort();
}

export function offlineWorkerPlugin(version: string): PluginLike {
  let publicDir = "public";
  let workerInput: Omit<Parameters<typeof offlineWorkerSource>[0], "bundleFiles"> | null = null;
  return {
    name: "joulz-offline-worker",
    apply: "build",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      // Only the phone's bundle: the server build has no worker.
      const env = this.environment?.name;
      if (env && env !== "client") return;
      const files = walk(publicDir).map((full) => ({ full, path: `/${relative(publicDir, full).split(sep).join("/")}` }));
      const publicFiles = files.map((f) => f.path);
      // Media keeps its name from build to build, so its bytes' hash is what tells a changed file (a
      // redrawn tile, a new recording) from the one a phone already keeps (3 Nov 2026).
      const mediaHashes = Object.fromEntries(
        files
          .filter((f) => MEDIA_DIRS.some((dir) => f.path.startsWith(`/${dir}/`)))
          .map((f) => [f.path, sha256(readFileSync(f.full))]),
      );
      // App files' hashes: the bundle's own bytes, and the public files' (8 Nov 2026: a new build's download
      // fetches only what changed).
      const appHashes: Record<string, string> = {};
      for (const [fileName, entry] of Object.entries(bundle)) {
        const bytes = bundleBytes(entry);
        if (bytes !== null) appHashes[`/${fileName}`] = sha256(bytes);
      }
      for (const f of files) if (!MEDIA_DIRS.some((dir) => f.path.startsWith(`/${dir}/`))) appHashes[f.path] = sha256(readFileSync(f.full));
      workerInput = {
        version,
        publicFiles,
        mediaHashes,
        lazyMedia: lazyMediaPaths(),
        appHashes,
      };
      this.emitFile({ type: "asset", fileName: "sw.js", source: offlineWorkerSource({ ...workerInput, bundleFiles: Object.keys(bundle) }) });
    },
    // The worker's app list again from the files actually written (speed fix 1, Nov 2026): Vite drops a
    // CSS-only chunk's empty JS file after this plugin's generateBundle, and once games were their own chunks
    // a few such files (the polish-nov3 sheets) were listed, so every install failed on their 404s.
    writeBundle(options, bundle) {
      const env = this.environment?.name;
      if ((env && env !== "client") || !workerInput || !options.dir) return;
      const dir = options.dir;
      const written = Object.keys(bundle).filter((f) => existsSync(join(dir, f)));
      writeFileSync(join(dir, "sw.js"), offlineWorkerSource({ ...workerInput, bundleFiles: written }));
    },
  };
}
