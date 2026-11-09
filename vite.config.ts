// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { execSync } from "node:child_process";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

import { offlineWorkerPlugin } from "./src/lib/offline/swPlugin";

/**
 * One id per build, baked into the phone bundle and the server bundle alike
 * (src/lib/appVersion.ts). The commit when git is there, plus the build time, so
 * every Publish gets a new id with no manual step. Kept in the environment so a
 * second evaluation of this config in the same build reuses the same id.
 */
function buildId(): string {
  if (process.env["DUELZ_BUILD_ID"]) return process.env["DUELZ_BUILD_ID"];
  let commit = "";
  try {
    commit = execSync("git rev-parse --short=10 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    /* no git in this build environment */
  }
  const id = `${commit || "build"}-${Date.now().toString(36)}`;
  process.env["DUELZ_BUILD_ID"] = id;
  return id;
}

/**
 * Speed fix 7 (9 Nov 2026, docs/audit-nov-2026/performance.md): the server build is minified. Nitro's Cloudflare preset
 * leaves it unminified (`minify: false`), so a fresh isolate parsed about 26 MB of server JS before its first deal or
 * answer. Lovable's config passes any other nitro option through, inside its build as outside, so this reaches the
 * published build. The narrow `nitro` type has no `minify`, hence the cast; nothing else about the build changes.
 */
type NitroOptions = Exclude<NonNullable<Parameters<typeof defineConfig>[0]>["nitro"], boolean | undefined>;
const SERVER_BUILD = { minify: true } as NitroOptions & { minify: boolean };

export default defineConfig({
  nitro: SERVER_BUILD,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Import protection (9 Nov 2026): the phone build refuses any import of a *.server.* file. Lovable's config sets
    // client.files to ["**/server/**"], which replaces TanStack Start's own default ("**/*.server.*"), so a client
    // import of e.g. src/lib/duel/registry.server.ts built without complaint. Vite's mergeConfig concatenates these
    // arrays with Lovable's, so its "**/server/**" and "server-only" stay; they are restated here for the reader.
    importProtection: {
      behavior: "error",
      client: {
        files: ["**/server/**", "**/*.server.*"],
        specifiers: ["server-only"],
      },
    },
  },
  vite: {
    define: { __DUELZ_BUILD_ID__: JSON.stringify(buildId()) },
  },
  // Offline practice (31 Oct 2026): /sw.js, filled in with this build's id and files (src/lib/offline/swPlugin.ts).
  plugins: [offlineWorkerPlugin(buildId())],
});
