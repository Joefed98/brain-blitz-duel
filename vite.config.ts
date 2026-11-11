// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

/**
 * Workers Logs (9 Nov 2026): the Worker's logs stay on across deploys. `wrangler deploy` makes the Worker's settings
 * match its config, so a config without `observability` turned logs back off on every GitHub deploy
 * (.github/workflows/deploy-cloudflare.yml). Nitro's cloudflare preset merges `cloudflare.wrangler` into the
 * wrangler.json it generates (.output/server/wrangler.json, found through .wrangler/deploy/config.json), so every
 * deploy carries logs on, invocation logs on and persisted to the dashboard. No sampling: every request is logged.
 */
const WORKER_OBSERVABILITY = {
  enabled: true,
  head_sampling_rate: 1,
  logs: { enabled: true, invocation_logs: true, persist: true, head_sampling_rate: 1 },
};

/**
 * Rated play's Cron Trigger (wave 3 W3a, docs/rated/README.md "The standings job"): a nitro scheduled task, as B2's push
 * tasks are. Nitro's Cloudflare preset writes each schedule into the generated wrangler.json's `triggers.crons`, so
 * `wrangler deploy` sets the Worker's Cron Triggers, and the Worker's `scheduled` handler runs the task for the cron
 * that fired. UTC, kept in step with RATED_CRONS (src/lib/rated/tasks/ratedTasks.server.ts; ratings-check compares).
 */
const RATED_TASKS = {
  tasks: {
    "rated:standings": { handler: fileURLToPath(new URL("./src/lib/rated/tasks/standings.task.ts", import.meta.url)) },
  },
  scheduledTasks: {
    "23 * * * *": ["rated:standings"],
  },
};

/**
 * Matchmaking's Cron Trigger (wave 3 W3b, docs/rated/matchmaking-interface.md): the 15-day purge of mm_practice_deals,
 * run by the Worker so it happens with or without pg_cron. UTC, kept in step with MATCHMAKING_CRONS
 * (src/lib/rated/tasks/matchmakingTasks.server.ts; rated-matchmaking-check compares).
 */
const MATCHMAKING_TASKS = {
  tasks: {
    "rated:practice-deals-purge": { handler: fileURLToPath(new URL("./src/lib/rated/tasks/practiceDealsPurge.task.ts", import.meta.url)) },
  },
  scheduledTasks: {
    "37 4 * * *": ["rated:practice-deals-purge"],
  },
};

type TaskSet = { tasks: Record<string, { handler: string }>; scheduledTasks: Record<string, string[]> };
/** Every task set's tasks and schedules in one nitro option (a later set adds to, never replaces, an earlier one's). */
function nitroTasks(...sets: TaskSet[]) {
  const tasks: TaskSet["tasks"] = {};
  const scheduledTasks: TaskSet["scheduledTasks"] = {};
  for (const set of sets) {
    Object.assign(tasks, set.tasks);
    for (const [cron, names] of Object.entries(set.scheduledTasks)) scheduledTasks[cron] = [...(scheduledTasks[cron] ?? []), ...names];
  }
  return { experimental: { tasks: true }, tasks, scheduledTasks };
}

/** Adds more task sets to a nitroTasks option (their tasks and schedules join, never replace, the ones already there). */
function withTasks(base: ReturnType<typeof nitroTasks>, ...sets: TaskSet[]) {
  const more = nitroTasks(...sets);
  const scheduledTasks = { ...base.scheduledTasks };
  for (const [cron, names] of Object.entries(more.scheduledTasks)) scheduledTasks[cron] = [...(scheduledTasks[cron] ?? []), ...names];
  return { ...base, tasks: { ...base.tasks, ...more.tasks }, scheduledTasks };
}

const SERVER_BUILD = Object.assign(
  { minify: true },
  { cloudflare: { wrangler: { observability: WORKER_OBSERVABILITY } } },
  withTasks(nitroTasks(RATED_TASKS), MATCHMAKING_TASKS),
) as NitroOptions & { minify: boolean };

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
