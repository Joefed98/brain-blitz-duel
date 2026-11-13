/**
 * practice-challenges-check (wave 2 C1b, 11 Nov 2026; docs/challenges/catalogue.md): the practice challenges are
 * checked by the server and pay their rewards.
 *
 *  1. Real stored fields: every challenge's check reads fields, reveal lines and tiles that real server-graded Practice
 *     runs carry (scripts/fixtures/practice-challenges-runs.json.gz, recorded by practice-challenges-record.ts through
 *     gradeAnswer on today's live deals).
 *  2. Meets and falls short: for every live challenge, a real graded run of its game set to just meet every condition
 *     completes it through `evaluateChallenge`; the same run with any one condition just short does not. Hard and
 *     Expert challenges complete on no run (their levels aren't dealt before wave 3.5), not even one that meets them.
 *  3. Speed goals against the grader: every Classic "within N s" puzzle goal, graded on its game's finished kit answer,
 *     has its speed part full at exactly N s left on the clock and not 2 s later.
 *  4. The six stored facts: Heave's gold crate on the gold mark (goldHome), Slice's golden fruit sliced and dealt
 *     (goldenSliced, goldenDealt), Spacewalk's close calls and no-stop streak (closeCalls, noStop / streakPts), Meteor's
 *     gold stars (goldStars, goldStarsDealt) and Five Hands' best bonus column (bestColumnPoints) are in the graded
 *     extra, and grade.ts adds them as keys only (scores are unchanged: the games' own checks replay every fixture).
 *  5. The database (a local PostgreSQL 16 with every migration, the server-function harness): a graded Practice run
 *     through practiceGradeFn completes challenges for its caller; coins pay once per challenge per account (twice
 *     run, raced five at once); coin challenges only on a deal's first graded run (retries complete only the ones that
 *     pay nothing, a missing key fails closed, five grades of one deal at once give one first run); a guest's completions are kept unpaid and paid once on sign-up (completeSignUpFn);
 *     anon and authenticated can't insert, update or delete progress rows or call the writers; a player reads only
 *     their own rows; challenge_completed and coins_credited are recorded.
 *  6. The completion moment never covers a result: it is drawn only on the Practice list (`stage === "list"`), never
 *     by a round, reveal, result, podium, standings or share screen; it shows the server's completions once.
 *
 *   bun scripts/practice-challenges-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { readRecordedRuns, type RecordedRun } from "./practice-challenges-record";
import {
  PRACTICE_CHALLENGES,
  challengeLive,
  evaluateChallenge,
  extraNumber,
  type ChallengeCond,
  type PracticeChallenge,
} from "../src/lib/duel/practiceChallenges";
import { ARCADE_STANDARD } from "../src/lib/arcade/standard";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
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

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
async function section(name: string, body: () => Promise<void> | void): Promise<void> {
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
  if (/^\s*(FAIL|NOTE)|^practice-challenges-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const RUNS = readRecordedRuns();
const runsOf = (type: string) => RUNS.filter((r) => r.type === type);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/* ------------------------------------------------------------------ building runs that meet or fall short */

/** A path's value in an object (dotted). */
function getPath(o: any, path: string): unknown {
  let v = o;
  for (const k of path.split(".")) v = v == null ? undefined : v[k];
  return v;
}
function setPath(o: any, path: string, value: unknown): void {
  const keys = path.split(".");
  let v = o;
  for (const k of keys.slice(0, -1)) {
    if (v[k] == null || typeof v[k] !== "object") v[k] = {};
    v = v[k];
  }
  v[keys[keys.length - 1]!] = value;
}
const LINE = /^([^:→]+): .* → (-?\d+) of (\d+)$/;
function setLine(extra: any, label: string, points: number, max: number): void {
  extra.reveal ??= {};
  const lines: string[] = Array.isArray(extra.reveal.lines) ? extra.reveal.lines.filter((l: string) => LINE.exec(l)?.[1] !== label) : [];
  lines.unshift(`${label}: set → ${points} of ${max}`);
  extra.reveal.lines = lines;
}
function lineMax(extra: any, label: string, type: string): number {
  for (const l of (extra?.reveal?.lines ?? []) as string[]) {
    const m = LINE.exec(l);
    if (m && m[1] === label) return Number(m[3]);
  }
  const specs: any[] = [ARCADE_STANDARD[type]?.spec, (LIVE_BANDS as any)[type]?.std];
  for (const s of specs) {
    const p = s?.parts?.find((x: any) => x.label === label);
    if (p) return p.max;
  }
  return 1000;
}
function setTile(extra: any, label: string, value: number): void {
  extra.reveal ??= {};
  const tiles: any[] = Array.isArray(extra.reveal.tiles) ? extra.reveal.tiles.filter((t: any) => t.label !== label) : [];
  tiles.push({ label, value: String(value) });
  extra.reveal.tiles = tiles;
}

interface Run {
  score: number;
  isCorrect: boolean;
  reactionAvgMs: number | null;
  extra: any;
  level?: "classic" | "hard" | "expert" | null;
}

