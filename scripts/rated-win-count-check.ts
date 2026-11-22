/**
 * rated-win-count-check (P3, 22 Nov 2026; Joe: You's "Rated wins" gauge is the server's count from the rated match
 * history). On a local PostgreSQL 16 with every migration applied (scripts/server-fn-harness.ts), through the real
 * ratings engine and the real server function:
 *
 * - rated_win_count counts a player's own live rated matches and the wins among them, equal to the engine's stored
 *   results; the opponent gets their own figure;
 * - ratedWinCountFn answers the signed-in player's count; a player with no rated matches gets 0 of 0;
 * - phones can't run rated_win_count (anon and authenticated have no right on it).
 *
 *   bun scripts/rated-win-count-check.ts
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
    console.log("rated-win-count-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL");
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: not run (CI runs it)");
  process.exit(0);
}

const quietLog = console.log;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^rated-win-count-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};

const mt = await import("../src/lib/rated/match");
const catalogue = await import("../src/lib/duel/catalogue");
const { dealtSignature } = await import("../src/lib/duel/dealSignature");
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
  db = startLocalDb("rated-win-count-check-");
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
  const { readRatedWinCount } = await import("../src/lib/data/ratings.server");
  const { ratedWinCountFn } = await import("../src/lib/profile/ratedWins.functions");

  q(`INSERT INTO auth.users (id, is_anonymous, email) SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, false, 'w' || n || '@example.com' FROM generate_series(100, 104) n`);
  for (let n = 100; n < 105; n++) q(`SELECT public.create_profile('${uid(n)}', 'Wins_${n}', 2::smallint, DATE '1990-01-01', NULL)`);
  const A = uid(100);
  const B = uid(101);

  // Nine matches a day apart, so the same-opponent daily rule freezes none (placement included): A wins two of every three.
  const start = Date.now() - 10 * 86_400_000;
  const outcomes: Outcome[] = [];
  for (let i = 0; i < 9; i++)
    outcomes.push(await rs.recordRatedMatch(admin, duel(A, B, i % 3 === 2 ? [[100, 150], [100, 150]] : [[150, 100], [150, 100]]), start + i * 86_400_000));
  check(outcomes.every((o) => o.ok && o.status === "recorded"), "every match recorded");
  // A match the ratings engine doesn't count counts for nothing here: five more against B on one UK day, the fourth and
  // fifth frozen by the same-opponent rule (counted false for both players).
  const day = start + 9 * 86_400_000;
  for (let i = 0; i < 5; i++) outcomes.push(await rs.recordRatedMatch(admin, duel(A, B, [[150, 100], [150, 100]]), day + i * 60_000));
  const frozen = Number(q(`SELECT count(*) FROM rated_match_players WHERE player_id = '${A}' AND side = 'live' AND NOT counted`));
  const stored = (who: string) => q(`SELECT count(*) FILTER (WHERE result = 'win') || '/' || count(*) FROM rated_match_players WHERE player_id = '${who}' AND side = 'live' AND counted`);

  const a = await readRatedWinCount(admin, A);
  const b = await readRatedWinCount(admin, B);
  const counted = 14 - frozen;
  check(frozen > 0, `control: some of A's matches were not counted (${frozen})`);
  check(!a.error && a.data?.played === counted && a.data.wins === counted - 3, `A: wins of counted matches only (${a.data?.wins} of ${a.data?.played}, want ${counted - 3} of ${counted})`);
  check(`${a.data?.wins}/${a.data?.played}` === stored(A), `A's count is the stored results (${stored(A)})`);
  check(!b.error && b.data?.played === Number(q(`SELECT count(*) FROM rated_match_players WHERE player_id = '${B}' AND side = 'live' AND counted`)) && b.data.wins === 3, `B: B's own, 3 wins (${b.data?.wins} of ${b.data?.played})`);

  const fnA = await callServerFn<{ played: number; wins: number } | null>(ratedWinCountFn, undefined, accountToken(A));
  check(fnA?.played === a.data?.played && fnA.wins === a.data?.wins, `the function answers A's count (${fnA?.wins} of ${fnA?.played})`);
  const fnC = await callServerFn<{ played: number; wins: number } | null>(ratedWinCountFn, undefined, accountToken(uid(102)));
  check(fnC?.played === 0 && fnC.wins === 0, "a player with no rated matches: 0 of 0");

  for (const [who, c] of [["anon", client(ANON_KEY)], ["authenticated", client(ANON_KEY, accountToken(A))]] as const) {
    const r = await (c.rpc as unknown as (f: string, a: unknown) => Promise<{ error: unknown }>).call(c, "rated_win_count", { p_user_id: A });
    check(!!r.error, `${who} can't run rated_win_count`);
  }
  const privs = q(`SELECT string_agg(r || ':' || has_function_privilege(r, 'public.rated_win_count(uuid)', 'EXECUTE'), ',') FROM unnest(ARRAY['anon', 'authenticated']) r`);
  check(!privs.includes(":true"), `no execute right for anon or authenticated (${privs})`);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 4).join(" | ") : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

console.log = quietLog;
console.log(`rated-win-count-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: You's rated wins are the server's, from the stored rated matches.");
