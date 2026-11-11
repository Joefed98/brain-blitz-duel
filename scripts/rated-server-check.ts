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
 * - head to head: wins, losses and draws between two players in settled live matches only, from each side; recorded
 *   and flagged matches left out; a room id answers its rated match (id, format) for its players only;
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
const PRA = uid(10); // practice runs
const VIE = uid(11); // plays against them
const X1 = uid(12);
const X2 = uid(13);
const Z1 = uid(14);
const Z2 = uid(15);
const F1 = uid(16); // flagged by the server's replay
const F2 = uid(17);
const H1 = uid(18); // head to head
const H2 = uid(19);

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
  q(`INSERT INTO auth.users (id) VALUES ${[ALI, BO, CY, DEE, KID, GUEST, NOTEST, PAL, EVE, PRA, VIE, X1, X2, Z1, Z2, F1, F2].map((u) => `('${u}')`).join(", ")}`);
  const profile = (id: string, name: string, n: number, dob: string) =>
    `('${id}', '${name}', '${name.toLowerCase()}', ${n % 32}, DATE '${dob}', ${n + 10})`;
  q(`SET session_replication_role = replica; INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth, player_number) VALUES
    ${profile(ALI, "Ali", 1, "1990-01-01")}, ${profile(BO, "Bo_B", 2, "1991-01-01")}, ${profile(CY, "Cyan", 3, "1992-01-01")},
    ${profile(DEE, "Dee_D", 4, "1993-01-01")}, ${profile(KID, "Kiddo", 5, "2011-06-01")}, ${profile(NOTEST, "Nota", 7, "1994-01-01")},
    ${profile(PAL, "Pally", 8, "1995-01-01")}, ${profile(EVE, "Evie", 9, "1996-01-01")}, ${profile(PRA, "Practo", 10, "1990-02-02")},
    ${profile(VIE, "Viewer", 11, "1990-03-03")}, ${profile(X1, "Xavi", 12, "1990-04-04")}, ${profile(X2, "Xeno", 13, "1990-05-05")},
    ${profile(Z1, "Zara", 14, "1990-06-06")}, ${profile(Z2, "Zeke", 15, "1990-07-07")},
    ${profile(F1, "Flaggy", 16, "1990-08-08")}, ${profile(F2, "Fairy", 17, "1990-09-09")}`);
  if (q(`SELECT to_regclass('shop.testers') IS NULL`) === "t")
    q(`CREATE SCHEMA IF NOT EXISTS shop; CREATE TABLE shop.testers (user_id uuid PRIMARY KEY, note text NOT NULL DEFAULT '')`);
  q(`INSERT INTO shop.testers (user_id, note) SELECT u, 'rated-server-check' FROM unnest(ARRAY['${ALI}','${BO}','${CY}','${DEE}','${KID}','${PAL}','${EVE}','${PRA}','${VIE}','${X1}','${X2}','${Z1}','${Z2}','${F1}','${F2}']::uuid[]) AS u ON CONFLICT DO NOTHING`);

  // W3a stand-in: fixed ratings, every recordRatedMatch call kept.
  const RATING: Record<string, number> = {
    [ALI]: 1000, [BO]: 1120, [CY]: 1100, [DEE]: 900, [KID]: 1000, [PAL]: 1000, [EVE]: 1500, [PRA]: 1000, [VIE]: 1000,
    [X1]: 3000, [X2]: 3000, [Z1]: 4000, [Z2]: 4000, [GUEST]: 1000,
  };
  const recordedCalls: import("../src/lib/data/ratings").RatedMatchResult[] = [];
  setRatingsBackend({
    matchRating: async (userId) => (RATING[userId] === undefined ? null : { rating: RATING[userId]!, placement: userId === PAL || userId === GUEST }),
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
    check(q(`SELECT count(*) FROM public.mm_queue`) === "0", "nothing was queued by a refused join");
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
    check(q(`SELECT count(*) FROM public.mm_matches`) === "1" && q(`SELECT count(*) FROM public.mm_queue`) === "0", "one match; both searches cleared");
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
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${liveRoomId}'`);
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
    const stored = (slot: number, round: number) => q(`SELECT coalesce(extra::text, 'null') FROM public.round_results WHERE duel_id = '${liveRoomId}' AND player_slot = ${slot} AND round_number = ${round}`);
    check(!!sent && sent.games.every((g, i) => !!g.gradeExtras && JSON.stringify(g.gradeExtras[ALI] ?? null) === stored(1, i + 1) && JSON.stringify(g.gradeExtras[BO] ?? null) === stored(2, i + 1)),
      "W3a gets both live players' stored server grades for every game (gradeExtras, exactly as stored)");
    const settled = results.find((r) => r.state === "settled") ?? viaFn;
    check(settled.state === "settled" && settled.result.winner === "a" && settled.result.players[0]!.gamesWon === 2 && settled.result.players[1]!.gamesWon === 1 && settled.result.ratings?.ok === true, "the result from the stored scores: Ali 2–1, W3a's answer kept");
    check(viaFn.state === "settled", "a later settle answers the stored result");
    check(q(`SELECT status FROM public.mm_matches WHERE id = '${liveMatchId}'`) === "settled", "the match is settled");
    check(q(`SELECT count(*) FROM public.mm_runs WHERE match_id = '${liveMatchId}'`) === "2", "both players' runs join the recorded-run pool");
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
    check(q(`SELECT count(*) FROM public.mm_matches WHERE rematch_of = '${liveMatchId}'`) === "1", "exactly one rematch row");
    if (both.state !== "agreed") return;
    // Finish the rematch at once and settle it: it is a rated match like any other (W3a counts it).
    const rid = both.match.roomId!;
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() - interval '20 seconds' WHERE id = '${rid}'`);
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
    const key = q(`SELECT recorded_key FROM public.mm_matches WHERE id = '${m.matchId}'`);
    const src = q(`SELECT duel_id FROM public.mm_runs WHERE key = '${key}'`);
    const same = q(`SELECT (a.puzzles_public = b.puzzles_public)::text || ',' || (sa.puzzles_private = sb.puzzles_private)::text FROM public.duels a, public.duels b, public.duel_secrets sa, public.duel_secrets sb
       WHERE a.id = '${m.roomId}' AND b.id = '${src}' AND sa.duel_id = a.id AND sb.duel_id = b.id`);
    check(same === "true,true", "the live player is dealt exactly the recorded run's games and deals");
    check(q(`SELECT count(*) FROM public.mm_run_uses WHERE run_key = '${key}'`) === "1", "the use is counted");
    // Playback: never ahead of the run (the stored games' timelines, or nothing).
    const games = JSON.parse(q(`SELECT recorded_games->'games' FROM public.mm_matches WHERE id = '${m.matchId}'`)) as { score: number; timeline: [number, number][] | null }[];
    q(`UPDATE public.duels SET phase = 'puzzle', phase_started_at = now() - interval '3 seconds' WHERE id = '${m.roomId}'`);
    const view = await call(fns.ratedOpponentScoreFn, { matchId: m.matchId }, userToken(CY));
    const g0 = games[0]!;
    const allowed = g0.timeline ? g0.timeline.filter(([ms]) => ms <= 3_500).map(([, s]) => s) : [];
    check(view !== null && (g0.timeline ? view.score === null || allowed.includes(view.score!) || view.score === 0 : view.score === null), "playback shows only what the run had reached (nothing without a timeline)");
    // Finish it; the owner of the last recorded opponent is skipped next time.
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${m.roomId}'`);
    const s = await rated.settleMatch(client, m.matchId, Date.now());
    const rec = callFor(m.matchId)[0]?.players[1];
    check(s.state === "settled" && s.result.kind === "recorded" && rec?.side === "recorded" && rec.run.source === "rated" && rec.run.runId === key && rec.run.ownerId === rec.playerId,
      "a recorded match settles; W3a gets the run (rated source: its owner moves at most half, W3a's rule)");
    const sentRec = callFor(m.matchId)[0];
    const runGames = JSON.parse(q(`SELECT games FROM public.mm_runs WHERE key = '${key}'`)) as { extra?: unknown }[];
    check(!!sentRec && !!rec && sentRec.games.length === 3 && sentRec.games.every((g, i) => !!g.gradeExtras && CY in g.gradeExtras && rec.playerId in g.gradeExtras &&
      JSON.stringify(g.gradeExtras[rec.playerId]) === JSON.stringify(runGames[i]?.extra ?? null)),
      "W3a gets each game's stored server grade for the live player and for the recorded run's owner (gradeExtras)");
    const firstOwner = m.recorded!.ownerId;
    await rated.joinQueue(client, CY, { format: "bo3", choice: "mixed" }, t + 20_000);
    const second = await rated.pollQueue(client, CY, t + 28_500);
    check(second.state === "found" && second.match.kind === "recorded" && second.match.recorded!.ownerId !== firstOwner, "never the same player twice in a row");
    if (second.state === "found") {
      q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${second.match.roomId}'`);
      await rated.settleMatch(client, second.match.matchId, Date.now());
    }
    // The 5-a-day cap: every rated run used up today, then no rated run can be chosen.
    q(`INSERT INTO public.mm_run_uses (run_key, viewer_id, match_id) SELECT r.key, '${DEE}', r.match_id FROM public.mm_runs r, generate_series(1, 5)`);
    await rated.joinQueue(client, EVE, { format: "bo3", choice: "mixed" }, t + 40_000);
    const capped = await rated.pollQueue(client, EVE, t + 48_100);
    check(capped.state === "searching", "a run used 5 times today is not played against again (none left: still searching)");
    await rated.leaveQueue(client, EVE);
  });

  await section("practice runs as a fallback", async () => {
    // Three graded Practice plays by Practo, through the real practice functions: each counted play's deal is stored.
    const practice = await import("../src/lib/duel/practice.functions");
    const { dealRoomRounds } = await import("../src/lib/duel/roomDeal");
    const { matchSettings } = await import("../src/lib/rated/matchmaking");
    const types = dealRoomRounds(matchSettings("bo3", "puzzles"), { seed: 4242 }).types;
    for (const type of types) {
      const dealt = await call(practice.practiceGenerateFn, { type }, userToken(PRA));
      await call(practice.practiceGradeFn, { puzzle: dealt.puzzle, sealed: dealt.sealed, answer: "", msRemaining: 1_000 }, userToken(PRA));
    }
    for (let i = 0; i < 50 && q(`SELECT count(*) FROM public.mm_practice_deals WHERE user_id = '${PRA}'`) !== "3"; i++) await new Promise((r) => setTimeout(r, 100));
    check(q(`SELECT count(*) FROM public.mm_practice_deals WHERE user_id = '${PRA}'`) === "3", "each graded practice play's deal is stored by the server");
    check(q(`SELECT count(*) FROM public.mm_practice_deals d JOIN public.practice_plays p ON p.id = d.play_id WHERE d.user_id = '${PRA}'`) === "3", "keyed on its practice_plays row");
    // No rated run fits All puzzles (every rated run is Mixed) and no ordinary room has finished: Practice is the fallback.
    const t = Date.now();
    await rated.joinQueue(client, VIE, { format: "bo3", choice: "puzzles" }, t);
    const found = await rated.pollQueue(client, VIE, t + 8_000);
    check(found.state === "found" && found.match.kind === "recorded" && found.match.recorded?.fallback === true, "a Practice run is played against as the fallback");
    if (found.state !== "found") return;
    check(q(`SELECT recorded_source FROM public.mm_matches WHERE id = '${found.match.matchId}'`) === "practice" && found.match.recorded?.ownerId === PRA, "its source is practice and its owner the player who played it");
    const { splitPuzzle } = await import("../src/lib/duel/secrets");
    const dealsByType = new Map((JSON.parse(q(`SELECT jsonb_agg(puzzle) FROM public.mm_practice_deals WHERE user_id = '${PRA}'`)) as { type: string }[]).map((p) => [p.type, p]));
    const roomPubs = JSON.parse(q(`SELECT puzzles_public FROM public.duels WHERE id = '${found.match.roomId}'`)) as { type: string }[];
    check(roomPubs.length === 3 && roomPubs.every((p) => JSON.stringify(p) === JSON.stringify(splitPuzzle(dealsByType.get(p.type) as never).pub)), "the live player is dealt exactly the practice plays' puzzles");
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${found.match.roomId}'`);
    const s = await rated.settleMatch(client, found.match.matchId, Date.now());
    const sent = callFor(found.match.matchId)[0]?.players[1];
    check(s.state === "settled" && sent?.side === "recorded" && sent.run.source === "practice", "W3a gets it as a practice run (its owner never moves)");
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
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${made.roomId}'`);
    const t = Date.now();
    await rated.joinQueue(client, KID, { format: "bo3", choice: "puzzles" }, t);
    const fb = await rated.pollQueue(client, KID, t + 8_000);
    check(fb.state === "found" && fb.match.kind === "recorded" && fb.match.recorded?.fallback === true, "no rated run fits: the fallback (a room's server-graded run)");
    if (fb.state === "found") {
      const fbKey = q(`SELECT recorded_key FROM public.mm_matches WHERE id = '${fb.match.matchId}'`);
      check(/^room:/.test(fbKey), `the fallback is a room run (${fbKey})`);
      const firstThree = q(`SELECT (a.puzzles_public = (SELECT jsonb_agg(e ORDER BY i) FROM jsonb_array_elements(b.puzzles_public) WITH ORDINALITY AS x(e, i) WHERE i <= 3))::text
         FROM public.duels a, public.duels b WHERE a.id = '${fb.match.roomId}' AND b.id = '${made.roomId}'`);
      check(firstThree === "true", "the fallback deals exactly the room's first three games");
      // Chat in a rated room: an under-18 picks quick phrases only.
      const free = await call(chat.sendRoomMessageFn, { roomId: fb.match.roomId, text: "add me on insta" }, userToken(KID));
      const phrase = await call(chat.sendRoomMessageFn, { roomId: fb.match.roomId, text: "gg" }, userToken(KID));
      check(free.ok === false && phrase.ok === true, "rated chat: an under-18's free text refused, a quick phrase sent");
      check(q(`SELECT string_agg(text, '|') FROM public.room_messages WHERE duel_id = '${fb.match.roomId}'`) === "Good game!", "rated chat: the phrase is stored as its text");
      q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${fb.match.roomId}'`);
      const s = await rated.settleMatch(client, fb.match.matchId, Date.now());
      const fbRec = callFor(fb.match.matchId)[0]?.players[1];
      check(s.state === "settled" && s.result.recorded?.fallback === true && fbRec?.side === "recorded" && fbRec.run.source === "room" && fbRec.playerId === DEE,
        "the fallback's run goes to W3a as a room run (its owner never moves, W3a's rule)");
    }
    // Placement: straight to a beginner's recorded run, never the live queue.
    q(`DELETE FROM public.mm_run_uses`);
    const tp = Date.now();
    // A placed player (Evie) is searching too, at the same rating band once widened: never paired with Pally.
    q(`DELETE FROM public.mm_queue WHERE user_id = '${EVE}'`);
    RATING[EVE] = 1000;
    await rated.joinQueue(client, EVE, { format: "bo3", choice: "mixed" }, tp);
    await rated.joinQueue(client, PAL, { format: "bo3", choice: "mixed" }, tp);
    const evePoll = await rated.pollQueue(client, EVE, tp + 7_000);
    check(evePoll.state === "searching", "a placed player is never paired live with a placement player");
    await rated.leaveQueue(client, EVE);
    RATING[EVE] = 1500;
    const early = await rated.pollQueue(client, PAL, tp + 100);
    check(early.state === "searching", "placement alone: still searching before 8 s (a placement partner could still come)");
    const pl = await rated.pollQueue(client, PAL, tp + 8_000);
    check(pl.state === "found" && pl.match.kind === "recorded", "placement alone: a recorded run at 8 s");
    if (pl.state === "found") {
      const rating = q(`SELECT coalesce(recorded_owner_rating, -1) FROM public.mm_matches WHERE id = '${pl.match.matchId}'`);
      check(Number(rating) <= 1000, `placement: a beginner's run (owner rating ${rating})`);
    }
  });

  await section("flagged runs", async () => {
    // Dee's and Eve's room runs both fit All puzzles; Dee's first game is flagged by the replay: only Eve's can be used.
    const room = q(`SELECT duel_id FROM public.duel_players WHERE user_id = '${DEE}' LIMIT 1`);
    q(`UPDATE public.round_results SET extra = '{"flagged": true}'::jsonb WHERE duel_id = '${room}' AND player_slot = 1 AND round_number = 1`);
    q(`DELETE FROM public.mm_run_uses`);
    q(`DELETE FROM public.mm_practice_deals WHERE user_id = '${PRA}'`);
    const keys: string[] = [];
    for (const viewer of [CY, BO]) {
      const t = Date.now();
      await rated.settleOpenMatches(client, viewer, t);
      await rated.joinQueue(client, viewer, { format: "bo3", choice: "puzzles" }, t);
      const found = await rated.pollQueue(client, viewer, t + 8_000);
      if (found.state === "found") {
        keys.push(q(`SELECT recorded_key FROM public.mm_matches WHERE id = '${found.match.matchId}'`));
        q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${found.match.roomId}'`);
        await rated.settleMatch(client, found.match.matchId, Date.now());
      } else keys.push("none");
    }
    check(keys.length === 2 && keys.every((k) => k !== `room:${room}:1`), `a room run with a flagged game is never played against (${keys.join(", ")})`);
    // A practice deal the replay flagged is stored as flagged and never chosen.
    q(`INSERT INTO public.mm_practice_deals (play_id, user_id, game, puzzle, answer, score, ms_remaining, flagged)
       SELECT 900000 + n, '${PRA}', p->>'type', p, '', 10, 0, true FROM (SELECT puzzles_public -> (n - 1) AS p, n FROM public.duels, generate_series(1, 3) AS n WHERE id = '${room}') x`);
    q(`UPDATE public.round_results SET extra = '{"flagged": true}'::jsonb WHERE duel_id = '${room}'`);
    const t = Date.now();
    await rated.joinQueue(client, KID, { format: "bo3", choice: "puzzles" }, t);
    const none = await rated.pollQueue(client, KID, t + 8_000);
    check(none.state === "searching", "flagged practice deals and flagged room runs are never chosen (nothing left: still searching)");
    await rated.leaveQueue(client, KID);
  });

  await section("early finish and flagged rated runs", async () => {
    const t = Date.now();
    const pair = async (a: string, b: string) => {
      await rated.joinQueue(client, a, { format: "bo3", choice: "mixed" }, t);
      await rated.joinQueue(client, b, { format: "bo3", choice: "mixed" }, t);
      const p = await rated.pollQueue(client, a, t + 100);
      await rated.pollQueue(client, b, t + 200);
      return p.state === "found" ? p.match : null;
    };
    const play = async (roomId: string, round: number, a: number, b: number, token: string, flagB = false) => {
      q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer, extra) VALUES
         ('${roomId}', 1, ${round}, ${a}, 1000, true, 'x', NULL), ('${roomId}', 2, ${round}, ${b}, 1000, true, 'x', ${flagB ? `'{"flagged": true}'::jsonb` : "NULL"})`);
      q(`UPDATE public.duels SET current_round = ${round}, phase = 'result', phase_started_at = now() - interval '5 minutes' WHERE id = '${roomId}'`);
      await call(duel.advancePhaseFn, { roomId }, token);
      return q(`SELECT phase FROM public.duels WHERE id = '${roomId}'`);
    };
    const z = await pair(Z1, Z2);
    check(z !== null, "a live best of 3 (Zara v Zeke)");
    if (z) {
      const r = z.roomId!;
      check((await play(r, 1, 150, 100, userToken(Z1))) === "standings", "1–0: play goes on to game 2");
      check((await play(r, 2, 140, 90, userToken(Z1))) === "winner_reveal", "2–0: the match stops at once (the winner reveal, game 3 never played)");
      q(`UPDATE public.duels SET phase_started_at = now() - interval '5 minutes' WHERE id = '${r}'`);
      await call(duel.advancePhaseFn, { roomId: r }, userToken(Z1));
      check(q(`SELECT status || ',' || current_round FROM public.duels WHERE id = '${r}'`) === "finished,2", "the room finishes after game 2");
      const s = await rated.settleMatch(client, z.matchId, Date.now());
      const sent = callFor(z.matchId)[0];
      check(s.state === "settled" && s.result.games.length === 2 && s.result.players[0]!.gamesWon === 2 && sent?.games.length === 2, "settled on the two games played; W3a gets those two");
      check(q(`SELECT count(*) FROM public.mm_runs WHERE match_id = '${z.matchId}'`) === "0", "a match stopped early leaves no run (a recorded run needs every game)");
    }
    const x = await pair(X1, X2);
    check(x !== null, "a live best of 3 (Xavi v Xeno)");
    if (x) {
      const r = x.roomId!;
      check((await play(r, 1, 150, 100, userToken(X1))) === "standings" && (await play(r, 2, 90, 140, userToken(X1))) === "standings", "1–1: play goes on to game 3");
      check((await play(r, 3, 120, 110, userToken(X1), true)) === "winner_reveal", "game 3 is the last as before");
      q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${r}'`);
      const s = await rated.settleMatch(client, x.matchId, Date.now());
      check(s.state === "settled" && s.result.games.length === 3, "a full best of 3 settles on three games");
      check(q(`SELECT string_agg(owner_id::text, ',') FROM public.mm_runs WHERE match_id = '${x.matchId}'`) === X1, "a rated run with a game the replay flagged is never stored (only Xavi's run joins the pool)");
    }
  });

  await section("guests", async () => {
    const { RATED_SWITCHES } = await import("../src/lib/rated/matchmaking");
    const { guestEnergyName } = await import("../src/lib/rated/guestName.server");
    const everyone = { ...RATED_SWITCHES, forEveryone: true };
    // A phone that still sends a typed name: it is ignored (rated play never takes a guest's typed name).
    const typedName = { format: "bo3", choice: "mixed", displayName: "Gus" } as { format: string; choice: string };
    const off = await rated.joinQueue(client, GUEST, typedName, Date.now());
    check(off.ok === false && off.reason === "account", "while rated play is testers-only, a guest can't queue");
    const status = await rated.ratedStatus(client, GUEST, everyone);
    check(status.open === true && status.account === false, "with rated play for everyone, open to a guest");
    check(q(`SELECT count(*) FROM information_schema.columns WHERE table_name = 'mm_queue' AND column_name = 'display_name'`) === "0", "the queue keeps no guest name (no column)");
    q(`DELETE FROM public.mm_run_uses`);
    const t = Date.now();
    const joined = await rated.joinQueue(client, GUEST, typedName, t, everyone);
    check(joined.ok === true, "a guest queues with no sign-up and no name");
    const found = await rated.pollQueue(client, GUEST, t + 8_000);
    check(found.state === "found" && found.match.kind === "recorded", "a guest in placement with nobody else in placement searching: a beginner's recorded run at 8 s");
    if (found.state === "found") {
      const seated = q(`SELECT display_name FROM public.duel_players WHERE duel_id = '${found.match.roomId}' AND user_id = '${GUEST}'`);
      check(seated === guestEnergyName(GUEST) && /^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,2}$/.test(seated) && seated !== "Gus",
        `seated under their generated energy name, never the typed one (${seated})`);
      const me = found.match.players.find((p) => p.userId === GUEST);
      check(me?.guest === true && me.displayName === seated, "the match view tags them Guest");
      const typed = await call(chat.sendRoomMessageFn, { roomId: found.match.roomId, text: "hi there" }, userToken(GUEST));
      check(typed.ok === false, "a guest sends quick phrases only in a rated room");
      q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${found.match.roomId}'`);
      await rated.settleMatch(client, found.match.matchId, Date.now());
      // A guest's run played against: their energy name and Guest tag, never a typed name. A Practice run stitched from
      // three plays an hour, three hours and two hours old is labelled with its oldest game's age.
      const dee = q(`SELECT duel_id FROM public.duel_players WHERE user_id = '${DEE}' LIMIT 1`);
      q(`DELETE FROM public.mm_practice_deals`);
      q(`DELETE FROM public.mm_run_uses`);
      q(`INSERT INTO public.mm_practice_deals (play_id, user_id, game, puzzle, answer, score, ms_remaining, recorded_at)
         SELECT 990000 + n, '${GUEST}', d.puzzles_public -> (n - 1) ->> 'type', (d.puzzles_public -> (n - 1)) || coalesce(s.puzzles_private -> (n - 1), '{}'::jsonb),
                '', 50, 1000, now() - make_interval(hours => (ARRAY[1, 3, 2])[n])
           FROM public.duels d JOIN public.duel_secrets s ON s.duel_id = d.id, generate_series(1, 3) AS n WHERE d.id = '${dee}'`);
      const t2 = Date.now();
      await rated.settleOpenMatches(client, VIE, t2);
      await rated.joinQueue(client, VIE, { format: "bo3", choice: "puzzles" }, t2);
      const vs = await rated.pollQueue(client, VIE, t2 + 8_000);
      check(vs.state === "found" && vs.match.recorded?.ownerId === GUEST && vs.match.recorded.ownerGuest === true && vs.match.recorded.ownerName === guestEnergyName(GUEST),
        `a guest's recorded run shows their energy name with a Guest tag (${vs.state === "found" ? vs.match.recorded?.ownerName : vs.state})`);
      if (vs.state === "found") {
        const ageH = (Date.now() - (vs.match.recorded?.recordedAtMs ?? 0)) / 3_600_000;
        check(vs.match.recorded?.label === "Recorded run · 3 h ago" && ageH > 2.9 && ageH < 3.1, `a stitched Practice run is labelled with its oldest game's age (${vs.match.recorded?.label})`);
      }
      // Signing up keeps the same player id (wave 1's linking): the match, and so W3a's ratings, stay theirs.
      q(`SET session_replication_role = replica; INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth, player_number) VALUES ('${GUEST}', 'GusNow', 'gusnow', 3, DATE '1999-09-09', 99)`);
      const mine = q(`SELECT count(*) FROM public.mm_match_players WHERE user_id = '${GUEST}'`);
      check(mine === "1", "after sign-up the same player still holds their match (ratings key on the same id)");
    }
  });

  await section("the practice deals purge (Cron Trigger)", async () => {
    const { runPracticeDealsPurge } = await import("../src/lib/rated/tasks/matchmakingTasks.server");
    q(`INSERT INTO public.mm_practice_deals (play_id, user_id, game, puzzle, answer, score, ms_remaining, recorded_at) VALUES
       (970001, '${PRA}', 'flood', '{"type":"flood"}', '', 1, 0, now() - interval '16 days'),
       (970002, '${PRA}', 'flood', '{"type":"flood"}', '', 1, 0, now() - interval '14 days')`);
    const out = await runPracticeDealsPurge();
    check(out.result.removed === 1 && q(`SELECT string_agg(play_id::text, ',') FROM public.mm_practice_deals WHERE play_id BETWEEN 970000 AND 979999`) === "970002",
      "the Worker's purge task removes deals older than 15 days and keeps the rest (no pg_cron needed)");
  });

  await section("adult chat", async () => {
    if (!liveRoomId) return;
    const typed = await call(chat.sendRoomMessageFn, { roomId: liveRoomId, text: "good game mate" }, userToken(ALI));
    check(typed.ok === true, "rated chat: an adult with an account types");
  });

  await section("forget_user removes a deleted account's runs", async () => {
    const before = Number(q(`SELECT count(*) FROM public.mm_runs WHERE owner_id = '${X1}'`));
    q(`INSERT INTO public.mm_practice_deals (play_id, user_id, game, puzzle, answer, score, ms_remaining) VALUES (950001, '${X1}', 'flood', '{"type":"flood"}', '', 1, 0)`);
    q(`INSERT INTO public.mm_run_uses (run_key, viewer_id, match_id) VALUES ('rated:00000000-0000-4000-8000-0000000000aa:${X1}', '${X1}', gen_random_uuid())`);
    check(before === 1, "Xavi has a stored rated run");
    q(`SELECT accounts.forget_user('${X1}')`);
    check(q(`SELECT count(*) FROM public.mm_runs WHERE owner_id = '${X1}'`) === "0", "forget_user removes their stored rated runs");
    check(q(`SELECT count(*) FROM public.mm_practice_deals WHERE user_id = '${X1}'`) === "0", "and their stored practice deals");
    check(q(`SELECT count(*) FROM public.mm_match_players WHERE user_id = '${X1}'`) === "0" && q(`SELECT count(*) FROM public.mm_run_uses WHERE viewer_id = '${X1}' OR position('${X1}' IN run_key) > 0`) === "0", "and nothing else names them (seats and uses re-keyed)");
    check(q(`SELECT count(*) FROM public.mm_match_players mp JOIN public.mm_matches m ON m.id = mp.match_id WHERE m.duel_id = (SELECT duel_id FROM public.mm_matches WHERE id IN (SELECT match_id FROM public.mm_match_players WHERE user_id = '${X2}') ORDER BY created_at DESC LIMIT 1)`) === "2", "their opponent's match keeps both seats");
    // An owner of a recorded opponent: the match keeps its shape under a fresh id and "Deleted player".
    const owner = q(`SELECT recorded_owner FROM public.mm_matches WHERE recorded_source = 'rated' AND recorded_owner IN ('${ALI}', '${BO}') LIMIT 1`);
    if (owner) {
      q(`SELECT accounts.forget_user('${owner}')`);
      check(q(`SELECT count(*) FROM public.mm_matches WHERE recorded_owner = '${owner}' OR position('${owner}' IN coalesce(recorded_key, '')) > 0`) === "0" && q(`SELECT count(*) FROM public.mm_runs WHERE owner_id = '${owner}'`) === "0",
        "a recorded opponent's account removed: their runs go, matches played against them are re-keyed");
      check(q(`SELECT count(*) FROM public.mm_matches WHERE recorded_games->>'ownerName' = 'Deleted player'`) !== "0", "shown as Deleted player");
    } else check(false, "a rated recorded owner to forget");
  });

  await section("W3a bound for real", async () => {
    // Without a stand-in, ratingsReady() binds W3a's own ratings.server.ts on this database.
    setRatingsBackend(null);
    const { ratingsReady } = await import("../src/lib/rated/ratingsAdapter.server");
    const { START_RATING } = await import("../src/lib/rated/glicko.config");
    const real = await ratingsReady();
    const r = await real.matchRating(CY, { format: "bo3", choice: "mixed" });
    check(real.startingRating === START_RATING && r !== null && r.placement === true && r.rating === START_RATING,
      `W3a's ratings bind on first use: a new player is in placement at the starting rating (${JSON.stringify(r)})`);
  });

  await section("a flagged live run, through W3a's real engine", async () => {
    // Joe's rule (11 Nov 2026): the flag comes only from the server's grading; W3a reads it from each player's stored
    // grade (gradeExtras). A real rated match on W3a's own ratings, D2's pass and C2's badges: Flaggy's second game was
    // flagged by the server replay. Nobody's rating moves, the flag is logged for Joe, Flaggy gets no Joules.
    setRatingsBackend(null);
    const { ratingsReady } = await import("../src/lib/rated/ratingsAdapter.server");
    await ratingsReady();
    if (q(`SELECT count(*) FROM public.pass_seasons WHERE id = 'test'`) !== "0") q(`SELECT pass.start_test_season('rated-server-check')`);
    // Both are new, so in placement on W3a's real engine; both searching at the same time, they are matched live with
    // each other through the real queue (Joe, 11 Nov 2026).
    const t = Date.now();
    const j1 = await rated.joinQueue(client, F1, { format: "bo3", choice: "mixed" }, t);
    const j2 = await rated.joinQueue(client, F2, { format: "bo3", choice: "mixed" }, t);
    const placementBoth = q(`SELECT string_agg(placement::text, ',' ORDER BY user_id) FROM public.mm_queue WHERE user_id IN ('${F1}', '${F2}')`);
    check(j1.ok && j2.ok && placementBoth === "true,true", `both queue in placement on W3a's real engine (${placementBoth})`);
    const p = await rated.pollQueue(client, F1, t + 100);
    await rated.pollQueue(client, F2, t + 200);
    check(p.state === "found" && p.match.kind === "live" && p.match.players.every((x) => x.placement), "two placement players are matched live with each other through the real queue");
    if (p.state !== "found") return;
    const r = p.match.roomId!;
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer, extra) VALUES
       ('${r}', 1, 1, 150, 1000, true, 'x', '{"flagged": false}'::jsonb), ('${r}', 2, 1, 100, 1000, true, 'x', NULL),
       ('${r}', 1, 2, 160, 1000, true, 'x', '{"flagged": true, "reason": "score did not match the replay"}'::jsonb), ('${r}', 2, 2, 90, 1000, true, 'x', NULL)`);
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = 2, phase_started_at = now() WHERE id = '${r}'`);
    const flaggedSlot = Number(q(`SELECT slot FROM public.mm_match_players WHERE match_id = '${p.match.matchId}' AND user_id = '${F1}'`));
    check(flaggedSlot === 1, "Flaggy is slot 1 (the flagged results above are theirs)");
    const s = await rated.settleMatch(client, p.match.matchId, Date.now());
    const out = s.state === "settled" ? s.result.ratings : null;
    check(s.state === "settled" && out?.ok === true, `the match settles through W3a's finishRatedMatch (${JSON.stringify(out && !out.ok ? out : null)})`);
    if (!out || !out.ok) return;
    const fl = out.players.find((x) => x.playerId === F1);
    const fa = out.players.find((x) => x.playerId === F2);
    check(out.players.every((x) => x.moved === false && x.frozen === "flagged_run" && x.changes.length === 0), "nobody's rating moves (frozen: flagged_run)");
    check(q(`SELECT count(*) FROM public.rated_ratings WHERE player_id IN ('${F1}', '${F2}')`) === "0", "no rating row was written for either player");
    check(fl?.flagged === true && fa?.flagged === false, "the flag is Flaggy's alone");
    check(q(`SELECT string_agg(player_id::text || ':' || coalesce(game_idx::text, '-'), ',') FROM moderation.rated_flags WHERE match_id = '${p.match.matchId}'`) === `${F1}:1`,
      "the flag is logged in moderation.rated_flags for Joe (Flaggy, game 2)");
    check(fl?.joules === 0 && q(`SELECT count(*) FROM public.pass_joules WHERE user_id = '${F1}' AND kind = 'rated'`) === "0", "Flaggy gets no Joules");
    check((fa?.joules ?? 0) > 0, `Fairy, not flagged, still earns the match's Joules (${fa?.joules})`);
    // The phone's settle answer never carries the stored grades.
    const phone = await call(fns.ratedSettleFn, { matchId: p.match.matchId }, userToken(F2));
    check(phone.state === "settled" && !JSON.stringify(phone).includes('"extras"') && !JSON.stringify(phone).includes("score did not match"),
      "the phone's settle answer leaves the stored grades out");
  });

  await section("head to head and a room's match (W3c)", async () => {
    q(`INSERT INTO auth.users (id) VALUES ('${H1}'), ('${H2}')`);
    let n = 0;
    // A settled match between H1 and H2 as the store keeps it: `slots` gives each player's slot, `winner` the stored side.
    const stored = (kind: "live" | "recorded", status: string, slots: [string, number][], winner: string, flagged = false) => {
      const id = `00000000-0000-4000-8000-${String(900000 + ++n).padStart(12, "0")}`;
      const ratings = flagged
        ? `, "ratings": {"ok": true, "players": [{"playerId": "${slots[0]![0]}", "flagged": true, "frozen": "flagged_run"}]}`
        : "";
      const rec = kind === "recorded" ? `'rated:x:${id}', 'rated', '${H2}'` : "NULL, NULL, NULL";
      q(`INSERT INTO public.mm_matches (id, format, choice, kind, status, recorded_key, recorded_source, recorded_owner, result)
        VALUES ('${id}', 'bo3', 'mixed', '${kind}', '${status}', ${rec}, '{"winner": "${winner}"${ratings}}'::jsonb)`);
      q(`INSERT INTO public.mm_match_players (match_id, user_id, slot, rating_before) VALUES ${slots.map(([u, sl]) => `('${id}', '${u}', ${sl}, 1000)`).join(", ")}`);
      return id;
    };
    check(JSON.stringify(await rated.headToHead(client, H1, H2)) === JSON.stringify({ wins: 0, losses: 0, draws: 0, played: 0 }), "no matches yet: 0–0–0");
    stored("live", "settled", [[H1, 1], [H2, 2]], "a"); // H1 wins as slot 1
    stored("live", "settled", [[H2, 1], [H1, 2]], "b"); // H1 wins as slot 2
    stored("live", "settled", [[H1, 1], [H2, 2]], "b"); // H2 wins
    stored("live", "settled", [[H2, 1], [H1, 2]], "draw");
    // Left out: a recorded match (H1 played H2's run), a match still playing, a flagged one, one with someone else.
    stored("recorded", "settled", [[H1, 1]], "a");
    stored("live", "playing", [[H1, 1], [H2, 2]], "a");
    stored("live", "settled", [[H1, 1], [H2, 2]], "a", true);
    stored("live", "settled", [[H1, 1], [EVE, 2]], "a");
    const mine = await rated.headToHead(client, H1, H2);
    const theirs = await rated.headToHead(client, H2, H1);
    check(JSON.stringify(mine) === JSON.stringify({ wins: 2, losses: 1, draws: 1, played: 4 }), `H1 against H2: 2 wins, 1 loss, 1 draw (${JSON.stringify(mine)})`);
    check(JSON.stringify(theirs) === JSON.stringify({ wins: 1, losses: 2, draws: 1, played: 4 }), `H2 against H1 is the mirror (${JSON.stringify(theirs)})`);
    check((await rated.headToHead(client, H1, H1)).played === 0, "a player against themselves: nothing");
    const viaFn = await call(fns.ratedHeadToHeadFn, { opponentId: H2 }, userToken(H1));
    check(JSON.stringify(viaFn) === JSON.stringify(mine), "ratedHeadToHeadFn answers the caller's side");
    const junk = await call(fns.ratedHeadToHeadFn, { opponentId: "not-an-id" }, userToken(H1));
    check(junk.played === 0, "a malformed opponent id: an empty record");
    // Through the real flow: Flaggy and Fairy's match above settled live, but with a flagged run, so it counts for neither.
    const realFlagged = q(`SELECT count(*) FROM public.mm_matches m WHERE m.kind = 'live' AND m.status = 'settled'
      AND EXISTS (SELECT 1 FROM public.mm_match_players p WHERE p.match_id = m.id AND p.user_id = '${F1}')
      AND EXISTS (SELECT 1 FROM public.mm_match_players p WHERE p.match_id = m.id AND p.user_id = '${F2}')`);
    check(Number(realFlagged) >= 1 && (await rated.headToHead(client, F2, F1)).played === 0 && (await rated.headToHead(client, F1, F2)).played === 0,
      `a settled live match with a flagged run counts for neither player (${realFlagged} stored)`);

    // A room id: its rated match, for its players only (Flaggy and Fairy's room, both still accounts).
    const flaggedMatch = q(`SELECT m.id FROM public.mm_matches m JOIN public.mm_match_players p ON p.match_id = m.id
      WHERE p.user_id = '${F2}' AND m.kind = 'live' AND m.duel_id IS NOT NULL LIMIT 1`);
    const room = q(`SELECT duel_id FROM public.mm_matches WHERE id = '${flaggedMatch}'`);
    const [ME, OTHER, OUTSIDER] = [F2, F1, H1];
    const info = await call(fns.ratedRoomFn, { roomId: room }, userToken(ME));
    check(info?.matchId === flaggedMatch && info.format === "bo3" && info.kind === "live" && info.totalGames === 3,
      `a rated room answers its match id, format and kind (${JSON.stringify(info)})`);
    const boInfo = await call(fns.ratedRoomFn, { roomId: room }, userToken(OTHER));
    check(boInfo?.matchId === flaggedMatch, "the other player gets it too (another tab, another device, after a reload)");
    check((await call(fns.ratedRoomFn, { roomId: room }, userToken(OUTSIDER))) === null, "someone not in the match gets null");
    const plain = q(`SELECT id FROM public.duels WHERE id NOT IN (SELECT duel_id FROM public.mm_matches WHERE duel_id IS NOT NULL) LIMIT 1`);
    check(plain !== "" && (await call(fns.ratedRoomFn, { roomId: plain }, userToken(ME))) === null, "an ordinary room is not a rated match");
    const recRoom = q(`SELECT m.duel_id || ',' || p.user_id || ',' || m.id FROM public.mm_matches m JOIN public.mm_match_players p ON p.match_id = m.id
      JOIN auth.users u ON u.id = p.user_id
      WHERE m.kind = 'recorded' AND m.duel_id IS NOT NULL LIMIT 1`).split(",");
    const recInfo = await call(fns.ratedRoomFn, { roomId: recRoom[0]! }, userToken(recRoom[1]!));
    check(recInfo?.matchId === recRoom[2] && recInfo.kind === "recorded", "a recorded match's room answers too (kind recorded)");
    check((await call(fns.ratedRoomFn, { roomId: "nope" }, userToken(ME))) === null, "a malformed room id: null");
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
