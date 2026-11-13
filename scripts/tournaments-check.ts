/**
 * tournaments-check (wave 4, W4b; docs/tournaments/README.md, docs/tournaments/interface.md): the Tournaments hub's
 * rules and the Arena and the daily Score Attack end to end, through the real server code and server functions,
 * against a local PostgreSQL 16 with every migration applied (scripts/server-fn-harness.ts). W3a's ratings are stood
 * in through `setRatingsBackend`. No browser (~30 s).
 *
 * What it proves:
 * - the schedule: Arenas at 13:00 and 20:00 UK every day (summer time too), one Score Attack a UK day, ids, the featured
 *   pick rotating through every room pick, W4c's kinds off;
 * - the Arena's points: 2 a win, 4 once 2 wins in a row are behind, a loss or draw 0 and the streak broken, the same in
 *   the database (tournament_arena_settle) as in rules.ts on 400 random results; standings order;
 * - pairing by rating through W3b's bestPartner (nearest first, the band widening, anyone from 12 s), never the
 *   opponent just played while someone else waits; the 4-entrant minimum (3 entrants: called off, told the next one);
 * - Arena duels are ordinary rooms on W3b's engine and never rated matches: no mm_matches row, recordRatedMatch never
 *   called, nothing under src/lib/tournaments names W3a's or W3b's rating writes; Play again refused; stranger chat;
 * - Score Attack: one room for everyone (the same games and deals), entrants only, highest total then the faster time;
 * - entry by each method (free, coins, a Score Attack ticket, a Category Cup ticket while the Cup is off and refused
 *   when it's on), insufficient coins, no ticket, one entry per account, guests and non-testers refused; coins and
 *   tickets refunded in full when an event doesn't run, once;
 * - every prize amount and the small-field safeguard (exhaustively in rules.ts, then paid on the database); payouts,
 *   trophies and badges once whatever runs twice; ledger lines with reason tournament_prize;
 * - anon and authenticated can't write entries, standings, results, prizes or trophies, or call the functions;
 * - the check-only switch window.__DUELZ_ALLOW_TOURNAMENTS__ is never read in a production build;
 * - the Cron Trigger's schedule; the three analytics events.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
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
async function section(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    check(false, `${name}: threw ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 4).join(" | ") : String(err)}`);
  }
}

const quietLog = console.log;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^tournaments-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
};

/* ------------------------------------------------------------------ 1. pure rules (no database) */

const rules = await import("../src/lib/tournaments/rules");
const config = await import("../src/config/tournamentConfig");

await section("schedule", async () => {
  const { ukTimeToUtcMs } = await import("../src/lib/publicSchedule");
  const winter = rules.scheduledEvent("arena:2026-12-01:1300")!;
  const summer = rules.scheduledEvent("arena:2026-07-01:2000")!;
  check(winter.startsAt === Date.UTC(2026, 11, 1, 13, 0) && summer.startsAt === Date.UTC(2026, 6, 1, 19, 0), "Arenas start at 13:00 and 20:00 UK time (summer time too)");
  check(winter.endsAt - winter.startsAt === config.ARENA_WINDOW_MIN * 60_000 && config.ARENA_WINDOW_MIN === 45, "an Arena's window is 45 minutes (a config value)");
  check(rules.scheduledEvent("arena:2026-12-01:1400") === null && rules.scheduledEvent("arena:2026-12-01") === null, "only the configured Arena times are events");
  const sa = rules.scheduledEvent("score_attack:2026-12-01")!;
  check(sa.startsAt === ukTimeToUtcMs("2026-12-01", "00:00") && sa.endsAt === ukTimeToUtcMs("2026-12-02", "00:00"), "a Score Attack is a UK day, 24 hours");
  const week = rules.scheduleBetween(Date.UTC(2026, 11, 7, 0, 0), Date.UTC(2026, 11, 14, 0, 0));
  check(week.filter((e) => e.kind === "arena").length === 14 && week.filter((e) => e.kind === "score_attack").length === 7, `a week holds 14 Arenas and 7 Score Attacks (${week.length})`);
  check(week.every((e, i) => i === 0 || week[i - 1]!.startsAt <= e.startsAt), "the schedule is in time order");
  const { ROOM_PICKS } = await import("../src/lib/duel/roomSettings");
  const { shiftDayKey } = await import("../src/lib/duel/daily");
  const picks = Array.from({ length: ROOM_PICKS.length }, (_, i) => rules.featuredPick(shiftDayKey("2026-12-01", i)));
  check(new Set(picks).size === ROOM_PICKS.length, "the featured category rotates through every room pick, one a day");
  check(rules.parseEventId("category_cup:2026-12-01:1900")?.kind === "category_cup" && rules.scheduledEvent("category_cup:2026-12-01:1900") === null, "W4c's kinds are off (no events)");
  check(rules.parseEventId("arena:2026-12-01:2500") === null && rules.parseEventId("nope:2026-12-01") === null && rules.parseEventId("x".repeat(80)) === null, "malformed ids are refused");
  check(config.TOURNAMENT_KINDS_ON.arena && config.TOURNAMENT_KINDS_ON.score_attack && !config.TOURNAMENT_KINDS_ON.category_cup && !config.TOURNAMENT_KINDS_ON.championship, "the launch set: Arena and Score Attack on, Category Cup and Championship off");
});

await section("arena points and standings", async () => {
  check(rules.arenaWinPoints(0) === 2 && rules.arenaWinPoints(1) === 2 && rules.arenaWinPoints(2) === 4 && rules.arenaWinPoints(7) === 4, "2 a win; after 2 wins in a row each win counts double");
  let p = rules.freshArenaPlayer("u");
  const seq: ("win" | "loss" | "draw")[] = ["win", "win", "win", "win", "loss", "win", "win", "win", "draw", "win"];
  const got: number[] = [];
  for (const r of seq) {
    const out = rules.applyArenaResult(p, r, 100, 1);
    got.push(out.points);
    p = out.player;
  }
  check(got.join() === "2,2,4,4,0,2,2,4,0,2" && p.points === 22 && p.bestStreak === 4 && p.streak === 1, `the streak doubles from the third win and breaks on a loss or draw (${got.join()})`);
  const a = { ...rules.freshArenaPlayer("a"), points: 10, wins: 4, played: 5, scoreTotal: 500, lastWinAt: 5 };
  const b = { ...rules.freshArenaPlayer("b"), points: 10, wins: 5, played: 5, scoreTotal: 400, lastWinAt: 9 };
  const c = { ...rules.freshArenaPlayer("c"), points: 10, wins: 5, played: 6, scoreTotal: 400, lastWinAt: 3 };
  const idle = rules.freshArenaPlayer("z");
  const order = rules.arenaStandings([a, b, c, idle]).map((x) => `${x.userId}${x.place}`).join();
  check(order === "c1,b2,a3", `standings: points, then wins, then score, then who got there first; players who never played aren't ranked (${order})`);
  const sa = rules.scoreAttackStandings([
    { userId: "a", total: 700, tieMs: 90_000, finishedAt: 5 },
    { userId: "b", total: 700, tieMs: 80_000, finishedAt: 9 },
    { userId: "c", total: 800, tieMs: 99_000, finishedAt: 1 },
  ]);
  check(sa.map((x) => x.userId + x.place).join() === "c1,b2,a3", "Score Attack: highest total, then the faster total time");
});

await section("prizes and the safeguard", async () => {
  const want = (kind: "arena" | "score_attack", place: number, n: number): number | null => {
    if (kind === "arena") {
      if (place === 1) return n >= 4 ? 100 : null;
      if (place === 2) return n >= 8 ? 60 : null;
      if (place === 3) return n >= 12 ? 30 : null;
      return null;
    }
    if (place === 1) return n >= 5 ? 300 : null;
    if (place === 2) return n >= 8 ? 200 : null;
    if (place === 3) return n >= 12 ? 100 : null;
    if (place >= 4 && place <= 10) return n >= 50 ? 60 : null;
    return null;
  };
  let bad = 0;
  for (const kind of ["arena", "score_attack"] as const)
    for (let n = 0; n <= 120; n++)
      for (let place = 1; place <= Math.max(n, 12); place++) {
        const got = rules.prizeFor(kind, place, n);
        const coins = want(kind, place, n);
        const trophy = coins !== null && place <= 3 ? (["gold", "silver", "bronze"] as const)[place - 1] : null;
        if ((got?.coins ?? null) !== coins || (got?.trophy ?? null) !== trophy) bad++;
      }
  check(bad === 0, `every prize amount and the safeguard, for every place and field up to 120 (Arena 100/60/30 from 4/8/12; Score Attack 300/200/100 from 5/8/12, 4th–10th 60 from 50); trophies follow (${bad} wrong)`);
  check(rules.prizeFor("score_attack", 11, 500) === null && rules.prizeFor("arena", 4, 500) === null, "no prize past the table");
  check(rules.entryOptionsFor("arena").join() === "free" && rules.entryOptionsFor("score_attack").join() === "coins,ticket_score_attack,ticket_category_cup", "entry: the Arena free; Score Attack coins, its ticket, or a Category Cup ticket while the Cup is off");
  const cupOn = { ...rules.TOURNAMENT_SWITCHES, kinds: { ...rules.TOURNAMENT_SWITCHES.kinds, category_cup: true } };
  check(rules.entryOptionsFor("score_attack", cupOn).join() === "coins,ticket_score_attack", "with the Category Cup on, its ticket no longer enters a Score Attack");
  check(rules.entryCoins("score_attack") === 50 && rules.entryCoins("arena") === 0, "Score Attack 50 coins; the Arena free");
});

