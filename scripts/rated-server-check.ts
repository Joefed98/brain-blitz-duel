/**
 * rated-server-check (wave 3, W3b; docs/rated/matchmaking-interface.md): rated matchmaking end to end, through the real
 * server functions and server code, against a local PostgreSQL 16 with every migration applied
 * (scripts/server-fn-harness.ts). W3a's ratings are stood in through `setRatingsBackend`. No browser (~20 s).
 *
 * What it proves:
 * - only testers (shop.testers) can queue while rated play is testers-only; guests can't; switched-off formats and
 *   choices are refused by the server; queue joins are rate limited; a player in a match can't queue again;
 * - the queue: no pair across choices, no pair outside the band, a pair once the band has widened, one match for both,
 *   a recorded run from 8 s (never before);
 * - live matches run on the rooms engine: an ordinary started room, both players in it, nobody else can join, Play
 *   again refused;
 * - the opponent's live score: shown during the game, hidden for the final 20 %, the stored score on the game's result;
 * - settling: nothing while the room plays; recordRatedMatch called exactly once under racing calls; the result from the
 *   stored scores; both players' runs join the pool;
 * - rematch: both within 8 s make one new rated match (rematchOf set, counted like any other); later, closed;
 * - recorded runs: the live player is dealt exactly the run's puzzles; never their own; never the same owner twice in a
 *   row; 5 uses a day; the fallback (a room's run) only when no rated run fits, its owner never moving; placement
 *   plays a beginner's run at once; playback never ahead of the run;
 * - rated chat: quick phrases only for an under-18; adults type;
 * - the four analytics events.
 */
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
  if (/^\s*(FAIL|NOTE)|^rated-server-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
};

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ALI = uid(1);
const BO = uid(2);
const CY = uid(3);
const DEE = uid(4); // a room player whose run is the fallback
const KID = uid(5); // 15 years old
const GUEST = uid(6); // no profile
const NOTEST = uid(7); // an account, not a tester
const PAL = uid(8); // in placement
const EVE = uid(9);

let db: LocalDb | null = null;
let rest: RestServer | null = null;

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log("rated-server-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL");
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: not run (CI runs it)");
  console.log("rated-server-check: skipped locally");
  process.exit(0);
}

