/**
 * practice-progress-check (wave 2 train C, C1a, 11 Nov 2026; docs/practice-progress.md): practice stars, bests and gems
 * on the account, through the real server functions (src/lib/duel/practice.functions.ts,
 * src/lib/practice/progress.functions.ts, src/lib/economy/economy.functions.ts) and the real migrations on a local
 * PostgreSQL 16, with the server-function harness's PostgREST / GoTrue stand-in (scripts/server-fn-harness.ts).
 *
 * What it proves:
 *  1. The rules: 175 earns a star, 174 doesn't; only Easy, Classic and Hard have stars (Expert's crown is wave 3.5); a
 *     run with no level is Classic; 276 stars at most (92 games × 3); the gem thresholds are the master plan's, the same
 *     in code and in the migration, in GEM_IDS' order; every gem unlocks at exactly its threshold.
 *  2. The stored breakdown: a practice run stores in practice_plays.breakdown exactly what a room run of the same answer
 *     stores in round_results.extra (gradeRoomAnswer), with the same score, from the server's own grading; the grade's
 *     answer is unchanged by the breakdown (extraJson is the same text); the stored level is Classic.
 *  3. Stars and bests from graded runs only: 174 / 175, the best only rises, "improved" never on a first run, a star
 *     once earned is kept, Expert earns none, a run with a NULL level counts as Classic, a play counts once, the intro
 *     example and a flagged run never count, and runs graded before the fresh start never count (nothing deleted).
 *  4. Gems: an account's gems unlock at exactly 10, 20, … stars and are never removed; setAvatar accepts an unlocked
 *     gem and refuses a locked one; a guest has no gems until signing up, when their stars unlock them (same user id).
 *  5. Follows the account: two sessions of one account read exactly the same progress; a second-device guest is a
 *     separate guest with nothing; signing in to an account doesn't move a guest's progress onto it.
 *  6. Offline runs count only once the server has graded them (practiceGradeQueuedFn), and the grade says what they did.
 *  7. The one-time refresh note: unseen, then seen once marked, on every session of the player.
 *  8. Nobody but the database's own functions writes progress: anon and authenticated can't read, write or call any of
 *     it (gems included), and the service role can't write the tables directly.
 *  9. Analytics: star_earned and best_set (game, props.level) and gem_unlocked (props.gem).
 * 10. The device's fresh start: the old practice bests (every prefix) and goals record are cleared once, nothing else.
 * 11. Wiring: Practice, the intro, the reveal, Profile, the Play tab and the offline queue never read the device's
 *     practice bests or stars.
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's runners). Without them it fails on CI and prints a NOTE
 * locally. No browser.
 *
 *   bun scripts/practice-progress-check.ts
 */

import { readFileSync } from "node:fs";

import {
  accountToken,
  ANON_KEY,
  callServerFn,
  installServerFnPlugin,
  postgresBin,
  SERVICE_KEY,
  startLocalDb,
  startRestServer,
  userToken,
  type LocalDb,
  type RestServer,
} from "./server-fn-harness";
import { STAR_TOTAL_MAX } from "../src/lib/practice/progressRules";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
async function section(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    check(false, `${name}: threw ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 4).join(" | ") : String(err)}`);
  }
}

const quietLog = console.log;
const quietWarn = console.warn;
const quietError = console.error;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^practice-progress-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ACC = uid(41); // an account (two sessions: two phones)
const GUEST = uid(42); // a guest who later signs up
const OTHER = uid(43); // a guest on a second device
const EXPERT = uid(44); // a guest for the level rules
const FRESH = uid(45); // a guest with a play from before the fresh start
const OLD = uid(46); // an account from before the fresh start (the refresh note)

/** The master plan's gem thresholds, written out here, independent of the code. */
const NEEDS: [string, number][] = [
  ["amber", 10], ["rose-quartz", 20], ["ruby", 30], ["jade", 50], ["amethyst", 75],
  // Changed with Joe's approval, 13 Nov 2026: Diamond is every live star (STAR_TOTAL_MAX, 249 with 83 live games), so no retirement can put it out of reach.
  ["aquamarine", 100], ["sapphire", 125], ["pearl", 150], ["obsidian", 200], ["diamond", STAR_TOTAL_MAX],
];

await pureChecks();
await deviceChecks();
await wiringChecks();

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`practice-progress-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`practice-progress-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