/** The conditions a goal stands for (the four simple kinds as conditions). */
function condsOf(c: PracticeChallenge): ChallengeCond[] {
  const g = c.goal;
  if (g.kind === "check") return [...g.all];
  if (g.kind === "part") return [{ c: "full", label: g.label, max: g.max }];
  if (g.kind === "score") return [{ c: "score", op: "gte", v: g.score }];
  return [{ c: "finish" }, { c: "field", path: g.kind === "bonus" ? "parts.efficiency" : "parts.speed", op: "gte", v: g.max }];
}

/** Sets the run so `cond` holds (meet) or just fails (short). */
function apply(run: Run, cond: ChallengeCond, type: string, meet: boolean): void {
  const n = (v: number, op: string): number => {
    if (meet) return op === "gt" ? v + 1 : op === "lt" ? v - 1 : v;
    return op === "gte" || op === "eq" || op === "gt" ? (op === "gt" ? v : v - 1) : op === "lte" ? v + 1 : v;
  };
  switch (cond.c) {
    case "finish":
      run.extra.standard = 1;
      run.extra.parts = { ...(run.extra.parts ?? {}), kind: meet ? "finish" : "partial" };
      return;
    case "score":
      run.score = n(cond.v, cond.op);
      return;
    case "correct":
      run.isCorrect = meet;
      return;
    case "avgMs":
      run.reactionAvgMs = n(cond.v, cond.op);
      return;
    case "field": {
      let target: number;
      if (typeof cond.v === "string") {
        const refPath = cond.v.slice(1);
        const cur = getPath(run.extra, refPath);
        const ref = typeof cur === "number" ? cur : 5;
        setPath(run.extra, refPath, ref);
        target = ref;
      } else target = cond.v;
      const was = getPath(run.extra, cond.path);
      const v = n(target, cond.op);
      setPath(run.extra, cond.path, typeof was === "boolean" ? v >= 1 : v);
      return;
    }
    case "len": {
      const k = Math.max(0, n(cond.v, cond.op));
      setPath(run.extra, cond.path, Array.from({ length: k }, () => true));
      return;
    }
    case "all":
      setPath(run.extra, cond.path, meet ? Array.from({ length: 10 }, () => true) : [...Array.from({ length: 9 }, () => true), false]);
      return;
    case "line":
      setLine(run.extra, cond.label, n(cond.v, cond.op), lineMax(run.extra, cond.label, type));
      return;
    case "full":
      setLine(run.extra, cond.label, meet ? cond.max : cond.max - 1, cond.max);
      return;
    case "tile":
      setTile(run.extra, cond.label, n(cond.v, cond.op));
      return;
  }
}

/** Whether a real run carries what a condition reads. */
function carries(run: RecordedRun, cond: ChallengeCond): boolean {
  const e = run.extra as any;
  switch (cond.c) {
    case "finish":
      return e?.standard === 1;
    case "score":
    case "correct":
      return true;
    case "avgMs":
      return typeof run.reactionAvgMs === "number";
    case "field":
      return (
        (typeof getPath(e, cond.path) === "number" || typeof getPath(e, cond.path) === "boolean" || getPath(e, cond.path) === null) &&
        (typeof cond.v !== "string" || ["number", "boolean"].includes(typeof getPath(e, cond.v.slice(1))))
      );
    case "len":
    case "all":
      return Array.isArray(getPath(e, cond.path));
    case "line":
    case "full":
      return ((e?.reveal?.lines ?? []) as string[]).some((l) => LINE.exec(l)?.[1] === cond.label);
    case "tile":
      return ((e?.reveal?.tiles ?? []) as any[]).some((t) => t.label === cond.label);
  }
}

/* ------------------------------------------------------------------ 1–2: real fields, meets and falls short */
await section("real fields", () => {
  const types = new Set(RUNS.map((r) => r.type));
  check(types.size >= 91 && RUNS.length >= 270, `real graded runs for ${types.size} games (${RUNS.length} runs)`);
  for (const c of PRACTICE_CHALLENGES) {
    const runs = runsOf(c.type);
    if (c.type === "orbit") {
      // Orbit's bot can't play today's fuel-bank deal outside a room; its lines are its live spec's (practice-goals-check).
      check(runs.length === 0, `${c.id}: Orbit is proved by its live spec`);
      continue;
    }
    check(runs.length > 0, `${c.id}: real runs of ${c.type} recorded`);
    for (const cond of condsOf(c)) {
      // A finish puzzle's bonus and speed parts exist only on a finish; a game that never finished in the recording (Gradient's kit) proves the standard's shape.
      const relaxed = cond.c === "field" && /^parts\.(speed|efficiency)$/.test(cond.path) ? { c: "finish" as const } : cond;
      check(runs.some((r) => carries(r, relaxed) || carries(r, cond)), `${c.id}: real graded ${c.type} runs carry what "${JSON.stringify(cond)}" reads`);
    }
  }
});

