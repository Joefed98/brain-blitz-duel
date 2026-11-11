/**
 * ratings-check (wave 3, session W3a, 11 Nov 2026; docs/rated/README.md, docs/rated/ratings-interface.md): the
 * ratings engine, pure and on a local PostgreSQL 16 with every migration applied (scripts/server-fn-harness.ts).
 *
 * What it proves:
 * - the Glicko-2 targets (src/lib/rated/glicko.config.ts) on simulated players: placement matches move 100–200; a
 *   newish player's moves shrink gradually from about 100 to about 25; a settled player moves 8–15 a match; after
 *   about 3 months away a match moves about 25; upsets move more; the chess scale (400 apart ≈ 10 in 11); start 1,000,
 *   floor 100; a seeded population of 240 players with hidden skills shows the same;
 * - Mixed moves Puzzles or Arcade at half weight (categories at the full game weight); the Joulz Rating weighs the
 *   pools by 90 days of games (equal with none; a pool never played never counts), the same in TS and SQL;
 * - a recorded run moves its owner at most half as much as live, only from a rated game, and not past 5 uses a day;
 *   room, Daily and Practice runs never move their owner; the 4th rated match between two live players in a UK day
 *   plays but moves nothing, and the count starts again at UK midnight;
 * - placement hides every rating for exactly 5 matches, then reveals the tier once; tiers and divisions at every
 *   threshold; caps count only from 1,000 rated players; Storm's top 3% and Top 500's rank with the 3-day grace;
 *   "Storm-rated, top 4%";
 * - recordRatedMatch is idempotent (also racing), never loses a concurrent update, refuses a game in the wrong pool,
 *   stores each game's dealt signature, and can't be reached from the phone: no server function exports it and anon
 *   and authenticated can't run a rated function or read or write a rated table;
 * - Joules: 150 / 100 for a best of 3, 1.5× for best of 5 or 7 and 4 or 8 players, stored once per player;
 * - each competitive badge (First Win, Placed, Hot Streak, Comeback Kid, Clean Sweep, Podium Regular, Unstoppable,
 *   Giant Slayer, Storm Chaser, Lightning Strikes, Top 500, Revenge, Photo Finish) awarded by a real match, once, and
 *   not by the match just short of it;
 * - the events rated_match_finished, placement_finished, tier_changed; the Cron Trigger's schedule; the R-challenge
 *   switch; the ratings engine reaches no economy module.
 *
 * Needs the PostgreSQL 16 binaries for the database part (preinstalled on GitHub's runners; without them it fails on
 * CI and prints a NOTE locally). No browser.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import {
  accountToken,
  ANON_KEY,
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
const quietWarn = console.warn;
const quietError = console.error;
const report: string[] = [];
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE|TARGET)|^ratings-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const cfg = await import("../src/lib/rated/glicko.config");
const gl = await import("../src/lib/rated/glicko2");
const mt = await import("../src/lib/rated/match");
const tiers = await import("../src/lib/rated/tiers");
const joules = await import("../src/lib/rated/joules");
const catalogue = await import("../src/lib/duel/catalogue");
const { dealtSignature } = await import("../src/lib/duel/dealSignature");
const { ukDayKey } = await import("../src/lib/duel/daily");
type Glicko = import("../src/lib/rated/glicko2").GlickoState;
type Result = import("../src/lib/data/ratings").RatedMatchResult;

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 16, 12); // Mon 16 Nov 2026, 12:00 UK (GMT)

/** A deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A best-of-3 All puzzles match's two games, won 2–0 (score 1) or lost 0–2 (score 0): one "match" in the targets. */
const sweep = (score: number, opp: { rating: number; rd: number }): import("../src/lib/rated/glicko2").GlickoResult[] => [
  { opponentRating: opp.rating, opponentRd: opp.rd, score, weight: cfg.GAME_WEIGHT },
  { opponentRating: opp.rating, opponentRd: opp.rd, score, weight: cfg.GAME_WEIGHT },
];
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN;
};

const PUZZLE_TYPE = catalogue.ACTIVE_PUZZLE_TYPES.find((t) => mt.gamePool(t) === "puzzles" && mt.gameCategory(t) === "logic")!;
const PUZZLE_TYPE_2 = catalogue.ACTIVE_PUZZLE_TYPES.find((t) => mt.gamePool(t) === "puzzles" && mt.gameCategory(t) === "word")!;
const ARCADE_TYPE = catalogue.ACTIVE_PUZZLE_TYPES.find((t) => mt.gamePool(t) === "arcade" && mt.gameCategory(t) !== null)!;

function game(type: string, scores: Record<string, number>): Result["games"][number] {
  return { type, pool: mt.gamePool(type)!, category: mt.gameCategory(type)!, version: "classic", signature: dealtSignature(type), scores };
}

/** A 1v1 match: each pair [a's score, b's score] one game. */
function duel(id: string, a: string, b: string, scores: [number, number][], o: Partial<Result> & { types?: string[] } = {}): Result {
  const { types, ...rest } = o;
  return {
    matchId: id,
    format: { kind: "duel", bestOf: 3 },
    choice: "puzzles",
    players: [
      { playerId: a, side: "live" },
      { playerId: b, side: "live" },
    ],
    games: scores.map(([x, y], i) => game(types?.[i] ?? (rest.choice === "arcade" ? ARCADE_TYPE : PUZZLE_TYPE), { [a]: x, [b]: y })),
    ...rest,
  };
}

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let matchSeq = 0;
const mid = () => `10000000-0000-4000-8000-${String(++matchSeq).padStart(12, "0")}`;

/* ================================================================== pure */

