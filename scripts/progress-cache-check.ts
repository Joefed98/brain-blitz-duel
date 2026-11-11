/**
 * progress-cache-check (wave 2 C1a, 11 Nov 2026, Joe's decision): the display-only copy of the last practice progress
 * the server sent (src/lib/practice/progressCache.ts, wired in useProgress.ts), so stars and bests still show when
 * Practice opens offline after a restart.
 *
 *  1. The copy: written from a server answer, read back after a "restart" (memory cleared) for the same session's
 *     player, shown until the server answers again, then replaced by the server's answer; never another player's;
 *     corrupt or blocked storage reads as no copy; the copy is held to the view's shape and never shows the note.
 *  2. Offline: with the server unreachable the copy stays on screen; a graded run's own answer (`progress`) updates it.
 *  3. Never sent back or trusted: only useProgress.ts imports the copy; no server function, server module, grading,
 *     scoring or replay code reads it; the copy is written only from the server's answers (getMyPracticeProgressFn and
 *     a graded run's `progress`, passed by Practice and the offline queue), and the progress call takes no input.
 *
 *   bun scripts/progress-cache-check.ts
 */
import { mock } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

/* A device: storage that can be blocked, a session whose user can change, a server that can be offline. */
const store = new Map<string, string>();
let blocked = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => {
      if (blocked) throw new Error("blocked");
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (blocked) throw new Error("blocked");
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  },
};
let sessionUser: string | null = "u-1";
mock.module("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: sessionUser ? { user: { id: sessionUser } } : null } }) } },
}));
let server: (() => unknown) | null = null;
mock.module("@/lib/practice/progress.functions", () => ({
  getMyPracticeProgressFn: async () => {
    if (!server) throw new Error("offline");
    return server();
  },
  markPracticeRefreshNoteSeenFn: async () => ({ ok: true }),
}));

const cache = await import("../src/lib/practice/progressCache");
const progress = await import("../src/lib/practice/useProgress");
const { bestOf, starOf } = await import("../src/lib/practice/progress");
const tick = () => new Promise((r) => setTimeout(r, 5));
const restart = () => progress.resetPracticeProgressForChecks();

const viewA = {
  games: { unblock: { classic: { best: 182, star: true, starScore: 182 } }, tilt: { classic: { best: 120, star: false, starScore: null } } },
  stars: 1,
  gems: [],
  noteSeen: false,
  freshStartAt: "2026-11-11T10:15:00.000Z",
};