let db: LocalDb | null = null;
let rest: RestServer | null = null;
try {
  db = startLocalDb("practice-progress-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  db.psql(`INSERT INTO auth.users (id, is_anonymous, email) VALUES
    ('${ACC}', false, 'acc@example.com'), ('${GUEST}', true, NULL), ('${OTHER}', true, NULL),
    ('${EXPERT}', true, NULL), ('${FRESH}', true, NULL)`);
  db.psql(`INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth)
    VALUES ('${ACC}', 'Acc_Player', 'acc_player', 3, DATE '1990-01-01')`);
  await installServerFnPlugin();
  await databaseChecks(db);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`practice-progress-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: practice stars, bests and gems are the server's, from graded runs only, the same on every device.");
process.exit(0);

/* =================================================================== 1. the rules */

async function pureChecks(): Promise<void> {
  await section("rules", async () => {
    const rules = await import("../src/lib/practice/progressRules");
    const { ACTIVE_PUZZLE_TYPES } = await import("../src/lib/duel/registry");
    const { GEM_IDS } = await import("../src/lib/economy/slots");
    check(rules.STAR_SCORE === 175, "a star needs 175");
    // The pack limit (Joe's decision, 11 Nov 2026: 100 an hour per network, was 20).
    const { IP_PRACTICE_PACK_LIMIT } = await import("../src/lib/duel/rateLimit.server");
    check(IP_PRACTICE_PACK_LIMIT.max === 100 && IP_PRACTICE_PACK_LIMIT.windowSeconds === 3600 && IP_PRACTICE_PACK_LIMIT.bucket === "ip-practice-pack", "practice packs: 100 an hour per network");
    check(rules.earnsStar(175) && !rules.earnsStar(174) && rules.earnsStar(200) && !rules.earnsStar(Number.NaN), "175 earns the star, 174 doesn't");
    check(rules.earnsStar(175, "easy") && rules.earnsStar(175, "hard") && !rules.earnsStar(200, "expert"), "stars on Easy, Classic and Hard; Expert's 175+ is a crown, never a star");
    check(rules.DEALT_LEVEL === "classic" && rules.levelOf(null) === "classic" && rules.levelOf(undefined) === "classic" && rules.levelOf("nonsense") === "classic" && rules.levelOf("hard") === "hard", "a run with no level is Classic");
    // Changed with Joe's approval, 13 Nov 2026: nine games retired, 83 live games × 3 levels = 249.
    check(rules.STAR_TOTAL_MAX === 249 && ACTIVE_PUZZLE_TYPES.length * rules.STARS_PER_GAME === rules.STAR_TOTAL_MAX, `249 stars: ${ACTIVE_PUZZLE_TYPES.length} games × 3 levels`);
    check(rules.GEM_THRESHOLDS.map((g) => `${g.gem}:${g.stars}`).join() === NEEDS.map(([g, n]) => `${g}:${n}`).join(), "the gem thresholds are the master plan's");
    check(rules.GEM_THRESHOLDS.map((g) => g.gem).join() === GEM_IDS.join(), "in GEM_IDS' order");
    for (const [gem, n] of NEEDS) {
      check(!rules.gemsFor(n - 1).includes(gem) && rules.gemsFor(n).includes(gem), `${gem} unlocks at exactly ${n}`);
      check(rules.gemUnlockLine(gem) === `Unlocks at ${n} stars`, `${gem}'s locked line`);
    }
    check(rules.nextGem(0)?.gem === "amber" && rules.nextGem(10)?.gem === "rose-quartz" && rules.nextGem(STAR_TOTAL_MAX) === null, "the next gem to unlock"); // Changed with Joe's approval, 13 Nov 2026: Diamond at every live star.
    const sql = readFileSync("supabase/migrations/20261111101500_practice_progress.sql", "utf8");
    const values = [...sql.matchAll(/\('([a-z-]+)', (\d+)\)/g)].map((m) => `${m[1]}:${m[2]}`).join();
    // Changed with Joe's approval, 13 Nov 2026: the first migration's thresholds match with Diamond's old 250 left out; the retirement migration's Diamond
    // reads the mirror's live star total.
    check(values === [...NEEDS.slice(0, -1).map(([g, n]) => `${g}:${n}`), "diamond:250"].join(), `the first migration's thresholds are the same but Diamond (${values})`);
    const retired = readFileSync("supabase/migrations/20261116600000_retired_games.sql", "utf8");
    check(/\('diamond', coalesce\(\(SELECT star_total FROM public\.game_retirement WHERE id\), 250\)\)/.test(retired), "the retirement migration's Diamond is the mirror's live star total");
    check(/score >= 175/.test(sql) && /v_level IN \('easy', 'classic', 'hard'\)/.test(sql), "the migration's star rule is the same");
    const progress = await import("../src/lib/practice/progress");
    check(progress.runStarLine({ counted: true, level: "classic", best: 180, previousBest: null, improved: false, star: true, starEarned: true, starTotal: 1, gemsUnlocked: [] }) === "Star earned", "a run that earns its star names it");
    check(progress.runStarLine({ counted: true, level: "classic", best: 180, previousBest: 179, improved: true, star: true, starEarned: false, starTotal: 1, gemsUnlocked: [] }) === null, "no line without a new star");
    check(progress.practiceRunRecord(null, 140).best === 140 && !progress.practiceRunRecord(null, 140).improved, "a run not yet counted keeps the best shown and is never a new best");
  });
}

/* =================================================================== 10. the device's fresh start */

async function deviceChecks(): Promise<void> {
  await section("device fresh start", async () => {
    const store = new Map<string, string>([
      ["duelz-practice-best:v3:unblock@speedPar=1", "150"],
      ["duelz-practice-best:v2:tilt@tiltRev=8", "120"],
      ["duelz-practice-best:pinball", "99"],
      ["duelz-practice-goals:v1", JSON.stringify({ v: 1, stars: { unblock: 3 }, challenges: { "unblock.par": { value: 20, done: "2026-11-09" } } })],
      ["duelz-practice-recent:v1", "[]"],
      ["duelz-arcade-room-best:v2:tilt", "140"],
      ["duelz-account:v1", "{}"],
    ]);
    const keys = () => [...store.keys()];
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        get length() {
          return store.size;
        },
        key: (i: number) => keys()[i] ?? null,
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
    const fresh = await import("../src/lib/practice/deviceFreshStart");
    check(fresh.clearDeviceProgressOnce(), "the first visit clears the device's practice progress");
    check(![...store.keys()].some((k) => k.startsWith("duelz-practice-best:") || k === "duelz-practice-goals:v1"), `every old best and the goals record are gone (${keys().join(", ")})`);
    check(["duelz-practice-recent:v1", "duelz-arcade-room-best:v2:tilt", "duelz-account:v1"].every((k) => store.has(k)), "nothing else is touched");
    check(store.has(fresh.DEVICE_FRESH_START_KEY), "the device remembers it was cleared");
    store.set("duelz-practice-goals:v1", JSON.stringify({ v: 1, stars: {}, challenges: { "unblock.par": { value: 4 } } }));
    fresh.resetDeviceFreshStartForChecks();
    check(!fresh.clearDeviceProgressOnce() && store.has("duelz-practice-goals:v1"), "once only: challenge ticks recorded after it are kept (today's challenge code keeps working)");
    delete (globalThis as { window?: unknown }).window;
  });
}

/* =================================================================== 11. wiring */

async function wiringChecks(): Promise<void> {
  await section("wiring", async () => {
    const read = (p: string) => readFileSync(p, "utf8");
    for (const file of ["src/routes/practice.tsx", "src/routes/profile.tsx", "src/routes/index.tsx", "src/components/duel/RoundIntro.tsx", "src/components/duel/AnswerReveal.tsx", "src/lib/offline/queue.ts"]) {
      const src = read(file);
      check(!/readPracticeBest|recordPracticeBest|starsOf\(|starTotal\(|from "@\/lib\/duel\/practiceBest"/.test(src), `${file}: never reads the device's practice bests or stars`);
    }
    const grade = read("src/lib/duel/practice.functions.ts");
    check(/breakdown: graded\.extra \?\? null,\s*level: levelOf\(/.test(grade), "the grade stores its own graded extra as the breakdown, with the level");
    check(/progress: progress as PracticeRunProgress \| null/.test(grade), "the grade answers what the run did to progress");
    check(/practiceGradeQueuedFn[\s\S]*gradePracticeRun\(data, mergePuzzle/.test(grade), "queued offline runs go through the same grade (counted once graded)");
    const queue = read("src/lib/offline/queue.ts");
    check(/practiceRunRecord\(result\.progress, null\);\s*applyPracticeRun\(run\.type, result\.progress\)/.test(queue), "the queue shows a run's progress only from the server's grade");
    const practice = read("src/routes/practice.tsx");
    check(/data-practice-refresh-note/.test(practice) && /PRACTICE_REFRESH_NOTE/.test(practice) && /notePracticeRefreshSeen\(\)/.test(practice), "Practice shows the one-time note and tells the server it was seen");
    const rules = await import("../src/lib/practice/progressRules");
    check(rules.PRACTICE_REFRESH_NOTE === "Stars and challenges have had a refresh. Everything you earn now is saved to your account.", "the note's words are Joe's");
    const neutral = ["src/lib/duel/grade.ts", "src/lib/duel/scoring.ts", "src/lib/duel/roomGrade.server.ts", "src/lib/duel/gradeAnswer.server.ts"];
    for (const file of neutral) check(!/practice\/progress|practiceProgress/.test(read(file)), `${file}: scoring never reads progress`);
  });
}

/* =================================================================== the database */

async function databaseChecks(db: LocalDb): Promise<void> {
  const practice = await import("../src/lib/duel/practice.functions");
  const progressFns = await import("../src/lib/practice/progress.functions");
  const economy = await import("../src/lib/economy/economy.functions");
  const { splitPuzzle, mergePuzzle } = await import("../src/lib/duel/secrets");
  const { sealDeal, openDeal } = await import("../src/lib/duel/practiceSeal.server");
  const { gradeRoomAnswer } = await import("../src/lib/duel/roomGrade.server");
  const { puzzleTimeLimitMs } = await import("../src/lib/duel/catalogue");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const call = callServerFn;
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const accA = accountToken(ACC);
  const accB = accountToken(ACC);
  type Run = { type: string; puzzle: Record<string, unknown> & { type: string }; answer: string };
  const record = (playId: string) => JSON.parse(q(`SELECT public.practice_record_play(${playId})::text`)) as Record<string, unknown>;
  /** A graded play written as practice_plays holds it, for the counting rules (the score as graded). */
  const play = (user: string, game: string, score: number, level = "classic") =>
    q(`INSERT INTO public.practice_plays (user_id, game_id, score, level) VALUES ('${user}', '${game}', ${score}, '${level}') RETURNING id`);

  /* ---------------------------------------------------- 2. the stored breakdown */
  await section("breakdown", async () => {
    const fixture = JSON.parse(readFileSync("scripts/fixtures/replay-runs.json", "utf8")) as { runs: Run[] };
    const { ACTIVE_PUZZLE_TYPES } = await import("../src/lib/duel/registry");
    const seen = new Set<string>();
    const runs = fixture.runs.filter((r) => (ACTIVE_PUZZLE_TYPES as readonly string[]).includes(r.type) && !seen.has(r.type) && seen.add(r.type)).slice(0, 6);
    check(runs.length === 6, `six fixture runs of different games (${runs.map((r) => r.type).join(", ")})`);
    for (const run of runs) {
      const { pub, priv } = splitPuzzle(run.puzzle as never);
      const sealed = await sealDeal(pub as never, priv as Record<string, unknown>);
      const before = q(`SELECT coalesce(max(id), 0) FROM public.practice_plays`);
      const graded = await call(practice.practiceGradeFn, { puzzle: pub, sealed, answer: run.answer, msRemaining: 0 }, accA);
      const row = q(`SELECT breakdown::text || '|' || score || '|' || coalesce(level, '-') FROM public.practice_plays WHERE id > ${before} AND user_id = '${ACC}' ORDER BY id DESC LIMIT 1`);
      const [stored, score, level] = [row.slice(0, row.lastIndexOf("|", row.lastIndexOf("|") - 1)), ...row.split("|").slice(-2)];
      const now = Date.now();
      const room = gradeRoomAnswer(run.puzzle as never, { phase: "puzzle", phaseStartedAt: new Date(now - puzzleTimeLimitMs(run.puzzle as never)).toISOString(), nowMs: now }, run.answer, 0);
      // The arcade replay's diag.replayMs is how long the server's replay took (wall clock), not part of the grade.
      const timing = (v: unknown) => {
        const c = JSON.parse(JSON.stringify(v ?? null)) as { diag?: Record<string, unknown> } | null;
        if (c?.diag) delete c.diag["replayMs"];
        return sortKeys(c);
      };
      const same = (a: unknown, b: unknown) => JSON.stringify(timing(a)) === JSON.stringify(timing(b));
      check(same(JSON.parse(stored), room.graded.extra ?? null), `${run.type}: practice stores the breakdown a room stores for the same answer (${diffKeys(timing(JSON.parse(stored)), timing(room.graded.extra))})`);
      check(Number(score) === Math.round(room.graded.score) && graded.score === room.graded.score, `${run.type}: the same score (${graded.score} vs room ${room.graded.score})`);
      check(JSON.stringify(sortKeys(JSON.parse(stored))) === JSON.stringify(sortKeys(JSON.parse(graded.extraJson ?? "null"))), `${run.type}: the stored breakdown is exactly the grade's own extra`);
      check(level === "classic", `${run.type}: stored as Classic`);
      const flagged = (room.graded.extra as { flagged?: boolean } | undefined)?.flagged === true;
      check(graded.progress?.counted === !flagged, `${run.type}: ${flagged ? "flagged by the server replay: not counted" : "counted"}`);
    }
    // A puzzle with a private half, dealt by the server.
    const dealt = await call(practice.practiceGenerateFn, { type: "tilegrid" }, accA);
    const opened = await openDeal(dealt.sealed, dealt.puzzle);
    const graded = await call(practice.practiceGradeFn, { puzzle: dealt.puzzle, sealed: dealt.sealed, answer: "", msRemaining: 30_000 }, accA);
    const stored = q(`SELECT breakdown::text FROM public.practice_plays WHERE user_id = '${ACC}' AND game_id = 'tilegrid' ORDER BY id DESC LIMIT 1`);
    check(JSON.stringify(sortKeys(JSON.parse(stored))) === JSON.stringify(sortKeys(JSON.parse(graded.extraJson ?? "null"))), "tilegrid: the stored breakdown is the grade's own");
    const now = Date.now();
    const room = gradeRoomAnswer(mergePuzzle(opened!.pub, opened!.priv) as never, { phase: "puzzle", phaseStartedAt: new Date(now - 30_000).toISOString(), nowMs: now }, "", 30_000);
    check(JSON.stringify(sortKeys(JSON.parse(stored))) === JSON.stringify(sortKeys(room.graded.extra ?? null)) && room.graded.score === graded.score, "tilegrid: the same as a room's for the same answer");
    // The intro example never counts.
    const example = await call(practice.practiceGenerateFn, { type: "tilegrid", example: true }, accA);
    const ex = await call(practice.practiceGradeFn, { puzzle: example.puzzle, sealed: example.sealed, answer: "", msRemaining: 1_000 }, accA);
    check(ex.progress?.counted !== true && q(`SELECT count(*) FROM public.practice_progress WHERE best_play_id IN (SELECT id FROM public.practice_plays WHERE example)`) === "0", "the intro example is never counted");
    // A player without a session: recorded as before, counted for nobody.
    const anon = await call(practice.practiceGradeFn, { puzzle: dealt.puzzle, sealed: dealt.sealed, answer: "", msRemaining: 1_000 }, null);
    check(anon.progress === null, "a grade with no player counts for nobody");
  });

  /* ---------------------------------------------------- 3. stars and bests */
  await section("stars and bests", async () => {
    let r = record(play(EXPERT, "unblock", 174));
    check(r["counted"] === true && r["star_earned"] === false && r["star"] === false && r["best"] === 174 && r["previous_best"] === null && r["improved"] === false && r["best_set"] === true, `174: a best, no star, not "improved" on a first run (${JSON.stringify(r)})`);
    r = record(play(EXPERT, "unblock", 175));
    check(r["star_earned"] === true && r["star_total"] === 1 && r["best"] === 175 && r["improved"] === true, "175 earns the star");
    r = record(play(EXPERT, "unblock", 120));
    check(r["star"] === true && r["star_earned"] === false && r["best"] === 175 && r["best_set"] === false && r["improved"] === false, "a lower run: the best and the star stay");
    r = record(play(EXPERT, "unblock", 199));
    check(r["star_earned"] === false && r["star_total"] === 1 && r["best"] === 199 && r["previous_best"] === 175, "a higher run raises the best; the star is earned once");
    check(q(`SELECT star_score FROM public.practice_progress WHERE user_id = '${EXPERT}' AND game_id = 'unblock'`) === "175", "the star keeps the score that earned it");
    r = record(play(EXPERT, "tilt", 200, "expert"));
    check(r["level"] === "expert" && r["star"] === false && r["star_total"] === 1, "Expert's 200 earns no star (its crown is wave 3.5)");
    const nullLevel = q(`INSERT INTO public.practice_plays (user_id, game_id, score, level) VALUES ('${EXPERT}', 'flood', 180, NULL) RETURNING id`);
    r = record(nullLevel);
    check(r["level"] === "classic" && r["star_earned"] === true && q(`SELECT level FROM public.practice_progress WHERE user_id = '${EXPERT}' AND game_id = 'flood'`) === "classic", "a run with no level counts as Classic");
    check(record(nullLevel)["counted"] === false, "a play counts once");
    const flagged = q(`INSERT INTO public.practice_plays (user_id, game_id, score, flagged) VALUES ('${EXPERT}', 'pinball', 190, true) RETURNING id`);
    check(record(flagged)["reason"] === "flagged", "a run the server replay flagged never counts");
    const example = q(`INSERT INTO public.practice_plays (user_id, game_id, score, example) VALUES ('${EXPERT}', 'pinball', 190, true) RETURNING id`);
    check(record(example)["reason"] === "example", "the intro example never counts");
    check(q(`SELECT count(*) FROM public.practice_progress WHERE user_id = '${EXPERT}' AND game_id = 'pinball'`) === "0", "neither left a best");
    // The fresh start: a play graded before it never counts, and is never deleted.
    const fresh = q(`SELECT fresh_start_at FROM public.practice_progress_start`);
    const old = q(`INSERT INTO public.practice_plays (user_id, game_id, score, created_at) VALUES ('${FRESH}', 'sudoku', 200, timestamptz '${fresh}' - interval '1 second') RETURNING id`);
    check(record(old)["reason"] === "before_fresh_start", "a run graded before the fresh start doesn't count");
    check(q(`SELECT count(*) FROM public.practice_progress WHERE user_id = '${FRESH}'`) === "0" && q(`SELECT count(*) FROM public.practice_plays WHERE id = ${old}`) === "1", "it leaves no star or best, and stays stored");
    // Through the server: the view.
    const view = await call(progressFns.getMyPracticeProgressFn, {}, userToken(EXPERT));
    check(view.stars === 2 && view.games.unblock.classic.best === 199 && view.games.unblock.classic.star === true && view.games.tilt.expert.star === false && view.gems.length === 0, `the view: 2 stars, bests by game and level, no gems for a guest (${JSON.stringify(view)})`);
    check(q(`SELECT count(*) FROM public.practice_plays WHERE user_id = '${EXPERT}'`) === q(`SELECT count(*) FROM public.practice_plays WHERE user_id = '${EXPERT}' AND progress_counted_at IS NOT NULL`), "every play is marked once it is looked at");
  });

  /* ---------------------------------------------------- 4. gems */
  await section("gems", async () => {
    const games = (await import("../src/lib/duel/registry")).ACTIVE_PUZZLE_TYPES.filter((t) => !["tilegrid"].includes(t));
    const starred = () => Number(q(`SELECT public.practice_star_total('${ACC}')`));
    const gems = () => q(`SELECT coalesce(string_agg(gem, ',' ORDER BY gem), '') FROM public.gem_unlocks WHERE user_id = '${ACC}'`);
    const fixtureStars = starred();
    let i = 0;
    let amberAt = -1;
    let roseAt = -1;
    while (starred() < 20) {
      const out = record(play(ACC, games[i++]!, 175));
      const unlocked = (out["gems_unlocked"] as string[]) ?? [];
      if (unlocked.includes("amber")) amberAt = Number(out["star_total"]);
      if (unlocked.includes("rose-quartz")) roseAt = Number(out["star_total"]);
    }
    check(fixtureStars < 10 && amberAt === 10 && roseAt === 20, `Amber at exactly 10, Rose Quartz at exactly 20 (${amberAt}, ${roseAt})`);
    check(gems() === "amber,rose-quartz", `two gems (${gems()})`);
    // setAvatar: an unlocked gem is accepted, a locked one refused.
    const ok = await call(economy.setAvatar, { avatarId: "captain-joulz", colour: 3, gem: "amber" }, accA);
    const refused = await call(economy.setAvatar, { avatarId: "captain-joulz", colour: 3, gem: "ruby" }, accA);
    check(JSON.stringify(ok).includes("set") || (ok as { ok?: boolean }).ok === true, `setAvatar accepts an unlocked gem (${JSON.stringify(ok)})`);
    check(/gem_locked/.test(JSON.stringify(refused)), `setAvatar refuses a locked gem (${JSON.stringify(refused)})`);
    const loadout = await call(economy.getMyLoadout, {}, accA);
    check(JSON.stringify((loadout as { unlockedGems?: string[] }).unlockedGems?.slice().sort()) === '["amber","rose-quartz"]', "the loadout lists the unlocked gems (Customise's picker)");
    // Permanent: the gems are unlocked rows nothing removes.
    check(!/DELETE FROM public\.gem_unlocks/.test(readFileSync("supabase/migrations/20261111101500_practice_progress.sql", "utf8")), "nothing in the migration removes a gem");
    // A guest: stars but no gems until they sign up (the same user id), when the stars unlock them.
    for (let k = 0; k < 10; k++) record(play(GUEST, games[k]!, 180));
    check(q(`SELECT count(*) FROM public.gem_unlocks WHERE user_id = '${GUEST}'`) === "0", "a guest's 10 stars unlock no gem yet");
    q(`UPDATE auth.users SET is_anonymous = false, email = 'guest@example.com' WHERE id = '${GUEST}'`);
    q(`INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth) VALUES ('${GUEST}', 'Was_Guest', 'was_guest', 5, DATE '1991-01-01')`);
    check(q(`SELECT string_agg(gem, ',') FROM public.gem_unlocks WHERE user_id = '${GUEST}'`) === "amber", "signing up keeps the guest's stars and unlocks their gems");
  });

  /* ---------------------------------------------------- 5. follows the account */
  await section("devices", async () => {
    const a = await call(progressFns.getMyPracticeProgressFn, {}, accA);
    const b = await call(progressFns.getMyPracticeProgressFn, {}, accB);
    check(JSON.stringify(a) === JSON.stringify(b) && a.stars >= 20, `two phones on one account read exactly the same (${a.stars} stars)`);
    const other = await call(progressFns.getMyPracticeProgressFn, {}, userToken(OTHER));
    check(other.stars === 0 && Object.keys(other.games).length === 0, "a guest on a second device is a separate guest with nothing");
    record(play(OTHER, "unblock", 190));
    const acc = await call(progressFns.getMyPracticeProgressFn, {}, accA);
    check(acc.stars === a.stars && JSON.stringify(acc) === JSON.stringify(a), "that guest's runs never reach the account (no merge on signing in elsewhere)");
    let refused = false;
    try {
      await call(progressFns.getMyPracticeProgressFn, {}, null);
    } catch {
      refused = true;
    }
    check(refused, "no session: no progress");
  });

  /* ---------------------------------------------------- 6. offline runs */
  await section("offline", async () => {
    const fixture = JSON.parse(readFileSync("scripts/fixtures/replay-runs.json", "utf8")) as { runs: Run[] };
    void fixture;
    // A live deal whose answer couldn't be sent, queued and graded later (a pack deal goes the same way).
    const tok = userToken(OTHER);
    const dealt = await call(practice.practiceGenerateFn, { type: "tilegrid" }, tok);
    const run = { type: "tilegrid", answer: "" };
    const pub = dealt.puzzle as Record<string, unknown>;
    const sealed = dealt.sealed as string;
    const before = await call(progressFns.getMyPracticeProgressFn, {}, tok);
    check(!before.games[run.type], "a run waiting on the phone counts for nothing");
    const graded = await call(practice.practiceGradeQueuedFn, { puzzle: pub, sealed, answer: run.answer, msRemaining: 0 }, tok);
    const after = await call(progressFns.getMyPracticeProgressFn, {}, tok);
    check(graded.status === "graded" && graded.progress?.counted === true && after.games[run.type]?.classic?.best === Math.round(graded.score), "once the server grades it, it counts, and the grade says what it did");
    const rejected = await call(practice.practiceGradeQueuedFn, { puzzle: { ...pub, seed: 1 }, sealed, answer: run.answer, msRemaining: 0 }, tok);
    check(rejected.status === "rejected" && !("progress" in rejected), "a rejected run never counts");
  });

  /* ---------------------------------------------------- 7. the note */
  await section("note", async () => {
    // Only players who existed before the fresh start get the note (Joe, 11 Nov 2026); ACC and OTHER are new since.
    check((await call(progressFns.getMyPracticeProgressFn, {}, userToken(OTHER))).noteSeen === true, "a player new since the fresh start never gets the note");
    check((await call(progressFns.getMyPracticeProgressFn, {}, accA)).noteSeen === true, "nor does a new account");
    q(`INSERT INTO auth.users (id, is_anonymous, email, created_at) VALUES ('${OLD}', false, 'old@example.com', (SELECT fresh_start_at FROM public.practice_progress_start) - interval '30 days')`);
    const oldA = accountToken(OLD);
    const oldB = accountToken(OLD);
    check((await call(progressFns.getMyPracticeProgressFn, {}, oldA)).noteSeen === false, "a player from before the fresh start has the note due");
    check((await call(progressFns.markPracticeRefreshNoteSeenFn, {}, oldA)).ok === true, "marked seen");
    check((await call(progressFns.getMyPracticeProgressFn, {}, oldA)).noteSeen === true, "then seen");
    check(q(`SELECT public.practice_mark_refresh_note_seen('${OLD}')`) === "f", "once only");
    check((await call(progressFns.getMyPracticeProgressFn, {}, oldB)).noteSeen === true, "seen on one phone is seen on the account's other phone");
    check(!db.psql(`SET ROLE authenticated; SELECT public.practice_refresh_note_due('${OLD}');`).ok, "clients can't ask whether it is due");
  });

  /* ---------------------------------------------------- 8. who can write */
  await section("roles", async () => {
    for (const role of ["anon", "authenticated"]) {
      for (const table of ["practice_progress", "practice_refresh_notes", "practice_progress_start"]) {
        const read = db.psql(`SET ROLE ${role}; SELECT count(*) FROM public.${table};`);
        const write = db.psql(`SET ROLE ${role}; INSERT INTO public.${table} (user_id, game_id, level, best_score) VALUES ('${ACC}', 'x', 'classic', 200);`);
        check(!read.ok && !write.ok, `${role} can't read or write ${table}`);
      }
      const gem = db.psql(`SET ROLE ${role}; INSERT INTO public.gem_unlocks (user_id, gem) VALUES ('${ACC}', 'diamond');`);
      check(!gem.ok, `${role} can't unlock a gem`);
      for (const fn of ["practice_record_play(1::bigint)", `practice_sync_gems('${ACC}')`, `practice_mark_refresh_note_seen('${ACC}')`]) {
        check(!db.psql(`SET ROLE ${role}; SELECT public.${fn};`).ok, `${role} can't call ${fn.split("(")[0]}`);
      }
    }
    const svc = db.psql(`SET ROLE service_role; UPDATE public.practice_progress SET best_score = 200 WHERE user_id = '${ACC}';`);
    const svcGem = db.psql(`SET ROLE service_role; INSERT INTO public.gem_unlocks (user_id, gem) VALUES ('${ACC}', 'diamond');`);
    check(!svc.ok && !svcGem.ok, "the service role can't write progress or gems directly");
    const admin = await adminDb();
    const viaApi = await admin.from("practice_progress").insert({ user_id: ACC, game_id: "x", level: "classic", best_score: 200 });
    check(Boolean(viaApi.error), "nor through the API");
  });

  /* ---------------------------------------------------- 9. analytics */
  await section("analytics", async () => {
    await flushAnalytics();
    const rows = (event: string) => q(`SELECT coalesce(string_agg(coalesce(game, '') || ':' || coalesce(props::text, ''), ' ' ORDER BY id), '') FROM analytics.events WHERE event = '${event}' AND player_id = '${ACC}'`);
    check(/tilegrid:\{"level": "classic"\}/.test(rows("best_set")), `best_set from a grade, with the game and level (${rows("best_set").slice(0, 80)})`);
    const { ANALYTICS_EVENTS, CLIENT_EVENTS } = await import("../src/lib/analytics/events");
    check(["star_earned", "best_set", "gem_unlocked"].every((e) => (ANALYTICS_EVENTS as readonly string[]).includes(e)), "ANALYTICS_EVENTS lists the three");
    check(!["star_earned", "best_set", "gem_unlocked"].some((e) => (CLIENT_EVENTS as readonly string[]).includes(e)), "the phone can't send them");
    const def = q(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'events_event_check'`);
    check(ANALYTICS_EVENTS.every((e) => def.includes(`'${e}'`)), "the table allows every event");
    const { recordProgressEvents } = await import("../src/lib/practice/progress.server");
    await recordProgressEvents({ counted: true, game: "unblock", level: "classic", best: 180, best_set: true, star_earned: true, gems_unlocked: ["ruby"] }, ACC);
    await flushAnalytics();
    check(q(`SELECT count(*) FROM analytics.events WHERE event = 'gem_unlocked' AND player_id = '${ACC}' AND props->>'gem' = 'ruby'`) === "1", "gem_unlocked (gem)");
    check(q(`SELECT count(*) FROM analytics.events WHERE event = 'star_earned' AND player_id = '${ACC}' AND game = 'unblock' AND props->>'level' = 'classic'`) === "1", "star_earned (game, level)");
  });
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  return v;
}

function diffKeys(a: unknown, b: unknown, path = ""): string {
  if (JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b))) return "";
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    return [...keys].map((k) => diffKeys((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`)).filter(Boolean).join("; ");
  }
  return `${path}: ${JSON.stringify(a)?.slice(0, 60)} vs ${JSON.stringify(b)?.slice(0, 60)}`;
}