await section("glicko-2 targets: one player against settled opponents", async () => {
  check(cfg.START_RATING === 1000 && cfg.RATING_FLOOR === 100, "every rating starts at 1,000, floor 100");
  check(Math.abs(gl.expectedScore(1400, 1000, 0.0001) - 10 / 11) < 0.002, `chess scale: 400 apart, the stronger wins about 10 in 11 (${gl.expectedScore(1400, 1000, 0.0001).toFixed(4)})`);
  // Alternate a 2–0 win and an 0–2 loss against an equal settled opponent (RD 60), so the rating stays near 1,000.
  let s = gl.newGlickoState();
  let t = T0;
  const moves: number[] = [];
  for (let i = 0; i < 80; i++) {
    const n = gl.glickoUpdate(s, sweep(i % 2 ? 0 : 1, { rating: s.rating, rd: 60 }), (t += 3_600_000));
    moves.push(Math.abs(n.rating - s.rating));
    s = n;
  }
  const r = (k: number) => moves[k - 1]!;
  report.push(`TARGET placement matches 1–5 move ${moves.slice(0, 5).map((m) => m.toFixed(0)).join(", ")} (target 100–200)`);
  check(moves.slice(0, 5).every((m) => m >= 100 && m <= 200), "placement: each of matches 1–5 moves 100–200");
  report.push(`TARGET newish: match 6 ${r(6).toFixed(0)}, 10 ${r(10).toFixed(0)}, 20 ${r(20).toFixed(0)}, 30 ${r(30).toFixed(0)} (target about 100 down to about 25)`);
  check(r(6) >= 90 && r(6) <= 115, `newish: the 6th match moves about 100 (${r(6).toFixed(1)})`);
  check(r(30) >= 22 && r(30) <= 28, `newish: the 30th match moves about 25 (${r(30).toFixed(1)})`);
  let gradual = true;
  for (let k = 7; k <= 30; k++) if (r(k) > r(k - 1) + 0.5 || r(k - 1) - r(k) > 12) gradual = false;
  check(gradual, "newish: the moves shrink gradually (never up, never more than 12 a match) from the 6th to the 30th");
  const settled = moves.slice(49);
  report.push(`TARGET settled (matches 50–80): ${Math.min(...settled).toFixed(1)}–${Math.max(...settled).toFixed(1)} a match, RD ${s.rd.toFixed(1)} (target 8–15)`);
  check(settled.every((m) => m >= 8 && m <= 15), "settled: matches 50–80 each move 8–15");
  // Three months away.
  const away = gl.glickoUpdate(s, sweep(1, { rating: s.rating, rd: 60 }), t + 90 * DAY);
  report.push(`TARGET after 90 days away: ${(away.rating - s.rating).toFixed(1)} (target about 25)`);
  check(away.rating - s.rating >= 20 && away.rating - s.rating <= 30, `after about 3 months away a match moves about 25 (${(away.rating - s.rating).toFixed(1)})`);
  const back = gl.glickoUpdate(s, sweep(1, { rating: s.rating, rd: 60 }), t + DAY);
  check(back.rating - s.rating < 15, "a day away changes little");
  // Upsets.
  const even = gl.glickoUpdate(s, sweep(1, { rating: s.rating, rd: 60 }), t + 3_600_000).rating - s.rating;
  const upset = gl.glickoUpdate(s, sweep(1, { rating: s.rating + 400, rd: 60 }), t + 3_600_000).rating - s.rating;
  const expected = gl.glickoUpdate(s, sweep(1, { rating: s.rating - 400, rd: 60 }), t + 3_600_000).rating - s.rating;
  const upsetLoss = gl.glickoUpdate(s, sweep(0, { rating: s.rating - 400, rd: 60 }), t + 3_600_000).rating - s.rating;
  report.push(`TARGET upsets: beating +400 ${upset.toFixed(1)}, an equal ${even.toFixed(1)}, −400 ${expected.toFixed(1)}; losing to −400 ${upsetLoss.toFixed(1)}`);
  check(upset > 1.6 * even && even > 2 * expected && -upsetLoss > 1.6 * even, "upsets move more: beating someone 400 above (or losing to 400 below) moves well over an even result, an expected win far less");
  // A 2–1 moves about half a 2–0.
  const twoOne = gl.glickoUpdate(s, [...sweep(1, { rating: s.rating, rd: 60 }), { opponentRating: s.rating, opponentRd: 60, score: 0, weight: cfg.GAME_WEIGHT }], t + 3_600_000).rating - s.rating;
  check(twoOne > 0.35 * even && twoOne < 0.65 * even, `a 2–1 win moves about half a 2–0 (${twoOne.toFixed(1)} vs ${even.toFixed(1)})`);
  // The floor.
  let low = gl.newGlickoState();
  for (let i = 0; i < 200; i++) low = gl.glickoUpdate(low, sweep(0, { rating: 100, rd: 60 }), T0 + i * 3_600_000);
  check(low.rating >= 100 && low.rating < 105, `losing every match never goes below 100 (${low.rating.toFixed(1)})`);
  check(gl.rdFloor(0) === cfg.PLACEMENT_RD && gl.rdFloor(4) === cfg.PLACEMENT_RD && Math.abs(gl.rdFloor(5) - cfg.NEWISH_START_RD) < 1e-9 && Math.abs(gl.rdFloor(cfg.NEWISH_UNTIL - 1) - cfg.NEWISH_END_RD) < 1e-9 && gl.rdFloor(cfg.NEWISH_UNTIL) === cfg.MIN_RD, "the RD floor schedule: placement, newish down to its end, then the safety floor");
  // A weight of 0 changes nothing; a new rating against a new opponent.
  check(gl.glickoUpdate(s, [{ opponentRating: 1000, opponentRd: 60, score: 1, weight: 0 }], t) === s, "no weighted result: nothing moves");
  const nn = gl.glickoUpdate(gl.newGlickoState(), sweep(1, { rating: 1000, rd: 350 }), T0).rating - 1000;
  check(nn >= 100 && nn <= 200, `a placement match against another new player moves 100–200 (${nn.toFixed(0)})`);
});

await section("glicko-2 targets: a simulated population", async () => {
  const rand = rng(20261114);
  const N = 240;
  const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const skill = Array.from({ length: N }, () => 1000 + 280 * normal());
  const st: Glicko[] = Array.from({ length: N }, () => gl.newGlickoState());
  const byIndex: Record<number, number[]> = {};
  let t = T0;
  for (let round = 0; round < 110; round++) {
    // Pair neighbours by current rating (a matchmaker's rough job), with some shuffle.
    const order = [...Array(N).keys()].sort((a, b) => st[a]!.rating + 60 * normal() - (st[b]!.rating + 60 * normal()));
    t += 3_600_000;
    for (let k = 0; k + 1 < N; k += 2) {
      const a = order[k]!;
      const b = order[k + 1]!;
      // A best of 3 from the hidden skills.
      const p = 1 / (1 + 10 ** ((skill[b]! - skill[a]!) / 400));
      let wa = 0;
      let wb = 0;
      const games: number[] = [];
      while (wa < 2 && wb < 2) {
        const g = rand() < p ? 1 : 0;
        games.push(g);
        if (g) wa++;
        else wb++;
      }
      const ra = games.map((g) => ({ opponentRating: st[b]!.rating, opponentRd: st[b]!.rd, score: g, weight: cfg.GAME_WEIGHT }));
      const rb = games.map((g) => ({ opponentRating: st[a]!.rating, opponentRd: st[a]!.rd, score: 1 - g, weight: cfg.GAME_WEIGHT }));
      const na = gl.glickoUpdate(st[a]!, ra, t);
      const nb = gl.glickoUpdate(st[b]!, rb, t);
      if (games.length === 2) {
        (byIndex[st[a]!.matches + 1] ??= []).push(Math.abs(na.rating - st[a]!.rating));
        (byIndex[st[b]!.matches + 1] ??= []).push(Math.abs(nb.rating - st[b]!.rating));
      }
      st[a] = na;
      st[b] = nb;
    }
  }
  const med = (from: number, to: number) => median(Object.entries(byIndex).filter(([k]) => +k >= from && +k <= to).flatMap(([, v]) => v));
  report.push(`TARGET population (2–0 / 0–2 results): placement ${med(1, 5).toFixed(0)}, match 6 ${med(6, 6).toFixed(0)}, 28–32 ${med(28, 32).toFixed(0)}, 60–110 ${med(60, 110).toFixed(1)}`);
  check(med(1, 5) >= 100 && med(1, 5) <= 200, `population: placement matches move 100–200 (median ${med(1, 5).toFixed(0)})`);
  check(med(6, 6) >= 75 && med(6, 6) <= 125, `population: the 6th match moves about 100 (median ${med(6, 6).toFixed(0)})`);
  check(med(28, 32) >= 18 && med(28, 32) <= 32, `population: the 30th match moves about 25 (median ${med(28, 32).toFixed(0)})`);
  check(med(60, 110) >= 8 && med(60, 110) <= 15, `population: settled players move 8–15 (median ${med(60, 110).toFixed(1)})`);
  // The ratings find the skills.
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ms = mean(skill);
  const mr = mean(st.map((s) => s.rating));
  const cov = mean(skill.map((x, i) => (x - ms) * (st[i]!.rating - mr)));
  const corr = cov / Math.sqrt(mean(skill.map((x) => (x - ms) ** 2)) * mean(st.map((s) => (s.rating - mr) ** 2)));
  check(corr > 0.9, `population: after 110 matches the ratings follow the hidden skills (correlation ${corr.toFixed(3)})`);
});

/** A player before a match (pure tests). */
function pre(ratings: Partial<Record<import("../src/lib/data/ratings").RatingKey, Glicko>> = {}, profile: Partial<import("../src/lib/rated/match").RatedProfileState> = {}): import("../src/lib/rated/match").PlayerPre {
  return { profile: { ...mt.newProfileState(), ...profile }, ratings, recentGames: { puzzles: 0, arcade: 0 }, standing: null };
}
const settledAt = (rating: number): Glicko => ({ rating, rd: 60, volatility: 0.06, matches: 80, lastAt: T0 - 3_600_000 });
const ctx0 = (): import("../src/lib/rated/match").MatchContext => ({ nowMs: T0, pairCounts: {}, runUsesToday: {}, rematchLosses: {} });

