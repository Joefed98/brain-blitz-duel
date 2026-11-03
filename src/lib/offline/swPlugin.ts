/**
 * The build step that writes /sw.js (offline practice, 31 Oct 2026). Node only: imported by vite.config.ts,
 * never by the app. On the client build it fills the hand-written worker (sw.template.js) with this build's
 * id (so every Publish is a new worker and a new app cache), every file the client bundle wrote, the public
 * files (app files and media apart) and the pages to keep. Nothing here runs in the dev server, which has
 * no worker.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { GOOGLE_FONTS_CSS, MEDIA_DIRS, OFFLINE_PAGES, keepPublicFile } from "./assets";

interface BundleLike {
  [fileName: string]: unknown;
}

interface PluginLike {
  name: string;
  apply: "build";
  configResolved(config: { publicDir: string }): void;
  generateBundle(this: { environment?: { name?: string }; emitFile(file: { type: "asset"; fileName: string; source: string }): void }, options: unknown, bundle: BundleLike): void;
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
}): string {
  const isMedia = (path: string) => MEDIA_DIRS.some((dir) => path.startsWith(`/${dir}/`));
  const publicFiles = opts.publicFiles.filter(keepPublicFile);
  const app = [
    ...opts.bundleFiles.filter((f) => !f.endsWith(".map") && f !== "sw.js").map((f) => `/${f}`),
    ...publicFiles.filter((p) => !isMedia(p)),
  ];
  const config = {
    version: opts.version,
    app: [...new Set(app)].sort(),
    media: publicFiles.filter(isMedia).sort(),
    mediaHash: Object.fromEntries(
      publicFiles.filter(isMedia).sort().flatMap((p) => (opts.mediaHashes?.[p] ? [[p, opts.mediaHashes[p]]] : [])),
    ),
    pages: [...OFFLINE_PAGES],
    googleFonts: GOOGLE_FONTS_CSS,
  };
  const template = readFileSync(new URL("./sw.template.js", import.meta.url), "utf8");
  return template.replace("__OFFLINE_CONFIG__", JSON.stringify(config));
}

export function offlineWorkerPlugin(version: string): PluginLike {
  let publicDir = "public";
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
          .map((f) => [f.path, createHash("sha256").update(readFileSync(f.full)).digest("hex")]),
      );
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: offlineWorkerSource({ version, bundleFiles: Object.keys(bundle), publicFiles, mediaHashes }),
      });
    },
  };
}