/* ------------------------------------------------------------------ 1. the copy */
server = () => viewA;
await progress.refreshPracticeProgress("u-1");
await tick();
check(bestOf(progress.practiceProgressNow(), "unblock") === 182, "the server's answer is shown");
check(store.has(cache.PROGRESS_CACHE_KEY), "and kept as the display-only copy");
restart();
server = null;
check(progress.practiceProgressNow() === null, "a restart forgets the shown progress");
await progress.seedFromCopy();
const seeded = progress.practiceProgressNow();
check(bestOf(seeded, "unblock") === 182 && starOf(seeded, "unblock") && bestOf(seeded, "tilt") === 120 && seeded?.stars === 1, "after a restart the copy shows the same stars and bests");
check(seeded?.noteSeen === true, "the refresh note is never shown from the copy");
/* 2. Offline: the copy stays until the server answers. */
await progress.refreshPracticeProgress("u-1");
check(bestOf(progress.practiceProgressNow(), "unblock") === 182, "offline: the copy stays on screen");
const viewB = { ...viewA, games: { unblock: { classic: { best: 150, star: true, starScore: 182 } } }, stars: 1 };
server = () => viewB;
await progress.refreshPracticeProgress("u-1");
await tick();
check(bestOf(progress.practiceProgressNow(), "unblock") === 150 && bestOf(progress.practiceProgressNow(), "tilt") === null, "the server's next answer replaces the copy on screen (the server is the only source)");
check(bestOf(cache.readShownProgress("u-1"), "unblock") === 150, "and replaces the kept copy");
progress.applyPracticeRun("flood", { counted: true, level: "classic", best: 190, previousBest: null, improved: false, star: true, starEarned: true, starTotal: 2, gemsUnlocked: [] });
await tick();
check(bestOf(cache.readShownProgress("u-1"), "flood") === 190 && cache.readShownProgress("u-1")?.stars === 2, "a graded run's own answer updates the copy");
progress.applyPracticeRun("pinball", { counted: false, level: "classic", best: null, previousBest: null, improved: false, star: false, starEarned: false, starTotal: 0, gemsUnlocked: [] });
await tick();
check(bestOf(cache.readShownProgress("u-1"), "pinball") === null, "a run the server didn't count never reaches the copy");
/* Another player. */
restart();
server = null;
sessionUser = "u-2";
await progress.seedFromCopy();
check(progress.practiceProgressNow() === null && cache.readShownProgress("u-2") === null, "another player's copy is never shown");
sessionUser = null;
await progress.seedFromCopy();
check(progress.practiceProgressNow() === null, "no session: no copy");
sessionUser = "u-1";
/* Shape and storage. */
store.set(cache.PROGRESS_CACHE_KEY, "{not json");
check(cache.readShownProgress("u-1") === null, "a corrupt copy reads as none");
store.set(cache.PROGRESS_CACHE_KEY, JSON.stringify({ player: "u-1", view: { games: { tilt: { classic: { best: "x" }, hard: { best: 199, star: true, starScore: 199 } }, "<script>": { classic: { best: 5 } } }, stars: -4, gems: ["ruby", 7], noteSeen: false, extra: "y" } }));
const shaped = cache.readShownProgress("u-1");
check(
  !!shaped && bestOf(shaped, "tilt") === null && bestOf(shaped, "tilt", "hard") === 199 && !("<script>" in shaped.games) && shaped.stars === 0 &&
    shaped.gems.join() === "ruby" && shaped.noteSeen === true && !("extra" in shaped),
  "the copy is held to the view's shape",
);
blocked = true;
check(cache.readShownProgress("u-1") === null, "blocked storage reads as no copy");
cache.saveShownProgress("u-1", viewA as never);
blocked = false;

/* ------------------------------------------------------------------ 3. never sent back or trusted */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const importers = walk("src").filter((f) => /progressCache"/.test(readFileSync(f, "utf8")));
check(importers.join() === "src/lib/practice/useProgress.ts", `only the progress store imports the copy (${importers.join(", ")})`);
for (const f of walk("src").filter((f) => /\.server\.ts$|\.functions\.ts$|\/grade|scoring|replay/i.test(f))) {
  check(!/progressCache|useProgress|PROGRESS_CACHE_KEY|duelz-practice-view/.test(readFileSync(f, "utf8")), `${f}: never reads the copy`);
}
const hook = readFileSync("src/lib/practice/useProgress.ts", "utf8");
check((hook.match(/saveShownProgress\(/g) ?? []).length === 1 && /function keepFromServer\(view: PracticeProgressView\)/.test(hook), "the copy is written in one place");
check((hook.match(/keepFromServer\(/g) ?? []).length === 3 && /publish\(answer\);\s*keepFromServer\(answer\);/.test(hook) && /publish\(next\);\s*keepFromServer\(next\);/.test(hook), "only from the server's answer and a counted run's own answer");
check(/if \(copy && !current\) publish\(copy\)/.test(hook), "the copy is shown only before the server has answered");
for (const [file, call] of [["src/routes/practice.tsx", "applyPracticeRun(puzzle.type, result.progress)"], ["src/lib/offline/queue.ts", "applyPracticeRun(run.type, result.progress)"]] as const) {
  const src = readFileSync(file, "utf8");
  check(src.includes(call) && (src.match(/applyPracticeRun\(/g) ?? []).length === 1, `${file}: applies only the server's grade (${call})`);
}
const fns = readFileSync("src/lib/practice/progress.functions.ts", "utf8");
check(!/inputValidator/.test(fns), "the progress calls take no input (nothing from the phone is read)");
const cacheSrc = readFileSync("src/lib/practice/progressCache.ts", "utf8");
check(!/fetch\(|createServerFn|import\("@\/lib\/duel/.test(cacheSrc), "the copy module sends nothing");

if (failures.length) {
  for (const m of failures) console.log(`FAIL ${m}`);
  console.log(`FAIL progress-cache-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`PASS progress-cache-check: ${passes} assertions`);