await section("weights, pools and categories", async () => {
  const A = uid(1);
  const B = uid(2);
  const both = (m: Result) =>
    mt.applyMatch(m, T0, { [A]: pre({ puzzles: settledAt(1000), arcade: settledAt(1000), logic: settledAt(1000) }), [B]: pre({ puzzles: settledAt(1000), arcade: settledAt(1000), logic: settledAt(1000) }) }, ctx0());
  const all = both(duel(mid(), A, B, [[150, 100], [150, 100]], { choice: "puzzles" }));
  const mixed = both(duel(mid(), A, B, [[150, 100], [150, 100]], { choice: "mixed" }));
  const d = (x: ReturnType<typeof both>, key: string) => x.players[0]!.change.changes.find((c) => c.key === key)?.delta ?? 0;
  const ratio = d(mixed, "puzzles") / d(all, "puzzles");
  check(ratio > 0.45 && ratio < 0.55, `Mixed: each game moves its pool at half weight (${d(mixed, "puzzles").toFixed(2)} vs ${d(all, "puzzles").toFixed(2)}, ×${ratio.toFixed(3)})`);
  check(Math.abs(d(mixed, "logic") - d(all, "logic")) < 1e-9 && d(all, "logic") > 0, "the category moves at the full game weight in both");
  check(!mixed.players[0]!.change.changes.some((c) => c.key === "arcade"), "a puzzles-only match leaves Arcade alone");
  const mix2 = both(duel(mid(), A, B, [[150, 100], [100, 150], [150, 140]], { choice: "mixed", types: [PUZZLE_TYPE, ARCADE_TYPE, PUZZLE_TYPE] }));
  const keys = mix2.players[0]!.change.changes.map((c) => c.key).sort();
  check(keys.join() === ["arcade", "logic", "puzzles", mt.gameCategory(ARCADE_TYPE)!].sort().join(), `a Mixed match moves Puzzles, Arcade and each game's category (${keys.join(", ")})`);
  check(Math.abs(d(all, "puzzles") + all.players[1]!.change.changes.find((c) => c.key === "puzzles")!.delta) < 1e-6, "equal players: one's gain is the other's loss");
  // Pool and category are the server's.
  const bad = duel(mid(), A, B, [[1, 0]]);
  bad.games[0]!.pool = "arcade";
  check(mt.checkMatch(bad, T0).ok === false && (mt.checkMatch(bad, T0) as { reason: string }).reason === "pool_mismatch", "a game sent with the wrong pool is refused (pool_mismatch)");
  const badCat = duel(mid(), A, B, [[1, 0]]);
  badCat.games[0]!.category = "word";
  check((mt.checkMatch(badCat, T0) as { reason?: string }).reason === "pool_mismatch", "a game sent with the wrong category is refused");
  const arcadeInPuzzles = duel(mid(), A, B, [[1, 0]], { types: [ARCADE_TYPE] });
  check((mt.checkMatch(arcadeInPuzzles, T0) as { reason?: string }).reason === "pool_mismatch", "an arcade game in All puzzles is refused");
  const retired = [...catalogue.RETIRED_PUZZLE_TYPES][0]!;
  const ret = duel(mid(), A, B, [[1, 0]]);
  ret.games[0] = { ...ret.games[0]!, type: retired };
  check((mt.checkMatch(ret, T0) as { reason?: string }).reason === "bad_games", "a retired game can't be rated");
  check((mt.checkMatch({ ...duel(mid(), A, B, [[1, 0]]), players: [{ playerId: A, side: "live" }, { playerId: A, side: "live" }] }, T0) as { reason?: string }).reason === "bad_players", "the same player twice is refused");
  const noVersion = duel(mid(), A, B, [[1, 0]]);
  (noVersion.games[0] as { version: string }).version = "hard";
  check((mt.checkMatch(noVersion, T0) as { reason?: string }).reason === "bad_games", "every rated game deals Classic for now (another version is refused)");
  check((mt.checkMatch({ ...duel(mid(), A, B, [[1, 0]]), finishedAt: new Date(T0 + 3_600_000).toISOString() }, T0) as { reason?: string }).reason === "bad_match", "a finish time in the future is refused");
  // The 11 categories: every active game maps to one, by its kind.
  const cats = new Set(catalogue.ACTIVE_PUZZLE_TYPES.map((t) => mt.gameCategory(t)));
  check(!cats.has(null) && cats.size === 11, `every active game has one of the 11 category ratings (${[...cats].sort().join(", ")})`);
});

await section("placings (4 and 8 players)", async () => {
  const ids = [uid(11), uid(12), uid(13), uid(14)];
  const pres = Object.fromEntries(ids.map((id) => [id, pre({ puzzles: settledAt(1000), logic: settledAt(1000) })]));
  const m: Result = {
    matchId: mid(),
    format: { kind: "placings", players: 4 },
    choice: "puzzles",
    players: ids.map((playerId) => ({ playerId, side: "live" as const })),
    games: [game(PUZZLE_TYPE, { [ids[0]!]: 190, [ids[1]!]: 150, [ids[2]!]: 120, [ids[3]!]: 90 }), game(PUZZLE_TYPE, { [ids[0]!]: 180, [ids[1]!]: 170, [ids[2]!]: 110, [ids[3]!]: 100 })],
    placings: { [ids[0]!]: 1, [ids[1]!]: 2, [ids[2]!]: 3, [ids[3]!]: 4 },
  };
  const out = mt.applyMatch(m, T0, pres, ctx0());
  const d = out.players.map((p) => p.change.changes.find((c) => c.key === "puzzles")!.delta);
  const one = mt.applyMatch(duel(mid(), ids[0]!, ids[1]!, [[150, 100], [150, 100]]), T0, pres, ctx0()).players[0]!.change.changes.find((c) => c.key === "puzzles")!.delta;
  check(d[0]! > d[1]! && d[1]! > d[2]! && d[2]! > d[3]! && d[0]! > 0 && d[3]! < 0, `placings: 1st gains most, 4th loses most (${d.map((x) => x.toFixed(1)).join(", ")})`);
  check(Math.abs(d[0]! - one) / one < 0.1, `the winner of 4 moves about as much as one 1v1 win (${d[0]!.toFixed(1)} vs ${one.toFixed(1)})`);
  check(out.players[0]!.change.result === "win" && out.players[1]!.change.result === "loss" && out.players[2]!.change.place === 3, "first place is a win; the rest are losses with their place");
  check((mt.checkMatch({ ...m, placings: { ...m.placings!, [ids[3]!]: 3 } }, T0) as { ok: boolean }).ok, "level players share a place (1, 2, 3, 3)");
  check((mt.checkMatch({ ...m, placings: { ...m.placings!, [ids[3]!]: 2 } }, T0) as { reason?: string }).reason === "bad_placings", "placings that don't add up (1, 2, 3, 2) are refused");
  check(joules.ratedMatchJoules(m.format, "win") === 225 && joules.ratedMatchJoules(m.format, "loss") === 150 && joules.ratedMatchJoules({ kind: "placings", players: 8 }, "win") === 225, "4 and 8 players pay 1.5× (225 / 150)");
  check(out.players.map((p) => p.change.joules).join() === "225,150,150,150", "each live player's Joules are on their change");
});

await section("the Joulz Rating", async () => {
  const P = { rating: 1400 };
  const A = { rating: 1000 };
  check(Math.abs(mt.joulzRating({ puzzles: P, arcade: A }, { puzzles: 30, arcade: 10 })! - 1300) < 1e-9, "weighted by 90 days of games in each (30 : 10 → 1,300)");
  check(mt.joulzRating({ puzzles: P, arcade: A }, { puzzles: 0, arcade: 0 }) === 1200, "no recent play: equal weight (1,200)");
  check(mt.joulzRating({ puzzles: P }, { puzzles: 0, arcade: 12 }) === 1400, "a pool never played never counts against you");
  check(mt.joulzRating({}, { puzzles: 0, arcade: 0 }) === null, "no pool played: none");
  check(cfg.JOULZ_WINDOW_DAYS === 90 && mt.JOULZ_WINDOW_MS === 90 * DAY, "the window is 90 days");
});

