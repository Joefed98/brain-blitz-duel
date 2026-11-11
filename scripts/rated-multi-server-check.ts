/**
 * rated-multi-server-check (wave 3, W3d; docs/rated/multiplayer.md): a 4-player rated match end to end through W3b's real
 * queue, rooms and settling (src/lib/rated/rated.server.ts with W3d's hooks), against a local PostgreSQL 16 with every
 * migration applied (scripts/server-fn-harness.ts). W3a's ratings are stood in (W3b's `setRatingsBackend` for the queue's
 * rating, the same stand-in, through W3b's adapter, gets the placings result). No browser (~10 s).
 *
 * It proves: ffa4 off is refused by the server; a placement player can't queue for 4 or 8; four testers within the band
 * make one live match (one ordinary started room, all four seated, the same deals, nobody else); three never start one
 * (recorded seats are parked), even after 15 s; settling sends W3a one placings match exactly once under racing calls,
 * with the final placings from the stored scores (points, then total score); every player's run joins the pool; the
 * start and finish events.
 */
import {
  ANON_KEY,
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
  if (/^\s*(FAIL|NOTE)|^rated-multi-server-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
};

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = uid(21);
const B = uid(22);
const C = uid(23);
const D = uid(24);
const E = uid(25); // in placement
const F = uid(26);
const G = uid(27);
const H = uid(28);

let db: LocalDb | null = null;
let rest: RestServer | null = null;

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log("rated-multi-server-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL");
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: not run (CI runs it)");
  console.log("rated-multi-server-check: skipped locally");
  process.exit(0);
}