await section("meets and falls short", () => {
  for (const c of PRACTICE_CHALLENGES) {
    const base: RecordedRun =
      runsOf(c.type)[0] ?? ({ type: c.type, level: "none", seed: 0, score: 100, isCorrect: true, reactionAvgMs: null, extra: { std: true, reveal: { lines: [] } } } as RecordedRun);
    const conds = condsOf(c);
    const meetRun = (level: Run["level"] = null): Run => {
      const r: Run = { score: base.score, isCorrect: base.isCorrect, reactionAvgMs: base.reactionAvgMs, extra: clone(base.extra ?? {}), level };
      for (const cond of conds) apply(r, cond, c.type, true);
      return r;
    };
    if (challengeLive(c)) {
      check(evaluateChallenge(c, meetRun()).met, `${c.id}: a run that meets every condition completes it`);
      conds.forEach((cond, i) => {
        if (cond.c === "score" && cond.v <= 0) return;
        const r = meetRun();
        apply(r, cond, c.type, false);
        // Conditions that read the same field keep the other ones met.
        conds.forEach((other, j) => j !== i && "path" in other && "path" in cond && other.path !== cond.path && apply(r, other, c.type, true));
        check(!evaluateChallenge(c, r).met, `${c.id}: a run just short on ${JSON.stringify(cond)} does not complete it`);
      });
      check(!evaluateChallenge(c, meetRun("hard")).met && !evaluateChallenge(c, meetRun("expert")).met, `${c.id}: a run dealt at another level doesn't count for a Classic challenge`);
    } else {
      for (const level of [null, "classic", "hard", "expert"] as const)
        check(!evaluateChallenge(c, meetRun(level)).met, `${c.id}: ${c.level} can't complete before wave 3.5 (a ${level ?? "plain"} run that meets it)`);
    }
  }
  // Real runs: whatever they complete, they meet every condition (no challenge completes on a real run that falls short).
  for (const run of RUNS)
    for (const c of PRACTICE_CHALLENGES.filter((x) => x.type === run.type)) {
      const r: Run = { score: run.score, isCorrect: run.isCorrect, reactionAvgMs: run.reactionAvgMs, extra: run.extra };
      const res = evaluateChallenge(c, r);
      if (res.met) check(challengeLive(c), `${c.id}: a real ${run.level} run completes only a live challenge`);
    }
  const completed = new Set<string>();
  for (const run of RUNS)
    for (const c of PRACTICE_CHALLENGES.filter((x) => x.type === run.type))
      if (evaluateChallenge(c, { score: run.score, isCorrect: run.isCorrect, reactionAvgMs: run.reactionAvgMs, extra: run.extra }).met) completed.add(c.id);
  check(completed.size >= 60, `real recorded runs complete ${completed.size} challenges on their own (the checks read real data)`);
});

/* ------------------------------------------------------------------ 3: speed goals against the grader */
await section("speed against the grader", async () => {
  const { gradeAnswer, generatePuzzle } = await import("../src/lib/duel/generate.server");
  const { withSeededRandom } = await import("../src/lib/duel/random");
  const { puzzleTimeLimitMs } = await import("../src/lib/duel/registry");
  const { KITS } = await import("./puzzle-fairness/kits");
  const { SKILLS, hashText, makeRng } = await import("./puzzle-fairness/kit");
  const { asPhoneSends } = await import("./standard-lib");
  let proved = 0;
  // Lightbender's and Lookout's answers carry their own times (each shot, each word found), so their speed is judged on
  // those, not on the clock the grade is given: their rule tables are proved in practice-goals-check section 3.
  const OWN_TIMES = new Set(["laser", "wordsearch"]);
  for (const c of PRACTICE_CHALLENGES) {
    if (c.goal.kind !== "speed" || !challengeLive(c) || OWN_TIMES.has(c.type)) continue;
    const kit = (KITS as any)[c.type];
    if (!kit) continue;
    let done = false;
    for (const seed of [6100, 6107, 6114, 6121]) {
      const puzzle = withSeededRandom(seed, () => generatePuzzle(c.type, { bankSeed: seed } as any));
      const limit = puzzleTimeLimitMs(puzzle);
      const play = kit.play(puzzle, makeRng(hashText(`speed:${c.type}:${seed}`)), SKILLS.near, limit);
      const steps = asPhoneSends(puzzle, play.steps);
      const last = steps[steps.length - 1];
      if (!last) continue;
      const at = gradeAnswer(puzzle, last.answer, limit - c.goal.withinS * 1000);
      if (!at.isCorrect) continue;
      const late = gradeAnswer(puzzle, last.answer, limit - (c.goal.withinS + 2) * 1000);
      const sp = (g: any) => Number(g.extra?.parts?.speed ?? -1);
      check(sp(at) >= c.goal.max, `${c.id}: finished with ${c.goal.withinS} s used, its speed part is full (${sp(at)} of ${c.goal.max})`);
      check(sp(late) < c.goal.max, `${c.id}: 2 s later it isn't (${sp(late)})`);
      done = true;
      proved += 1;
      break;
    }
    if (!done) check(c.type === "tiles", `${c.id}: a kit finish to grade (only Gradient's kit can't finish its live deal)`);
  }
  const eligible = PRACTICE_CHALLENGES.filter((c) => c.goal.kind === "speed" && challengeLive(c) && !OWN_TIMES.has(c.type) && c.type !== "tiles").length;
  check(proved === eligible, `${proved} of ${eligible} speed goals proved against the grader (all but Gradient's)`);
});