await section("flagged runs: the rule", async () => {
  check(rules.serverFlag({ flagged: true }) === "server_replay" && rules.serverFlag({ flagged: true, flagReason: "desync" }) === "desync", "a stored grade's extra.flagged === true is a flag (reason flagReason, else server_replay)");
  check(rules.serverFlag({ flagged: "true" }) === null && rules.serverFlag({ flagged: 1 }) === null && rules.serverFlag(null) === null && rules.serverFlag([true]) === null, "nothing else is a flag");
  check(rules.flaggedDuelWinner("a", true, false) === "b" && rules.flaggedDuelWinner("b", false, true) === "a" && rules.flaggedDuelWinner("a", true, true) === "draw" && rules.flaggedDuelWinner("a", false, false) === "a", "a flagged player earns nothing from a duel; the opponent's result stands as a win");
  const server = readFileSync("src/lib/tournaments/tournaments.server.ts", "utf8");
  const functions = readFileSync("src/lib/tournaments/tournaments.functions.ts", "utf8");
  const flagReads = server.match(/serverFlag\(([^)]*)\)/g) ?? [];
  check(flagReads.length === 2 && flagReads.every((m) => m === "serverFlag(r.extra)") && !/flagged/.test(functions), `the flag is read only from stored grades (round_results / async_results extra), never from anything the phone sends (${flagReads.join(" ")})`);
});