try {
  db = startLocalDb("rated-multi-server-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  await installServerFnPlugin();
  await runAll(db);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`rated-multi-server-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: 4-player rated matches through W3b's queue, rooms and settling on a real database.");
process.exit(0);

async function runAll(db: LocalDb): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const rated = await import("../src/lib/rated/rated.server");
  const { RATED_SWITCHES } = await import("../src/lib/rated/matchmaking");
  const { setRatingsBackend } = await import("../src/lib/rated/ratingsAdapter.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  type W3aResult = import("../src/lib/data/ratings").RatedMatchResult;
  const client = await adminDb();

  const ALL = [A, B, C, D, E, F, G, H];
  q(`INSERT INTO auth.users (id) VALUES ${ALL.map((u) => `('${u}')`).join(", ")}`);
  q(`SET session_replication_role = replica; INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth, player_number) VALUES
    ${ALL.map((u, i) => `('${u}', 'Multi${i}', 'multi${i}', ${i}, DATE '1990-01-01', ${i + 40})`).join(", ")}`);
  if (q(`SELECT to_regclass('shop.testers') IS NULL`) === "t")
    q(`CREATE SCHEMA IF NOT EXISTS shop; CREATE TABLE shop.testers (user_id uuid PRIMARY KEY, note text NOT NULL DEFAULT '')`);
  q(`INSERT INTO shop.testers (user_id, note) SELECT u, 'rated-multi-server-check' FROM unnest(ARRAY[${ALL.map((u) => `'${u}'`).join(",")}]::uuid[]) AS u ON CONFLICT DO NOTHING`);

  const RATING: Record<string, number> = { [A]: 1000, [B]: 1010, [C]: 1020, [D]: 1030, [E]: 1000, [F]: 1500, [G]: 1510, [H]: 1520 };
  const sent: W3aResult[] = [];
  setRatingsBackend({
    matchRating: async (userId) => (RATING[userId] === undefined ? null : { rating: RATING[userId]!, placement: userId === E }),
    // W3a's recordRatedMatch stand-in, reached through W3b's adapter for 4 and 8 players too.
    recordRatedMatch: async (result) => {
      await new Promise((r) => setTimeout(r, 20));
      const duplicate = sent.some((s) => s.matchId === result.matchId);
      if (!duplicate) sent.push(result);
      return { ok: true, status: duplicate ? "duplicate" : "recorded", matchId: result.matchId, players: [] };
    },
    startingRating: 1000,
    beginnerMax: 1000,
  });
  const ON = { ...RATED_SWITCHES, formats: { ...RATED_SWITCHES.formats, ffa4: true } };
  const T0 = Date.now();
  let matchId = "";
  let roomId = "";

  await section("switches", async () => {
    const off = await rated.joinQueue(client, A, { format: "ffa4", choice: "mixed" }, T0);
    check(off.ok === false && off.reason === "option", "ffa4 off at launch: the server refuses the join");
    const eight = await rated.joinQueue(client, A, { format: "ffa8", choice: "mixed" }, T0, ON);
    check(eight.ok === false && eight.reason === "option", "ffa8 stays off when only ffa4 is on");
    const placement = await rated.joinQueue(client, E, { format: "ffa4", choice: "mixed" }, T0, ON);
    check(placement.ok === false && placement.reason === "option", "a placement player can't queue for 4 players");
    check(q(`SELECT count(*) FROM public.mm_queue`) === "0", "nothing queued by a refused join");
  });

  await section("filling", async () => {
    for (const u of [F, G, H]) await rated.joinQueue(client, u, { format: "ffa4", choice: "mixed" }, T0, ON);
    const short = await rated.pollQueue(client, F, T0 + 30_000);
    check(short.state === "searching", "three players never start a 4-player match, even after 15 s (recorded seats parked)");
    for (const u of [F, G, H]) await rated.leaveQueue(client, u);
    for (const u of [A, B, C]) await rated.joinQueue(client, u, { format: "ffa4", choice: "mixed" }, T0, ON);
    await rated.joinQueue(client, D, { format: "ffa4", choice: "puzzles" }, T0, ON);
    const crossChoice = await rated.pollQueue(client, A, T0 + 1_000);
    check(crossChoice.state === "searching", "no group across choices");
    await rated.leaveQueue(client, D);
    await rated.joinQueue(client, D, { format: "ffa4", choice: "mixed" }, T0, ON);
    const narrow = await rated.pollQueue(client, A, T0 + 500);
    check(narrow.state === "found" && narrow.match.kind === "live", "four players within ±50 make one live match");
    if (narrow.state !== "found") return;
    matchId = narrow.match.matchId;
    roomId = narrow.match.roomId!;
    for (const u of [B, C, D]) {
      const p = await rated.pollQueue(client, u, T0 + 600);
      check(p.state === "found" && p.match.matchId === matchId, `player ${u.slice(-2)} finds the same match`);
    }
    check(q(`SELECT count(*) FROM public.mm_matches`) === "1" && q(`SELECT count(*) FROM public.mm_queue`) === "0", "one match; every search cleared");
    const seated = q(`SELECT count(*) FROM public.duel_players WHERE duel_id = '${roomId}'`);
    check(seated === "4", `all four seated in one room, the same deals (${seated})`);
    const room = q(`SELECT status || ',' || round_count FROM public.duels WHERE id = '${roomId}'`);
    check(room === "in_progress,3", `an ordinary started room of three games (${room})`);
    check(q(`SELECT format FROM public.mm_matches WHERE id = '${matchId}'`) === "ffa4", "the match is stored as ffa4");
  });

  await section("settling", async () => {
    if (!roomId) return;
    const early = await rated.settleMatch(client, matchId, Date.now());
    check(early.state === "playing" && sent.length === 0, "nothing settles while the room plays");
    // Game 1: slot 1 150, 2 100, 3 100, 4 0. Game 2: 4 200, 3 150, 2 50, 1 0. Game 3: 2 180, 1 120, 4 60, 3 10.
    const scores = [
      [150, 100, 100, 0],
      [0, 50, 150, 200],
      [120, 180, 10, 60],
    ];
    const rows = scores.flatMap((g, r) => g.map((s, i) => `('${roomId}', ${i + 1}, ${r + 1}, ${s}, 1000, true, 'x')`));
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer) VALUES ${rows.join(", ")}`);
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', phase_started_at = now() WHERE id = '${roomId}'`);
    const settles = await Promise.all([1, 2, 3, 4].map(() => rated.settleMatch(client, matchId, Date.now())));
    check(sent.length === 1, `W3a's recordRatedMatch sent once (${sent.length})`);
    const r = sent[0];
    check(!!r && r.format.kind === "placings" && r.format.kind === "placings" && r.format.players === 4, "a placings match of 4");
    // Points: g1 places 1, 2=, 2=, 4 → 5, 3, 3, 0; g2 → 0, 1, 3, 5; g3 → 3, 5, 0, 1. Totals: 8, 9, 6, 6; scores 270, 330, 260, 260.
    const slotUser = q(`SELECT string_agg(user_id::text, ',' ORDER BY player_slot) FROM public.duel_players WHERE duel_id = '${roomId}'`).split(",");
    const places = slotUser.map((u) => r?.placings?.[u]);
    check(JSON.stringify(places) === "[2,1,3,3]", `the final placings by points then total score, level shared (${JSON.stringify(places)})`);
    check(!!r && r.games.length === 3 && r.games.every((g) => Object.keys(g.scores).length === 4 && g.version === "classic"), "every game with every player's stored score");
    check(!!r && r.players.every((p) => p.side === "live"), "every seat live");
    check(q(`SELECT status FROM public.mm_matches WHERE id = '${matchId}'`) === "settled", "the match is settled");
    check(q(`SELECT count(*) FROM public.mm_runs WHERE match_id = '${matchId}'`) === "4", "all four runs join the recorded-run pool (the source for recorded seats)");
    const settled = settles.find((x) => x.state === "settled");
    check(settled?.state === "settled" && settled.result.ratings?.ok === true && JSON.stringify(slotUser.map((u) => settled.result.placings?.[u])) === "[2,1,3,3]", "W3b's settlement carries the placings and W3a's answer (for the result screens)");
    check(settled?.state === "settled" && settled.result.players.length === 4 && settled.result.players.every((p) => p.scores.length === 3), "the settlement has every player's stored scores");
    const again = await rated.settleMatch(client, matchId, Date.now());
    check(again.state === "settled" && sent.length === 1, "a later settle sends nothing more");
  });

  await section("events", async () => {
    await flushAnalytics();
    const count = (e: string) => Number(q(`SELECT count(*) FROM analytics.events WHERE event = '${e}'`));
    check(count("multiplayer_match_started") === 1, "multiplayer_match_started once");
    check(q(`SELECT props->>'size' || ',' || (props->>'live_seats') || ',' || (props->>'recorded_seats') FROM analytics.events WHERE event = 'multiplayer_match_started'`) === "4,4,0", "with size 4, 4 live seats, 0 recorded");
    check(count("multiplayer_match_finished") === 4, "multiplayer_match_finished for each of the four");
    check(q(`SELECT string_agg(props->>'placing', ',' ORDER BY (props->>'placing')::int) FROM analytics.events WHERE event = 'multiplayer_match_finished'`) === "1,2,3,3", "with each placing");
  });
}
