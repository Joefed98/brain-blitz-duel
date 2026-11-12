/**
 * rated-multi-server-check (wave 3, W3d; docs/rated/multiplayer.md): a 4-player rated match end to end through W3b's real
 * queue, rooms and settling (src/lib/rated/rated.server.ts with W3d's hooks), against a local PostgreSQL 16 with every
 * migration applied (scripts/server-fn-harness.ts). W3a's ratings are stood in through W3b's `setRatingsBackend`, then a
 * second match settles on W3a's real finishRatedMatch, bound as W3b's ratingsReady() binds it. No browser (~15 s).
 *
 * It proves: ffa4 off is refused by the server; a placement player can't queue for 4 or 8; four testers within the band
 * make one live match (one ordinary started room, all four seated, the same deals, nobody else); three never start one
 * (recorded seats are parked), even after 15 s; settling sends W3a one placings match exactly once under racing calls,
 * with the final placings from the stored scores (points, then total score); every player's run joins the pool; the
 * start and finish events; and (Joe's rule, 11 Nov 2026, built in W3a's engine) a 4- and an 8-player match with one run
 * the server flagged (its stored grade's extra.flagged) on W3a's real engine: nobody's rating moves, nothing counts
 * for placement, streaks or competitive badges (Podium Regular included), the flagged run earns its player no badge (E2's
 * badge_facts) while the unflagged player's Flawless stands, it is logged once in moderation.rated_flags, the flagged
 * player gets no Joules and the others keep theirs.
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
const I = uid(31);
const J = uid(32);
const K = uid(33);
const L = uid(34);
// A flagged 8-player match's players.
const EIGHT = [41, 42, 43, 44, 45, 46, 47, 48].map(uid);
// Leaving (W3b's rule, Joe 12 Nov 2026): a 4-player match with one leaver, and one with a leaver and a flagged run.
const LEAVE = [51, 52, 53, 54].map(uid);
const LEAVE_FLAG = [61, 62, 63, 64].map(uid);

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
console.log("PASS: 4- and 8-player rated matches through W3b's queue, rooms and settling, and flagged runs on W3a's engine, on a real database.");
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

  const ALL = [A, B, C, D, E, F, G, H, I, J, K, L, ...EIGHT, ...LEAVE, ...LEAVE_FLAG];
  q(`INSERT INTO auth.users (id) VALUES ${ALL.map((u) => `('${u}')`).join(", ")}`);
  q(`SET session_replication_role = replica; INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth, player_number) VALUES
    ${ALL.map((u, i) => `('${u}', 'Multi${i}', 'multi${i}', ${i}, DATE '1990-01-01', ${i + 40})`).join(", ")}`);
  if (q(`SELECT to_regclass('shop.testers') IS NULL`) === "t")
    q(`CREATE SCHEMA IF NOT EXISTS shop; CREATE TABLE shop.testers (user_id uuid PRIMARY KEY, note text NOT NULL DEFAULT '')`);
  q(`INSERT INTO shop.testers (user_id, note) SELECT u, 'rated-multi-server-check' FROM unnest(ARRAY[${ALL.map((u) => `'${u}'`).join(",")}]::uuid[]) AS u ON CONFLICT DO NOTHING`);

  const RATING: Record<string, number> = { [A]: 1000, [B]: 1010, [C]: 1020, [D]: 1030, [E]: 1000, [F]: 1500, [G]: 1510, [H]: 1520, [I]: 1200, [J]: 1200, [K]: 1200, [L]: 1200, ...Object.fromEntries(EIGHT.map((u) => [u, 1300])), ...Object.fromEntries([...LEAVE, ...LEAVE_FLAG].map((u) => [u, 1250])) };
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
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${roomId}'`);
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

  await section("W3a's real recordRatedMatch", async () => {
    // The queue's rating stays the stand-in (W3a puts new players in placement, which can't queue for 4 or 8); the
    // settle runs W3a's real engine exactly as W3b's ratingsReady() binds it for every match: getMyRatings, and
    // finishRatedMatch (recordRatedMatch, then the Joules through D2's pass and C2's badges).
    const w3a = await import("../src/lib/rated/ratings.server");
    const { finishRatedMatch } = await import("../src/lib/rated/rewards.server");
    const { bindW3aRatings } = await import("../src/lib/rated/ratingsAdapter.server");
    const real = bindW3aRatings({ getMyRatings: w3a.getMyRatings, recordRatedMatch: finishRatedMatch }, adminDb, 1500);
    setRatingsBackend({
      matchRating: async (userId) => (RATING[userId] === undefined ? null : { rating: RATING[userId]!, placement: false }),
      recordRatedMatch: real.recordRatedMatch,
      startingRating: 1500,
      beginnerMax: 1500,
    });
    const t = Date.now();
    for (const u of [I, J, K, L]) await rated.joinQueue(client, u, { format: "ffa4", choice: "mixed" }, t, ON);
    const found = await rated.pollQueue(client, I, t + 200);
    check(found.state === "found", "a second 4-player match");
    if (found.state !== "found") return;
    const id = found.match.matchId;
    const room = found.match.roomId!;
    // Slot order I, J, K, L. Game scores give placings 1, 2, 3, 4 by slot.
    const rows = [0, 1, 2].flatMap((r) => [200, 150, 100, 50].map((sc, i) => `('${room}', ${i + 1}, ${r + 1}, ${sc}, 1000, true, 'x')`));
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer) VALUES ${rows.join(", ")}`);
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${room}'`);
    const out = await rated.settleMatch(client, id, Date.now());
    const outcome = out.state === "settled" ? out.result.ratings : null;
    check(out.state === "settled" && outcome?.ok === true && outcome.status === "recorded", `W3a records the placings match (${outcome && !outcome.ok ? outcome.reason + ": " + outcome.message : out.state})`);
    if (!outcome?.ok) return;
    const slotUser = q(`SELECT string_agg(user_id::text, ',' ORDER BY player_slot) FROM public.duel_players WHERE duel_id = '${room}'`).split(",");
    const byUser = new Map(outcome.players.map((p) => [p.playerId, p]));
    check(JSON.stringify(slotUser.map((u) => byUser.get(u)?.place)) === "[1,2,3,4]", "W3a's places are the final placings");
    check(JSON.stringify(slotUser.map((u) => byUser.get(u)?.joules)) === "[225,150,150,150]", "W3a's Joules: 1.5 × best of 3, first place the win");
    check(byUser.get(slotUser[0]!)?.result === "win" && byUser.get(slotUser[3]!)?.result === "loss", "first is a win, last a loss");
    const { toRatingsResult } = await import("../src/lib/rated/ratingsAdapter.server");
    const resend = out.state === "settled" ? toRatingsResult(out.result) : null;
    check(!!resend && resend.format.kind === "placings" && JSON.stringify(slotUser.map((u) => resend.placings?.[u])) === "[1,2,3,4]", "the stored settlement rebuilds the same placings result (W3b's toRatingsResult)");
    const again = resend ? await finishRatedMatch(await adminDb(), resend) : { ok: false as const };
    check(again.ok === false || again.status === "duplicate", "the same match again moves nothing");
  });

  await section("events", async () => {
    await flushAnalytics();
    const count = (e: string) => Number(q(`SELECT count(*) FROM analytics.events WHERE event = '${e}'`));
    check(count("multiplayer_match_started") === 2, "multiplayer_match_started once a match (two matches)");
    check(q(`SELECT string_agg(DISTINCT props->>'size' || ',' || (props->>'live_seats') || ',' || (props->>'recorded_seats'), ';') FROM analytics.events WHERE event = 'multiplayer_match_started'`) === "4,4,0", "with size 4, 4 live seats, 0 recorded");
    check(count("multiplayer_match_finished") === 8, "multiplayer_match_finished for each of the four, both matches");
    check(q(`SELECT string_agg(props->>'placing', ',' ORDER BY (props->>'placing')::int) FROM analytics.events WHERE event = 'multiplayer_match_finished'`) === "1,1,2,2,3,3,3,4", "with each placing");
  });
  // Joe's rule (11 Nov 2026), built in W3a's engine: a match with one run the server flagged (its stored grade's
  // extra.flagged) moves nobody's rating, counts for nobody's placement, streaks or badges (Podium Regular included),
  // is logged for review (moderation.rated_flags), and pays the flagged player no Joules while the others keep theirs.
  // Proved here for 4 and 8 players through W3b's settle and W3a's real recordRatedMatch.
  // Each player's placement count, matches, wins, win streak, best streak, podiums and Joulz Rating; a player with no
  // profile row yet reads as all zeros (W3a creates a zero row on a player's first match, counted or not).
  const profileOf = (users: string[]) => {
    const rows = q(`SELECT coalesce(string_agg(player_id::text || '=' || placement_played || ':' || matches || ':' || wins || ':' || win_streak || ':' || best_win_streak || ':' || podiums || ':' || coalesce(joulz::text, '-'), ',' ORDER BY player_id), '')
       FROM public.rated_profiles WHERE player_id = ANY(ARRAY[${users.map((u) => `'${u}'`).join(",")}]::uuid[])`);
    const got = new Map(rows ? rows.split(",").map((r) => r.split("=") as [string, string]) : []);
    return [...users].sort().map((u) => `${u}=${got.get(u) ?? "0:0:0:0:0:0:-"}`).join(",");
  };
  const ratingsOf = (users: string[]) =>
    q(`SELECT coalesce(string_agg(player_id::text || ':' || key || ':' || rating || ':' || rd || ':' || matches, ',' ORDER BY player_id, key), '')
       FROM public.rated_ratings WHERE player_id = ANY(ARRAY[${users.map((u) => `'${u}'`).join(",")}]::uuid[])`);
  const badgesOf = (users: string[]) =>
    q(`SELECT count(*) FROM public.player_badges WHERE user_id = ANY(ARRAY[${users.map((u) => `'${u}'`).join(",")}]::uuid[])`);
  const hasBadgeTable = q(`SELECT to_regclass('public.player_badges') IS NOT NULL`) === "t";
  const { RATED_BADGES } = await import("../src/lib/rated/ratings.server");
  check(RATED_BADGES.includes("podium-regular"), "W3a's competitive badges include Podium Regular");

  async function flaggedMatch(size: 4 | 8, users: string[], flaggedSlot: number): Promise<void> {
    const label = `flagged ${size}-player`;
    const format = size === 4 ? "ffa4" : "ffa8";
    const sw = { ...RATED_SWITCHES, formats: { ...RATED_SWITCHES.formats, ffa4: true, ffa8: true } };
    const t = Date.now();
    // A poll clears a player's claimed entry from a match they were found for earlier (as the phone's next poll does).
    for (const u of users) await rated.pollQueue(client, u, t);
    for (const u of users) {
      const joined = await rated.joinQueue(client, u, { format, choice: "mixed" }, t, sw);
      check(joined.ok, `${label}: ${u.slice(-2)} joins the queue (${joined.ok ? "ok" : joined.reason})`);
    }
    const found = await rated.pollQueue(client, users[0]!, t + 200);
    check(found.state === "found", `${label}: a match of ${size}`);
    if (found.state !== "found") return;
    const id = found.match.matchId;
    const room = found.match.roomId!;
    const slotUser = q(`SELECT string_agg(user_id::text, ',' ORDER BY player_slot) FROM public.duel_players WHERE duel_id = '${room}'`).split(",");
    const flaggedUser = slotUser[flaggedSlot - 1]!;
    const userBadges = (u: string) => (hasBadgeTable ? q(`SELECT coalesce(string_agg(badge, ',' ORDER BY badge), '') FROM public.player_badges WHERE user_id = '${u}'`) : "");
    const flaggedBadgesBefore = userBadges(flaggedUser);
    const before = { profiles: profileOf(users), ratings: ratingsOf(users), badges: hasBadgeTable ? badgesOf(users) : "", ratedBadges: hasBadgeTable ? q(`SELECT count(*) FROM public.player_badges WHERE user_id = ANY(ARRAY[${users.map((u) => `'${u}'`).join(",")}]::uuid[]) AND badge = ANY(ARRAY[${RATED_BADGES.map((b) => `'${b}'`).join(",")}])`) : "" };
    // Every slot scores by its place; the flagged slot's game 2 carries the server replay's flag in its stored extra
    // and is a 200 (the only 200 that player has in the match), so Flawless would come from that run alone. Slot 1,
    // never flagged, scores 200 in every game.
    const rows = [0, 1, 2].flatMap((r) =>
      slotUser.map((_, i) => {
        const flaggedRun = i + 1 === flaggedSlot && r === 1;
        const extra = flaggedRun ? `'{"flagged": true, "flagReason": "replay_mismatch"}'::jsonb` : "NULL";
        return `('${room}', ${i + 1}, ${r + 1}, ${flaggedRun ? 200 : 200 - i * 20}, 1000, true, 'x', ${extra})`;
      }),
    );
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer, extra) VALUES ${rows.join(", ")}`);
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${room}'`);
    const out = await rated.settleMatch(client, id, Date.now());
    const outcome = out.state === "settled" ? out.result.ratings : null;
    check(out.state === "settled" && outcome?.ok === true && outcome.status === "recorded", `${label}: W3a records the match (${outcome && !outcome.ok ? outcome.reason : out.state})`);
    if (!outcome?.ok) return;
    const byUser = new Map(outcome.players.map((p) => [p.playerId, p]));
    check(outcome.players.length === size && outcome.players.every((p) => !p.moved && p.changes.length === 0 && p.frozen === "flagged_run"), `${label}: nobody's rating moves (every player frozen "flagged_run")`);
    check(ratingsOf(users) === before.ratings, `${label}: every stored rating unchanged`);
    check(profileOf(users) === before.profiles, `${label}: placement, matches, wins, streaks and podiums unchanged for everyone (${before.profiles.slice(0, 120)} → ${profileOf(users).slice(0, 120)})`);
    // The competitive badges (W3a's RATED_BADGES, Podium Regular among them) are the rated rule's: none for anyone.
    const ratedBadgesOf = (us: string[]) =>
      q(`SELECT count(*) FROM public.player_badges WHERE user_id = ANY(ARRAY[${us.map((u) => `'${u}'`).join(",")}]::uuid[]) AND badge = ANY(ARRAY[${RATED_BADGES.map((b) => `'${b}'`).join(",")}])`);
    check(outcome.players.every((p) => p.badges.length === 0) && (!hasBadgeTable || ratedBadgesOf(users) === before.ratedBadges), `${label}: no competitive badges for anyone (Podium Regular included)`);
    // Joe's decision (11 Nov 2026), built by E2 (#378) in its badge_facts: a flagged run never counts towards any badge,
    // and the innocent player's own clean runs still count for their own-play badges. The flagged player's only 200 is
    // the flagged run, so they gain nothing from this match; slot 1's clean 200s earn Flawless.
    if (hasBadgeTable) {
      check(userBadges(flaggedUser) === flaggedBadgesBefore, `${label}: the flagged player earns no badge from the match (${flaggedBadgesBefore || "none"} → ${userBadges(flaggedUser) || "none"})`);
      check(userBadges(slotUser[0]!).split(",").includes("flawless"), `${label}: the unflagged player's Flawless stands (${userBadges(slotUser[0]!) || "none"})`);
    }
    const counted = q(`SELECT string_agg(DISTINCT counted::text || ',' || moved::text || ',' || coalesce(frozen, '-'), ';') FROM public.rated_match_players WHERE match_id = '${id}'`);
    check(counted === "false,false,flagged_run", `${label}: every player's row stored as not counted, not moved, frozen flagged_run (${counted})`);
    check(byUser.get(flaggedUser)?.flagged === true && byUser.get(flaggedUser)?.joules === 0, `${label}: the flagged player gets no Joules`);
    const others = slotUser.filter((u) => u !== flaggedUser);
    check(others.every((u) => byUser.get(u)?.flagged === false && byUser.get(u)?.joules === (byUser.get(u)?.place === 1 ? 225 : 150)), `${label}: the others keep their Joules (225 first, 150 the rest)`);
    check(q(`SELECT string_agg(joules::text, ',' ORDER BY player_id) FROM public.rated_match_players WHERE match_id = '${id}'`) === [...slotUser].sort().map((u) => String(byUser.get(u)?.joules)).join(","), `${label}: the stored Joules match`);
    const flags = q(`SELECT string_agg(player_id::text || ':' || coalesce(game_idx::text, '-') || ':' || reason || ':' || (resolved_at IS NULL)::text, ',') FROM moderation.rated_flags WHERE match_id = '${id}'`);
    check(flags === `${flaggedUser}:1:replay_mismatch:true`, `${label}: logged for review once, the flagged player's game 2, unresolved (${flags})`);
    const fin = await (async () => {
      await flushAnalytics();
      return Number(q(`SELECT count(*) FROM analytics.events WHERE event = 'multiplayer_match_finished' AND room_id IS NULL AND (props->>'size') = '${size}'`));
    })();
    check(fin >= size, `${label}: the finish events still recorded (the match was played)`);
    const again = await rated.settleMatch(client, id, Date.now());
    check(again.state === "settled" && q(`SELECT count(*) FROM moderation.rated_flags WHERE match_id = '${id}'`) === "1" && profileOf(users) === before.profiles, `${label}: settling again changes nothing`);
  }

  await section("a flagged run in a 4-player match", async () => {
    // I, J, K and L already played the real-engine match above, so they have ratings and profiles to keep.
    await flaggedMatch(4, [I, J, K, L], 3);
  });

  await section("a flagged run in an 8-player match", async () => {
    await flaggedMatch(8, EIGHT, 2);
  });

  // Joe's leaving rule (12 Nov 2026, built in W3b, settled through W3d's multiSettlement): once the games begin, a
  // player away for good places below everyone who stayed (the latest leaver highest) and earns no Joules; the rest
  // place among themselves by placing points, then total score. The leaver is marked as W3b's reviewDepartures marks
  // one who played on (gone in the match, left in the room). Slot 1 plays the best game 1, then leaves.
  async function leaverMatch(users: string[], flaggedSlot: number | null): Promise<void> {
    const label = flaggedSlot ? "a leaver and a flagged run" : "one leaver";
    const sw = { ...RATED_SWITCHES, formats: { ...RATED_SWITCHES.formats, ffa4: true } };
    const t = Date.now();
    for (const u of users) await rated.pollQueue(client, u, t);
    for (const u of users) {
      const joined = await rated.joinQueue(client, u, { format: "ffa4", choice: "mixed" }, t, sw);
      check(joined.ok, `${label}: ${u.slice(-2)} joins the queue (${joined.ok ? "ok" : joined.reason})`);
    }
    const found = await rated.pollQueue(client, users[0]!, t + 200);
    check(found.state === "found", `${label}: a match of 4`);
    if (found.state !== "found") return;
    const id = found.match.matchId;
    const room = found.match.roomId!;
    const slotUser = q(`SELECT string_agg(user_id::text, ',' ORDER BY player_slot) FROM public.duel_players WHERE duel_id = '${room}'`).split(",");
    const leaver = slotUser[0]!;
    const flaggedUser = flaggedSlot ? slotUser[flaggedSlot - 1]! : null;
    const before = { profiles: profileOf(users), ratings: ratingsOf(users) };
    // Game 1: everyone (slot 1 best); games 2 and 3: the three who stayed. Slot n scores 200 - 20 (n - 1).
    const rows = [0, 1, 2].flatMap((r) =>
      slotUser.flatMap((_, i) => {
        if (i === 0 && r > 0) return [];
        const extra = flaggedSlot && i + 1 === flaggedSlot && r === 1 ? `'{"flagged": true, "flagReason": "replay_mismatch"}'::jsonb` : "NULL";
        return [`('${room}', ${i + 1}, ${r + 1}, ${200 - i * 20}, 1000, true, 'x', ${extra})`];
      }),
    );
    q(`INSERT INTO public.round_results (duel_id, player_slot, round_number, score, ms_remaining, is_correct, answer, extra) VALUES ${rows.join(", ")}`);
    q(`UPDATE public.mm_match_players SET gone_at = now() - interval '2 minutes' WHERE match_id = '${id}' AND user_id = '${leaver}'`);
    q(`UPDATE public.duel_players SET status = 'left' WHERE duel_id = '${room}' AND user_id = '${leaver}'`);
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${room}'`);
    const out = await rated.settleMatch(client, id, Date.now());
    check(out.state === "settled", `${label}: settles (${out.state})`);
    if (out.state !== "settled") return;
    const placesBySlot = slotUser.map((u) => out.result.placings?.[u]);
    // Stayers' placing points: slot 2 3 + 5 + 5 = 13, slot 3 1 + 3 + 3 = 7, slot 4 0 + 1 + 1 = 2.
    check(JSON.stringify(placesBySlot) === "[4,1,2,3]", `${label}: the leaver last despite the best game 1, the rest by points then total score (${JSON.stringify(placesBySlot)})`);
    check(out.result.ending?.kind === "forfeit" && out.result.ending.leavers.join() === leaver, `${label}: the settlement names the leaver (W3b's ending)`);
    const outcome = out.result.ratings;
    check(outcome?.ok === true && outcome.status === "recorded", `${label}: W3a records the match (${outcome && !outcome.ok ? outcome.reason : "-"})`);
    if (!outcome?.ok) return;
    const byUser = new Map(outcome.players.map((p) => [p.playerId, p]));
    check(byUser.get(leaver)?.joules === 0 && byUser.get(leaver)?.place === 4, `${label}: the leaver earns no Joules, placed 4th`);
    check(q(`SELECT joules::text FROM public.rated_match_players WHERE match_id = '${id}' AND player_id = '${leaver}'`) === "0", `${label}: the leaver's stored Joules are 0`);
    if (!flaggedUser) {
      check(byUser.get(leaver)?.moved === true, "one leaver: the leaver's rating moves as last place");
      check(byUser.get(slotUser[1]!)?.joules === 225 && byUser.get(slotUser[2]!)?.joules === 150 && byUser.get(slotUser[3]!)?.joules === 150, "one leaver: the players who stayed keep their Joules (225 first, 150 the rest)");
      check(ratingsOf(users) !== before.ratings, "one leaver: ratings move");
    } else {
      check(outcome.players.every((p) => !p.moved && p.frozen === "flagged_run"), "a leaver and a flagged run: nobody's rating moves (frozen flagged_run), the leaver included");
      check(ratingsOf(users) === before.ratings && profileOf(users) === before.profiles, "a leaver and a flagged run: every stored rating and profile unchanged");
      check(byUser.get(flaggedUser)?.flagged === true && byUser.get(flaggedUser)?.joules === 0, "a leaver and a flagged run: the flagged player gets no Joules");
      const others = slotUser.filter((u) => u !== leaver && u !== flaggedUser);
      check(others.every((u) => byUser.get(u)?.joules === (byUser.get(u)?.place === 1 ? 225 : 150)), "a leaver and a flagged run: the other two keep their Joules (225 first, 150 the rest)");
      const flags = q(`SELECT string_agg(player_id::text || ':' || coalesce(game_idx::text, '-'), ',') FROM moderation.rated_flags WHERE match_id = '${id}'`);
      check(flags === `${flaggedUser}:1`, `a leaver and a flagged run: logged for review once, the flagged player's game 2 (${flags})`);
    }
    const again = await rated.settleMatch(client, id, Date.now());
    check(again.state === "settled" && JSON.stringify(slotUser.map((u) => again.result.placings?.[u])) === JSON.stringify(placesBySlot), `${label}: settling again changes nothing`);
  }

  await section("one leaver in a 4-player match", async () => {
    await leaverMatch(LEAVE, null);
  });

  await section("a leaver and a flagged run in a 4-player match", async () => {
    await leaverMatch(LEAVE_FLAG, 3);
  });

}