await section("recorded runs and the same opponent", async () => {
  const A = uid(21);
  const B = uid(22);
  const pres = () => ({ [A]: pre({ puzzles: settledAt(1000), logic: settledAt(1000) }), [B]: pre({ puzzles: settledAt(1000), logic: settledAt(1000) }) });
  const live = mt.applyMatch(duel(mid(), A, B, [[150, 100], [150, 100]]), T0, pres(), ctx0());
  const withRun = (source: import("../src/lib/data/ratings").RunSource, uses = 0) => {
    const m = duel(mid(), A, B, [[150, 100], [150, 100]]);
    m.players[1] = { playerId: B, side: "recorded", run: { runId: "run-1", ownerId: B, source } };
    return mt.applyMatch(m, T0, pres(), { ...ctx0(), runUsesToday: { "run-1": uses } });
  };
  const ownerLive = live.players[1]!.change.changes.find((c) => c.key === "puzzles")!.delta;
  const rated = withRun("rated");
  const ownerRec = rated.players[1]!.change.changes.find((c) => c.key === "puzzles")?.delta ?? 0;
  check(ownerRec < 0 && Math.abs(ownerRec) <= 0.5 * Math.abs(ownerLive) + 1e-9 && Math.abs(ownerRec) >= 0.4 * Math.abs(ownerLive), `a rated run moves its owner at most half as much as live (${ownerRec.toFixed(2)} vs ${ownerLive.toFixed(2)})`);
  check(Math.abs(rated.players[0]!.change.changes.find((c) => c.key === "puzzles")!.delta - live.players[0]!.change.changes.find((c) => c.key === "puzzles")!.delta) < 1e-9, "the live player against a recorded run moves fully");
  for (const source of ["room", "daily", "practice"] as const) {
    const r = withRun(source);
    check(!r.players[1]!.change.moved && r.players[1]!.change.frozen === "recorded_unrated_source" && r.players[0]!.change.moved, `a ${source} run never moves its owner (the live player still moves)`);
  }
  const fifth = withRun("rated", 4);
  const sixth = withRun("rated", 5);
  check(fifth.players[1]!.change.moved && !sixth.players[1]!.change.moved && sixth.players[1]!.change.frozen === "recorded_daily_limit", "a run's 5th use in a UK day moves its owner, its 6th doesn't");
  check(rated.runUses.length === 1 && sixth.runUses[0]!.moved === false, "every use is recorded, with whether it moved its owner");
  check(rated.players[1]!.change.joules === 0 && rated.players[1]!.counted === false, "a run's owner earns no Joules and plays no placement match");
  // The 4th match in a UK day.
  const k = mt.pairKey(A, B);
  const third = mt.applyMatch(duel(mid(), A, B, [[150, 100], [150, 100]]), T0, pres(), { ...ctx0(), pairCounts: { [k]: 2 } });
  const fourth = mt.applyMatch(duel(mid(), A, B, [[150, 100], [150, 100]]), T0, pres(), { ...ctx0(), pairCounts: { [k]: 3 } });
  check(third.players.every((p) => p.change.moved), "the 3rd rated match against the same player in a day moves ratings");
  check(fourth.players.every((p) => !p.change.moved && p.change.frozen === "same_opponent_today" && !p.counted), "from the 4th, the match plays but neither rating moves");
  check(fourth.players.every((p) => p.change.joules > 0) && fourth.pairs.length === 1, "a frozen match still pays Joules and is counted for the day");
  const recFourth = withRun("rated");
  check(recFourth.pairs.length === 0, "a recorded run isn't a live opponent (the 4th-match rule counts live pairs only)");
});

await section("placement and tiers", async () => {
  check(mt.placementOf(0).label === "Placement 1 of 5" && mt.placementOf(4).label === "Placement 5 of 5" && mt.placementOf(5).done && mt.placementOf(5).label === null, "“Placement 1 of 5” … “Placement 5 of 5”, then done");
  const ladder: [number, string][] = [];
  for (const def of tiers.TIER_DEFS) def.at.forEach((at, i) => ladder.push([at, `${def.name} ${["III", "II", "I"][i]}`]));
  const expectedLadder = "100 Spark III,300 Spark II,500 Spark I,700 Charge III,850 Charge II,1000 Charge I,1100 Volt III,1250 Volt II,1400 Volt I,1500 Surge III,1650 Surge II,1800 Surge I,1900 Storm III,2050 Storm II,2200 Storm I,2400 Lightning III,2550 Lightning II,2700 Lightning I";
  check(ladder.map(([a, l]) => `${a} ${l}`).join() === expectedLadder, "the thresholds are the master plan's");
  let every = true;
  for (let i = 0; i < ladder.length; i++) {
    const [at, label] = ladder[i]!;
    if (tiers.tierFor(at).label !== label) every = false;
    if (i > 0 && tiers.tierFor(at - 1).label !== ladder[i - 1]![1]) every = false;
    if (tiers.tierFor(at - 0.4).label !== label) every = false; // shown as `at`
  }
  check(every, "every threshold: its division at the threshold (and at a rating shown as it), the one below a point under");
  check(tiers.tierFor(100).label === "Spark III" && tiers.tierFor(5000).label === "Lightning I", "the floor is Spark III, the top Lightning I");
  check(tiers.tierFor(1278).next?.label === "Volt I" && tiers.tierFor(1278).next?.pointsToGo === 122, "the next step: 1,278 is 122 to Volt I (the ladder's own example)");
  const capsOff = { capsActive: false, stormOk: false, top500Ok: false, rank: 3, share: 0.2 };
  check(tiers.tierFor(1950, capsOff).label === "Storm III" && tiers.tierFor(2500, capsOff).tier === "lightning", "before 1,000 rated players tiers go by rating alone (no cap, no Top 500)");
  const held = tiers.tierFor(1950, { capsActive: true, stormOk: false, top500Ok: false, rank: 40, share: 0.035 });
  check(held.label === "Surge I" && held.heldBack?.label === "Storm-rated, top 4%" && held.heldBack.ratedTier === "storm", `held back by the cap: “${held.heldBack?.label}”, shown Surge I`);
  check(tiers.tierFor(1950, { capsActive: true, stormOk: true, top500Ok: false, rank: 20, share: 0.02 }).label === "Storm III", "in the top 3%: Storm");
  check(tiers.tierFor(2500, { capsActive: true, stormOk: true, top500Ok: true, rank: 37, share: 0.01 }).label === "Top 500 #37", "Lightning and in the top 500: “Top 500 #37”");
  check(tiers.tierFor(2500, { capsActive: true, stormOk: true, top500Ok: false, rank: 600, share: 0.01 }).label === "Lightning III", "Lightning outside the top 500: Lightning");
  check(tiers.tierFor(2300, { capsActive: true, stormOk: true, top500Ok: true, rank: 10, share: 0.01 }).tier === "storm", "Top 500 needs Lightning");
  check(tiers.tierFor(2500, { capsActive: true, stormOk: false, top500Ok: false, rank: 1200, share: 0.05 }).heldBack?.label === "Lightning-rated, top 5%", "Lightning outside the top 3% is held back too");
  check(tiers.CAPS_FROM_PLAYERS === 1000 && tiers.STORM_TOP_SHARE === 0.03 && tiers.TOP_500 === 500 && tiers.CAP_GRACE_DAYS === 3, "caps from 1,000 rated players, top 3%, top 500, 3 days' grace");
  const ladderRungs = tiers.tierLadder();
  check(ladderRungs.length === 7 && ladderRungs[0]!.tier === "top500" && ladderRungs[2]!.cap === "and top 3%" && ladderRungs[6]!.from === 100 && ladderRungs[6]!.to === 699, "the ladder: Top 500 first, Storm's cap, Spark 100–699");
});

await section("config, switch and schedule", async () => {
  const { RATED_PLAY_FOR_EVERYONE, ratedChallengesDrawable } = await import("../src/config/ratedConfig");
  check(RATED_PLAY_FOR_EVERYONE === false && ratedChallengesDrawable() === false, "rated play is off for everyone, so no R challenge can be drawn");
  const src = readFileSync("src/config/ratedConfig.ts", "utf8");
  check(!/window|__DUELZ|import\.meta/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), "the switch is a plain constant (no window override for a production build to ignore)");
  check(joules.ratedMatchJoules({ kind: "duel", bestOf: 3 }, "win") === 150 && joules.ratedMatchJoules({ kind: "duel", bestOf: 3 }, "loss") === 100 && joules.ratedMatchJoules({ kind: "duel", bestOf: 5 }, "win") === 225 && joules.ratedMatchJoules({ kind: "duel", bestOf: 7 }, "loss") === 150 && joules.ratedMatchJoules({ kind: "duel", bestOf: 3 }, "draw") === 100, "Joules: 150 / 100 a best of 3, 225 / 150 a best of 5 or 7, a draw as a loss");
  check(joules.ratedJoulesKey("m", "p") === "rated_match:m:p", "D2's key: rated_match:<match>:<player>");
  const { RATED_CRONS } = await import("../src/lib/rated/tasks/ratedTasks.server");
  const vite = readFileSync("vite.config.ts", "utf8");
  const cron = RATED_CRONS["rated:standings"];
  check(vite.includes(`"${cron}": ["rated:standings"]`) && vite.includes('"rated:standings": { handler: fileURLToPath(new URL("./src/lib/rated/tasks/standings.task.ts"') && existsSync("src/lib/rated/tasks/standings.task.ts") && vite.includes("nitroTasks(RATED_TASKS)"), `the Cron Trigger: "${cron}" runs rated:standings (vite.config.ts and RATED_CRONS agree)`);
  const config = readFileSync("src/lib/rated/glicko.config.ts", "utf8");
  const constants = [...config.matchAll(/^export const ([A-Z_]+) =/gm)].map((m) => m[1]!);
  check(constants.length >= 20 && constants.every((c) => new RegExp(`Target|${c}`).test(config)), `every constant lives in glicko.config.ts (${constants.length})`);
});

