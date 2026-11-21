/**
 * rated-week-change-check (P1, 21 Nov 2026; Joe: Home's "+22 this week" is worked out on the server from the rated
 * match history, so it is the same on every device). On a local PostgreSQL 16 with every migration applied
 * (scripts/server-fn-harness.ts), through the real ratings engine and the real server function:
 *
 * - rated_week_change sums a player's Joulz Rating changes (each stored match's before → after) over the matches
 *   finished from a moment on: it equals the engine's own outcomes added up, leaves out matches before Monday and
 *   placement matches (no rating before), and is the opponent's own figure for the opponent;
 * - ratedWeekChangeFn answers the signed-in player's week from Monday 00:00 UK (the same figure, rounded), and names
 *   that Monday; a player with no rated matches gets 0 over 0 matches;
 * - phones can't run rated_week_change (anon and authenticated have no right on it).
 *
 *   bun scripts/rated-week-change-check.ts
 */
import {
  accountToken,
  ANON_KEY,
  callServerFn,
  installServerFnPlugin,
  postgresBin,
  SERVICE_KEY,
  startLocalDb,
  startRestServer,
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

if (!postgresBin()) {
  if (process.env["CI"]) {
    console.log("rated-week-change-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL");
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: not run (CI runs it)");
  process.exit(0);
}

const quietLog = console.log;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^rated-week-change-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};

const mt = await import("../src/lib/rated/match");
const catalogue = await import("../src/lib/duel/catalogue");
const { dealtSignature } = await import("../src/lib/duel/dealSignature");
const { ukDay, ukMidnight } = await import("../src/lib/pass/ukDays");
const { weekStartOf } = await import("../src/lib/pass/weekly");
type Result = import("../src/lib/data/ratings").RatedMatchResult;
type Outcome = import("../src/lib/data/ratings").RatedMatchOutcome;

const PUZZLE = catalogue.ACTIVE_PUZZLE_TYPES.find((t) => mt.gamePool(t) === "puzzles" && mt.gameCategory(t) === "logic")!;
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let seq = 0;
const mid = () => `20000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
function duel(a: string, b: string, scores: [number, number][]): Result {
  return {
    matchId: mid(),
    format: { kind: "duel", bestOf: 3 },
    choice: "puzzles",
    players: [
      { playerId: a, side: "live" },
      { playerId: b, side: "live" },
    ],
    games: scores.map(([x, y]) => ({ type: PUZZLE, pool: mt.gamePool(PUZZLE)!, category: mt.gameCategory(PUZZLE)!, version: "classic", signature: dealtSignature(PUZZLE), scores: { [a]: x, [b]: y } })),
  };
}

let db: LocalDb | null = null;
let rest: RestServer | null = null;
try {
  db = startLocalDb("rated-week-change-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  await installServerFnPlugin();
  const q = (sql: string) => {
    const out = db!.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const { createClient } = await import("@supabase/supabase-js");
  const client = (key: string, token?: string) =>
    createClient<import("../src/integrations/supabase/types").Database>(rest!.url, key, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
  const admin = client(SERVICE_KEY);
  const rs = await import("../src/lib/rated/ratings.server");
  const { readRatedWeekChange } = await import("../src/lib/data/ratings.server");
  const { ratedWeekChangeFn } = await import("../src/lib/home/weekChange.functions");

  q(`INSERT INTO auth.users (id, is_anonymous, email) SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, false, 'w' || n || '@example.com' FROM generate_series(100, 104) n`);
  for (let n = 100; n < 105; n++) q(`SELECT public.create_profile('${uid(n)}', 'Week_${n}', 2::smallint, DATE '1990-01-01', NULL)`);
  const A = uid(100);
  const B = uid(101);

  // This week's Monday (UK) and the real clock: the server function reads the week from Date.now().
  const now = Date.now();
  const monday = ukMidnight(weekStartOf(ukDay(now)));
  // Placement (5 matches) and two more, all last week; then four this week (the last a minute ago).
  const lastWeek = monday - 3 * 86_400_000;
  const outcomes: { at: number; out: Outcome }[] = [];
  const play = async (at: number, scores: [number, number][]) => outcomes.push({ at, out: await rs.recordRatedMatch(admin, duel(A, B, scores), at) });
  for (let i = 0; i < 7; i++) await play(lastWeek + i * 3_600_000, i % 3 === 2 ? [[100, 150], [100, 150]] : [[150, 100], [150, 100]]);
  const thisWeek = [monday + 60_000, monday + 120_000, monday + 180_000, Math.max(monday + 240_000, now - 60_000)].filter((t) => t <= now);
  for (const [i, at] of thisWeek.entries()) await play(at, i % 2 ? [[100, 150], [100, 150]] : [[150, 100], [150, 100]]);
  check(outcomes.every((o) => o.out.ok && o.out.status === "recorded"), "every match recorded");

  const sum = (who: string, from: number) =>
    outcomes
      .filter((o) => o.at >= from && o.out.ok)
      .reduce((s, o) => {
        const p = o.out.ok ? o.out.players.find((x) => x.playerId === who) : undefined;
        return p && p.joulz.before !== null && p.joulz.after !== null ? s + (p.joulz.after - p.joulz.before) : s;
      }, 0);
  const fromIso = new Date(monday).toISOString();
  const a = await readRatedWeekChange(admin, A, fromIso);
  const b = await readRatedWeekChange(admin, B, fromIso);
  check(!a.error && a.data !== null && a.data.matches === thisWeek.length, `this week's matches counted (${a.data?.matches} of ${thisWeek.length})`);
  check(Math.abs((a.data?.change ?? NaN) - sum(A, monday)) < 1e-6, `A's change is the engine's outcomes added up (${a.data?.change} vs ${sum(A, monday)})`);
  check(Math.abs((b.data?.change ?? NaN) - sum(B, monday)) < 1e-6, `B's change is B's own (${b.data?.change} vs ${sum(B, monday)})`);
  check(thisWeek.length === 0 || sum(A, monday) !== 0, "the week moved A's rating (the test means something)");
  const all = await readRatedWeekChange(admin, A, new Date(lastWeek - 1).toISOString());
  check(all.data?.matches === outcomes.length, `from before the first match: every match counted (${all.data?.matches})`);
  check(Math.abs((all.data?.change ?? NaN) - sum(A, lastWeek - 1)) < 1e-6, "placement matches (no rating before) add nothing");
  const before = outcomes.slice(0, 5).every((o) => o.out.ok && o.out.players.every((p) => p.joulz.before === null));
  check(before, "control: the five placement matches have no rating before");

  const fnA = await callServerFn<{ week: string; matches: number; change: number } | null>(ratedWeekChangeFn, undefined, accountToken(A));
  check(fnA?.week === weekStartOf(ukDay(now)), `the function names this week's Monday (${fnA?.week})`);
  check(fnA?.matches === thisWeek.length && fnA.change === Math.round(sum(A, monday)), `the function answers A's week rounded (${fnA?.change} vs ${Math.round(sum(A, monday))})`);
  const fnC = await callServerFn<{ matches: number; change: number } | null>(ratedWeekChangeFn, undefined, accountToken(uid(102)));
  check(fnC?.matches === 0 && fnC.change === 0, "a player with no rated matches: 0 over 0 matches");

  for (const [who, c] of [["anon", client(ANON_KEY)], ["authenticated", client(ANON_KEY, accountToken(A))]] as const) {
    const r = await (c.rpc as unknown as (f: string, a: unknown) => Promise<{ error: unknown }>).call(c, "rated_week_change", { p_user_id: A, p_from: fromIso });
    check(!!r.error, `${who} can't run rated_week_change`);
  }
  const privs = q(`SELECT string_agg(r || ':' || has_function_privilege(r, 'public.rated_week_change(uuid, timestamptz)', 'EXECUTE'), ',') FROM unnest(ARRAY['anon', 'authenticated']) r`);
  check(!privs.includes(":true"), `no execute right for anon or authenticated (${privs})`);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 4).join(" | ") : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

console.log = quietLog;
console.log(`rated-week-change-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: Home's weekly rating change is the server's, from the stored rated matches.");
