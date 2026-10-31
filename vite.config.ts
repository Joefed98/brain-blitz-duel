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

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: { __DUELZ_BUILD_ID__: JSON.stringify(buildId()) },
  },
  // Offline practice (31 Oct 2026): /sw.js, filled in with this build's id and files (src/lib/offline/swPlugin.ts).
  plugins: [offlineWorkerPlugin(buildId())],
});