await section("source rules", async () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f)) files.push(p);
    }
  };
  walk("src/lib/tournaments");
  walk("src/components/tournaments");
  const src = files.map((f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")).join("\n");
  check(!/recordRatedMatch|insertRatedMatch|insertMatchPlayers|mm_matches|mm_match_players|settleMatch\(|ratingsAdapter\.server"\)\)\.record/.test(src), "nothing under src/lib/tournaments writes a rating or a rated match");
  check(!/\bany\b/.test(readFileSync("src/lib/data/tournaments.server.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), "the data layer has no `any`");
  check(!/\.from\("tournament_[a-z_]+"\)\.(insert|update|upsert|delete)/.test(readFileSync("src/lib/data/tournaments.server.ts", "utf8")), "no tournament table is written directly (only through the migration's functions)");
  const api = readFileSync("src/lib/tournaments/tournamentsApi.ts", "utf8");
  const fn = api.slice(api.indexOf("export function tournamentsAutomated"));
  const body = fn.slice(fn.indexOf("{") + 1, fn.indexOf("\n}"));
  const prodAt = body.indexOf("if (import.meta.env.PROD) return true;");
  const flagAt = body.indexOf("__DUELZ_ALLOW_TOURNAMENTS__");
  check(prodAt > 0 && flagAt > prodAt && body.includes('checkOverride<boolean>("__DUELZ_ALLOW_TOURNAMENTS__")') && (api.match(/__DUELZ_ALLOW_TOURNAMENTS__/g) ?? []).length === 2, "the check-only switch window.__DUELZ_ALLOW_TOURNAMENTS__ is read only after a production build has answered (import.meta.env.PROD), and only through checkOverride");
  const { TOURNAMENT_CRON } = await import("../src/lib/tournaments/tasks/tournamentsTick.server");
  const vite = readFileSync("vite.config.ts", "utf8");
  check(vite.includes(`"${TOURNAMENT_CRON}": ["tournaments:tick"]`) && vite.includes(`"tournaments:tick": { handler:`), "vite.config.ts schedules the tournaments' tick every 5 minutes");
  const { ANALYTICS_EVENTS, ANALYTICS_MODES } = await import("../src/lib/analytics/events");
  check(["tournament_entered", "tournament_finished", "prize_paid"].every((e) => (ANALYTICS_EVENTS as readonly string[]).includes(e)) && (ANALYTICS_MODES as readonly string[]).includes("tournament"), "the three events and the tournament mode are in the analytics lists");
  const mig = readFileSync("supabase/migrations/20261115200200_analytics_tournament_events.sql", "utf8");
  check(/UNION SELECT unnest\(ARRAY\['tournament_entered', 'tournament_finished', 'prize_paid'\]\)/.test(mig) && /SELECT unnest\(existing\)/.test(mig), "the analytics migration adds to the event list as it stands (never replaces it)");
});

/* ------------------------------------------------------------------ 2. on a real database */

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = uid(1);
const B = uid(2);
const C = uid(3);
const D = uid(4);
const KID = uid(5); // 15
const GUEST = uid(6); // no profile
const NOTEST = uid(7); // not a tester
const POOR = uid(8);
const E = uid(9);
const BULK = Array.from({ length: 60 }, (_, i) => uid(100 + i));

let db: LocalDb | null = null;
let rest: RestServer | null = null;

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log("tournaments-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL");
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part didn't run (CI runs it)");
} else {
  try {
    db = startLocalDb("tournaments-check-");
    check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
    rest = await startRestServer(db.socketDir);
    process.env["SUPABASE_URL"] = rest.url;
    process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
    await installServerFnPlugin();
    await runDb(db);
  } catch (err) {
    check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await rest?.stop();
    db?.stop();
  }
}

restore();
console.log(`tournaments-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: the schedule, Arena points and pairing, Score Attack, entry and refunds, prizes once, never a rating.");
process.exit(0);

async function runDb(db: LocalDb): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const tryQ = (sql: string) => db.psql(sql);
  // The kind check is widened, never narrowed (13 Nov 2026: this branch's first copy wrote the list out in full from
  // before E2 and dropped daily_archive, which would have broken the Plus Daily archive live; found by W4d on a merged
  // tree and by plus-check). The migration reads the kinds as they stand and adds score_attack.
  const tmig = readFileSync("supabase/migrations/20261115200000_tournaments.sql", "utf8");
  const kindsBlock = /DO \$kinds\$[\s\S]*?\$kinds\$;/.exec(tmig)?.[0] ?? "";
  check(
    /pg_get_constraintdef/.test(kindsBlock) && /UNION SELECT 'score_attack'/.test(kindsBlock) && !/'(daily_puzzle|daily_arcade|challenge|daily_archive)'/.test(tmig),
    "the migration adds score_attack to async_rooms' kinds as they stand (read from the constraint), never writing the list out",
  );
  const kindCheck = q(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'async_rooms_kind_check' AND conrelid = 'public.async_rooms'::regclass`);
  const KINDS = ["daily_puzzle", "daily_arcade", "challenge", "daily_archive", "score_attack"];
  check(KINDS.every((k) => kindCheck.includes(`'${k}'`)), `async_rooms' kind check keeps every earlier kind and adds score_attack (${kindCheck})`);
  // Every kind really works: a room of each goes in after all the migrations (rolled back, nothing kept).
  const insertKind = (k: string) =>
    db.psql(`BEGIN; INSERT INTO public.async_rooms (kind, room_key, seed, round_count, opens_at, closes_at) VALUES ('${k}', 'kind-probe:${k}', 1, 1, now(), now() + interval '1 hour'); ROLLBACK;`);
  const works = KINDS.map((k) => [k, insertKind(k).ok] as const);
  check(works.every(([, ok]) => ok), `an async room of every kind can be made after the migrations (${works.map(([k, ok]) => `${k} ${ok ? "ok" : "REFUSED"}`).join(", ")})`);
  check(!insertKind("no_such_kind").ok, "an unknown kind is still refused (the check is widened, not dropped)");
  // A kind some other migration adds before this one survives it: re-run the block on a list with an extra kind.
  const later = db.psql(`BEGIN;
    ALTER TABLE public.async_rooms DROP CONSTRAINT async_rooms_kind_check;
    ALTER TABLE public.async_rooms ADD CONSTRAINT async_rooms_kind_check CHECK (kind IN ('daily_puzzle', 'daily_arcade', 'challenge', 'daily_archive', 'zz_probe')) NOT VALID;
    ${kindsBlock}
    SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'async_rooms_kind_check' AND conrelid = 'public.async_rooms'::regclass;
    ROLLBACK;`);
  check(later.ok && ["zz_probe", ...KINDS].every((k) => later.out.includes(`'${k}'`)), "re-run on a list with another migration's kind, the block keeps it and adds score_attack (idempotent, order-proof)");
  const server = await import("../src/lib/tournaments/tournaments.server");
  const fns = await import("../src/lib/tournaments/tournaments.functions");
  const data = await import("../src/lib/data/tournaments.server");
  const duelFns = await import("../src/lib/duel/duel.functions");
  const chat = await import("../src/lib/duel/chat.functions");
  const { setRatingsBackend } = await import("../src/lib/rated/ratingsAdapter.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const client = await adminDb();
  const call = callServerFn;

  const all = [A, B, C, D, KID, GUEST, NOTEST, POOR, E, ...BULK];
  q(`INSERT INTO auth.users (id) VALUES ${all.map((u) => `('${u}')`).join(", ")}`);
  const named: [string, string, string][] = [
    [A, "Ana", "1990-01-01"], [B, "Ben", "1990-01-02"], [C, "Cas", "1990-01-03"], [D, "Dot", "1990-01-04"],
    [KID, "Kiddo", "2011-06-01"], [NOTEST, "Nota", "1990-01-05"], [POOR, "Poor_P", "1990-01-06"], [E, "Eli", "1990-01-07"],
    ...BULK.map((u, i) => [u, `Bulk_${i}`, "1990-02-01"] as [string, string, string]),
  ];
  q(`SET session_replication_role = replica; INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth, player_number) VALUES
    ${named.map(([id, n, dob], i) => `('${id}', '${n}', '${n.toLowerCase()}', ${i % 32}, DATE '${dob}', ${i + 20})`).join(", ")}`);
  if (q(`SELECT to_regclass('shop.testers') IS NULL`) === "t") q(`CREATE SCHEMA IF NOT EXISTS shop; CREATE TABLE shop.testers (user_id uuid PRIMARY KEY, note text NOT NULL DEFAULT '')`);
  q(`INSERT INTO shop.testers (user_id, note) SELECT u, 'tournaments-check' FROM unnest(ARRAY[${all.filter((u) => u !== NOTEST && u !== GUEST).map((u) => `'${u}'`).join(",")}]::uuid[]) AS u ON CONFLICT DO NOTHING`);
  const credit = (u: string, n: number, key: string) => q(`SELECT public.economy_credit('${u}', ${n}, 'admin_adjustment', 'check', 'x', '${key}')`);
  const balance = (u: string) => Number(q(`SELECT coalesce((SELECT balance FROM public.coin_wallets WHERE user_id = '${u}'), 0)`));
  const tickets = (u: string, kind: string) => Number(q(`SELECT coalesce((SELECT count FROM public.consumable_balances WHERE user_id = '${u}' AND kind = '${kind}'), 0)`));

  const RATING: Record<string, number> = { [A]: 1000, [B]: 1030, [C]: 1600, [D]: 1640, [E]: 1300 };
  let ratedCalls = 0;
  setRatingsBackend({
    matchRating: async (u) => ({ rating: RATING[u] ?? 1500, placement: false }),
    recordRatedMatch: async () => {
      ratedCalls++;
      throw new Error("tournaments must never record a rated match");
    },
    startingRating: 1500,
    beginnerMax: 1500,
  });

  // Fixed days well away from today's real schedule: every server call takes its own clock.
  const DAY = "2026-12-03";
  const arenaId = `arena:${DAY}:1300`;
  const arena2Id = `arena:${DAY}:2000`;
  const saId = `score_attack:${DAY}`;
  const arenaEv = rules.scheduledEvent(arenaId)!;
  const arena2Ev = rules.scheduledEvent(arena2Id)!;
  const saEv = rules.scheduledEvent(saId)!;

  await section("permissions", async () => {
    for (const fn of ["tournament_enter", "tournament_pay_prize", "tournament_finish", "tournament_arena_settle", "tournament_cancel"]) {
      const r = tryQ(`SET ROLE authenticated; SELECT has_function_privilege('authenticated', oid, 'EXECUTE') FROM pg_proc WHERE proname = '${fn}'`);
      check(r.ok && r.out.trim() === "f", `authenticated can't call ${fn}`);
      const r2 = tryQ(`SELECT has_function_privilege('anon', oid, 'EXECUTE') FROM pg_proc WHERE proname = '${fn}'`);
      check(r2.ok && r2.out.trim() === "f", `anon can't call ${fn}`);
    }
    for (const t of ["tournament_events", "tournament_entries", "tournament_arena_players", "tournament_results", "tournament_prizes", "tournament_trophies", "tournament_arena_duels", "tournament_reminders"]) {
      const w = q(`SELECT bool_or(has_table_privilege(r, 'public.${t}', p)) FROM unnest(ARRAY['anon','authenticated','service_role']) r, unnest(ARRAY['INSERT','UPDATE','DELETE']) p`);
      check(w === "f", `nobody writes ${t} through the API (anon, authenticated, service_role)`);
    }
    const ins = tryQ(`SET ROLE authenticated; INSERT INTO public.tournament_prizes (event_id, user_id, place, coins, ledger_id) VALUES ('x', '${A}', 1, 999, 1)`);
    check(!ins.ok && /permission denied/.test(ins.err), "an authenticated insert into tournament_prizes is refused");
  });

  await section("entry", async () => {
    const guest = await call(fns.tournamentEnterFn, { eventId: saId, entry: "coins" }, userToken(GUEST));
    check(guest.ok === false && guest.reason === "account", "a guest can't enter (accounts only)");
    const notTester = await call(fns.tournamentEnterFn, { eventId: saId, entry: "coins" }, userToken(NOTEST));
    check(notTester.ok === false && notTester.reason === "not_open", "a non-tester can't enter while tournaments are testers-only");
    const hub = await call(fns.tournamentHubFn, {}, userToken(NOTEST));
    check(hub.open === false && hub.week.length === 0, "a non-tester's hub: closed, nothing listed");
    const before = saEv.startsAt - 3_600_000;
    credit(A, 120, "a1");
    const paid = await server.enterEvent(client, A, { eventId: saId, entry: "coins" }, before);
    check(paid.ok === true && balance(A) === 70, `coins entry: 50 spent through the ledger (${balance(A)})`);
    const again = await server.enterEvent(client, A, { eventId: saId, entry: "coins" }, before);
    check(again.ok === true && balance(A) === 70 && q(`SELECT count(*) FROM public.tournament_entries WHERE event_id = '${saId}' AND user_id = '${A}'`) === "1", "one entry per account; entering again charges nothing");
    credit(POOR, 10, "p1");
    const poor = await server.enterEvent(client, POOR, { eventId: saId, entry: "coins" }, before);
    check(poor.ok === false && poor.reason === "insufficient" && balance(POOR) === 10, "not enough coins: refused, nothing spent");
    const noTicket = await server.enterEvent(client, POOR, { eventId: saId, entry: "ticket_score_attack" }, before);
    check(noTicket.ok === false && noTicket.reason === "no_ticket", "no ticket: refused");
    q(`SELECT public.economy_grant_consumable('${B}', 'ticket_score_attack', 1, 'admin_adjustment', 'check', 'x', 'b-t1')`);
    q(`SELECT public.economy_grant_consumable('${C}', 'ticket_category_cup', 1, 'admin_adjustment', 'check', 'x', 'c-t1')`);
    const tSa = await server.enterEvent(client, B, { eventId: saId, entry: "ticket_score_attack" }, before);
    check(tSa.ok === true && tickets(B, "ticket_score_attack") === 0, "a Score Attack ticket enters a Score Attack (used once)");
    const cupOn = { ...rules.TOURNAMENT_SWITCHES, kinds: { ...rules.TOURNAMENT_SWITCHES.kinds, category_cup: true } };
    const refusedCup = await server.enterEvent(client, C, { eventId: saId, entry: "ticket_category_cup" }, before, cupOn);
    check(refusedCup.ok === false && refusedCup.reason === "bad_entry" && tickets(C, "ticket_category_cup") === 1, "with the Category Cup on, its ticket is refused for a Score Attack");
    const tCup = await server.enterEvent(client, C, { eventId: saId, entry: "ticket_category_cup" }, before);
    check(tCup.ok === true && tickets(C, "ticket_category_cup") === 0, "while the Category Cup is off, its ticket enters any daily Score Attack");
    const freeSa = await server.enterEvent(client, D, { eventId: saId, entry: "free" }, before);
    check(freeSa.ok === false && freeSa.reason === "bad_entry", "a Score Attack can't be entered free");
    const coinsArena = await server.enterEvent(client, D, { eventId: arenaId, entry: "coins" }, before);
    check(coinsArena.ok === false && coinsArena.reason === "bad_entry", "the Arena is free only");
    const lateSa = await server.enterEvent(client, D, { eventId: saId, entry: "coins" }, saEv.endsAt - 60_000);
    check(lateSa.ok === false && lateSa.reason === "closed", "entry closes before the event does");
    const kid = await server.enterEvent(client, KID, { eventId: arenaId, entry: "free" }, arenaEv.startsAt - 60_000);
    check(kid.ok === true, "under-18s can enter");
    check(q(`SELECT entrants FROM public.tournament_events WHERE id = '${saId}'`) === "3", "the event counts its entrants");
  });

  await section("refunds when an event doesn't run", async () => {
    const id = `score_attack:2026-12-04`;
    const ev = rules.scheduledEvent(id)!;
    credit(E, 60, "e1");
    q(`SELECT public.economy_grant_consumable('${D}', 'ticket_score_attack', 1, 'admin_adjustment', 'check', 'x', 'd-t1')`);
    await server.enterEvent(client, E, { eventId: id, entry: "coins" }, ev.startsAt - 1000);
    await server.enterEvent(client, D, { eventId: id, entry: "ticket_score_attack" }, ev.startsAt - 1000);
    check(balance(E) === 10 && tickets(D, "ticket_score_attack") === 0, "paid before");
    const first = await server.cancelEvent(client, id, "check");
    const second = await server.cancelEvent(client, id, "check");
    check(first === 2 && second === 0 && balance(E) === 60 && tickets(D, "ticket_score_attack") === 1, `coins and tickets refunded in full, once (${balance(E)}, ${tickets(D, "ticket_score_attack")})`);
    check(q(`SELECT count(*) FROM public.coin_ledger WHERE user_id = '${E}' AND reason = 'refund'`) === "1", "one refund line");
    const late = await server.enterEvent(client, A, { eventId: id, entry: "coins" }, ev.startsAt - 1000);
    check(late.ok === false && late.reason === "closed", "a called-off event can't be entered");
    const joe = q(`SELECT tournaments.cancel_event('${id}', 'again')`);
    check(/not_cancellable|"refunded": 0/.test(joe) || /cancelled/.test(joe), "Joe's cancel_event runs (logged) and refunds nothing twice");
  });

  await section("the Arena's 4-entrant minimum", async () => {
    for (const u of [A, B]) await server.enterEvent(client, u, { eventId: arena2Id, entry: "free" }, arena2Ev.startsAt - 60_000);
    // KID entered arenaId above; arena2 has 2: called off at its start.
    const row = await server.advanceEvent(client, (await data.readEvent(client, arena2Id)).data!, arena2Ev.startsAt + 1_000);
    check(row.status === "cancelled" && row.cancel_reason === "too_few", "fewer than 4 entrants: called off at the start");
    const view = await server.eventFor(client, A, arena2Id, arena2Ev.startsAt + 2_000);
    check(view?.status === "cancelled" && view.cancelledNext !== null && view.cancelledNext > arena2Ev.startsAt, "entrants are told when the next Arena is");
    const ready = await server.arenaReady(client, A, arena2Id, arena2Ev.startsAt + 3_000);
    check(ready.state === "closed", "a called-off Arena can't be played");
  });

  let duelAB = "";
  let roomAB = "";
  await section("the Arena: pairing, duels, points", async () => {
    for (const u of [A, B, C, D]) await server.enterEvent(client, u, { eventId: arenaId, entry: "free" }, arenaEv.startsAt - 60_000);
    const t = arenaEv.startsAt + 5_000;
    const live = await server.advanceEvent(client, (await data.readEvent(client, arenaId)).data!, t);
    check(live.status === "live" && live.entrants === 5, `4+ entrants: live at the start (${live.status}, ${live.entrants})`);
    const notIn = await server.arenaReady(client, E, arenaId, t);
    check(notIn.state === "closed", "a player who didn't enter can't play the Arena");
    const now = Date.now();
    const r1 = await server.arenaReady(client, A, arenaId, now);
    const r2 = await server.arenaReady(client, C, arenaId, now);
    check(r1.state === "searching" && r2.state === "searching", "A (1000) and C (1600) don't pair: too far apart");
    const r3 = await server.arenaReady(client, B, arenaId, now + 100);
    check(r3.state === "duel" && r3.duel.opponent.userId === A, "B (1030) pairs with A (1000): the nearest rating within the band");
    const pc = await server.arenaPoll(client, C, arenaId, now + 200);
    check(pc.state === "searching", "C keeps searching");
    const pFar = await server.arenaPoll(client, C, arenaId, now + 13_000);
    check(pFar.state === "searching", "nobody else waiting: C stays searching");
    if (r3.state !== "duel") return;
    duelAB = r3.duel.duelId;
    const duel = (await data.readArenaDuel(client, duelAB)).data!;
    roomAB = duel.duel_id!;
    check(q(`SELECT status || ',' || round_count FROM public.duels WHERE id = '${roomAB}'`) === "in_progress,3", "a duel is an ordinary room on W3b's engine, best of 3");
    check(q(`SELECT count(*) FROM public.mm_matches`) === "0" && ratedCalls === 0, "never a rated match: no mm_matches row, recordRatedMatch never called");
    check(await server.isTournamentRoom(client, roomAB), "the room is known as a tournament room");
    const again = await call(duelFns.rematchFn, { roomId: roomAB }, userToken(duel.a_user));
    check(again.ok === false, "Play again is refused in an Arena duel's room");
    q(`UPDATE public.duel_players SET user_id = user_id WHERE duel_id = '${roomAB}'`);
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer) VALUES
      ('${roomAB}', 1, 1, 150, 1000, true, 'x'), ('${roomAB}', 2, 1, 100, 1000, true, 'x'),
      ('${roomAB}', 1, 2, 140, 1000, true, 'x'), ('${roomAB}', 2, 2, 120, 1000, true, 'x'),
      ('${roomAB}', 1, 3, 10, 1000, true, 'x'), ('${roomAB}', 2, 3, 190, 1000, true, 'x')`);
    const early = await server.arenaPoll(client, A, arenaId, Date.now());
    check(early.state === "duel" && q(`SELECT status FROM public.tournament_arena_duels WHERE id = '${duelAB}'`) === "playing", "nothing settles while the room plays");
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${roomAB}'`);
    await Promise.all([1, 2, 3].map(() => server.arenaPoll(client, A, arenaId, Date.now())));
    await server.arenaPoll(client, B, arenaId, Date.now());
    const slotA = duel.a_user;
    const pts = q(`SELECT string_agg(user_id::text || ':' || points || ':' || streak || ':' || played, ',' ORDER BY user_id) FROM public.tournament_arena_players WHERE event_id = '${arenaId}' AND played > 0`);
    const other = slotA === A ? B : A;
    check(pts === [`${A}`, `${B}`].sort().map((u) => (u === slotA ? `${u}:2:1:1` : `${u}:0:0:1`)).join(","), `settled once: slot 1 won 2 games to 1, 2 points (${pts})`);
    check(q(`SELECT a_points || ',' || b_points || ',' || winner FROM public.tournament_arena_duels WHERE id = '${duelAB}'`) === "2,0,a", "the duel's stored result");
    check(ratedCalls === 0 && q(`SELECT count(*) FROM public.mm_matches`) === "0", "still no rating touched after settling");
    // Back in the queue: the opponent just played is passed over while someone else waits.
    const t2 = Date.now();
    await server.arenaReady(client, other, arenaId, t2);
    const next = await server.arenaReady(client, slotA, arenaId, t2 + 50);
    check(next.state === "searching" || (next.state === "duel" && next.duel.opponent.userId === C), "the opponent just played isn't met again at once while someone else waits");
    // Chat: an under-18 in a tournament room picks quick phrases.
    const kidRoom = await server.arenaReady(client, KID, arenaId, Date.now());
    void kidRoom;
    const msg = await call(chat.sendRoomMessageFn, { roomId: roomAB, text: "hello there" }, userToken(slotA));
    check(msg.ok !== false || !/quick phrases/.test(String(msg.message)), "an adult with an account types in a tournament room");
    const { tournamentChatText } = await import("../src/lib/tournaments/tournamentChat.server");
    const kidTyped = await tournamentChatText(client, roomAB, KID, "hello there", Date.now());
    const adultTyped = await tournamentChatText(client, roomAB, slotA, "hello there", Date.now());
    const ordinary = await tournamentChatText(client, crypto.randomUUID(), KID, "hello there", Date.now());
    check(kidTyped?.ok === false && adultTyped?.ok === true && ordinary === null, "stranger chat rules in a tournament room: an under-18 picks quick phrases, an adult types; other rooms unchanged");
  });

  await section("streak arithmetic: the database equals rules.ts", async () => {
    const id = "arena:2026-12-05:1300";
    const ev = rules.scheduledEvent(id)!;
    await data.ensureEventRow(client, ev);
    q(`UPDATE public.tournament_events SET status = 'live' WHERE id = '${id}'`);
    q(`INSERT INTO public.tournament_entries (event_id, user_id, entry) SELECT '${id}', u, 'free' FROM unnest(ARRAY['${BULK[0]}','${BULK[1]}','${BULK[2]}']::uuid[]) u`.replace("INSERT INTO public.tournament_entries", "SET session_replication_role = origin; INSERT INTO public.tournament_entries"));
    let rng = 7;
    const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const tsPlayers = new Map([BULK[0]!, BULK[1]!, BULK[2]!].map((u) => [u, rules.freshArenaPlayer(u)]));
    const tsGames = new Map([BULK[0]!, BULK[1]!, BULK[2]!].map((u) => [u, { gameStreak: 0, bestGameStreak: 0 }]));
    let mismatch = 0;
    for (let i = 0; i < 400; i++) {
      const pair = [BULK[0]!, BULK[1]!, BULK[2]!].sort(() => rand() - 0.5).slice(0, 2) as [string, string];
      const r = rand();
      const winner = r < 0.45 ? "a" : r < 0.9 ? "b" : "draw";
      const duelId = crypto.randomUUID();
      q(`INSERT INTO public.tournament_arena_duels (id, event_id, a_user, b_user) VALUES ('${duelId}', '${id}', '${pair[0]}', '${pair[1]}')`.replace("INSERT", "SET session_replication_role = origin; INSERT"));
      // 2 or 3 played games, scores and times drawn so ties on score (and on both) happen.
      const games = Array.from({ length: rand() < 0.5 ? 2 : 3 }, () => ({ a: Math.floor(rand() * 4) * 50, b: Math.floor(rand() * 4) * 50, aTimeMs: Math.floor(rand() * 3) * 1000, bTimeMs: Math.floor(rand() * 3) * 1000 }));
      const out = JSON.parse(q(`SELECT public.tournament_arena_settle('${duelId}', '${winner}', 100, 90, '${JSON.stringify(games)}'::jsonb)`));
      const ga = rules.applyArenaGames(tsGames.get(pair[0])!, games, "a");
      const gb = rules.applyArenaGames(tsGames.get(pair[1])!, games, "b");
      tsGames.set(pair[0], ga);
      tsGames.set(pair[1], gb);
      if (out.a_best_game_streak !== ga.bestGameStreak || out.b_best_game_streak !== gb.bestGameStreak) mismatch++;
      const [pa, pb] = pair.map((u) => tsPlayers.get(u)!);
      const ra = rules.applyArenaResult(pa!, winner === "a" ? "win" : winner === "b" ? "loss" : "draw", 100, i);
      const rb = rules.applyArenaResult(pb!, winner === "b" ? "win" : winner === "a" ? "loss" : "draw", 90, i);
      tsPlayers.set(pair[0], ra.player);
      tsPlayers.set(pair[1], rb.player);
      if (out.a_points !== ra.points || out.b_points !== rb.points) mismatch++;
      const again = JSON.parse(q(`SELECT public.tournament_arena_settle('${duelId}', 'a', 100, 90, '[]'::jsonb)`));
      if (again.status !== "already") mismatch++;
    }
    const dbRows = q(`SELECT string_agg(user_id::text || ':' || points || ':' || wins || ':' || streak || ':' || best_streak || ':' || played, ',' ORDER BY user_id) FROM public.tournament_arena_players WHERE event_id = '${id}'`);
    const tsRows = [...tsPlayers.values()].sort((a, b) => (a.userId < b.userId ? -1 : 1)).map((p) => `${p.userId}:${p.points}:${p.wins}:${p.streak}:${p.bestStreak}:${p.played}`).join(",");
    check(mismatch === 0 && dbRows === tsRows, `400 random duel results: the database's points and streaks equal rules.ts, and a duel settles once (${mismatch} differ)`);
    const dbGames = q(`SELECT string_agg(user_id::text || ':' || game_streak || ':' || best_game_streak, ',' ORDER BY user_id) FROM public.tournament_arena_players WHERE event_id = '${id}'`);
    const tsGameRows = [...tsGames.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([u, g]) => `${u}:${g.gameStreak}:${g.bestGameStreak}`).join(",");
    check(dbGames === tsGameRows, `the same 400 duels' games: the database's runs of games won in a row equal rules.ts (${dbGames === tsGameRows ? "equal" : `${dbGames} vs ${tsGameRows}`})`);
  });

  await section("the Arena finishes and pays once", async () => {
    const end = arenaEv.endsAt + 31 * 60_000;
    // Every duel still playing at the late cut-off is void; the event finishes.
    const row = await server.advanceEvent(client, (await data.readEvent(client, arenaId)).data!, end);
    check(row.status === "finished", `the Arena finishes after its window (${row.status})`);
    await flushAnalytics();
    const results = q(`SELECT string_agg(place::text || ':' || points, ',' ORDER BY place) FROM public.tournament_results WHERE event_id = '${arenaId}'`);
    check(results.startsWith("1:2,"), `final places stored (${results})`);
    const winner = q(`SELECT user_id FROM public.tournament_results WHERE event_id = '${arenaId}' AND place = 1`);
    // 5 entrants: 1st pays 100 (2nd needs 8, 3rd 12).
    check(q(`SELECT string_agg(place || ':' || coins, ',') FROM public.tournament_prizes WHERE event_id = '${arenaId}'`) === "1:100", "5 entrants: only 1st is paid (100); 2nd needs 8, 3rd 12");
    check(q(`SELECT count(*) FROM public.coin_ledger WHERE reason = 'tournament_prize' AND ref_id = '${arenaId}'`) === "1", "one prize line in the ledger");
    check(q(`SELECT medal FROM public.tournament_trophies WHERE event_id = '${arenaId}'`) === "gold", "one trophy: gold for 1st");
    const badges = q(`SELECT string_agg(badge, ',' ORDER BY badge) FROM public.player_badges WHERE user_id = '${winner}'`);
    check(["arena-champion", "champion", "entrant", "trophy-hunter"].every((b) => badges.includes(b)), `the winner's badges: Entrant, Trophy Hunter, Champion, Arena Champion (${badges})`);
    await server.payEvent(client, arenaId, end);
    await server.advanceEvent(client, (await data.readEvent(client, arenaId)).data!, end + 60_000);
    await server.runTournamentTick(client, end + 120_000);
    check(q(`SELECT count(*) FROM public.coin_ledger WHERE reason = 'tournament_prize' AND ref_id = '${arenaId}'`) === "1" && q(`SELECT count(*) FROM public.tournament_trophies WHERE event_id = '${arenaId}'`) === "1", "paying again, the tick and another read pay nothing more");
    check(q(`SELECT count(*) FROM public.player_badges WHERE user_id = '${winner}' AND badge = 'champion'`) === "1", "badges once");
    const ev = q(`SELECT string_agg(DISTINCT event, ',' ORDER BY event) FROM analytics.events WHERE event IN ('tournament_entered', 'tournament_finished', 'prize_paid')`);
    check(ev === "prize_paid,tournament_entered,tournament_finished", `the three events recorded (${ev})`);
    const props = q(`SELECT props::text FROM analytics.events WHERE event = 'prize_paid' LIMIT 1`);
    check(/"kind": "arena"/.test(props) && /"place": 1/.test(props) && /"coins": 100/.test(props), `prize_paid carries kind, place and coins (${props})`);
  });

  await section("Score Attack: one set for everyone, totals and the time tie-break", async () => {
    const open = saEv.startsAt + 60_000;
    const sa = await server.scoreAttackStart(client, A, saId, open);
    const sb = await server.scoreAttackStart(client, B, saId, open);
    check(sa.ok && sb.ok && sa.roomId === sb.roomId, "every entrant plays the one room (the same games and deals)");
    const notIn = await server.scoreAttackStart(client, E, saId, open);
    check(notIn.ok === false, "only entrants can play");
    if (!sa.ok) return;
    check(q(`SELECT kind || ',' || round_count FROM public.async_rooms WHERE id = '${sa.roomId}'`) === `score_attack,${config.SCORE_ATTACK_ROUNDS}`, "a Score Attack async room of the configured length");
    const types = JSON.parse(q(`SELECT to_json(round_order) FROM public.async_rooms WHERE id = '${sa.roomId}'`)) as string[];
    const { pickTypes } = await import("../src/lib/duel/roomSettings");
    const pick = rules.featuredPick(DAY);
    check(types.every((t) => pickTypes(pick).includes(t as never)), `every game from the day's featured category (${pick})`);
    await server.scoreAttackStart(client, C, saId, open);
    // Totals as the room stored them: A 700 in 300 s, B 700 in 280 s (faster), C 650.
    q(`UPDATE public.async_attempts SET total_score = CASE user_id WHEN '${A}' THEN 700 WHEN '${B}' THEN 700 ELSE 650 END,
         tie_ms = CASE user_id WHEN '${A}' THEN 300000 WHEN '${B}' THEN 280000 ELSE 100000 END,
         rounds_done = round_count_of, finished_at = now()
       FROM (SELECT ${config.SCORE_ATTACK_ROUNDS} AS round_count_of) x WHERE room_id = '${sa.roomId}'`);
    const board = await server.scoreAttackBoard(client, A, saId, open + 1000);
    check(board?.open === true && board.rows.map((r) => r.total).join() === "700,700,650" && board.rows[0]?.isMe === false && board.rows[1]?.isMe === true, "highest total wins; level on total, the faster total time is ahead");
    const done = await server.advanceEvent(client, (await data.readEvent(client, saId)).data!, saEv.endsAt + 1000);
    check(done.status === "finished", "the Score Attack finishes when its day ends");
    check(q(`SELECT string_agg(place || ':' || total, ',' ORDER BY place) FROM public.tournament_results WHERE event_id = '${saId}'`) === "1:700,2:700,3:650", "its final places");
    check(q(`SELECT count(*) FROM public.tournament_prizes WHERE event_id = '${saId}'`) === "0", "3 entrants: no prize (1st needs 5)");
  });

  await section("Score Attack prizes with a big field", async () => {
    const id = "score_attack:2026-12-06";
    const ev = rules.scheduledEvent(id)!;
    const players = BULK.slice(0, 55);
    for (const [i, u] of players.entries()) {
      credit(u, 50, `bulk${i}`);
      const out = await data.enterRpc(client, { eventId: (await server.ensureEvent(client, id))!.id, userId: u, entry: "coins", coins: 50 });
      if (out.data?.status !== "entered") throw new Error(`bulk entry ${out.data?.status}`);
    }
    const row = (await data.readEvent(client, id)).data!;
    await server.advanceEvent(client, row, ev.startsAt + 1000);
    const room = await server.scoreAttackRoom(client, (await data.readEvent(client, id)).data!);
    const { startAttempt } = await import("../src/lib/duel/asyncRoom.server");
    for (const [i, u] of players.entries()) {
      await startAttempt(client, room, u, { name: `Bulk_${i}`, colour: null, icon: null }, ev.startsAt + 2000);
      q(`UPDATE public.async_attempts SET total_score = ${1000 - i}, tie_ms = 1000, finished_at = now(), rounds_done = ${config.SCORE_ATTACK_ROUNDS} WHERE room_id = '${room.id}' AND user_id = '${u}'`);
    }
    await server.advanceEvent(client, (await data.readEvent(client, id)).data!, ev.endsAt + 1000);
    const paid = q(`SELECT string_agg(place || ':' || coins, ',' ORDER BY place) FROM public.tournament_prizes WHERE event_id = '${id}'`);
    check(paid === "1:300,2:200,3:100,4:60,5:60,6:60,7:60,8:60,9:60,10:60", `55 entrants: 300 / 200 / 100, 4th–10th 60, nothing for 11th (${paid})`);
    check(balance(players[0]!) === 300 && balance(players[10]!) === 0, "the coins reach the winners' wallets");
    check(q(`SELECT string_agg(medal, ',' ORDER BY place) FROM public.tournament_trophies WHERE event_id = '${id}'`) === "gold,silver,bronze", "gold, silver and bronze trophies");
    const sac = q(`SELECT count(*) FROM public.player_badges WHERE user_id = '${players[0]}' AND badge = 'score-attack-champion'`);
    check(sac === "1", "the winner earns Score Attack Champion");
    check(q(`SELECT count(*) FROM public.player_badges WHERE badge = 'entrant' AND user_id = ANY(ARRAY[${players.map((u) => `'${u}'`).join(",")}]::uuid[])`) === "55", "every ranked player earns Entrant");
    await server.payEvent(client, id, ev.endsAt + 2000);
    check(q(`SELECT count(*) FROM public.coin_ledger WHERE reason = 'tournament_prize' AND ref_id = '${id}'`) === "10", "paid once");
  });

  await section("Serial Winner and Arena Ace", async () => {
    const champ = BULK[59]!;
    for (let i = 0; i < 10; i++) {
      const id = `arena:2027-01-${String(10 + i).padStart(2, "0")}:1300`;
      const ev = rules.scheduledEvent(id)!;
      await data.ensureEventRow(client, ev);
      q(`SET session_replication_role = origin; INSERT INTO public.tournament_entries (event_id, user_id, entry) SELECT '${id}', u, 'free' FROM unnest(ARRAY['${champ}','${BULK[50]}','${BULK[51]}','${BULK[52]}']::uuid[]) u; UPDATE public.tournament_events SET entrants = 4, status = 'live' WHERE id = '${id}'`);
      q(`INSERT INTO public.tournament_arena_players (event_id, user_id, points, wins, played) VALUES ('${id}', '${champ}', 6, 3, 3), ('${id}', '${BULK[50]}', 2, 1, 3)`);
      await server.advanceEvent(client, (await data.readEvent(client, id)).data!, ev.endsAt + 1000);
    }
    check(q(`SELECT count(*) FROM public.tournament_trophies WHERE user_id = '${champ}' AND medal = 'gold'`) === "10", "ten wins, ten gold trophies");
    check(q(`SELECT count(*) FROM public.player_badges WHERE user_id = '${champ}' AND badge = 'serial-winner'`) === "1", "Serial Winner after 10 tournament wins");
    check(q(`SELECT count(*) FROM public.player_badges WHERE badge = 'serial-winner'`) === "1", "nobody else");
  });

  await section("Arena Ace: 8 games won in a row in one Arena (Joe, 11 Nov 2026)", async () => {
    check(rules.ARENA_ACE_STREAK === 8, "Arena Ace's run is 8 games");
    const g = (a: number, b: number) => ({ a, b, aTimeMs: 1000, bTimeMs: 1000 });
    const four20 = [[g(150, 50), g(150, 50)], [g(150, 50), g(150, 50)], [g(150, 50), g(150, 50)], [g(150, 50), g(150, 50)]];
    let run = { gameStreak: 0, bestGameStreak: 0 };
    for (const d of four20) run = rules.applyArenaGames(run, d, "a");
    check(run.bestGameStreak === 8, "four straight 2–0 duels are 8 games in a row");
    run = { gameStreak: 0, bestGameStreak: 0 };
    for (const d of [[g(150, 50), g(150, 50)], [g(150, 50), g(50, 150), g(150, 50)], [g(150, 50), g(150, 50)], [g(150, 50), g(150, 50)]]) run = rules.applyArenaGames(run, d, "a");
    check(run.bestGameStreak === 5 && run.gameStreak === 5, "four duel wins with a game lost inside one are not 8 in a row (the lost game breaks the run)");
    run = rules.applyArenaGames({ gameStreak: 7, bestGameStreak: 7 }, [g(100, 100)], "a");
    check(run.gameStreak === 0 && run.bestGameStreak === 7, "a drawn game breaks the run");
    check(rules.applyArenaGames({ gameStreak: 0, bestGameStreak: 0 }, [{ a: 100, b: 100, aTimeMs: 900, bTimeMs: 1000 }], "a").gameStreak === 1, "level scores: the faster game is won (W3b's gameWinner)");

    // Through the real settle: rooms from W3b's engine, stored results, settleArenaDuel.
    const { createDealtMatchRoom } = await import("../src/lib/rated/rated.server");
    const playDuels = async (id: string, ace: string, foe: string, duels: { a: number; b: number }[][]) => {
      for (const games of duels) {
        const room = await createDealtMatchRoom(client, { format: "bo3", choice: "mixed", userIds: [ace, foe] }, Date.now());
        const duelId = crypto.randomUUID();
        q(`SET session_replication_role = origin; INSERT INTO public.tournament_arena_duels (id, event_id, a_user, b_user, duel_id) VALUES ('${duelId}', '${id}', '${ace}', '${foe}', '${room.id}')`);
        const rows = games.flatMap((x, i) => [`('${room.id}', 1, ${i + 1}, ${x.a}, 1000, true, 'x')`, `('${room.id}', 2, ${i + 1}, ${x.b}, 1000, true, 'x')`]);
        q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer) VALUES ${rows.join(", ")}`);
        q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = ${games.length}, phase_started_at = now() WHERE id = '${room.id}'`);
        const duel = (await data.readArenaDuel(client, duelId)).data!;
        await server.settleArenaDuel(client, duel, Date.now());
      }
    };
    const twoNil = [{ a: 150, b: 50 }, { a: 150, b: 50 }];
    const setUp = async (id: string, users: string[]) => {
      await data.ensureEventRow(client, rules.scheduledEvent(id)!);
      q(`SET session_replication_role = origin; UPDATE public.tournament_events SET status = 'live' WHERE id = '${id}'; INSERT INTO public.tournament_entries (event_id, user_id, entry) SELECT '${id}', u, 'free' FROM unnest(ARRAY[${users.map((u) => `'${u}'`).join(",")}]::uuid[]) u`);
    };
    const aceBadge = (u: string) => q(`SELECT count(*) FROM public.player_badges WHERE user_id = '${u}' AND badge = 'arena-ace'`);
    const earnId = "arena:2026-12-10:1300";
    await setUp(earnId, [BULK[45]!, BULK[46]!]);
    await playDuels(earnId, BULK[45]!, BULK[46]!, [twoNil, twoNil, twoNil]);
    check(aceBadge(BULK[45]!) === "0", "6 games won in a row (three 2–0 duels): no Arena Ace yet");
    await playDuels(earnId, BULK[45]!, BULK[46]!, [twoNil]);
    check(aceBadge(BULK[45]!) === "1" && aceBadge(BULK[46]!) === "0", "the fourth straight 2–0 duel (8 games in a row) earns Arena Ace, once");
    const missId = "arena:2026-12-10:2000";
    await setUp(missId, [BULK[47]!, BULK[48]!]);
    await playDuels(missId, BULK[47]!, BULK[48]!, [twoNil, [{ a: 150, b: 50 }, { a: 50, b: 150 }, { a: 150, b: 50 }], twoNil, twoNil, twoNil]);
    const best = q(`SELECT best_game_streak FROM public.tournament_arena_players WHERE event_id = '${missId}' AND user_id = '${BULK[47]}'`);
    check(aceBadge(BULK[47]!) === "0" && best === "7", `five duel wins with one game lost: the best run is 7, no Arena Ace (${best})`);

    // A duel stops once won (2–0), as W3b's rated best of 3 does; ordinary rooms never stop early.
    const room = await createDealtMatchRoom(client, { format: "bo3", choice: "mixed", userIds: [BULK[45]!, BULK[46]!] }, Date.now());
    const plain = await createDealtMatchRoom(client, { format: "bo3", choice: "mixed", userIds: [BULK[45]!, BULK[46]!] }, Date.now());
    q(`SET session_replication_role = origin; INSERT INTO public.tournament_arena_duels (id, event_id, a_user, b_user, duel_id) VALUES ('${crypto.randomUUID()}', '${earnId}', '${BULK[45]}', '${BULK[46]}', '${room.id}')`);
    const readRoomRow = async (id: string) => (await (await import("../src/lib/data/rooms.server")).readRoom(client, id)).data!;
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer) VALUES ('${room.id}', 1, 1, 150, 1000, true, 'x'), ('${room.id}', 2, 1, 50, 1000, true, 'x'), ('${plain.id}', 1, 1, 150, 1000, true, 'x'), ('${plain.id}', 2, 1, 50, 1000, true, 'x')`);
    const after1 = await server.arenaDuelClinched(client, await readRoomRow(room.id), 1);
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer) VALUES ('${room.id}', 1, 2, 150, 1000, true, 'x'), ('${room.id}', 2, 2, 50, 1000, true, 'x'), ('${plain.id}', 1, 2, 150, 1000, true, 'x'), ('${plain.id}', 2, 2, 50, 1000, true, 'x')`);
    const after2 = await server.arenaDuelClinched(client, await readRoomRow(room.id), 2);
    const plainAfter2 = await server.arenaDuelClinched(client, await readRoomRow(plain.id), 2);
    check(!after1 && after2 && !plainAfter2, "an Arena duel stops at 2–0 (not after one game); a room that isn't an Arena duel never does");
    const src = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
    check(/arenaDuelClinched\(client, room, round\)\) \{\s*await leaveBetweenRoundScreen\(client, \{ \.\.\.room, round_count: round \}, round\);/.test(src), "the room flow ends an Arena duel the way it ends a won rated match");
  });

  await section("flagged runs: no points, no score, no place; logged for review", async () => {
    // An Arena: the flagged player (slot 1) would have won; they earn nothing, the opponent the win.
    const id = "arena:2026-12-08:1300";
    const ev = rules.scheduledEvent(id)!;
    const four = [BULK[55]!, BULK[56]!, BULK[57]!, BULK[58]!];
    for (const u of four) await server.enterEvent(client, u, { eventId: id, entry: "free" }, ev.startsAt - 60_000);
    await server.advanceEvent(client, (await data.readEvent(client, id)).data!, ev.startsAt + 1000);
    const t = Date.now();
    await server.arenaReady(client, four[0]!, id, t);
    const paired = await server.arenaReady(client, four[1]!, id, t + 13_000);
    check(paired.state === "duel", "the flagged run's duel pairs as any other");
    if (paired.state !== "duel") return;
    const duel = (await data.readArenaDuel(client, paired.duel.duelId)).data!;
    const room = duel.duel_id!;
    const cheat = duel.a_user;
    const honest = duel.b_user;
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer, extra) VALUES
      ('${room}', 1, 1, 200, 1000, true, 'x', '{"flagged": true, "flagReason": "desync"}'), ('${room}', 2, 1, 50, 1000, true, 'x', '{"flagged": false}'),
      ('${room}', 1, 2, 200, 1000, true, 'x', '{}'), ('${room}', 2, 2, 50, 1000, true, 'x', NULL),
      ('${room}', 1, 3, 200, 1000, true, 'x', NULL), ('${room}', 2, 3, 50, 1000, true, 'x', NULL)`);
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${room}'`);
    await server.arenaPoll(client, cheat, id, Date.now());
    await server.arenaPoll(client, honest, id, Date.now());
    const pts = (u: string) => q(`SELECT points || ':' || streak FROM public.tournament_arena_players WHERE event_id = '${id}' AND user_id = '${u}'`);
    check(pts(cheat) === "0:0" && pts(honest) === "2:1", `the flagged player earns no points; the opponent's result stands as a win (${pts(cheat)}, ${pts(honest)})`);
    const logged = q(`SELECT string_agg(source || ':' || game_idx || ':' || reason, ',') FROM moderation.tournament_flags WHERE event_id = '${id}' AND player_id = '${cheat}'`);
    check(logged === "arena_duel:0:desync" && q(`SELECT count(*) FROM moderation.tournament_flags WHERE event_id = '${id}'`) === "1", `logged once for Joe's review, only the server's flag (${logged})`);
    await server.arenaPoll(client, cheat, id, Date.now());
    check(q(`SELECT count(*) FROM moderation.tournament_flags WHERE event_id = '${id}'`) === "1", "logged once whatever reads it again");
    const board = await server.arenaBoard(client, cheat, id, Date.now());
    check(board?.underReview === true && !board.rows.some((r) => r.userId === cheat), "the flagged player is off the board and sees their result is under review");
    const honestBoard = await server.arenaBoard(client, honest, id, Date.now());
    check(honestBoard?.underReview === false && honestBoard.rows[0]?.userId === honest, "the opponent sees no flag");
    const view = await server.eventFor(client, cheat, id, Date.now());
    check(view?.underReview === true, "the event page says the flagged player's result is under review");
    await server.advanceEvent(client, (await data.readEvent(client, id)).data!, ev.endsAt + 31 * 60_000);
    check(q(`SELECT count(*) FROM public.tournament_results WHERE event_id = '${id}' AND user_id = '${cheat}'`) === "0", "no place for a flagged player");
    check(q(`SELECT user_id FROM public.tournament_results WHERE event_id = '${id}' AND place = 1`) === honest && q(`SELECT count(*) FROM public.tournament_prizes WHERE event_id = '${id}' AND user_id = '${cheat}'`) === "0" && q(`SELECT count(*) FROM public.tournament_trophies WHERE event_id = '${id}' AND user_id = '${cheat}'`) === "0", "no prize or trophy for the flagged player; the honest winner is 1st");
    const cheatBadges = q(`SELECT coalesce(string_agg(badge, ','), '') FROM public.player_badges WHERE user_id = '${cheat}'`);
    check(cheatBadges === "", `no badge for the flagged player (${cheatBadges})`);
    const entries = await server.myEntries(client, cheat);
    check(entries.find((e) => e.eventId === id)?.underReview === true, "the flagged player's entries say under review");
    const queue = q(`SELECT count(*) FROM moderation.tournament_flag_queue()`);
    const flagId = q(`SELECT id FROM moderation.tournament_flags WHERE event_id = '${id}'`);
    check(Number(queue) >= 1 && q(`SELECT moderation.tournament_flag_resolve(${flagId}, 'checked')`) === "resolved" && q(`SELECT moderation.tournament_flag_resolve(${flagId}, 'again')`) === "not_open", "Joe lists flags and closes one with a note");
    check(q(`SELECT count(*) FROM public.tournament_results WHERE event_id = '${id}' AND user_id = '${cheat}'`) === "0", "a resolved flag is never undone into a place");
    const priv = tryQ(`SELECT has_table_privilege('service_role', 'moderation.tournament_flags', 'SELECT')`);
    check(priv.ok && priv.out.trim() === "f", "the flags table is unreachable from the API (the service role included)");

    // A Score Attack: the flagged top scorer scores nothing; the next player is 1st and paid.
    const said = "score_attack:2026-12-09";
    const sev = rules.scheduledEvent(said)!;
    const six = BULK.slice(30, 36);
    for (const [i, u] of six.entries()) {
      credit(u, 50, `flag${i}`);
      await server.enterEvent(client, u, { eventId: said, entry: "coins" }, sev.startsAt - 1000);
    }
    await server.advanceEvent(client, (await data.readEvent(client, said)).data!, sev.startsAt + 1000);
    const room2 = await server.scoreAttackRoom(client, (await data.readEvent(client, said)).data!);
    const { startAttempt } = await import("../src/lib/duel/asyncRoom.server");
    for (const [i, u] of six.entries()) {
      await startAttempt(client, room2, u, { name: `F${i}`, colour: null, icon: null }, sev.startsAt + 2000);
      q(`UPDATE public.async_attempts SET total_score = ${900 - i * 10}, tie_ms = 1000, finished_at = now(), rounds_done = ${config.SCORE_ATTACK_ROUNDS} WHERE room_id = '${room2.id}' AND user_id = '${u}'`);
      q(`INSERT INTO public.async_results (room_id, attempt_id, user_id, round_number, started_at, answered, score, extra)
         SELECT room_id, id, user_id, 1, now(), true, 100, ${i === 0 ? `'{"flagged": true}'` : `'{"flagged": false}'`}::jsonb FROM public.async_attempts WHERE room_id = '${room2.id}' AND user_id = '${u}'`);
    }
    const b = await server.scoreAttackBoard(client, six[0]!, said, sev.startsAt + 5000);
    check(b?.underReview === true && b.me?.total === 0 && b.rows.every((r) => !r.isMe) && b.rows[0]?.total === 890, "a flagged Score Attack scores nothing: off the board, under review");
    await server.advanceEvent(client, (await data.readEvent(client, said)).data!, sev.endsAt + 1000);
    check(q(`SELECT count(*) FROM public.tournament_results WHERE event_id = '${said}' AND user_id = '${six[0]}'`) === "0", "no place for the flagged Score Attack");
    check(q(`SELECT user_id || ':' || coins FROM public.tournament_prizes WHERE event_id = '${said}' AND place = 1`) === `${six[1]}:300`, "the next player is 1st and paid 300");
    check(q(`SELECT string_agg(source || ':' || game_idx, ',') FROM moderation.tournament_flags WHERE event_id = '${said}'`) === "score_attack:0", "the Score Attack flag is logged for Joe's review");
  });

  await section("pairing on W3a's real ratings engine, never recording a rated match", async () => {
    // Back to the real binding: ratingsReady() binds W3a's getMyRatings and finishRatedMatch (ratingsAdapter.server.ts).
    const adapter = await import("../src/lib/rated/ratingsAdapter.server");
    adapter.setRatingsBackend(null);
    const real = await adapter.ratingsReady();
    let recorded = 0;
    adapter.setRatingsBackend({
      ...real,
      matchRating: real.matchRating.bind(real),
      recordRatedMatch: async (result) => {
        recorded++;
        return real.recordRatedMatch(result);
      },
    });
    const w = BULK[20]!, x = BULK[21]!, y = BULK[22]!, z = BULK[23]!;
    // Placed players with real ratings in W3a's tables (Joulz Rating: the Mixed rating the Arena pairs by).
    const rate = (u: string, joulz: number) =>
      q(`INSERT INTO public.rated_profiles (player_id, placement_played, matches, joulz) VALUES ('${u}', 5, 5, ${joulz});
         INSERT INTO public.rated_ratings (player_id, key, rating, rd, volatility, matches, last_at) VALUES
           ('${u}', 'puzzles', ${joulz}, 60, 0.06, 5, now()), ('${u}', 'arcade', ${joulz}, 60, 0.06, 5, now())`);
    rate(w, 1100); rate(x, 1140); rate(y, 1900); rate(z, 1930);
    const realW = await real.matchRating(w, { format: "bo3", choice: "mixed" });
    check(realW !== null && Math.round(realW.rating) === 1100 && realW.placement === false, `W3a's engine answers the stored rating (${JSON.stringify(realW)})`);
    const id = "arena:2026-12-11:1300";
    const ev = rules.scheduledEvent(id)!;
    for (const u of [w, x, y, z]) await server.enterEvent(client, u, { eventId: id, entry: "free" }, ev.startsAt - 60_000);
    await server.advanceEvent(client, (await data.readEvent(client, id)).data!, ev.startsAt + 1000);
    const ratedBefore = q(`SELECT (SELECT count(*) FROM public.rated_matches) || ':' || (SELECT count(*) FROM public.rated_match_players) || ':' || (SELECT string_agg(player_id::text || rating::text, ',' ORDER BY player_id, key) FROM public.rated_ratings) || ':' || (SELECT string_agg(player_id::text || coalesce(joulz::text, '-') || matches, ',' ORDER BY player_id) FROM public.rated_profiles)`);
    const t = Date.now();
    await server.arenaReady(client, w, id, t);
    await server.arenaReady(client, y, id, t + 10);
    const queued = q(`SELECT string_agg(user_id::text || ':' || rating, ',' ORDER BY user_id) FROM public.tournament_arena_queue WHERE event_id = '${id}'`);
    check(queued === [`${w}:1100`, `${y}:1900`].sort().join(","), `the queue holds W3a's ratings (${queued})`);
    const px = await server.arenaReady(client, x, id, t + 20);
    const pz = await server.arenaReady(client, z, id, t + 30);
    check(px.state === "duel" && px.duel.opponent.userId === w && pz.state === "duel" && pz.duel.opponent.userId === y, "paired by W3a's real ratings: 1100 with 1140, 1900 with 1930");
    if (px.state !== "duel" || pz.state !== "duel") return;
    for (const duel of [px.duel, pz.duel]) {
      const row = (await data.readArenaDuel(client, duel.duelId)).data!;
      q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer) VALUES
        ('${row.duel_id}', 1, 1, 150, 1000, true, 'x'), ('${row.duel_id}', 2, 1, 60, 1000, true, 'x'),
        ('${row.duel_id}', 1, 2, 150, 1000, true, 'x'), ('${row.duel_id}', 2, 2, 60, 1000, true, 'x')`);
      q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = 2, phase_started_at = now() WHERE id = '${row.duel_id}'`);
    }
    for (const u of [w, x, y, z]) await server.arenaPoll(client, u, id, Date.now());
    await server.advanceEvent(client, (await data.readEvent(client, id)).data!, ev.endsAt + 31 * 60_000);
    const settled = q(`SELECT count(*) FROM public.tournament_arena_duels WHERE event_id = '${id}' AND status = 'settled'`);
    const ratedAfter = q(`SELECT (SELECT count(*) FROM public.rated_matches) || ':' || (SELECT count(*) FROM public.rated_match_players) || ':' || (SELECT string_agg(player_id::text || rating::text, ',' ORDER BY player_id, key) FROM public.rated_ratings) || ':' || (SELECT string_agg(player_id::text || coalesce(joulz::text, '-') || matches, ',' ORDER BY player_id) FROM public.rated_profiles)`);
    check(settled === "2" && recorded === 0, `both duels settled and the event finished, recordRatedMatch (W3a's finishRatedMatch) never called (${recorded})`);
    check(ratedAfter === ratedBefore && q(`SELECT count(*) FROM public.mm_matches`) === "0", "W3a's tables (rated matches, players, ratings, profiles) and W3b's mm_matches unchanged: no rating moved");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f)) files.push(p);
      }
    };
    walk("src/lib/tournaments");
    const src = files.map((f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")).join("\n");
    check(!/finishRatedMatch|recordRatedMatch|rewards\.server|ratings\.server"/.test(src), "nothing under src/lib/tournaments names finishRatedMatch, recordRatedMatch or W3a's ratings / rewards modules");
    adapter.setRatingsBackend(null);
  });

  await section("reminders", async () => {
    const id = "arena:2026-12-07:1300";
    const ev = rules.scheduledEvent(id)!;
    await server.enterEvent(client, A, { eventId: id, entry: "free" }, ev.startsAt - 3_600_000);
    const r = await server.setReminder(client, B, id, true, ev.startsAt - 3_600_000);
    check(r.ok && r.reminded, "asking for a reminder");
    const off = await server.setReminder(client, A, id, false, ev.startsAt - 3_600_000);
    check(off.reminded === true, "an entry stays reminded");
    const early = await server.runTournamentTick(client, ev.startsAt - 20 * 60_000);
    const due = await server.runTournamentTick(client, ev.startsAt - 5 * 60_000);
    const twice = await server.runTournamentTick(client, ev.startsAt - 4 * 60_000);
    check(early.reminded === 0 && due.reminded === 2 && twice.reminded === 0, `reminders go once, 10 minutes before (${early.reminded}, ${due.reminded}, ${twice.reminded})`);
  });
}