/* ------------------------------------------------------------------ 4: the six facts */
await section("six facts", () => {
  const has = (type: string, keys: string[]) => runsOf(type).some((r) => keys.every((k) => extraNumber(r.extra, k) !== null));
  check(has("push", ["goldHome"]), "Heave: goldHome (the gold crate on the gold mark) is stored with a finish");
  check(has("slice", ["goldenSliced", "goldenDealt"]), "Slice: golden fruit sliced and dealt are stored");
  check(has("cross", ["closeCalls"]) && has("cross", ["noStop", "streakPts"]), "Spacewalk: close calls and the no-stop streak are stored");
  check(has("snake", ["goldStars", "goldStarsDealt"]), "Meteor: gold stars eaten and dealt are stored");
  check(has("fivehands", ["bestColumnPoints"]), "Five Hands: the best bonus column is stored");
  const grade = readFileSync("src/lib/duel/grade.ts", "utf8");
  check(/goldenSliced: run\.state\.golds \?\? 0, goldenDealt: run\.state\.goldDealt \?\? SLICE_V9_GOLDS/.test(grade), "grade.ts: Slice's fact read from the replayed state only");
  check(/goldStars: run\.state\.goldsEaten \?\? 0, goldStarsDealt: \(run\.state\.golds \?\? \[\]\)\.length/.test(grade), "grade.ts: Meteor's fact read from the replayed state only");
  check(/bestColumnPoints: fiveHandsBestColumnPoints\(run\.state\)/.test(grade), "grade.ts: Five Hands' fact read from the replayed state only");
  // The facts never touch the score: each sits in the stored extra only, after the score is set.
  for (const [type, key] of [["slice", "goldenSliced"], ["snake", "goldStars"], ["fivehands", "bestColumnPoints"]] as const)
    for (const r of runsOf(type)) check(typeof r.score === "number" && key in (r.extra ?? {}), `${type}: ${key} rides with a scored run (${r.score})`);
});

