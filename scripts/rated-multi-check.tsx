/**
 * rated-multi-check (wave 3, session W3d; docs/rated/multiplayer.md): rated 4- and 8-player matches. No browser, ~2 s.
 *
 *  1. The switches: both off at launch; the picker's sizes empty; the server refuses a queue request, filling and
 *     finishing while a size is off (with a backend bound, so it's the switch refusing); a junk size refused; on with
 *     no backend, "not ready"; on with one, queued. The phone's call goes through `joinMultiQueue`.
 *  2. Filling: before 15 s it waits; from 15 s every empty seat takes a recorded run (labelled), never a player twice
 *     (live or recorded), only runs on every deal; a full live match takes none; too few runs is "short".
 *  3. Placing points and tie-breaks for 4 and 8: the tables, shared places taking the higher points, standings by
 *     points then total score then shared, movement since the game before.
 *  4. The rating rule: every pair once, a win for the better place, a draw for a shared one, weight 1 / (size − 1);
 *     on a reference Elo, a 4- or 8-player match moves a rating about as much as one 1v1. Recorded seats unrated.
 *  5. Joules: 1.5 times the best-of-3 amounts, live players only; Podium Regular counts live top-3 finishes.
 *  6. Settling through W3b's own path: multiSettlement's placings, stored scores and stored server grades, and W3b's
 *     toRatingsResult building W3a's placings match from it (every game's gradeExtras for every player).
 *  7. The screens (happy-dom): filling, standings and final; the placings drawn on the first render with the entrance,
 *     the entrance only inside the podium, none under reduced motion; no motion of the screens' own.
 *     7b. W3c's format slot: filling, standings and final fitted to W3c's props, read through multiView.ts, drawn with
 *     W3c's MatchChips, JoulesLine, RankEmblem, RatedCard and PlayerDot.
 *  8. Analytics: the two events in ANALYTICS_EVENTS, the migration in W3d's range adding (not replacing) them.
 *  9. Rooms untouched: no room or practice code imports the rated multiplayer modules; the rooms' Placings table as before.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { RATED_FORMATS_ON } from "../src/config/matchmakingConfig";
import type { RatedMatchOutcome, RatedMatchResult } from "../src/lib/data/ratings";
import type { RatedMultiBackend } from "../src/lib/rated/multi/contracts";
import {
  assertMultiOn,
  fillMatch,
  joinMultiQueue,
  multiSizeOn,
  multiSizesOn,
  RatedMultiOffError,
} from "../src/lib/rated/multi/multi.server";
import {
  BEST_OF_3_JOULES,
  countsForPodiumRegular,
  FILL_WAIT_MS,
  fillPlan,
  fromW3bCandidate,
  finalPlacings,
  gamePlacings,
  movement,
  multiJoules,
  multiPointsTable,
  noPlayerTwice,
  pairWeight,
  ratingPairs,
  standingsAfter,
  type GameScore,
  type MultiSeat,
  type MultiSize,
  type RecordedCandidate,
} from "../src/lib/rated/multi/rules";
import { placingTable } from "../src/lib/duel/scoringMode";
import type { AnalyticsEvent } from "../src/lib/data/events.server";

const failures: string[] = [];
let checks = 0;
const check = (ok: boolean, message: string) => {
  checks++;
  if (!ok) {
    failures.push(message);
    if (failures.length <= 40) console.log(`FAIL ${message}`);
  }
};
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const rng = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const ON = { ffa4: true, ffa8: true };
const OFF = { ffa4: false, ffa8: false };

function stubBackend(log: string[] = []): RatedMultiBackend {
  return {
    async enqueue(input) {
      log.push(`enqueue:${input.size}:${input.choice}`);
      return { joinedAtMs: 1 };
    },
    async recordedCandidates() {
      log.push("candidates");
      return [
        { playerId: "u1", name: "Dup", dealKeys: ["d1", "d2", "d3"], runId: "r0" },
        { playerId: "r1", name: "Mia", dealKeys: ["d1", "d2", "d3"], runId: "r1" },
        { playerId: "r1", name: "Mia again", dealKeys: ["d1", "d2", "d3"], runId: "r1b" },
        { playerId: "r2", name: "Short", dealKeys: ["d1", "d2"], runId: "r2" },
        { playerId: "r3", name: "Raj", dealKeys: ["d1", "d2", "d3"], runId: "r3" },
        { playerId: "r4", name: "Kai", dealKeys: ["d1", "d2", "d3"], runId: "r4" },
      ];
    },
  };
}

/* ------------------------------------------------------------------ 1. switches */
check(RATED_FORMATS_ON.ffa4 === false && RATED_FORMATS_ON.ffa8 === false, "switches: W3b's ffa4 and ffa8 both off at launch");
check(multiSizesOn().length === 0 && !multiSizeOn(4, RATED_FORMATS_ON) && !multiSizeOn(8, RATED_FORMATS_ON), "switches: the server reads W3b's two lines");
check(multiSizesOn().length === 0, "switches: the picker shows no 4- or 8-player size at launch");
check(!multiSizeOn(4) && !multiSizeOn(8), "switches: neither size on");
check(eq(multiSizesOn({ ffa4: true, ffa8: false }), [4]) && eq(multiSizesOn({ ffa4: false, ffa8: true }), [8]), "switches: one switch for each size");
for (const size of [4, 8] as const) {
  const log: string[] = [];
  const r = await joinMultiQueue({ playerId: "u1", size, choice: "mixed" }, { backend: stubBackend(log) });
  check(!r.ok && r.reason === "off" && log.length === 0, `server: a ${size}-player queue request is refused while off (nothing queued)`);
  const r2 = await joinMultiQueue({ playerId: "u1", size, choice: "mixed" }, { switches: OFF, backend: stubBackend() });
  check(!r2.ok && r2.reason === "off", `server: ${size} refused with the switch off`);
  const other = size === 4 ? { ffa4: false, ffa8: true } : { ffa4: true, ffa8: false };
  const r3 = await joinMultiQueue({ playerId: "u1", size, choice: "mixed" }, { switches: other, backend: stubBackend() });
  check(!r3.ok && r3.reason === "off", `server: ${size} refused when only the other size is on`);
  let threw = false;
  try {
    assertMultiOn(size);
  } catch (e) {
    threw = e instanceof RatedMultiOffError;
  }
  check(threw, `server: assertMultiOn(${size}) throws while off`);
  let fillThrew = false;
  try {
    await fillMatch({ matchId: "m", size, choice: "mixed", live: [], waitedMs: 0, dealKeys: [] }, { backend: stubBackend() });
  } catch (e) {
    fillThrew = e instanceof RatedMultiOffError;
  }
  check(fillThrew, `server: filling a ${size}-player match is refused while off`);
  const on = await joinMultiQueue({ playerId: "u1", size, choice: "mixed" }, { switches: ON, backend: null });
  check(!on.ok && on.reason === "not_ready", `server: ${size} on with nothing bound is "not ready"`);
  const log2: string[] = [];
  const ok = await joinMultiQueue({ playerId: "u1", size, choice: "mixed" }, { switches: ON, backend: stubBackend(log2) });
  check(ok.ok && log2[0] === `enqueue:${size}:mixed`, `server: ${size} on: queued through the matchmaking port`);
  const badChoice = await joinMultiQueue({ playerId: "u1", size, choice: "word" }, { switches: ON, backend: stubBackend() });
  check(!badChoice.ok && badChoice.reason === "bad_choice", `server: ${size}: only Mixed, All puzzles or All arcade`);
}
for (const junk of [2, 3, 5, 16, "8", null, undefined]) {
  const r = await joinMultiQueue({ playerId: "u1", size: junk, choice: "mixed" }, { switches: ON, backend: stubBackend() });
  check(!r.ok && r.reason === "bad_size", `server: size ${String(junk)} refused`);
}
const fnSource = readFileSync("src/lib/rated/multi/multi.functions.ts", "utf8");
check(/requireSupabaseAuth/.test(fnSource) && /joinMultiQueue\(\{ playerId: context\.userId/.test(fnSource), "server: the phone's call goes through joinMultiQueue with the signed-in user");
check(!/window\.__/.test(readFileSync("src/lib/rated/multi/multi.server.ts", "utf8") + fnSource + readFileSync("src/config/matchmakingConfig.ts", "utf8") + readFileSync("src/config/ratedConfig.ts", "utf8")), "switches: no window override anywhere (nothing a browser can turn on)");
check(/RATED_FORMATS_ON/.test(readFileSync("src/lib/rated/multi/multi.server.ts", "utf8")), "switches: the server gate reads W3b's RATED_FORMATS_ON");

/* ------------------------------------------------------------------ 2. filling */
const live = (n: number) => Array.from({ length: n }, (_, i) => ({ playerId: `u${i + 1}`, name: `P${i + 1}` }));
const cands = (ids: string[], keys = ["d1", "d2", "d3"]): RecordedCandidate[] => ids.map((id, i) => ({ playerId: id, name: id, dealKeys: keys, runId: `run${i}` }));
const deals = ["d1", "d2", "d3"];
check(FILL_WAIT_MS === 15_000, "filling: waits 15 s for live players");
{
  const w = fillPlan({ size: 8, live: live(6), waitedMs: 14_999, dealKeys: deals, candidates: cands(["r1", "r2"]) });
  check(w.kind === "wait" && w.seats.length === 6 && w.msLeft === 1 && w.seats.every((s) => !s.recorded), "filling: 14.999 s: still waiting, no recorded seats");
  const f = fillPlan({ size: 8, live: live(6), waitedMs: 15_000, dealKeys: deals, candidates: cands(["r1", "r2", "r3"]) });
  check(f.kind === "filled" && f.seats.length === 8 && f.seats.filter((s) => s.recorded).length === 2, "filling: at 15 s every empty seat takes a recorded run");
  check(f.kind === "filled" && f.seats.slice(6).every((s) => s.recorded && s.seatId.startsWith("rec:")), "filling: recorded seats are labelled as recorded");
  const full = fillPlan({ size: 4, live: live(4), waitedMs: 30_000, dealKeys: deals, candidates: cands(["r1"]) });
  check(full.kind === "full" && full.seats.every((s) => !s.recorded), "filling: a full live match takes no recorded run");
  const dup = fillPlan({ size: 4, live: live(2), waitedMs: 20_000, dealKeys: deals, candidates: cands(["u1", "r1", "r1", "u2", "r2"]) });
  check(dup.kind === "filled" && eq(dup.seats.map((s) => s.playerId), ["u1", "u2", "r1", "r2"]), "filling: a live player's own run and a repeated player are skipped");
  const missingDeal = fillPlan({ size: 4, live: live(3), waitedMs: 20_000, dealKeys: deals, candidates: cands(["r1"], ["d1", "d2"]) });
  check(missingDeal.kind === "short" && missingDeal.missing === 1, "filling: a run missing one of the deals is not used; short when too few");
  const dupLive = fillPlan({ size: 4, live: [...live(2), { playerId: "u1", name: "again" }], waitedMs: 0, dealKeys: deals, candidates: [] });
  check(dupLive.seats.length === 2, "filling: a player in the queue twice takes one seat");
  const r = rng(7);
  let ok = true;
  let filledAll = true;
  for (let t = 0; t < 2000; t++) {
    const size: MultiSize = r() < 0.5 ? 4 : 8;
    const pool = Array.from({ length: 12 }, (_, i) => `x${i}`);
    const lv = Array.from({ length: 1 + Math.floor(r() * size) }, () => ({ playerId: pool[Math.floor(r() * pool.length)]!, name: "n" }));
    const cs = Array.from({ length: Math.floor(r() * 20) }, (_, i) => ({ playerId: pool[Math.floor(r() * pool.length)]!, name: "c", dealKeys: r() < 0.9 ? deals : ["d1"], runId: `k${i}` }));
    const p = fillPlan({ size, live: lv, waitedMs: 15_000 + Math.floor(r() * 10_000), dealKeys: deals, candidates: cs });
    if (!noPlayerTwice(p.seats) || p.seats.length > size) ok = false;
    if ((p.kind === "filled" || p.kind === "full") && p.seats.length !== size) filledAll = false;
  }
  check(ok, "filling: 2,000 seeded queues: never the same player twice, never more seats than the size");
  check(filledAll, "filling: 2,000 seeded queues: a filled match has every seat taken");
}

/* ------------------------------------------------------------------ 3. points and tie-breaks */
check(eq(multiPointsTable(8), [10, 7, 5, 4, 3, 2, 1, 0]), "points: 8 players 10, 7, 5, 4, 3, 2, 1, 0");
check(eq(multiPointsTable(4), [5, 3, 1, 0]), "points: 4 players 5, 3, 1, 0");
{
  const seats = ["a", "b", "c", "d"];
  const g = gamePlacings(4, seats, [{ seatId: "a", score: 150 }, { seatId: "b", score: 150 }, { seatId: "c", score: 90 }]);
  check(eq(g.map((x) => [x.place, x.points]), [[1, 5], [1, 5], [3, 1], [4, 0]]), "points: a level game score shares the place and the higher points; no result is 0");
  // Points level after three games, split by total score.
  const games: GameScore[][] = [
    [{ seatId: "a", score: 200 }, { seatId: "b", score: 100 }, { seatId: "c", score: 50 }, { seatId: "d", score: 10 }],
    [{ seatId: "a", score: 10 }, { seatId: "b", score: 120 }, { seatId: "c", score: 60 }, { seatId: "d", score: 50 }],
    [{ seatId: "a", score: 20 }, { seatId: "b", score: 30 }, { seatId: "c", score: 200 }, { seatId: "d", score: 100 }],
  ];
  const f = finalPlacings(4, seats, games);
  // a: 5+0+0=5 (230), b: 3+5+1=9 (250), c: 1+3+5=9 (310), d: 0+1+3=4 (160)
  check(eq(f.map((x) => [x.seatId, x.points, x.total, x.place]), [["c", 9, 310, 1], ["b", 9, 250, 2], ["a", 5, 230, 3], ["d", 4, 160, 4]]), "tie-break (4): level points split by the total score");
  const same = finalPlacings(4, seats, [[{ seatId: "a", score: 100 }, { seatId: "b", score: 100 }, { seatId: "c", score: 5 }, { seatId: "d", score: 5 }]]);
  check(eq(same.map((x) => x.place), [1, 1, 3, 3]), "tie-break (4): level points and total share the place (1, 1, 3, 3)");
  const st = standingsAfter(4, seats, games.slice(0, 2));
  const a = st.find((x) => x.seatId === "a")!;
  check(a.previousPlace === 1 && a.place === 2 && movement(a) === "down" && a.gamePoints === 0 && a.gamePlace === 4, "standings: movement since the game before and this game's points");
  check(standingsAfter(4, seats, games.slice(0, 1)).every((x) => movement(x) === null), "standings: no movement after the first game");
  // 8 players, an independent recount on seeded matches.
  const r = rng(11);
  let agree = true;
  for (let t = 0; t < 500; t++) {
    const size: MultiSize = t % 2 ? 8 : 4;
    const ids = Array.from({ length: size }, (_, i) => `s${i}`);
    const gs = Array.from({ length: 3 }, () => ids.map((seatId) => ({ seatId, score: Math.floor(r() * 6) * 40 })));
    const out = finalPlacings(size, ids, gs);
    const table = size === 8 ? [10, 7, 5, 4, 3, 2, 1, 0] : [5, 3, 1, 0];
    const pts = new Map(ids.map((id) => [id, 0]));
    const tot = new Map(ids.map((id) => [id, 0]));
    for (const g of gs)
      for (const row of g) {
        const place = 1 + g.filter((o) => o.score > row.score).length;
        pts.set(row.seatId, pts.get(row.seatId)! + (table[place - 1] ?? 0));
        tot.set(row.seatId, tot.get(row.seatId)! + row.score);
      }
    for (const row of out) {
      const better = ids.filter((o) => pts.get(o)! > pts.get(row.seatId)! || (pts.get(o) === pts.get(row.seatId) && tot.get(o)! > tot.get(row.seatId)!)).length;
      if (row.points !== pts.get(row.seatId) || row.total !== tot.get(row.seatId) || row.place !== better + 1) agree = false;
    }
    for (let i = 1; i < out.length; i++) if (out[i]!.place < out[i - 1]!.place) agree = false;
  }
  check(agree, "points and tie-breaks: 500 seeded 4- and 8-player matches agree with an independent recount");
}

/* ------------------------------------------------------------------ 4. ratings */
{
  for (const size of [4, 8]) {
    const pl = Array.from({ length: size }, (_, i) => ({ seatId: `s${i}`, place: i + 1 }));
    const pairs = ratingPairs(pl, size);
    check(pairs.length === (size * (size - 1)) / 2, `rating (${size}): every pair once`);
    check(pairs.every((p) => Math.abs(p.weight - 1 / (size - 1)) < 1e-12), `rating (${size}): each pair weighted 1 / ${size - 1}`);
    check(pairs.every((p) => p.result === 1 && Number(p.a.slice(1)) < Number(p.b.slice(1))), `rating (${size}): the better place wins every pair`);
  }
  const tied = ratingPairs([{ seatId: "a", place: 1 }, { seatId: "b", place: 1 }, { seatId: "c", place: 3 }], 3);
  check(tied.find((p) => (p.a === "a" && p.b === "b") || (p.a === "b" && p.b === "a"))?.result === 0.5, "rating: a shared place is a draw");
  check(pairWeight(2) === 1, "rating: a 1v1's single pair has weight 1");
  // Reference Elo (K = 32): each player's move is the sum over its pairs of K × weight × (result − expected).
  const K = 32;
  const expect = (ra: number, rb: number) => 1 / (1 + 10 ** ((rb - ra) / 400));
  const moves = (ratings: number[], places: number[]) => {
    const pl = places.map((place, i) => ({ seatId: String(i), place }));
    const d = ratings.map(() => 0);
    for (const p of ratingPairs(pl, ratings.length)) {
      const a = Number(p.a);
      const b = Number(p.b);
      const e = expect(ratings[a]!, ratings[b]!);
      d[a] += K * p.weight * (p.result - e);
      d[b] += K * p.weight * (1 - p.result - (1 - e));
    }
    return d;
  };
  const oneV1Win = K * (1 - expect(1200, 1200));
  for (const size of [4, 8]) {
    const d = moves(Array(size).fill(1200), Array.from({ length: size }, (_, i) => i + 1));
    check(Math.abs(d[0]! - oneV1Win) < 1e-9 && Math.abs(d[size - 1]! + oneV1Win) < 1e-9, `rating (${size}): first moves exactly as a 1v1 win, last as a 1v1 loss (equal ratings)`);
    check(Math.abs(d.reduce((s, x) => s + x, 0)) < 1e-9, `rating (${size}): the match's moves sum to zero`);
  }
  const r = rng(5);
  let bounded = true;
  let sumMulti = 0;
  let sum1v1 = 0;
  for (let t = 0; t < 2000; t++) {
    const size = t % 2 ? 8 : 4;
    const ratings = Array.from({ length: size }, () => 900 + Math.floor(r() * 800));
    const places = ratings.map(() => 0);
    [...ratings.keys()].sort(() => r() - 0.5).forEach((idx, i) => (places[idx] = i + 1));
    const d = moves(ratings, places);
    if (d.some((x) => Math.abs(x) > K + 1e-9)) bounded = false;
    sumMulti += d.reduce((s, x) => s + Math.abs(x), 0) / size;
    const [a, b] = [ratings[0]!, ratings[1]!];
    sum1v1 += Math.abs(K * ((r() < 0.5 ? 1 : 0) - expect(a, b)));
  }
  check(bounded, "rating: 2,000 seeded matches: no move larger than one 1v1's largest (K)");
  const ratio = sumMulti / sum1v1;
  check(ratio > 0.4 && ratio <= 1.05, `rating: a 4- or 8-player match's average move is about one 1v1's (ratio ${ratio.toFixed(2)})`);
}

/* ------------------------------------------------------------------ 5. Joules and Podium Regular */
check(BEST_OF_3_JOULES.win === 150 && BEST_OF_3_JOULES.loss === 100, "Joules: the best-of-3 amounts are 150 / 100");
check(multiJoules(8, 1) === 225 && multiJoules(8, 2) === 150 && multiJoules(8, 8) === 150, "Joules (8): 1.5× the win amount for first, 1.5× the loss amount below (W3a: first place is the win)");
check(multiJoules(4, 1) === 225 && multiJoules(4, 2) === 150 && multiJoules(4, 4) === 150, "Joules (4): 1.5× the best-of-3 amounts");
check(multiJoules(8, 1) === BEST_OF_3_JOULES.win * 1.5 && multiJoules(8, 8) === BEST_OF_3_JOULES.loss * 1.5, "Joules: exactly 1.5 times");
const liveSeat: MultiSeat = { seatId: "s", playerId: "p", name: "n", recorded: false };
check(countsForPodiumRegular(liveSeat, 3) && !countsForPodiumRegular(liveSeat, 4) && !countsForPodiumRegular({ ...liveSeat, recorded: true }, 1), "Podium Regular: live top-3 finishes only");

/* ------------------------------------------------------------------ 6. finishing on a stand-in backend */
{
  const events: AnalyticsEvent[] = [];
  const record = (e: AnalyticsEvent | readonly AnalyticsEvent[]) => void events.push(...(Array.isArray(e) ? e : [e]));
  const backend = stubBackend();
  const plan = await fillMatch(
    { matchId: "m1", size: 8, choice: "mixed", live: live(5), waitedMs: 15_000, dealKeys: deals },
    { switches: ON, backend, record },
  );
  check(plan.kind === "filled" && noPlayerTwice(plan.seats) && plan.seats.filter((s) => s.recorded).length === 3, "server fill: three recorded runs, the live player's own and a repeat skipped");
  const started = events.find((e) => e.event === "multiplayer_match_started");
  check(eq(started?.props, { size: 8, live_seats: 5, recorded_seats: 3 }), "events: multiplayer_match_started carries size, live and recorded seats");
  const waiting = await fillMatch({ matchId: "m2", size: 4, choice: "mixed", live: live(2), waitedMs: 3000, dealKeys: deals }, { switches: ON, backend, record });
  check(waiting.kind === "wait" && events.filter((e) => e.event === "multiplayer_match_started").length === 1, "events: no start event while still filling");
  // Settling a finished 8-player room through W3b's own path: multiSettlement, then W3b's toRatingsResult.
  const { multiSettlement } = await import("../src/lib/rated/multi/multiQueue.server");
  const { toRatingsResult } = await import("../src/lib/rated/ratingsAdapter.server");
  const users = Array.from({ length: 8 }, (_, i) => `00000000-0000-4000-8000-0000000000${String(i + 10)}`);
  const players = users.map((u, i) => ({ match_id: "m1", user_id: u, slot: i + 1, rating_before: 1200, placement: false })) as never[];
  const puzzles = [{ type: "unblock" }, { type: "hover" }, { type: "lightsout" }] as never[];
  const scoreAt = (slot: number, g: number) => ((slot - 1 + g) % 8) * 20;
  const results = [0, 1, 2].flatMap((g) =>
    users.map((_, i) => ({ player_slot: i + 1, round_number: g + 1, score: scoreAt(i + 1, g), extra: i === 4 && g === 1 ? { flagged: true, flagReason: "replay_mismatch" } : { part: 1 } })),
  ) as never[];
  const match = { id: "00000000-0000-4000-8000-000000000999", format: "ffa8", choice: "mixed", rematch_of: null } as never;
  const settled = multiSettlement({ match, players, puzzles, results, finishedAt: "2026-11-11T12:00:00.000Z" });
  const expected = finalPlacings(8, users.map((_, i) => `slot:${i + 1}`), [0, 1, 2].map((g) => users.map((_, i) => ({ seatId: `slot:${i + 1}`, score: scoreAt(i + 1, g) }))));
  check(users.every((u, i) => settled.placings?.[u] === expected.find((p) => p.seatId === `slot:${i + 1}`)?.place), "settle: the settlement's placings are the final placings (points, then total score)");
  check(settled.players.every((p) => p.scores.length === 3 && p.extras.length === 3) && settled.players[4]!.extras[1]?.["flagged"] === true, "settle: every player's stored scores and stored server grades by game");
  check(settled.ratings === null && settled.kind === "live" && settled.recorded === null, "settle: W3a's answer comes from the shared path (none yet)");
  const forW3a = toRatingsResult(settled);
  check(!!forW3a && eq(forW3a.format, { kind: "placings", players: 8 }) && forW3a.choice === "mixed", "W3b's toRatingsResult: a placings match of 8");
  check(!!forW3a && forW3a.players.length === 8 && forW3a.players.every((p) => p.side === "live"), "W3b's toRatingsResult: every seat live");
  check(!!forW3a && eq(forW3a.placings, settled.placings), "W3b's toRatingsResult: the placings, by player");
  check(!!forW3a && forW3a.games.length === 3 && forW3a.games.every((g, gi) => Object.keys(g.scores).length === 8 && users.every((u, i) => g.scores[u] === scoreAt(i + 1, gi))), "W3b's toRatingsResult: every game with every player's stored score");
  check(!!forW3a && forW3a.games.every((g) => Object.keys(g.gradeExtras ?? {}).length === 8) && forW3a.games[1]!.gradeExtras![users[4]!]?.["flagged"] === true && forW3a.games[0]!.gradeExtras![users[4]!]?.["flagged"] === undefined, "W3b's toRatingsResult: every game's stored server grades as gradeExtras (the flag where the server set it)");
  check(!!forW3a && eq(forW3a.games.map((g) => [g.pool, g.category]), [["puzzles", "pattern"], ["arcade", "retro"], ["puzzles", "logic"]]), "W3b's toRatingsResult: W3a's pool and category for each game");
  const fromW3b = fromW3bCandidate({ key: "room:d:2", source: "room", ownerId: "o1", games: [{ type: "gridlock", signature: "s" }] }, "Mia", (_g, i) => `d${i + 1}`);
  check(eq(fromW3bCandidate.length, 3) && fromW3b.playerId === "o1" && fromW3b.runId === "room:d:2" && fromW3b.source === "room" && eq(fromW3b.dealKeys, ["d1"]), "filling: a W3b recorded run becomes a seat candidate (owner, key, source, deals)");
}

/* ------------------------------------------------------------------ 6b. grouping in W3b's queue */
{
  const { groupFor } = await import("../src/lib/rated/multi/queue");
  const e = (userId: string, rating: number, joinedAtMs = 0, over: Record<string, unknown> = {}) =>
    ({ userId, format: "ffa4" as const, choice: "mixed" as const, rating, joinedAtMs, placement: false, ...over });
  const me = e("a", 1000);
  const near = [e("b", 1020), e("c", 1040), e("d", 990), e("x", 1300)];
  const g = groupFor(me, near, 4, 100);
  check(eq(g?.map((x) => x.userId), ["a", "d", "b", "c"]), "grouping: the nearest ratings first, all within the band");
  check(groupFor(me, [e("b", 1020), e("c", 1040)], 4, 100) === null, "grouping: three players make no 4-player group");
  check(groupFor(me, [e("b", 1020), e("c", 1110), e("d", 990)], 4, 100) === null, "grouping: one outside ±50 at the start, no group");
  check(groupFor(me, [e("b", 1020), e("c", 1090), e("d", 990)], 4, 2_100) !== null, "grouping: the band widens as W3b's (±100 from 2 s)");
  check(groupFor(me, [e("b", 1000), e("c", 1000, 0, { choice: "puzzles" }), e("d", 1000)], 4, 100) === null, "grouping: never across choices");
  check(groupFor(me, [e("b", 1000), e("c", 1000, 0, { placement: true }), e("d", 1000)], 4, 100) === null, "grouping: never a placement player");
  check(groupFor(me, [e("a", 1000), e("b", 1000), e("c", 1000)], 4, 100) === null, "grouping: never a player twice");
  const wide = groupFor(e("a", 1000), [e("b", 1150), e("c", 850)], 3, 10_000);
  check(wide === null, "grouping: every pair within the band, not only each player against me (850 v 1150)");
  const w3b = readFileSync("src/lib/rated/rated.server.ts", "utf8");
  check(/FORMAT_PLAYERS\[me\.format\] > 2[\s\S]{0,200}pollMultiQueue/.test(w3b), "W3b's pollQueue hands 4 and 8 players to pollMultiQueue");
  check(/multi\.multiSettlement\(/.test(w3b) && /const forRatings = toRatingsResult\(result\);\s*if \(forRatings\) result\.ratings = await \(await ratingsReady\(\)\)\.recordRatedMatch\(forRatings\);/.test(w3b) && !/settleMultiMatch|finishMultiMatch/.test(w3b), "W3b's settleMatch settles 4 and 8 players on the 1v1's own path (toRatingsResult, ratingsReady), no parallel one");
  check(/rating\.placement && FORMAT_PLAYERS\[format\] > 2/.test(w3b), "W3b's joinQueue refuses 4 and 8 players during placement");
}

/* ------------------------------------------------------------------ 7. screens */
{
  const { Window } = await import("happy-dom");
  let reduce = false;
  const win = new Window({ url: "https://joulz.uk/rated" });
  (win as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({
    matches: /reduce/.test(q) ? reduce : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "MutationObserver", "CustomEvent"] as const) {
    const value = (win as unknown as Record<string, unknown>)[key];
    const bind = typeof value === "function" && !/^[A-Z]/.test(key) && key !== "matchMedia";
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import("react");
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { MultiFilling, MultiStandings, MultiFinal } = await import("../src/components/rated/multi/MultiScreens");
  const $ = (sel: string) => document.querySelector(sel) as unknown as HTMLElement | null;
  const $$ = (sel: string) => [...document.querySelectorAll(sel)] as unknown as HTMLElement[];
  const mount = async (el: unknown) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host as unknown as HTMLElement);
    await act(async () => root.render(el as never));
    return async () => {
      await act(async () => root.unmount());
      host.remove();
    };
  };
  const view = (id: string, over: Record<string, unknown> = {}) => ({ seatId: id, name: id.toUpperCase(), look: { colour: 1, icon: null }, ...over });
  const seats8 = ["t", "s", "p", "a", "j", "m", "r", "k"].map((id) => view(id, id === "t" ? { you: true } : id === "m" ? { recorded: true } : {}));

  let left = false;
  let un = await mount(React.createElement(MultiFilling, { size: 8, picks: "Mixed", games: 3, seats: seats8.slice(0, 6), elapsedMs: 6000, onLeave: () => (left = true) }));
  check($("[data-fill-count]")?.textContent?.replace(/\s/g, "") === "6/8", "filling screen: 6 / 8");
  check($$("[data-seats] [data-empty]").length === 2 && /Searching…/.test($("[data-empty]")?.textContent ?? ""), "filling screen: two empty seats say Searching…");
  check($$("[data-recorded-run]").length === 1 && $("[data-seat='m'] [data-recorded-run]") !== null, "filling screen: the recorded seat is labelled Recorded run");
  check($("[data-points-table]")?.getAttribute("data-points-table") === "10,7,5,4,3,2,1,0" && /three games wins/.test($("[data-how-it-scores]")?.textContent ?? ""), "filling screen: How it scores shows the 8-player points");
  check($("[data-seat='t']")?.hasAttribute("data-you") === true, "filling screen: your seat is marked");
  await act(async () => void $("[data-leave-queue]")?.click());
  check(left, "filling screen: Leave queue");
  await un();
  un = await mount(React.createElement(MultiFilling, { size: 4, picks: "All puzzles", games: 3, seats: seats8.slice(0, 1), elapsedMs: 0, onLeave: () => {} }));
  check($("[data-points-table]")?.getAttribute("data-points-table") === "5,3,1,0" && $$("[data-empty]").length === 3, "filling screen (4): 5, 3, 1, 0 and three empty seats");
  await un();

  const ids = seats8.map((s) => s.seatId);
  const gamesPlayed: GameScore[][] = [ids.map((seatId, i) => ({ seatId, score: 200 - i * 20 })), ids.map((seatId, i) => ({ seatId, score: i * 20 }))];
  const rows = standingsAfter(8, ids, gamesPlayed);
  un = await mount(
    React.createElement(MultiStandings, {
      size: 8,
      game: 2,
      games: 3,
      rows,
      seats: seats8,
      headline: { gameName: "Apex", winnerName: "K", yourPlace: 8, yourPoints: 0 },
      next: { gameName: "Breaker", msLeft: 5000 },
    }),
  );
  check($$("[data-standings] [data-standing]").length === 8, "standings screen: eight rows");
  check(eq($$("[data-standing]").map((li) => li.getAttribute("data-standing")), rows.map((r) => r.seatId)), "standings screen: rows in the standings order");
  check($$("[data-move='up'] [role='img'], [data-move='up'] svg").length > 0 && $$("[data-move='down']").length > 0, "standings screen: movement shown with arrows, never colour alone");
  check(/Final game/.test($("[data-next-game]")?.textContent ?? "") && $("[data-next-clock]")?.textContent === "0:05", "standings screen: the final game next, with its countdown");
  check($("[data-standing='t']")?.hasAttribute("data-you") === true, "standings screen: your row outlined");
  await un();

  const final = finalPlacings(8, ids, [...gamesPlayed, ids.map((seatId, i) => ({ seatId, score: (i * 37) % 200 }))]);
  const changes = new Map(seats8.filter((s) => !s.recorded).map((s, i) => [s.seatId, 8 - i * 2]));
  const entrance = React.createElement("div", { "data-test-entrance": "" }, "entrance");
  for (const r of [false, true]) {
    reduce = r;
    un = await mount(
      React.createElement(MultiFinal, {
        size: 8,
        picks: "Mixed",
        rows: final,
        seats: seats8,
        changes,
        yourRating: { rating: 1284, change: 6, parts: [{ label: "Puzzles", rating: 1302, change: 6 }] },
        joules: 225,
        entrance,
        onNext: () => {},
      }),
    );
    const shown = [...$$("[data-podium] [data-standing]"), ...$$("[data-placings] [data-standing]")].map((el) => el.getAttribute("data-standing")).sort();
    check(eq(shown, [...ids].sort()), `final screen${r ? " (reduced motion)" : ""}: every placing drawn on the first render`);
    if (!r) {
      check($("[data-podium-entrance] [data-test-entrance]") !== null, "final screen: the equipped entrance draws in the podium's own layer");
      check($("[data-placings] [data-podium-entrance]") === null && $("[data-podium-entrance]")?.closest("[data-podium]") !== null, "final screen: the entrance never sits over the placings list");
      check($("[data-podium-entrance]")?.getAttribute("aria-hidden") === "true", "final screen: the entrance is decorative");
    } else check($("[data-podium-entrance]") === null, "final screen: no entrance motion under reduced motion");
    check(eq($$("[data-pod-place]").map((el) => el.getAttribute("data-pod-place")), [String(final[1]!.place), String(final[0]!.place), String(final[2]!.place)]), "final screen: the podium 2nd, 1st, 3rd");
    check($("[data-your-rating] [data-rating]")?.textContent === "1,284" && $("[data-your-rating] [data-change='6']") !== null, "final screen: your rating and its change");
    check($("[data-joules='225']") !== null && /\+225 Joules/.test($("[data-joules]")?.textContent ?? ""), "final screen: the Joules line");
    check($$("[data-placings] [data-change]").length + $$("[data-podium] [data-change]").length === 7, "final screen: each live player's rating change shown (recorded runs none)");
    check(/Next match/.test($("[data-next-match]")?.textContent ?? ""), "final screen: Next match");
    await un();
  }
  /* 7b. W3c's format slot and shared parts (W3c #380 dc89d06d): the three screens fitted to W3c's props, read through
     multiView.ts (stood in by setMultiViewPort), drawn with W3c's MatchChips, JoulesLine, RankEmblem, RatedCard and
     PlayerDot. */
  {
    const fs = await import("../src/components/rated/formatScreens");
    const fmt = await import("../src/components/rated/multi/MultiFormat");
    const mv = await import("../src/lib/rated/multi/multiView");
    const { tierFor } = await import("../src/lib/rated/tiers");
    const rankAt = (rating: number) => ({ ...tierFor(rating, null), rating });
    const slot = fs.screensFor("ffa4");
    check(slot?.Search === fmt.MultiSearch && slot?.Between === fmt.MultiBetween && slot?.Result === fmt.MultiResult && slot?.vs === false && fs.screensFor("ffa8") === slot, "W3c's slot: filling for Search, standings Between, final for Result, no VS");
    check(fs.screensFor("bo3")?.vs === true, "W3c's slot: a 1v1 keeps its own screens");

    // The pure builders from W3b's public settlement and match view.
    const vp = [1, 2, 3, 4].map((n) => ({ userId: `u${n}`, slot: n, displayName: `P${n}`, guest: n === 4 }));
    const tier = (r: number) => ({ ...tierFor(r, null) });
    const settled = {
      format: "ffa4",
      players: [
        { userId: "u1", slot: 1, scores: [100, 50, 90] },
        { userId: "u2", slot: 2, scores: [120, 60, 40] },
        { userId: "u3", slot: 3, scores: [80, 70, 30] },
        { userId: "u4", slot: 4, scores: [100, 50, 90] },
      ],
      games: [{ type: "unblock" }, { type: "hover" }, { type: "lightsout" }],
      placings: { u1: 1, u4: 1, u2: 3, u3: 4 },
      ratings: {
        ok: true as const,
        players: [
          { playerId: "u1", moved: true, joulz: { before: 1200.4, after: 1211.6 }, tier: { before: tier(1200), after: tier(1212) } },
          { playerId: "u2", moved: true, joulz: { before: 1250, after: 1244 }, tier: { before: tier(1250), after: tier(1244) } },
          { playerId: "u3", moved: false, joulz: { before: 1300, after: 1300 }, tier: { before: tier(1300), after: tier(1300) } },
        ],
      },
    };
    const fin = mv.multiFinalFrom(settled as never, vp, "u2")!;
    check(fin.size === 4 && eq(fin.rows.map((r) => [r.seatId, r.place]), [["slot:1", 1], ["slot:4", 1], ["slot:2", 3], ["slot:3", 4]]), "final data: placings from the stored scores (level points split by total, level totals shared)");
    check(fin.rows.every((r) => settled.placings[vp.find((p) => `slot:${p.slot}` === r.seatId)!.userId as keyof typeof settled.placings] === r.place), "final data: the same places the server stored");
    check(eq([...fin.changes.entries()].sort(), [["slot:1", 12], ["slot:2", -6]]), "final data: each moved player's change from W3a's answer, none for an unmoved one or a guest without an answer");
    check(fin.seats.find((x) => x.seatId === "slot:2")?.you === true && fin.seats.find((x) => x.seatId === "slot:1")?.rank?.rating === 1211.6 && fin.seats.find((x) => x.seatId === "slot:3")?.rank === null, "final data: you marked, tiers only for moved players");
    check(mv.multiFinalFrom({ ...settled, format: "bo3" } as never, vp, "u2") === null, "final data: a 1v1 isn't drawn here");
    const flaggedFin = mv.multiFinalFrom({ ...settled, ratings: { ok: true, players: settled.ratings.players.map((c) => ({ ...c, moved: false })) } } as never, vp, "u2")!;
    check(flaggedFin.changes.size === 0 && flaggedFin.seats.every((x) => x.rank === null), "final data: a match that moved nobody (a flagged run) shows no change for anyone");
    const st = mv.multiStandingsFrom({
      format: "ffa4",
      players: vp,
      gameTypes: ["unblock", "hover", "lightsout"],
      results: [
        { player_slot: 1, round_number: 1, score: 100 },
        { player_slot: 2, round_number: 1, score: 120 },
        { player_slot: 3, round_number: 1, score: 80 },
        { player_slot: 4, round_number: 1, score: 100 },
        { player_slot: 1, round_number: 2, score: 50 },
        { player_slot: 2, round_number: 2, score: 60 },
        { player_slot: 3, round_number: 2, score: 70 },
      ],
      meId: "u4",
    })!;
    check(st.game === 2 && st.games === 3 && st.next?.gameType === "lightsout" && st.headline.gameType === "hover", "standings data: after game 2 of 3, Lights Out next");
    check(st.headline.winnerName === "P3" && st.headline.yourPlace === 4 && st.headline.yourPoints === 0, "standings data: the game's winner, your place and points (a missing row scores 0)");
    check(eq(st.rows.map((r) => r.seatId), standingsAfter(4, ["slot:1", "slot:2", "slot:3", "slot:4"], [[{ seatId: "slot:1", score: 100 }, { seatId: "slot:2", score: 120 }, { seatId: "slot:3", score: 80 }, { seatId: "slot:4", score: 100 }], [{ seatId: "slot:1", score: 50 }, { seatId: "slot:2", score: 60 }, { seatId: "slot:3", score: 70 }, { seatId: "slot:4", score: 0 }]]).map((r) => r.seatId)), "standings data: rules.ts standingsAfter's order");

    // The adapters with W3c's props.
    const LOOK = { cardArt: "card-art.joulz-navy", frame: "frame.plain", nameColour: null, avatar: { id: "captain-joulz", colour: 4, gem: null } };
    const ME = { userId: "u2", username: "TheInventor", playerNumber: 42, look: LOOK, title: null, badges: [], rank: rankAt(1278), guest: false, deleted: false };
    let cancelled = false;
    let u2 = await mount(React.createElement(fmt.MultiSearch, { me: ME as never, pickText: "Mixed, 8 players", progress: { elapsedMs: 9000, range: 100, recordedAfterMs: 8000 }, onCancel: () => (cancelled = true) }));
    check($("[data-rated-multi='filling']")?.getAttribute("data-size") === "8" && $("[data-fill-count]")?.textContent?.replace(/\s/g, "") === "1/8", "W3c Search: the filling screen for 8, your seat first");
    check($("[data-my-card] [data-player-card]") !== null, "W3c Search: your card through W3c's RatedCard");
    check($("[data-match-chips]") !== null && /8 players/.test($("[data-match-chips]")?.textContent ?? "") && /Mixed/.test($("[data-match-chips]")?.textContent ?? ""), "W3c Search: W3c's MatchChips");
    check($("[data-seat='me'] [data-seat-emblem]") !== null, "W3c Search: your tier with W3c's RankEmblem");
    check(/0:09/.test($("[data-fill-clock]")?.textContent ?? ""), "W3c Search: the clock from W3c's search progress");
    await act(async () => void $("[data-leave-queue]")?.click());
    check(cancelled, "W3c Search: Leave queue is W3c's cancel");
    await u2();
    u2 = await mount(React.createElement(fmt.MultiSearch, { me: ME as never, pickText: "Puzzles, 4 players", progress: null, onCancel: () => {} }));
    check($("[data-rated-multi='filling']")?.getAttribute("data-size") === "4", "W3c Search: the filling screen for 4");
    await u2();

    const withCard = (d: NonNullable<ReturnType<typeof mv.multiFinalFrom>>) => ({ ...d, seats: d.seats.map((x) => (x.guest ? x : { ...x, card: LOOK })) });
    mv.setMultiViewPort({ final: async () => withCard(fin), standings: async () => ({ ...st, seats: st.seats.map((x) => ({ ...x, card: LOOK })) }) });
    let nexted = false;
    const result = {
      match: { id: "m1", pick: "mixed", format: "ffa4", bestOf: 3, roomCode: "ABCD", me: ME, them: ME, source: { kind: "live" }, headToHead: null, placement: null },
      games: [], myGames: 0, theirGames: 0, outcome: "drawn",
      rating: { after: rankAt(1244), change: -6, puzzles: null, arcade: null },
      frozen: null, placementResults: null, reveal: null,
      joules: { amount: 150, passLevel: 13 },
      star: null, nearMiss: null, friend: false, rematchUntil: null, moved: [],
    };
    u2 = await mount(React.createElement(fmt.MultiResult, { result: result as never, nowMs: 0, onNext: () => (nexted = true), onRematch: () => {}, onTiers: () => {}, onChallenge: async () => ({ ok: false, message: "" }), onReveal: () => {} }));
    for (let i = 0; i < 5 && !$("[data-rated-multi='final']"); i++) await act(async () => void (await new Promise((r) => setTimeout(r, 10))));
    check($("[data-rated-multi='final']")?.getAttribute("data-size") === "4", "W3c Result: the final screen for a 4-player result");
    check(/You finished 3rd/.test($("[data-final-headline]")?.textContent ?? ""), "W3c Result: your place from the stored scores");
    check($("[data-joules='150'] [data-joules-line='150']") !== null && /pass level 13/.test($("[data-joules]")?.textContent ?? ""), "W3c Result: W3c's JoulesLine with the pass level");
    check($("[data-your-rating] [data-change='-6']") !== null, "W3c Result: your change from W3c's result");
    check($$("[data-podium] [data-change], [data-placings] [data-change]").length === 2, "W3c Result: every moved player's change, nobody else's");
    check($$("[data-seat-emblem]").length === 2 && $$("[data-podium] .pcard, [data-podium] svg, [data-podium] img").length > 0, "W3c Result: W3c's RankEmblem for moved players, PlayerDot avatars");
    check($("[data-match-chips]") !== null, "W3c Result: W3c's MatchChips");
    await act(async () => void $("[data-next-match]")?.click());
    check(nexted, "W3c Result: Next match is W3c's onNext");
    await u2();

    u2 = await mount(React.createElement(fmt.MultiBetween, { matchId: "m1" }));
    for (let i = 0; i < 5 && !$("[data-rated-multi='standings']"); i++) await act(async () => void (await new Promise((r) => setTimeout(r, 10))));
    check($$("[data-standings] [data-standing]").length === 4 && $("[data-standing='slot:4']")?.hasAttribute("data-you") === true, "W3c Between: the standings, your row marked");
    check(/Final game/.test($("[data-next-game]")?.textContent ?? "") && $("[data-next-clock]") === null, "W3c Between: the next game, no clock it wasn't given");
    await u2();
    mv.setMultiViewPort(null);
    u2 = await mount(React.createElement(fmt.MultiBetween, { matchId: "m1" }));
    check($("[data-rated-multi]") === null, "W3c Between: nothing drawn without the server (a skeleton)");
    await u2();
    mv.setMultiViewPort(undefined);
    const src = readFileSync("src/lib/rated/multi/multiView.ts", "utf8");
    check(/import\.meta\.env\.PROD\) return;/.test(src) && /!import\.meta\.env\.PROD\) return Promise\.resolve\(override\)/.test(src) && /await ratedBackend\(\)/.test(src), "multiView: the check port is ignored in production and the real binding sits behind W3c's ratedBackend gate");
    const own = readFileSync("src/components/rated/multi/MultiScreens.tsx", "utf8");
    check(!/LOGO_PATHS|rm-chip"|<Avatar /.test(own) && /from "@\/components\/rated\/RatedParts"/.test(own), "screens: W3c's parts in place of W3d's own Joules line, chips and avatar");
  }

  const css = readFileSync("src/polish-layout/rated-multi.css", "utf8");
  check(!/animation|transition|@keyframes/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")), "screens: no motion of their own");
  check(!/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")), "screens: tokens only");
  check(readFileSync("src/styles.css", "utf8").includes('@import "./polish-layout/rated-multi.css";'), "screens: the stylesheet is loaded");
}

/* ------------------------------------------------------------------ 8. analytics */
{
  const { ANALYTICS_EVENTS, CLIENT_EVENTS } = await import("../src/lib/analytics/events");
  check((["multiplayer_match_started", "multiplayer_match_finished"] as const).every((e) => (ANALYTICS_EVENTS as readonly string[]).includes(e)), "analytics: both events listed");
  check(!(CLIENT_EVENTS as readonly string[]).some((e) => e.startsWith("multiplayer_")), "analytics: server only (the phone can't send them)");
  const files = readdirSync("supabase/migrations").filter((f) => /multiplayer/.test(f));
  check(files.length === 1 && files[0]! >= "20261114400000" && files[0]! <= "20261114409999_", `analytics: one migration in W3d's range (${files.join(", ")})`);
  const sql = readFileSync(join("supabase/migrations", files[0]!), "utf8");
  check(/UNION SELECT unnest\(ARRAY\['multiplayer_match_started', 'multiplayer_match_finished'\]\)/.test(sql) && /SELECT unnest\(existing\)/.test(sql), "analytics: the migration adds to the event list as it stands, never replacing it");
  check(!/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM|destructive: approved/i.test(sql), "analytics: the migration is additive");
}

/* ------------------------------------------------------------------ 9. rooms untouched */
{
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
  const outside = [...walk("src/lib/duel"), ...walk("src/lib/round"), ...walk("src/routes"), ...walk("src/components/duel")]
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => /rated\/multi|ratedMultiConfig/.test(readFileSync(f, "utf8")));
  check(outside.length === 0, `rooms: no room, round-engine or practice code reads the rated multiplayer modules (${outside.join(", ") || "none"})`);
  check(eq(placingTable(4), [5, 3, 1, 0]) && eq(placingTable(8), [10, 7, 5, 4, 3, 2, 1, 0]) && eq(placingTable(16), [15, 12, 10, 8, 6, 5, 4, 3, 2, 1]), "rooms: the Placings table is as before");
}

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${checks} rated-multi check(s)`);
  process.exit(1);
}
console.log(`rated-multi-check: all ${checks} checks passed`);