await section("phone and economy reach", async () => {
  // No server function the phone can call exports recordRatedMatch / finishRatedMatch.
  const SRC = resolve("src");
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : /\.(ts|tsx)$/.test(n) ? [join(dir, n)] : []));
  const files = walk(SRC);
  const fnFiles = files.filter((f) => /\.functions\.ts$/.test(f) && /(recordRatedMatch|finishRatedMatch|rated_apply_match)/.test(readFileSync(f, "utf8")));
  check(fnFiles.length === 0, `no *.functions.ts file names recordRatedMatch, finishRatedMatch or rated_apply_match (${fnFiles.map((f) => relative(".", f)).join(", ") || "none"})`);
  const phone = files.filter((f) => !/\.server\.ts$|\.functions\.ts$|\/tasks\//.test(f) && /from\s+["'][^"']*rated\/(ratings|rewards)\.server["']/.test(readFileSync(f, "utf8")));
  check(phone.length === 0, `no phone module imports the ratings server (${phone.map((f) => relative(".", f)).join(", ") || "none"})`);
  const fnsText = readFileSync("src/lib/rated/ratings.functions.ts", "utf8");
  check((fnsText.match(/createServerFn/g) ?? []).length === 5 && !/recordRatedMatch|finishRatedMatch/.test(fnsText.replace(/\/\*[\s\S]*?\*\//g, "")), "the ratings server functions are the four reads (plus the import)");
  // The ratings engine reaches no economy module (economy-neutral-check's walk, from the engine's own files).
  const EXTS = ["", ".ts", ".tsx", "/index.ts"];
  const SPEC = /(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  const resolveSpec = (from: string, spec: string) => {
    const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
    if (!base) return null;
    for (const e of EXTS) if (existsSync(base + e) && statSync(base + e).isFile()) return base + e;
    return null;
  };
  const reach = (roots: string[]) => {
    const seen = new Set<string>();
    const q = [...roots];
    while (q.length) {
      const f = q.shift()!;
      if (seen.has(f)) continue;
      seen.add(f);
      for (const m of readFileSync(f, "utf8").matchAll(SPEC)) {
        const p = resolveSpec(f, (m[1] ?? m[2] ?? m[3])!);
        if (p && !seen.has(p)) q.push(p);
      }
    }
    return seen;
  };
  const engine = ["ratings.server.ts", "match.ts", "glicko2.ts", "tiers.ts", "joules.ts", "glicko.config.ts"].map((f) => join(SRC, "lib/rated", f));
  const leaks = [...reach(engine)].filter((p) => /src\/lib\/economy\/|src\/lib\/data\/economy|src\/lib\/badges\//.test(p));
  check(leaks.length === 0, `the ratings engine reaches no economy or badge module (${leaks.map((p) => relative(".", p)).join(", ") || "none"})`);
  check([...reach([join(SRC, "lib/rated/rewards.server.ts")])].some((p) => /src\/lib\/badges\/badges\.server\.ts$/.test(p)), "control: finishRatedMatch reaches the badges");
});

/* ================================================================== database */

if (!postgresBin()) {
  restore();
  for (const l of report) console.log(`  ${l}`);
  if (process.env["CI"]) {
    console.log(`ratings-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`ratings-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

let db: LocalDb | null = null;
let rest: RestServer | null = null;
try {
  db = startLocalDb("ratings-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
for (const l of report) console.log(`  ${l}`);
console.log(`ratings-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: the ratings engine holds.");

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const rs = await import("../src/lib/rated/ratings.server");
  const rw = await import("../src/lib/rated/rewards.server");
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const client = (key: string, token?: string) =>
    createClient<import("../src/integrations/supabase/types").Database>(rest.url, key, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
  const admin = client(SERVICE_KEY);
  const events = async (event: string, player?: string) => {
    await flushAnalytics();
    return Number(q(`SELECT count(*) FROM analytics.events WHERE event = '${event}'${player ? ` AND player_id = '${player}'` : ""}`));
  };
  const hasBadge = (id: string, b: string) => Number(q(`SELECT count(*) FROM player_badges WHERE user_id = '${id}' AND badge = '${b}'`));
  const rating = (id: string, key = "puzzles") => Number(q(`SELECT coalesce((SELECT rating FROM rated_ratings WHERE player_id = '${id}' AND key = '${key}'), -1)`));

  // Players 100–199: accounts (profiles) for the badges; 1000–2199: the standings' crowd (auth users only).
  q(`INSERT INTO auth.users (id, is_anonymous, email) SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, false, 'p' || n || '@example.com' FROM generate_series(100, 199) n`);
  q(`INSERT INTO auth.users (id, is_anonymous) SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, true FROM generate_series(1000, 2199) n`);
  for (let n = 100; n < 140; n++) q(`SELECT public.create_profile('${uid(n)}', 'Rated_${n}', 2::smallint, DATE '1990-01-01', NULL)`);

  let clock = T0;
  const tick = (ms = 600_000) => (clock += ms);
  const record = (m: Result, at = tick()) => rw.finishRatedMatch(admin, m, at);

  await section("access: nothing reachable from the phone", async () => {
    const anon = client(ANON_KEY);
    const user = client(ANON_KEY, accountToken(uid(100)));
    const m = duel(mid(), uid(100), uid(101), [[1, 0], [1, 0]]);
    for (const [who, c] of [["anon", anon], ["authenticated", user]] as const) {
      const apply = await c.rpc("rated_apply_match", { p: { match_id: m.matchId } });
      check(!!apply.error, `${who} can't run rated_apply_match`);
      const state = await c.rpc("rated_state", { p_match_id: null, p_players: [uid(100)], p_day: "2026-11-16", p_since: "2026-01-01", p_run_ids: [], p_rematch_of: null });
      check(!!state.error, `${who} can't run rated_state`);
      const read = await c.from("rated_ratings" as never).select("*");
      check(!!read.error || (read.data as unknown[] | null)?.length === 0, `${who} can't read rated_ratings`);
      const ins = await c.from("rated_profiles" as never).insert({ player_id: uid(100) } as never);
      check(!!ins.error, `${who} can't write rated_profiles`);
    }
    const privs = q(`SELECT string_agg(p.proname || ':' || has_function_privilege(r, p.oid, 'EXECUTE'), ',' ORDER BY p.proname, r)
                       FROM pg_proc p, unnest(ARRAY['anon', 'authenticated']) r
                      WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'rated\\_%' AND p.proname <> 'rated_ms'`);
    check(!privs.includes(":true"), `anon and authenticated execute no rated function (${privs.split(",").length / 2} functions)`);
    const tbl = q(`SELECT count(*) FROM information_schema.role_table_grants WHERE table_name LIKE 'rated\\_%' AND grantee IN ('anon', 'authenticated')`);
    check(tbl === "0", "anon and authenticated have no right on any rated table");
    const svcWrite = q(`SELECT count(*) FROM information_schema.role_table_grants WHERE table_name LIKE 'rated\\_%' AND grantee = 'service_role' AND privilege_type <> 'SELECT'`);
    check(svcWrite === "0", "the service role writes no rated table directly (only through the functions)");
    const out = await rs.recordRatedMatch(admin, m, tick());
    check(out.ok && out.status === "recorded", "the server records a match through the service role");
  });

  await section("idempotent, concurrent, signatures", async () => {
    const A = uid(102);
    const B = uid(103);
    const m = duel(mid(), A, B, [[150, 100], [150, 120]]);
    const first = await record(m);
    const ra = rating(A);
    const again = await record(m);
    check(first.ok && first.status === "recorded" && again.ok && again.status === "duplicate", "the same match id twice: recorded, then duplicate");
    check(rating(A) === ra && q(`SELECT count(*) FROM rated_match_players WHERE match_id = '${m.matchId}'`) === "2", "the duplicate moves nothing and stores nothing more");
    check(again.ok && JSON.stringify(again.players.map((p) => p.changes.map((c) => [c.key, c.delta.toFixed(6)]))) === JSON.stringify((first as { players: { changes: { key: string; delta: number }[] }[] }).players.map((p) => p.changes.map((c) => [c.key, c.delta.toFixed(6)]))), "the duplicate answers the stored changes");
    const race = duel(mid(), A, B, [[150, 100], [150, 100]]);
    const at = tick();
    const all = await Promise.all(Array.from({ length: 4 }, () => rs.recordRatedMatch(admin, race, at)));
    check(all.filter((o) => o.ok && o.status === "recorded").length === 1 && all.every((o) => o.ok), `racing the same match: one recorded, the rest duplicates (${all.map((o) => (o.ok ? o.status : o.reason)).join(", ")})`);
    // Two different matches for the same player at once: neither update is lost.
    const C = uid(104);
    const D = uid(105);
    const before = q(`SELECT matches FROM rated_ratings WHERE player_id = '${A}' AND key = 'puzzles'`);
    const at2 = tick();
    const pair = await Promise.all([rs.recordRatedMatch(admin, duel(mid(), A, C, [[150, 100], [150, 100]]), at2), rs.recordRatedMatch(admin, duel(mid(), A, D, [[150, 100], [150, 100]]), at2)]);
    check(pair.every((o) => o.ok && o.status === "recorded"), "two matches for one player at once both record");
    check(Number(q(`SELECT matches FROM rated_ratings WHERE player_id = '${A}' AND key = 'puzzles'`)) === Number(before) + 2, "and both moved the rating (no lost update)");
    const sig = q(`SELECT signature FROM rated_games WHERE match_id = '${m.matchId}' AND idx = 0`);
    check(sig === dealtSignature(PUZZLE_TYPE), `each game's dealt signature is stored (${sig})`);
    const wrong = duel(mid(), A, B, [[1, 0]]);
    wrong.games[0]!.pool = "arcade";
    const refused = await record(wrong);
    check(!refused.ok && refused.reason === "pool_mismatch" && q(`SELECT count(*) FROM rated_matches WHERE match_id = '${wrong.matchId}'`) === "0", "a game in the wrong pool: refused, nothing stored");
  });

  await section("placement, the 4th match across UK midnight, Joules, events", async () => {
    const A = uid(110);
    const opps = [uid(111), uid(112), uid(113), uid(114), uid(115), uid(116)];
    for (let i = 0; i < 4; i++) {
      await record(duel(mid(), A, opps[i]!, [[150, 100], [150, 100]]));
      const view = await rs.getMyRatings(admin, A, clock);
      if (view.joulz !== null || view.tier !== null || view.pools !== null || view.placement.label !== `Placement ${i + 2} of 5`) check(false, `after placement match ${i + 1}: every rating hidden ("${view.placement.label}")`);
    }
    check(true, "placement matches 1–4: every rating hidden, “Placement n of 5”");
    const fifth = await record(duel(mid(), A, opps[4]!, [[150, 100], [150, 100]]));
    const me = fifth.ok ? fifth.players.find((p) => p.playerId === A)! : null;
    check(!!me && me.placement.justFinished && me.placement.done && me.tier.after !== null && me.joulz.after !== null && me.tier.before === null, "the 5th: placement done, the reveal (tier and Joulz Rating) once");
    const view = await rs.getMyRatings(admin, A, clock);
    check(view.joulz !== null && view.tier !== null && view.pools?.puzzles.status === "rated" && view.pools.arcade.status === "not_played" && (view.pools.puzzles as { provisional: boolean }).provisional, `after 5: shown (${view.joulz}, ${view.tier?.label}); Arcade “Not played yet”; Puzzles provisional`);
    const sixth = await record(duel(mid(), A, opps[5]!, [[150, 100], [150, 100]]));
    check(sixth.ok && !sixth.players.find((p) => p.playerId === A)!.placement.justFinished, "the reveal isn't repeated on the 6th");
    check((await events("placement_finished", A)) === 1, "placement_finished once");
    check((await events("rated_match_finished", A)) === 6, "rated_match_finished for each match");
    const props = q(`SELECT props::text FROM analytics.events WHERE event = 'rated_match_finished' AND player_id = '${A}' LIMIT 1`);
    check(/"format": "bo3"/.test(props) && /"choice": "puzzles"/.test(props) && /"result": "win"/.test(props) && /"opponent": "live"/.test(props), `rated_match_finished carries format, choice, result, live or recorded (${props})`);
    check(q(`SELECT string_agg(joules::text, ',') FROM rated_match_players WHERE player_id = '${A}'`) === "150,150,150,150,150,150" && q(`SELECT joules FROM rated_match_players WHERE player_id = '${opps[0]}'`) === "100", "Joules stored: 150 a win, 100 a loss");
    // The 4th match against one live opponent in a UK day, and midnight.
    const B = uid(117);
    const C = uid(118);
    clock = Date.UTC(2026, 10, 18, 22, 0); // Wed 18 Nov, 22:00 UK (GMT)
    const outs = [];
    for (let i = 0; i < 4; i++) outs.push(await record(duel(mid(), B, C, [[150, 100], [150, 100]]), (clock += 10 * 60_000)));
    check(outs.slice(0, 3).every((o) => o.ok && o.players.every((p) => p.moved)) && outs[3]!.ok && (outs[3] as { players: { moved: boolean; frozen: string | null }[] }).players.every((p) => !p.moved && p.frozen === "same_opponent_today"), "the 4th rated match against the same player in a UK day moves nothing");
    const rb = rating(B);
    clock = Date.UTC(2026, 10, 18, 23, 59);
    const late = await record(duel(mid(), B, C, [[150, 100], [150, 100]]), clock);
    check(late.ok && late.players.every((p) => !p.moved) && rating(B) === rb, "a 5th at 23:59 the same UK day: still frozen");
    const next = await record(duel(mid(), B, C, [[150, 100], [150, 100]]), Date.UTC(2026, 10, 19, 0, 1));
    check(next.ok && next.players.every((p) => p.moved) && rating(B) > rb, "after UK midnight the count starts again: the match moves ratings");
    check(ukDayKey(Date.UTC(2026, 6, 1, 23, 30)) === "2026-07-02", "UK days follow British Summer Time (23:30 UTC in July is the next UK day)");
    check(q(`SELECT string_agg(matches::text, ',' ORDER BY uk_day) FROM rated_pair_days WHERE player_a = '${B < C ? B : C}'`) === "5,1", "pair counts kept by UK day (5, then 1)");
  });

  await section("recorded runs on the database", async () => {
    const A = uid(119);
    const B = uid(120);
    await record(duel(mid(), A, B, [[150, 100], [150, 100]]));
    const rb = rating(B);
    for (let i = 0; i < 6; i++) {
      const m = duel(mid(), A, B, [[150, 100], [150, 100]]);
      m.players[1] = { playerId: B, side: "recorded", run: { runId: "run-abc", ownerId: B, source: "rated" } };
      await record(m);
    }
    check(q(`SELECT string_agg(moved::text, ',' ORDER BY match_id) FROM rated_run_uses WHERE run_id = 'run-abc'`) === "true,true,true,true,true,false", "the run's uses are recorded; the 6th in a day doesn't move its owner");
    check(rating(B) < rb, "the owner's rating moved for the first 5");
    const daily = duel(mid(), A, B, [[150, 100], [150, 100]]);
    daily.players[1] = { playerId: B, side: "recorded", run: { runId: "run-daily", ownerId: B, source: "daily" } };
    const rb2 = rating(B);
    const out = await record(daily);
    check(out.ok && rating(B) === rb2 && out.players.find((p) => p.playerId === B)!.frozen === "recorded_unrated_source", "a Daily run never moves its owner");
    check(q(`SELECT placement_played FROM rated_profiles WHERE player_id = '${B}'`) === "1", "nor plays them a placement match");
    const props = q(`SELECT props::text FROM analytics.events WHERE event = 'rated_match_finished' AND player_id = '${A}' ORDER BY occurred_at DESC LIMIT 1`);
    check(/"opponent": "recorded"/.test(props), "rated_match_finished says the opponent was a recorded run");
    check((await events("rated_match_finished", B)) === 1, "a run's owner gets no rated_match_finished for its uses");
  });

  /** Plays `n` placement wins for a player so they have a Joulz Rating (against fresh opponents 1000+). */
  let crowd = 1000;
  const place = async (id: string, n = 5) => {
    for (let i = 0; i < n; i++) await record(duel(mid(), id, uid(crowd++), [[150, 100], [150, 100]]));
  };

  await section("competitive badges, each once", async () => {
    const W = uid(121);
    const L = uid(122);
    // First Win, Placed.
    const lose = await record(duel(mid(), W, L, [[100, 150], [100, 150]]));
    check(lose.ok && hasBadge(W, "first-win") === 0, "a loss doesn't earn First Win");
    await record(duel(mid(), W, uid(crowd++), [[150, 100], [150, 100]]));
    check(hasBadge(W, "first-win") === 1, "First Win: the first rated win");
    for (let i = 0; i < 2; i++) await record(duel(mid(), W, uid(crowd++), [[150, 100], [150, 100]]));
    check(hasBadge(W, "placed") === 0, "Placed: not after 4 placement matches");
    const fifth = await record(duel(mid(), W, uid(crowd++), [[150, 100], [150, 100]]));
    check(hasBadge(W, "placed") === 1 && fifth.ok && fifth.players.find((p) => p.playerId === W)!.badges.includes("placed"), "Placed: after the 5th (and in the outcome's badges)");
    // Hot Streak (5 in a row) and Unstoppable (10): W has 4 wins in a row now.
    check(hasBadge(W, "hot-streak") === 0, "Hot Streak: not at 4 in a row");
    await record(duel(mid(), W, uid(crowd++), [[150, 100], [150, 100]]));
    check(hasBadge(W, "hot-streak") === 1, "Hot Streak: 5 rated wins in a row");
    for (let i = 0; i < 4; i++) await record(duel(mid(), W, uid(crowd++), [[150, 100], [150, 100]]));
    check(hasBadge(W, "unstoppable") === 0, "Unstoppable: not at 9 in a row");
    await record(duel(mid(), W, uid(crowd++), [[150, 100], [150, 100]]));
    check(hasBadge(W, "unstoppable") === 1, "Unstoppable: 10 in a row");
    // Comeback Kid: a best of 3 won after losing the first game; a best of 7 doesn't count.
    const S = uid(123);
    await record({ ...duel(mid(), S, uid(crowd++), [[150, 100], [100, 150], [150, 100], [150, 100]]), format: { kind: "duel", bestOf: 7 } });
    check(hasBadge(S, "comeback-kid") === 0, "Comeback Kid: not from a best of 7");
    await record(duel(mid(), S, uid(crowd++), [[100, 150], [150, 100], [150, 100]]));
    check(hasBadge(S, "comeback-kid") === 1, "Comeback Kid: won a best of 3 after losing the first game");
    // Clean Sweep: a best of 5 won 3–0 (a 3–1 doesn't).
    await record({ ...duel(mid(), S, uid(crowd++), [[150, 100], [100, 150], [150, 100], [150, 100]]), format: { kind: "duel", bestOf: 5 } });
    check(hasBadge(S, "clean-sweep") === 0, "Clean Sweep: not from a 3–1");
    const sweepOut = await record({ ...duel(mid(), S, uid(crowd++), [[150, 100], [150, 100], [150, 100]]), format: { kind: "duel", bestOf: 5 } });
    check(hasBadge(S, "clean-sweep") === 1, "Clean Sweep: a best of 5 won 3–0");
    check(sweepOut.ok && sweepOut.players.find((p) => p.playerId === S)!.joules === 225, "a best of 5 win pays 225 Joules");
    // Photo Finish: the deciding game by 1 point or less.
    const F = uid(124);
    await record(duel(mid(), F, uid(crowd++), [[150, 100], [150, 148]]));
    check(hasBadge(F, "photo-finish") === 0, "Photo Finish: not by 2");
    await record(duel(mid(), F, uid(crowd++), [[150, 100], [150, 149]]));
    check(hasBadge(F, "photo-finish") === 1, "Photo Finish: won by 1 point");
    // Revenge: win the rematch after losing to the same player.
    const R1 = uid(125);
    const R2 = uid(126);
    const lost = duel(mid(), R1, R2, [[100, 150], [100, 150]]);
    await record(lost);
    await record({ ...duel(mid(), R1, uid(crowd++), [[150, 100], [150, 100]]), rematchOf: lost.matchId });
    check(hasBadge(R1, "revenge") === 0, "Revenge: not against someone else");
    await record({ ...duel(mid(), R1, R2, [[150, 100], [150, 100]]), rematchOf: lost.matchId });
    check(hasBadge(R1, "revenge") === 1 && hasBadge(R2, "revenge") === 0, "Revenge: won the rematch after losing to the same player");
    // Podium Regular: top 3 in 25 four-player matches.
    const P = uid(127);
    const four = (placeP: number) => {
      const others = [uid(crowd++), uid(crowd++), uid(crowd++)];
      const ids = [P, ...others];
      const order = [...others];
      order.splice(placeP - 1, 0, P);
      return {
        matchId: mid(),
        format: { kind: "placings" as const, players: 4 as const },
        choice: "puzzles" as const,
        players: ids.map((playerId) => ({ playerId, side: "live" as const })),
        games: [game(PUZZLE_TYPE, Object.fromEntries(order.map((id, i) => [id, 190 - 20 * i])))],
        placings: Object.fromEntries(order.map((id, i) => [id, i + 1])),
      };
    };
    for (let i = 0; i < 24; i++) await record(four(3));
    await record(four(4));
    check(hasBadge(P, "podium-regular") === 0, "Podium Regular: not at 24 podiums (a 4th place doesn't count)");
    await record(four(2));
    check(hasBadge(P, "podium-regular") === 1, "Podium Regular: top 3 in 25 four-player matches");
    // Giant Slayer: beat someone rated 300+ above (both placed).
    const G = uid(128);
    const H = uid(129);
    await place(G);
    await place(H);
    q(`UPDATE rated_ratings SET rating = rating + 400 WHERE player_id = '${H}' AND key = 'puzzles';
       UPDATE rated_profiles SET joulz = (SELECT rating FROM rated_ratings WHERE player_id = '${H}' AND key = 'puzzles') WHERE player_id = '${H}'`);
    const jg = Number(q(`SELECT joulz FROM rated_profiles WHERE player_id = '${G}'`));
    const jh = Number(q(`SELECT joulz FROM rated_profiles WHERE player_id = '${H}'`));
    check(jh - jg >= 300, `Giant Slayer set-up: ${Math.round(jh)} vs ${Math.round(jg)}`);
    await record(duel(mid(), G, H, [[150, 100], [150, 100]]));
    check(hasBadge(G, "giant-slayer") === 1, "Giant Slayer: beat a player rated 300+ above");
    // Storm Chaser and Lightning Strikes by the tier shown (caps not active: by rating).
    const K = uid(130);
    await place(K);
    check(hasBadge(K, "storm-chaser") === 0, "Storm Chaser: not at a placed 1,0xx");
    q(`UPDATE rated_ratings SET rating = 1960 WHERE player_id = '${K}' AND key = 'puzzles'`);
    await record(duel(mid(), K, uid(crowd++), [[150, 100], [150, 100]]));
    check(hasBadge(K, "storm-chaser") === 1 && hasBadge(K, "lightning-strikes") === 0, "Storm Chaser: reaching Storm (not yet Lightning)");
    q(`UPDATE rated_ratings SET rating = 2420 WHERE player_id = '${K}' AND key = 'puzzles'`);
    const lightning = await record(duel(mid(), K, uid(crowd++), [[150, 100], [150, 100]]));
    check(hasBadge(K, "lightning-strikes") === 1, "Lightning Strikes: reaching Lightning");
    check(lightning.ok && lightning.players[0]!.tier.before?.tier === "storm" && lightning.players[0]!.tier.after?.tier === "lightning", "the change carries the tier before and after");
    check((await events("tier_changed", K)) >= 2, "tier_changed recorded on each tier change");
    const tc = q(`SELECT props::text FROM analytics.events WHERE event = 'tier_changed' AND player_id = '${K}' ORDER BY occurred_at DESC LIMIT 1`);
    check(/"from": "storm"/.test(tc) && /"to": "lightning"/.test(tc), `tier_changed carries from and to (${tc})`);
    // Each once: every competitive badge row is unique and badge_earned matches it.
    const dup = q(`SELECT count(*) FROM (SELECT user_id, badge FROM player_badges GROUP BY 1, 2 HAVING count(*) > 1) d`);
    await flushAnalytics();
    const earned = Number(q(`SELECT count(*) FROM player_badges WHERE badge IN (${rs.RATED_BADGES.map((b) => `'${b}'`).join(", ")})`));
    const evs = Number(q(`SELECT count(*) FROM analytics.events WHERE event = 'badge_earned' AND props ->> 'badge' IN (${rs.RATED_BADGES.map((b) => `'${b}'`).join(", ")})`));
    check(dup === "0" && earned === evs && earned > 0, `each competitive badge awarded once, with one badge_earned (${earned} awards, ${evs} events)`);
    const lightningCoins = q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${K}' AND idempotency_key = 'badge_reward:lightning-strikes'`);
    check(lightningCoins === "1", "Lightning Strikes (Legendary) pays its 250 coins once");
    // A guest plays rated without badges.
    const guest = uid(1500);
    const g = await record(duel(mid(), guest, uid(crowd++), [[150, 100], [150, 100]]));
    check(g.ok && g.players[0]!.badges.length === 0 && Number(q(`SELECT count(*) FROM player_badges WHERE user_id = '${guest}'`)) === 0, "a guest's rated win records a rating but no badge (badges are for accounts)");
  });

  await section("standings: caps from 1,000 players, the 3-day grace, Top 500", async () => {
    // The crowd: 1,100 placed players (synthetic rows, as a long beta would leave them), Puzzles only.
    const ids = Array.from({ length: 1100 }, (_, i) => 1000 + i).filter((n) => n >= crowd);
    q(`INSERT INTO rated_ratings (player_id, key, rating, rd, volatility, matches, last_at)
       SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'puzzles', 800 + (n % 700), 70, 0.06, 40, now()
         FROM generate_series(${crowd}, 2199) n ON CONFLICT DO NOTHING;
       INSERT INTO rated_profiles (player_id, placement_played, matches, joulz, shown_tier)
       SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 5, 40, 800 + (n % 700), 'charge'
         FROM generate_series(${crowd}, 2199) n ON CONFLICT DO NOTHING`);
    const placed = Number(q(`SELECT count(*) FROM rated_profiles WHERE joulz IS NOT NULL`));
    check(placed >= 1000 && ids.length > 0, `${placed} rated players`);
    // Before the caps: a fresh database's first run with < 1,000 would be by rating alone (pure check above).
    const star = uid(131);
    await place(star);
    q(`UPDATE rated_ratings SET rating = 2000 WHERE player_id = '${star}' AND key = 'puzzles'`);
    const now0 = Date.UTC(2026, 10, 20, 12);
    // Thirty-five players (more than 3%) above 2,000 push the star outside the top 3% … not yet.
    const job1 = await rw.runStandingsAndBadges(admin, now0);
    check(job1.capsActive && job1.ratedPlayers === placed + 1, `caps active from 1,000 rated players (${job1.ratedPlayers})`);
    const v1 = await rs.getMyRatings(admin, star, now0);
    check(v1.tier?.tier === "storm", `in the top 3% at 2,000: Storm (${v1.tier?.label}, rank ${q(`SELECT rank FROM rated_standings WHERE player_id = '${star}'`)})`);
    // Push 50 of the crowd above the star: now outside the top 3% (the share is 51 / 1,101 ≈ 4.6%).
    q(`UPDATE rated_ratings SET rating = 2100 WHERE player_id IN (SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid FROM generate_series(2100, 2149) n) AND key = 'puzzles'`);
    await rw.runStandingsAndBadges(admin, now0 + DAY);
    const v2 = await rs.getMyRatings(admin, star, now0 + DAY);
    check(v2.tier?.tier === "storm", `a day after dropping out of the top 3%: still Storm (the grace) (${v2.tier?.label})`);
    await rw.runStandingsAndBadges(admin, now0 + 3 * DAY + 3_600_000);
    const v3 = await rs.getMyRatings(admin, star, now0 + 3 * DAY + 3_600_000);
    check(v3.tier?.tier === "surge" && v3.tier.heldBack?.label === "Storm-rated, top 5%", `after 3 days out: held back, “${v3.tier?.heldBack?.label}” (${v3.tier?.label})`);
    check(q(`SELECT shown_tier FROM rated_profiles WHERE player_id = '${star}'`) === "surge" && q(`SELECT peak_tier FROM rated_profiles WHERE player_id = '${star}'`) === "storm", "the shown tier is stored as Surge; the peak stays Storm");
    check((await events("tier_changed", star)) >= 2, `the job's tier changes record tier_changed (${q(`SELECT string_agg(props::text, ' ; ') FROM analytics.events WHERE event = 'tier_changed' AND player_id = '${star}'`)})`);
    // Top 500: Lightning and a top-500 rank.
    q(`UPDATE rated_ratings SET rating = 2500 WHERE player_id = '${star}' AND key = 'puzzles'`);
    await rw.runStandingsAndBadges(admin, now0 + 4 * DAY);
    const v4 = await rs.getMyRatings(admin, star, now0 + 4 * DAY);
    check(v4.tier?.tier === "top500" && v4.tier.label === "Top 500 #1", `Lightning and ranked 1: “${v4.tier?.label}”`);
    check(hasBadge(star, "top-500") === 1 && hasBadge(star, "lightning-strikes") === 1, "the job awards Top 500 (and Lightning Strikes) when the tier rises");
    await rw.runStandingsAndBadges(admin, now0 + 4 * DAY + 3_600_000);
    check(hasBadge(star, "top-500") === 1, "and only once");
    // The SQL Joulz Rating is the engine's: a player with both pools and recent games.
    const J = uid(132);
    await place(J, 3);
    for (let i = 0; i < 2; i++) await record(duel(mid(), J, uid(crowd++), [[150, 100], [150, 100]], { choice: "arcade" }));
    const before = await rs.getMyRatings(admin, J, now0 + 5 * DAY);
    await rw.runStandingsAndBadges(admin, now0 + 5 * DAY);
    const sqlJ = Number(q(`SELECT joulz FROM rated_profiles WHERE player_id = '${J}'`));
    check(before.joulz !== null && Math.abs(sqlJ - before.joulz) <= 0.5, `the standings job's Joulz Rating is the engine's (${sqlJ.toFixed(2)} vs ${before.joulz})`);
    // 91 days on: no recent play, so equal weight.
    await rw.runStandingsAndBadges(admin, clock + 91 * DAY);
    const pz = rating(J, "puzzles");
    const ac = rating(J, "arcade");
    check(Math.abs(Number(q(`SELECT joulz FROM rated_profiles WHERE player_id = '${J}'`)) - (pz + ac) / 2) < 1e-6, "after 90 days without play: Puzzles and Arcade weigh equally");
    const ladder = await rs.getTierLadder(admin);
    const total = ladder.reduce((s, r) => s + (r.share ?? 0), 0);
    check(ladder.length === 7 && Math.abs(total - 1) < 1e-9, `the ladder carries live shares (sum ${total.toFixed(3)})`);
    const ps = await rs.placementStatus(admin, uid(199));
    check(ps.played === 0 && ps.label === "Placement 1 of 5", "a player who never played: “Placement 1 of 5”");
    const other = await rs.getRatingsFor(admin, star);
    check(other?.tier?.tier === "top500" && (await rs.getRatingsFor(admin, "not-a-uuid")) === null, "another player's ratings (an unknown id: none)");
  });
}