/* ------------------------------------------------------------------ 6: the moment's place */
await section("moment placement", () => {
  const practice = readFileSync("src/routes/practice.tsx", "utf8");
  const listStart = practice.indexOf(`if (stage === "list") {`);
  const listEnd = practice.indexOf(`if (stage === "offline"`, listStart);
  const at = practice.indexOf("<ChallengeMoments />");
  check(at > listStart && at < listEnd && practice.indexOf("<ChallengeMoments", at + 1) === -1, "the moment is drawn only on the Practice list");
  check(/queueChallengeMoments\(\(result as \{ challenges\?: unknown \}\)\.challenges\)/.test(practice), "practice queues the server's completions, never showing them over the reveal");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  for (const file of walk("src")) {
    const src = readFileSync(file, "utf8");
    if (/<ChallengeMoments\b|function ChallengeMoments\(/.test(src)) check(["src/routes/practice.tsx", "src/components/app/PracticeChallenges.tsx"].includes(file), `${file}: only Practice's list draws the challenge moment`);
    if (/takeChallengeMoments\(/.test(src))
      check(["src/components/app/PracticeChallenges.tsx", "src/lib/challenges/challengesClient.ts"].includes(file), `${file}: only the moment takes the queue`);
  }
  const ui = readFileSync("src/components/app/PracticeChallenges.tsx", "utf8");
  check(/export function ChallengeMoments\(\)/.test(ui) && /takeChallengeMoments\(\)/.test(ui), "the moment takes the queue once on the list");
});

await section("moment (happy-dom)", async () => {
  const { Window } = await import("happy-dom");
  const win = new Window({ url: "https://joulz.test/practice" });
  const g = globalThis as any;
  for (const k of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "MutationObserver", "CustomEvent", "Event", "getComputedStyle"]) g[k] = (win as any)[k];
  g.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const client = await import("../src/lib/challenges/challengesClient");
  const ui = await import("../src/components/app/PracticeChallenges");
  client.queueChallengeMoments([{ id: "laser.speed-of-light", coins: 100, paid: true }, { id: "bad id", coins: 9 }, { id: "flood.par", coins: 0, paid: false }]);
  client.queueChallengeMoments([{ id: "laser.speed-of-light", coins: 100, paid: true }]);
  const host = win.document.createElement("div");
  win.document.body.appendChild(host as any);
  const root = createRoot(host as any);
  await act(async () => root.render(React.createElement(ui.ChallengeMoments)));
  const first = host.querySelector("[data-challenge-moment]");
  check(first?.getAttribute("data-challenge-moment") === "laser.speed-of-light" && /Speed of light/.test(first?.textContent ?? "") && /\+100/.test(first?.textContent ?? ""), `the moment names the challenge and its coins (${first?.textContent})`);
  await act(async () => (first as any).click());
  const second = host.querySelector("[data-challenge-moment]");
  check(second?.getAttribute("data-challenge-moment") === "flood.par" && !second?.querySelector("[data-challenge-moment-coins]"), "a tap moves to the next; a challenge without coins shows none");
  await act(async () => (second as any).click());
  check(!host.querySelector("[data-challenge-moment]"), "each completion shows once (the bad id and the duplicate dropped)");
  check(client.takeChallengeMoments().length === 0, "the queue is empty once shown");
  await act(async () => root.unmount());
});

/* ------------------------------------------------------------------ 5: the database */
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ACC = uid(41); // an account from the start
const GUE = uid(42); // a guest who later signs up
const OTH = uid(43); // another account (RLS)

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`practice-challenges-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  finish();
}

let db: LocalDb | null = null;
let rest: RestServer | null = null;
try {
  db = startLocalDb("practice-challenges-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  db.psql(`INSERT INTO auth.users (id, is_anonymous, email) VALUES ('${ACC}', false, 'acc@example.com'), ('${GUE}', true, NULL), ('${OTH}', false, 'oth@example.com')`);
  await installServerFnPlugin();
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}
finish();

function finish(): never {
  restore();
  console.log(`practice-challenges-check: ${passes} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("FAIL");
    process.exit(1);
  }
  console.log("PASS: challenges complete only from the server's graded Practice runs and pay once per account.");
  process.exit(0);
}

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const account = await import("../src/lib/account/account.functions");
  const practice = await import("../src/lib/duel/practice.functions");
  const challengesFns = await import("../src/lib/challenges/challenges.functions");
  const server = await import("../src/lib/challenges/challenges.server");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { createClient } = await import("@supabase/supabase-js");
  const admin = await adminDb();
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const deviceDb = (token: string | null) =>
    createClient(rest.url, ANON_KEY, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
  const events = async (event: string, player: string) => {
    await flushAnalytics();
    return Number(q(`SELECT count(*) FROM analytics.events WHERE event = '${event}' AND player_id = '${player}'`));
  };
  const ledger = (id: string) => q(`SELECT coalesce(string_agg(amount || ':' || reason || ':' || idempotency_key, ',' ORDER BY id), '') FROM coin_ledger WHERE user_id = '${id}'`);
  const balance = (id: string) => Number(q(`SELECT coalesce((SELECT balance FROM coin_wallets WHERE user_id = '${id}'), -1)`));

  // An account (a profile, so a wallet).
  q(`SELECT public.create_profile('${ACC}', 'Acc_Chal', 2::smallint, DATE '1990-01-01', 'GB')`);
  q(`SELECT public.create_profile('${OTH}', 'Oth_Chal', 3::smallint, DATE '1990-01-01', 'GB')`);
  const ch = (id: string) => PRACTICE_CHALLENGES.find((c) => c.id === id)!;
  const meetRun = (c: PracticeChallenge) => {
    const base = runsOf(c.type)[0]!;
    const r: Run = { score: base.score, isCorrect: base.isCorrect, reactionAvgMs: base.reactionAvgMs, extra: clone(base.extra ?? {}) };
    for (const cond of condsOf(c)) apply(r, cond, c.type, true);
    return r;
  };

  await section("coins once per account", async () => {
    const speed = ch("laser.speed-of-light");
    check(speed.coins === 100 && speed.level === "classic", "Speed of light: Classic, 100 coins");
    const run = meetRun(speed);
    const first = await server.checkPracticeChallenges(admin, ACC, "laser", run, dealKey());
    check(first.some((x) => x.id === speed.id && x.coins === 100 && x.paid), `a completing run pays its 100 coins (${JSON.stringify(first)})`);
    check(balance(ACC) === 100 && ledger(ACC) === `100:challenge_reward:challenge_reward:${speed.id}`, `one ledger line, reason challenge_reward (${ledger(ACC)})`);
    const again = await server.checkPracticeChallenges(admin, ACC, "laser", run, dealKey());
    check(!again.some((x) => x.id === speed.id) && balance(ACC) === 100, "the same challenge again pays nothing");
    await Promise.all(Array.from({ length: 5 }, () => server.payPendingChallengeRewards(admin, ACC)));
    check(balance(ACC) === 100, "five payouts raced at once pay nothing more");
    // Five completions raced for another challenge: one completion, one payment.
    const bulls = ch("numline.fifteen-bulls");
    const raced = await Promise.all(Array.from({ length: 5 }, () => server.checkPracticeChallenges(admin, ACC, "numline", meetRun(bulls), dealKey())));
    check(raced.flat().filter((x) => x.id === bulls.id).length === 1 && balance(ACC) === 200, `five runs at once complete it once and pay 100 once (balance ${balance(ACC)})`);
    check(q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${ACC}' AND reason = 'challenge_reward'`) === "2", "two challenge_reward lines in all");
    // A challenge without coins completes without a line.
    // Changed with Joe's approval, 13 Nov 2026: Blackout is retired (its challenges are hidden), so a live game's coin-free challenge stands in.
    const par = ch("flood.par");
    const r = await server.checkPracticeChallenges(admin, ACC, "flood", meetRun(par), dealKey());
    check(r.some((x) => x.id === par.id && x.coins === 0) && balance(ACC) === 200, "a challenge without coins completes and pays nothing");
    // Hard and Expert: never complete before wave 3.5, so never pay.
    const hard = ch("tents.glamping");
    const h = await server.checkPracticeChallenges(admin, ACC, "tents", meetRun(hard), dealKey());
    check(!h.some((x) => x.id === hard.id) && q(`SELECT count(*) FROM practice_challenge_progress WHERE user_id = '${ACC}' AND challenge_id = '${hard.id}' AND completed_at IS NOT NULL`) === "0", "a Hard challenge (with coins) doesn't complete or pay");
    const completions = Number(q(`SELECT count(*) FROM practice_challenge_progress WHERE user_id = '${ACC}' AND completed_at IS NOT NULL`));
    check(completions >= 3 && (await events("challenge_completed", ACC)) === completions, `challenge_completed recorded once per completion (${completions})`);
    const props = JSON.parse(q(`SELECT json_agg(props ORDER BY occurred_at) FROM analytics.events WHERE event = 'challenge_completed' AND player_id = '${ACC}'`)) as Record<string, unknown>[];
    check(props.some((p) => p["challenge"] === speed.id && p["level"] === "classic" && p["coins"] === 100), `its props: challenge, level and coins paid (${JSON.stringify(props[0])})`);
    check(q(`SELECT game FROM analytics.events WHERE event = 'challenge_completed' AND player_id = '${ACC}' ORDER BY occurred_at LIMIT 1`) === "laser", "its game");
    check((await events("coins_credited", ACC)) === 2, "coins_credited once per payment");
  });

  await section("coins only on a deal's first graded run", async () => {
    // Joe, 11 Nov 2026: a coin challenge pays only on a player's first graded run of that deal; a retry of the same
    // deal can still complete challenges that pay nothing.
    const RET = uid(44);
    q(`INSERT INTO auth.users (id, is_anonymous, email) VALUES ('${RET}', false, 'ret@example.com')`);
    q(`SELECT public.create_profile('${RET}', 'Ret_Chal', 6::smallint, DATE '1990-01-01', 'GB')`);
    const coin = ch("clayshoot.dead-eye");
    const free = ch("clayshoot.bird-lover");
    check(coin.coins === 100 && free.coins === 0, "Dead eye pays 100, Bird lover nothing");
    const deal = dealKey();
    // The first run of the deal falls short of both; the retry of the same deal meets both.
    const short = meetRun(free);
    apply(short, { c: "field", path: "birdHits", op: "eq", v: 0 }, "clayshoot", false);
    const first = await server.checkPracticeChallenges(admin, RET, "clayshoot", short, deal);
    check(!first.some((x) => x.id === coin.id || x.id === free.id), `the deal's first run completes neither (${JSON.stringify(first)})`);
    const both = meetRun(coin);
    for (const cond of condsOf(free)) apply(both, cond, "clayshoot", true);
    const retry = await server.checkPracticeChallenges(admin, RET, "clayshoot", both, deal);
    check(retry.some((x) => x.id === free.id) && !retry.some((x) => x.id === coin.id), `a retry of the same deal completes the challenge that pays nothing, not the coin one (${retry.map((x) => x.id).join(", ")})`);
    check(balance(RET) === 0 && q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${RET}'`) === "0", "and pays no coins");
    check(q(`SELECT completed_at IS NULL FROM practice_challenge_progress WHERE user_id = '${RET}' AND challenge_id = '${coin.id}'`) === "t", "the coin challenge stays not done (its best value kept)");
    // A run with no deal key counts as a retry (fails closed).
    const none = await server.checkPracticeChallenges(admin, RET, "clayshoot", meetRun(coin), null);
    check(!none.some((x) => x.id === coin.id) && balance(RET) === 0, "a run with no deal key never completes a coin challenge");
    // A fresh deal's first run completes it and pays once.
    const fresh = await server.checkPracticeChallenges(admin, RET, "clayshoot", meetRun(coin), dealKey());
    check(fresh.some((x) => x.id === coin.id && x.paid) && balance(RET) === 100, "a new deal's first run completes it and pays 100");
    // Two grades of one new deal at once: exactly one is its first run.
    const raceKey = dealKey();
    const firsts = await Promise.all(Array.from({ length: 5 }, async () => (await admin.rpc("challenge_first_run", { p_user_id: RET, p_deal_key: raceKey })).data));
    check(firsts.filter((x) => x === true).length === 1, `five grades of one deal at once: exactly one first run (${firsts.join(",")})`);
    check(q(`SELECT count(*) FROM practice_challenge_deals WHERE user_id = '${RET}' AND deal_key = '${raceKey}'`) === "1", "one row for the deal");
    check((await admin.rpc("challenge_first_run", { p_user_id: RET, p_deal_key: "not-a-digest" })).data === false, "a malformed key is never a first run");
    // The key is the sealed deal's SHA-256.
    check((await server.challengeDealKey("abc")) === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "the deal key is the SHA-256 of the sealed token");
    check((await server.challengeDealKey("")) === null, "no sealed token, no key");
  });

  await section("guest paid on becoming an account", async () => {
    const encore = ch("beat.score180");
    const run = meetRun(encore);
    const done = await server.checkPracticeChallenges(admin, GUE, "beat", run, dealKey());
    check(done.some((x) => x.id === encore.id && x.coins === 100 && !x.paid), `a guest's completion is kept, its coins waiting (${JSON.stringify(done)})`);
    check(q(`SELECT count(*) FROM practice_challenge_progress WHERE user_id = '${GUE}' AND completed_at IS NOT NULL AND paid_at IS NULL AND coins = 100`) === "1", "stored completed and unpaid");
    check(q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${GUE}'`) === "0", "no ledger line for a guest");
    const fromList = await callServerFn(challengesFns.getMyChallengesFn, {}, userToken(GUE));
    check(fromList?.account === false && fromList.rows.some((x: any) => x.id === encore.id && x.done && !x.paid), "the guest's list shows it done, unpaid");
    // The guest confirms an email and finishes sign-up: the coins are paid then, once.
    q(`UPDATE auth.users SET is_anonymous = false, email = 'gue@example.com' WHERE id = '${GUE}'`);
    const made = await callServerFn(account.completeSignUpFn, { username: "Gue_Chal", dateOfBirth: "1992-05-06", colour: 5, country: "GB" }, accountToken(GUE));
    check(made?.kind === "account", `sign-up completes (${JSON.stringify(made).slice(0, 100)})`);
    check(balance(GUE) === 100 && ledger(GUE) === `100:challenge_reward:challenge_reward:${encore.id}`, `the waiting 100 coins are paid at sign-up (${ledger(GUE)})`);
    await callServerFn(challengesFns.getMyChallengesFn, {}, accountToken(GUE));
    await server.payPendingChallengeRewards(admin, GUE);
    check(balance(GUE) === 100, "and never again");
    const list = await callServerFn(challengesFns.getMyChallengesFn, {}, accountToken(GUE));
    check(list?.account === true && list.rows.some((x: any) => x.id === encore.id && x.paid), "the list shows it paid");
  });

  await section("roles can't complete or pay", async () => {
    for (const [who, token] of [["anon", null], ["authenticated", accountToken(OTH)]] as const) {
      const c = deviceDb(token);
      const ins = await c.from("practice_challenge_progress").insert({ user_id: OTH, challenge_id: "beat.score180", game_id: "beat", completed_at: new Date().toISOString(), coins: 100 });
      check(Boolean(ins.error), `${who} can't insert a progress row`);
      const upd = await c.from("practice_challenge_progress").update({ completed_at: new Date().toISOString() }).eq("user_id", OTH);
      check(Boolean(upd.error) || (upd.data ?? []).length === 0, `${who} can't update a progress row`);
      const del = await c.from("practice_challenge_progress").delete().eq("user_id", ACC);
      check(Boolean(del.error) || (del.data ?? []).length === 0, `${who} can't delete a progress row`);
      const rec = await c.rpc("challenge_record", { p_user_id: OTH, p_challenge_id: "beat.score180", p_game_id: "beat", p_value: 200, p_met: true, p_coins: 100 });
      check(Boolean(rec.error), `${who} can't call challenge_record`);
      const pay = await c.rpc("challenge_pay_due", { p_user_id: ACC });
      check(Boolean(pay.error), `${who} can't call challenge_pay_due`);
      const fr = await c.rpc("challenge_first_run", { p_user_id: OTH, p_deal_key: "0".repeat(64) });
      check(Boolean(fr.error), `${who} can't call challenge_first_run`);
      const dr = await c.from("practice_challenge_deals").select("deal_key");
      check(Boolean(dr.error) || (dr.data ?? []).length === 0, `${who} reads no deal rows`);
      const di = await c.from("practice_challenge_deals").insert({ user_id: OTH, deal_key: "1".repeat(64) });
      check(Boolean(di.error), `${who} can't insert a deal row`);
    }
    check(q(`SELECT count(*) FROM practice_challenge_progress WHERE user_id = '${OTH}'`) === "0" && balance(OTH) === 0, "nothing was written for the other account, and no coins");
    check(balance(ACC) === 200, "nor taken from anyone");
    // SQL-level grants too.
    check(refusedSql(db, "anon", `INSERT INTO public.practice_challenge_progress (user_id, challenge_id, game_id) VALUES ('${OTH}', 'beat.score180', 'beat')`), "anon: no INSERT privilege");
    check(refusedSql(db, "authenticated", `UPDATE public.practice_challenge_progress SET coins = 250`), "authenticated: no UPDATE privilege");
    check(refusedSql(db, "authenticated", `SELECT public.challenge_pay_due('${ACC}')`), "authenticated: no EXECUTE on challenge_pay_due");
    check(refusedSql(db, "service_role", `INSERT INTO public.practice_challenge_progress (user_id, challenge_id, game_id) VALUES ('${OTH}', 'beat.score180', 'beat')`), "service_role: writes only through the functions");
    // Reads: own rows only.
    const mine = await deviceDb(accountToken(ACC)).from("practice_challenge_progress").select("challenge_id, user_id");
    check(!mine.error && (mine.data ?? []).length > 0 && (mine.data ?? []).every((r: any) => r.user_id === ACC), "a player reads their own rows");
    const theirs = await deviceDb(accountToken(OTH)).from("practice_challenge_progress").select("challenge_id").eq("user_id", ACC);
    check(!theirs.error && (theirs.data ?? []).length === 0, "and no one else's");
  });

  await section("practice grade end to end", async () => {
    // Changed with Joe's approval, 13 Nov 2026: Blackout is retired (Practice refuses it), so Colour Flood, which has a kit, plays the run.
    const token = accountToken(OTH);
    const dealt = await callServerFn(practice.practiceGenerateFn, { type: "flood" }, token);
    const { KITS } = await import("./puzzle-fairness/kits");
    const { SKILLS, hashText, makeRng } = await import("./puzzle-fairness/kit");
    const { puzzleTimeLimitMs } = await import("../src/lib/duel/registry");
    // The full puzzle (the server's private half) for the kit to solve, as a player would on the board.
    const { unsealForChecks } = await loadUnseal();
    const full = { ...dealt.puzzle, ...(await unsealForChecks(dealt.sealed)) };
    const play = (KITS as any).flood.play(full, makeRng(hashText("e2e")), SKILLS.near, puzzleTimeLimitMs(full));
    const last = play.steps[play.steps.length - 1];
    const { start } = await callServerFn(practice.practiceStartFn, { sealed: dealt.sealed }, token);
    const graded = await callServerFn(practice.practiceGradeFn, { puzzle: dealt.puzzle, sealed: dealt.sealed, answer: last.answer, msRemaining: puzzleTimeLimitMs(full) - 1000, start }, token);
    check(graded.isCorrect === true, `the kit's answer finishes (${graded.score})`);
    const ids = (graded.challenges ?? []).map((x: any) => x.id);
    check(ids.length > 0 && ids.every((id: string) => id.startsWith("flood.")), `the graded run comes back with its completions (${ids.join(", ")})`);
    for (const id of ids) check(q(`SELECT count(*) FROM practice_challenge_progress WHERE user_id = '${OTH}' AND challenge_id = '${id}' AND completed_at IS NOT NULL`) === "1", `${id} stored completed for the caller`);
    // C1a's interface (docs/practice-progress.md): the challenges ran on the play practice_record_play counted, read
    // from its stored breakdown.
    // Changed with Joe's approval, 13 Nov 2026: the stored play is Colour Flood's, the run that stands in for retired Blackout.
    check(q(`SELECT count(*) FROM practice_plays WHERE user_id = '${OTH}' AND game_id = 'flood' AND progress_counted_at IS NOT NULL AND breakdown IS NOT NULL`) === "1", "the run's play is stored with its breakdown and counted");
    // The same deal graded again: noted once, by its sealed token's digest; the retry completes no coin challenge.
    const key = await server.challengeDealKey(dealt.sealed);
    check(q(`SELECT count(*) FROM practice_challenge_deals WHERE user_id = '${OTH}' AND deal_key = '${key}'`) === "1", "the graded deal is noted by its sealed token's digest");
    const again = await callServerFn(practice.practiceGradeFn, { puzzle: dealt.puzzle, sealed: dealt.sealed, answer: last.answer, msRemaining: puzzleTimeLimitMs(full) - 1000, start }, token);
    check(again.isCorrect === true && (again.challenges ?? []).every((x: any) => x.coins === 0), "a retry of the same deal completes no coin challenge");
    check(q(`SELECT count(*) FROM practice_challenge_deals WHERE user_id = '${OTH}' AND deal_key = '${key}'`) === "1", "still one row for the deal");
    // The phone's word counts for nothing: a run graded as a fail completes nothing, whatever it claims.
    const dealt2 = await callServerFn(practice.practiceGenerateFn, { type: "flood" }, accountToken(ACC));
    const g2 = await callServerFn(practice.practiceGradeFn, { puzzle: dealt2.puzzle, sealed: dealt2.sealed, answer: "", msRemaining: 59_000, extra: { reactionAvgMs: 1, correctCount: 99 } as any }, accountToken(ACC));
    check((g2.challenges ?? []).length === 0, "an empty answer completes nothing, whatever the phone claims");
    // A play C1a doesn't count (graded before the fresh start) completes nothing, even a finish.
    const startAt = q(`SELECT fresh_start_at FROM practice_progress_start`);
    q(`UPDATE practice_progress_start SET fresh_start_at = now() + interval '1 day'`);
    try {
      const dealt3 = await callServerFn(practice.practiceGenerateFn, { type: "flood" }, token);
      const full3 = { ...dealt3.puzzle, ...(await unsealForChecks(dealt3.sealed)) };
      const play3 = (KITS as any).flood.play(full3, makeRng(hashText("e2e-uncounted")), SKILLS.near, puzzleTimeLimitMs(full3));
      const g3 = await callServerFn(practice.practiceGradeFn, { puzzle: dealt3.puzzle, sealed: dealt3.sealed, answer: play3.steps[play3.steps.length - 1].answer, msRemaining: puzzleTimeLimitMs(full3) - 1000 }, token);
      check(g3.isCorrect === true && g3.progress?.counted !== true && (g3.challenges ?? []).length === 0, "a finish C1a doesn't count completes nothing");
    } finally {
      q(`UPDATE practice_progress_start SET fresh_start_at = '${startAt}'`);
    }
  });
}

/** A fresh deal key (a 64-hex digest, as challengeDealKey makes). */
function dealKey(): string {
  const g = globalThis as unknown as { __dealSeq?: number };
  g.__dealSeq = (g.__dealSeq ?? 0) + 1;
  return g.__dealSeq.toString(16).padStart(64, "0");
}

/** Whether a statement is refused for a database role. */
function refusedSql(db: LocalDb, role: string, sql: string): boolean {
  const out = db.psql(`BEGIN; SET LOCAL ROLE ${role}; ${sql}; ROLLBACK;`);
  return !out.ok || /ERROR/.test(out.err);
}

/** The private half of a sealed deal, for the kit (checks only). */
async function loadUnseal(): Promise<{ unsealForChecks: (sealed: string) => Promise<Record<string, unknown>> }> {
  const seal = (await import("../src/lib/duel/practiceSeal.server")) as any;
  return {
    unsealForChecks: async (sealed: string) => {
      const open = seal.unsealRaw ?? seal.unseal;
      const raw = (await open(sealed)) as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) if (!k.startsWith("__")) out[k] = v;
      return out;
    },
  };
}