try {
  db = startLocalDb("rated-server-check-");
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
console.log(`rated-server-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: rated queue, live and recorded matches, the hidden finish, settling once, rematch, chat and events on a real database.");
process.exit(0);

async function runAll(db: LocalDb): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const fns = await import("../src/lib/rated/rated.functions");
  const rated = await import("../src/lib/rated/rated.server");
  const { setRatingsBackend } = await import("../src/lib/rated/ratingsAdapter.server");
  const duel = await import("../src/lib/duel/duel.functions");
  const chat = await import("../src/lib/duel/chat.functions");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { puzzleTimeLimitMs } = await import("../src/lib/duel/catalogue");
  const client = await adminDb();
  const call = callServerFn;

  // Users, accounts (KID 15 today), and the tester list (D1's shop.testers, made here when D1 isn't merged in).
  q(`INSERT INTO auth.users (id) VALUES ${[ALI, BO, CY, DEE, KID, GUEST, NOTEST, PAL, EVE].map((u) => `('${u}')`).join(", ")}`);
  const profile = (id: string, name: string, n: number, dob: string) =>
    `('${id}', '${name}', '${name.toLowerCase()}', ${n % 32}, DATE '${dob}', ${n + 10})`;
  q(`SET session_replication_role = replica; INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth, player_number) VALUES
    ${profile(ALI, "Ali", 1, "1990-01-01")}, ${profile(BO, "Bo_B", 2, "1991-01-01")}, ${profile(CY, "Cyan", 3, "1992-01-01")},
    ${profile(DEE, "Dee_D", 4, "1993-01-01")}, ${profile(KID, "Kiddo", 5, "2011-06-01")}, ${profile(NOTEST, "Nota", 7, "1994-01-01")},
    ${profile(PAL, "Pally", 8, "1995-01-01")}, ${profile(EVE, "Evie", 9, "1996-01-01")}`);
  if (q(`SELECT to_regclass('shop.testers') IS NULL`) === "t")
    q(`CREATE SCHEMA IF NOT EXISTS shop; CREATE TABLE shop.testers (user_id uuid PRIMARY KEY, note text NOT NULL DEFAULT '')`);
  q(`INSERT INTO shop.testers (user_id, note) SELECT u, 'rated-server-check' FROM unnest(ARRAY['${ALI}','${BO}','${CY}','${DEE}','${KID}','${PAL}','${EVE}']::uuid[]) AS u ON CONFLICT DO NOTHING`);

  // W3a stand-in: fixed ratings, every recordRatedMatch call kept.
  const RATING: Record<string, number> = { [ALI]: 1000, [BO]: 1120, [CY]: 1100, [DEE]: 900, [KID]: 1000, [PAL]: 1000, [EVE]: 1500 };
  const recordedCalls: import("../src/lib/data/ratings").RatedMatchResult[] = [];
  setRatingsBackend({
    matchRating: async (userId) => (RATING[userId] === undefined ? null : { rating: RATING[userId]!, placement: userId === PAL }),
    recordRatedMatch: async (result) => {
      await new Promise((r) => setTimeout(r, 20));
      recordedCalls.push(result);
      return { ok: true, status: "recorded", matchId: result.matchId, players: [] };
    },
    startingRating: 1000,
    beginnerMax: 1000,
  });
  const callFor = (matchId: string) => recordedCalls.filter((c) => c.matchId === matchId);

  const T0 = Date.now();
  let liveMatchId = "";
  let liveRoomId = "";

  await section("gating", async () => {
    const guest = await call(fns.ratedQueueJoinFn, { format: "bo3", choice: "mixed" }, userToken(GUEST));
    check(guest.ok === false && guest.reason === "account", "a guest can't queue (account needed)");
    const notTester = await call(fns.ratedQueueJoinFn, { format: "bo3", choice: "mixed" }, userToken(NOTEST));
    check(notTester.ok === false && notTester.reason === "closed", "a non-tester can't queue while rated play is testers-only");
    const status = await call(fns.ratedStatusFn, {}, userToken(NOTEST));
    check(status.open === false && status.options.formats.length === 0, "a non-tester's status: closed, nothing offered");
    const bo5 = await call(fns.ratedQueueJoinFn, { format: "bo5", choice: "mixed" }, userToken(ALI));
    const word = await call(fns.ratedQueueJoinFn, { format: "bo3", choice: "word" }, userToken(ALI));
    const ffa = await call(fns.ratedQueueJoinFn, { format: "ffa8", choice: "mixed" }, userToken(ALI));
    check(bo5.reason === "option" && word.reason === "option" && ffa.reason === "option", "switched-off formats and choices are refused by the server");
    check(q(`SELECT count(*) FROM public.rated_queue`) === "0", "nothing was queued by a refused join");
    const tester = await call(fns.ratedStatusFn, {}, userToken(ALI));
    check(tester.open === true && tester.options.formats.join(",") === "bo3", "a tester's status: open, best of 3 offered");
  });

  await section("queue and live match", async () => {
    await rated.joinQueue(client, ALI, { format: "bo3", choice: "mixed" }, T0);
    await rated.joinQueue(client, BO, { format: "bo3", choice: "arcade" }, T0);
    const p1 = await rated.pollQueue(client, ALI, T0 + 500);
    check(p1.state === "searching" && p1.band === 50, "no pair across choices");
    await rated.leaveQueue(client, BO);
    await rated.joinQueue(client, BO, { format: "bo3", choice: "mixed" }, T0);
    const p2 = await rated.pollQueue(client, ALI, T0 + 1_000);
    check(p2.state === "searching", "no pair outside ±50 (1000 v 1120) at 1 s");
    const p3 = await rated.pollQueue(client, ALI, T0 + 3_000);
    check(p3.state === "searching", "no pair at ±100 (2 s)");
    const p4 = await rated.pollQueue(client, ALI, T0 + 4_100);
    check(p4.state === "found" && p4.match.kind === "live", "paired once the band reached ±150 (4 s)");
    if (p4.state !== "found") return;
    liveMatchId = p4.match.matchId;
    liveRoomId = p4.match.roomId!;
    const pBo = await rated.pollQueue(client, BO, T0 + 4_200);
    check(pBo.state === "found" && pBo.match.matchId === liveMatchId, "the partner finds the same match");
    check(q(`SELECT count(*) FROM public.rated_matches`) === "1" && q(`SELECT count(*) FROM public.rated_queue`) === "0", "one match; both searches cleared");
    const room = q(`SELECT status || ',' || phase || ',' || round_count || ',' || jsonb_array_length(puzzles_public) FROM public.duels WHERE id = '${liveRoomId}'`);
    check(room === "in_progress,starting,3,3", `an ordinary room, already started, three games (${room})`);
    const seated = q(`SELECT string_agg(user_id::text || ':' || player_slot, ',' ORDER BY player_slot) FROM public.duel_players WHERE duel_id = '${liveRoomId}'`);
    check(seated === `${ALI}:1,${BO}:2`, "both players seated in the one room (the same deals)");
    check(q(`SELECT count(*) FROM public.duel_secrets WHERE duel_id = '${liveRoomId}'`) === "1", "the answers stay server-side (duel_secrets)");
    const code = q(`SELECT room_code FROM public.duels WHERE id = '${liveRoomId}'`);
    const join = await call(duel.joinRoomFn, { roomCode: code, displayName: "Cy" }, userToken(CY));
    check(join.ok === false, "nobody else can join a rated room by its code");
    const again = await rated.joinQueue(client, ALI, { format: "bo3", choice: "mixed" }, T0 + 5_000);
    check(again.ok === false && again.reason === "in_match", "a player in a match can't queue again");
    const view = await call(fns.ratedMatchFn, { matchId: liveMatchId }, userToken(CY));
    check(view === null, "a match's view only for its players");
  });

  await section("live score and the hidden finish", async () => {
    if (!liveRoomId) return;
    const pub = JSON.parse(q(`SELECT puzzles_public->0 FROM public.duels WHERE id = '${liveRoomId}'`));
    const limit = puzzleTimeLimitMs(pub);
    const at = (ms: number) => new Date(Date.now() - ms).toISOString();
    q(`UPDATE public.duels SET phase = 'puzzle', phase_started_at = '${at(5_000)}' WHERE id = '${liveRoomId}'`);
    const sent = await call(fns.ratedProgressFn, { matchId: liveMatchId, round: 1, score: 77 }, userToken(ALI));
    const wrongRound = await call(fns.ratedProgressFn, { matchId: liveMatchId, round: 2, score: 150 }, userToken(ALI));
    check(sent.ok === true && wrongRound.ok === false, "live progress: only for the game being played");
    const seen = await call(fns.ratedOpponentScoreFn, { matchId: liveMatchId }, userToken(BO));
    check(seen?.score === 77 && seen.hidden === false, "the opponent's live score is shown during the game");
    q(`UPDATE public.duels SET phase_started_at = '${at(Math.ceil(limit * 0.8) + 200)}' WHERE id = '${liveRoomId}'`);
    const hidden = await call(fns.ratedOpponentScoreFn, { matchId: liveMatchId }, userToken(BO));
    check(hidden?.hidden === true && hidden.score === null, "hidden for the final 20 % of the game");
    q(`UPDATE public.duels SET phase_started_at = '${at(Math.floor(limit * 0.8) - 1_500)}' WHERE id = '${liveRoomId}'`);
    const justBefore = await call(fns.ratedOpponentScoreFn, { matchId: liveMatchId }, userToken(BO));
    check(justBefore?.hidden === false, "still shown just before the final 20 %");
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer) VALUES ('${liveRoomId}', 1, 1, 99, 1000, true, 'x')`);
    q(`UPDATE public.duels SET phase = 'reveal', phase_started_at = now() WHERE id = '${liveRoomId}'`);
    const revealed = await call(fns.ratedOpponentScoreFn, { matchId: liveMatchId }, userToken(BO));
    check(revealed?.score === 99 && revealed.hidden === false, "revealed with the game's result: the stored score");
  });

  await section("settling once", async () => {
    if (!liveRoomId) return;
    const early = await rated.settleMatch(client, liveMatchId, Date.now());
    check(early.state === "playing" && recordedCalls.length === 0, "nothing settles while the room plays");
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer) VALUES
       ('${liveRoomId}', 2, 1, 140, 1000, true, 'x'), ('${liveRoomId}', 1, 2, 150, 2000, true, 'x'), ('${liveRoomId}', 2, 2, 60, 2000, true, 'x'),
       ('${liveRoomId}', 1, 3, 120, 3000, true, 'x'), ('${liveRoomId}', 2, 3, 110, 3000, true, 'x')`);
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', phase_started_at = now() WHERE id = '${liveRoomId}'`);
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => rated.settleMatch(client, liveMatchId, Date.now())));
    const viaFn = await call(fns.ratedSettleFn, { matchId: liveMatchId }, userToken(BO));
    check(callFor(liveMatchId).length === 1, `recordRatedMatch called exactly once (${recordedCalls.length})`);
    const sent = callFor(liveMatchId)[0];
    const { poolAndCategory } = await import("../src/lib/rated/ratingsAdapter.server");
    const { gameVersionOf } = await import("../src/lib/rated/matchmaking");
    const pubs = JSON.parse(q(`SELECT puzzles_public FROM public.duels WHERE id = '${liveRoomId}'`)) as { type: string }[];
    check(
      !!sent && sent.format.kind === "duel" && sent.format.kind === "duel" && (sent.format as { bestOf: number }).bestOf === 3 && sent.choice === "mixed" &&
        sent.players.map((p) => `${p.playerId}:${p.side}`).join(",") === `${ALI}:live,${BO}:live`,
      "W3a gets the match: best of 3, Mixed, both players live",
    );
    check(
      !!sent && sent.games.length === 3 && sent.games.every((g, i) => g.type === pubs[i]!.type && g.version === "classic" && g.signature === gameVersionOf(pubs[i]!) &&
        g.pool === poolAndCategory(g.type)?.pool && g.category === poolAndCategory(g.type)?.category) &&
        sent.games.map((g) => `${g.scores[ALI]}-${g.scores[BO]}`).join(",") === "99-140,150-60,120-110",
      `W3a gets each game's type, pool, category, Classic version, signature and the stored scores (${sent?.games.map((g) => `${g.scores[ALI]}-${g.scores[BO]}`)})`,
    );
    const settled = results.find((r) => r.state === "settled") ?? viaFn;
    check(settled.state === "settled" && settled.result.winner === "a" && settled.result.players[0]!.gamesWon === 2 && settled.result.players[1]!.gamesWon === 1 && settled.result.ratings?.ok === true, "the result from the stored scores: Ali 2–1, W3a's answer kept");
    check(viaFn.state === "settled", "a later settle answers the stored result");
    check(q(`SELECT status FROM public.rated_matches WHERE id = '${liveMatchId}'`) === "settled", "the match is settled");
    check(q(`SELECT count(*) FROM public.rated_runs WHERE match_id = '${liveMatchId}'`) === "2", "both players' runs join the recorded-run pool");
    const play = await call(duel.rematchFn, { roomId: liveRoomId }, userToken(ALI));
    check(play.ok === false, "Play again is refused in a rated room");
  });

  await section("rematch", async () => {
    if (!liveRoomId) return;
    const finished = Date.parse(q(`SELECT to_char(phase_started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM public.duels WHERE id = '${liveRoomId}'`));
    const one = await rated.requestRematch(client, ALI, liveMatchId, finished + 2_000);
    check(one.state === "waiting", "one accept: waiting");
    const both = await rated.requestRematch(client, BO, liveMatchId, finished + 3_000);
    check(both.state === "agreed" && both.match.rematchOf === liveMatchId && both.match.kind === "live", "both within 8 s: a new rated match");
    const again = await rated.requestRematch(client, ALI, liveMatchId, finished + 3_500);
    check(again.state === "agreed" && both.state === "agreed" && again.match.matchId === both.match.matchId, "the rematch is made once");
    check(q(`SELECT count(*) FROM public.rated_matches WHERE rematch_of = '${liveMatchId}'`) === "1", "exactly one rematch row");
    if (both.state !== "agreed") return;
    // Finish the rematch at once and settle it: it is a rated match like any other (W3a counts it).
    const rid = both.match.roomId!;
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', phase_started_at = now() - interval '20 seconds' WHERE id = '${rid}'`);
    const s = await rated.settleMatch(client, both.match.matchId, Date.now());
    check(s.state === "settled" && s.result.rematchOf === liveMatchId && callFor(both.match.matchId)[0]?.rematchOf === liveMatchId,
      "the rematch settles through recordRatedMatch with rematchOf (W3a's 4-a-day rule counts it like any other)");
    const late = await rated.requestRematch(client, ALI, both.match.matchId, Date.now());
    check(late.state === "closed", "a rematch after 8 s is closed");
  });

  await section("recorded runs", async () => {
    const t = Date.now();
    await rated.joinQueue(client, CY, { format: "bo3", choice: "mixed" }, t);
    const early = await rated.pollQueue(client, CY, t + 7_900);
    check(early.state === "searching", "no recorded run before 8 s");
    const found = await rated.pollQueue(client, CY, t + 8_000);
    check(found.state === "found" && found.match.kind === "recorded", "a recorded run at 8 s");
    if (found.state !== "found") return;
    const m = found.match;
    check(m.recorded !== null && m.recorded.ownerId !== CY && /^Recorded run · /.test(m.recorded.label), `labelled with its real age, never one's own (${m.recorded?.label})`);
    const key = q(`SELECT recorded_key FROM public.rated_matches WHERE id = '${m.matchId}'`);
    const src = q(`SELECT duel_id FROM public.rated_runs WHERE key = '${key}'`);
    const same = q(`SELECT (a.puzzles_public = b.puzzles_public)::text || ',' || (sa.puzzles_private = sb.puzzles_private)::text FROM public.duels a, public.duels b, public.duel_secrets sa, public.duel_secrets sb
       WHERE a.id = '${m.roomId}' AND b.id = '${src}' AND sa.duel_id = a.id AND sb.duel_id = b.id`);
    check(same === "true,true", "the live player is dealt exactly the recorded run's games and deals");
    check(q(`SELECT count(*) FROM public.rated_run_uses WHERE run_key = '${key}'`) === "1", "the use is counted");
    // Playback: never ahead of the run (the stored games' timelines, or nothing).
    const games = JSON.parse(q(`SELECT recorded_games->'games' FROM public.rated_matches WHERE id = '${m.matchId}'`)) as { score: number; timeline: [number, number][] | null }[];
    q(`UPDATE public.duels SET phase = 'puzzle', phase_started_at = now() - interval '3 seconds' WHERE id = '${m.roomId}'`);
    const view = await call(fns.ratedOpponentScoreFn, { matchId: m.matchId }, userToken(CY));
    const g0 = games[0]!;
    const allowed = g0.timeline ? g0.timeline.filter(([ms]) => ms <= 3_500).map(([, s]) => s) : [];
    check(view !== null && (g0.timeline ? view.score === null || allowed.includes(view.score!) || view.score === 0 : view.score === null), "playback shows only what the run had reached (nothing without a timeline)");
    // Finish it; the owner of the last recorded opponent is skipped next time.
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', phase_started_at = now() WHERE id = '${m.roomId}'`);
    const s = await rated.settleMatch(client, m.matchId, Date.now());
    const rec = callFor(m.matchId)[0]?.players[1];
    check(s.state === "settled" && s.result.kind === "recorded" && rec?.side === "recorded" && rec.run.source === "rated" && rec.run.runId === key && rec.run.ownerId === rec.playerId,
      "a recorded match settles; W3a gets the run (rated source: its owner moves at most half, W3a's rule)");
    const firstOwner = m.recorded!.ownerId;
    await rated.joinQueue(client, CY, { format: "bo3", choice: "mixed" }, t + 20_000);
    const second = await rated.pollQueue(client, CY, t + 28_500);
    check(second.state === "found" && second.match.kind === "recorded" && second.match.recorded!.ownerId !== firstOwner, "never the same player twice in a row");
    if (second.state === "found") {
      q(`UPDATE public.duels SET status = 'finished', phase = 'finished', phase_started_at = now() WHERE id = '${second.match.roomId}'`);
      await rated.settleMatch(client, second.match.matchId, Date.now());
    }
    // The 5-a-day cap: every rated run used up today, then no rated run can be chosen.
    q(`INSERT INTO public.rated_run_uses (run_key, viewer_id, match_id) SELECT r.key, '${DEE}', r.match_id FROM public.rated_runs r, generate_series(1, 5)`);
    await rated.joinQueue(client, EVE, { format: "bo3", choice: "mixed" }, t + 40_000);
    const capped = await rated.pollQueue(client, EVE, t + 48_100);
    check(capped.state === "searching", "a run used 5 times today is not played against again (none left: still searching)");
    await rated.leaveQueue(client, EVE);
  });

  await section("fallback and placement", async () => {
    // A finished ordinary room with Dee's server-graded results: the only run that fits All puzzles.
    const made = await call(duel.createRoomFn, { displayName: "Dee" }, userToken(DEE));
    await call(duel.joinRoomFn, { roomCode: made.roomCode, displayName: "Eve" }, userToken(EVE));
    q(`UPDATE public.duels SET selected_categories = '["word","number","speed","attention","pattern","logic","rounds:6"]'::jsonb WHERE id = '${made.roomId}'`);
    const started = await call(duel.startRoomFn, { roomId: made.roomId }, userToken(DEE));
    check(started.ok === true, "an ordinary puzzles room starts");
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer)
       SELECT '${made.roomId}', s, r, 100 + r, 1500, true, 'x' FROM generate_series(1, 2) s, generate_series(1, 6) r`);
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', phase_started_at = now() WHERE id = '${made.roomId}'`);
    const t = Date.now();
    await rated.joinQueue(client, KID, { format: "bo3", choice: "puzzles" }, t);
    const fb = await rated.pollQueue(client, KID, t + 8_000);
    check(fb.state === "found" && fb.match.kind === "recorded" && fb.match.recorded?.fallback === true, "no rated run fits: the fallback (a room's server-graded run)");
    if (fb.state === "found") {
      const fbKey = q(`SELECT recorded_key FROM public.rated_matches WHERE id = '${fb.match.matchId}'`);
      check(/^room:/.test(fbKey), `the fallback is a room run (${fbKey})`);
      const firstThree = q(`SELECT (a.puzzles_public = (SELECT jsonb_agg(e ORDER BY i) FROM jsonb_array_elements(b.puzzles_public) WITH ORDINALITY AS x(e, i) WHERE i <= 3))::text
         FROM public.duels a, public.duels b WHERE a.id = '${fb.match.roomId}' AND b.id = '${made.roomId}'`);
      check(firstThree === "true", "the fallback deals exactly the room's first three games");
      // Chat in a rated room: an under-18 picks quick phrases only.
      const free = await call(chat.sendRoomMessageFn, { roomId: fb.match.roomId, text: "add me on insta" }, userToken(KID));
      const phrase = await call(chat.sendRoomMessageFn, { roomId: fb.match.roomId, text: "gg" }, userToken(KID));
      check(free.ok === false && phrase.ok === true, "rated chat: an under-18's free text refused, a quick phrase sent");
      check(q(`SELECT string_agg(text, '|') FROM public.room_messages WHERE duel_id = '${fb.match.roomId}'`) === "Good game!", "rated chat: the phrase is stored as its text");
      q(`UPDATE public.duels SET status = 'finished', phase = 'finished', phase_started_at = now() WHERE id = '${fb.match.roomId}'`);
      const s = await rated.settleMatch(client, fb.match.matchId, Date.now());
      const fbRec = callFor(fb.match.matchId)[0]?.players[1];
      check(s.state === "settled" && s.result.recorded?.fallback === true && fbRec?.side === "recorded" && fbRec.run.source === "room" && fbRec.playerId === DEE,
        "the fallback's run goes to W3a as a room run (its owner never moves, W3a's rule)");
    }
    // Placement: straight to a beginner's recorded run, never the live queue.
    q(`DELETE FROM public.rated_run_uses`);
    const tp = Date.now();
    await rated.joinQueue(client, PAL, { format: "bo3", choice: "mixed" }, tp);
    const pl = await rated.pollQueue(client, PAL, tp + 100);
    check(pl.state === "found" && pl.match.kind === "recorded", "placement: a recorded run at once");
    if (pl.state === "found") {
      const rating = q(`SELECT coalesce(recorded_owner_rating, -1) FROM public.rated_matches WHERE id = '${pl.match.matchId}'`);
      check(Number(rating) <= 1000, `placement: a beginner's run (owner rating ${rating})`);
    }
  });

  await section("adult chat", async () => {
    if (!liveRoomId) return;
    const typed = await call(chat.sendRoomMessageFn, { roomId: liveRoomId, text: "good game mate" }, userToken(ALI));
    check(typed.ok === true, "rated chat: an adult with an account types");
  });

  await section("rate limit", async () => {
    let refused = false;
    for (let i = 0; i < 32 && !refused; i++) {
      const r = await rated.joinQueue(client, EVE, { format: "bo3", choice: "arcade" }, Date.now());
      if (!r.ok && r.reason === "rate_limit") refused = true;
    }
    check(refused, "queue joins are rate limited");
    await rated.leaveQueue(client, EVE);
  });

  await section("analytics", async () => {
    await flushAnalytics();
    const count = (e: string, extra = "") => Number(q(`SELECT count(*) FROM analytics.events WHERE event = '${e}'${extra}`));
    check(count("queue_joined", ` AND props->>'format' = 'bo3' AND props->>'choice' = 'mixed'`) >= 2, "queue_joined (format, choice)");
    check(count("match_found", ` AND props->>'kind' = 'live' AND (props->>'waited_s')::numeric >= 4`) >= 1 && count("match_found", ` AND props->>'kind' = 'recorded'`) >= 1, "match_found (live or recorded, seconds waited)");
    check(count("rematch_requested") === 2 && count("rematch_accepted") === 1, "rematch_requested twice, rematch_accepted once");
  });
}
