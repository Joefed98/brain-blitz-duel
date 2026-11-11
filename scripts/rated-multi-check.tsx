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
 *  6. finishMultiMatch on a stand-in backend: the placings, the pairs, the Joules keys, the analytics events.
 *  7. The screens (happy-dom): filling, standings and final; the placings drawn on the first render with the entrance,
 *     the entrance only inside the podium, none under reduced motion; no motion of the screens' own.
 *  8. Analytics: the two events in ANALYTICS_EVENTS, the migration in W3d's range adding (not replacing) them.
 *  9. Rooms untouched: no room or practice code imports the rated multiplayer modules; the rooms' Placings table as before.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { RATED_FORMATS_ON } from "../src/config/ratedConfig";
import type { RatedMatchOutcome, RatedMatchResult } from "../src/lib/data/ratings";
import type { RatedMultiBackend } from "../src/lib/rated/multi/contracts";
import {
  assertMultiOn,
  fillMatch,
  finishMultiMatch,
  joinMultiQueue,
  multiRatedResult,
  multiSizeOn,
  multiSizesOn,
  RatedMultiOffError,
  type MultiGame,
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

function stubBackend(log: string[] = []): RatedMultiBackend & { matches: RatedMatchResult[] } {
  const matches: RatedMatchResult[] = [];
  return {
    matches,
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
    async recordRatedMatch(match): Promise<RatedMatchOutcome> {
      const duplicate = matches.some((m) => m.matchId === match.matchId);
      if (!duplicate) matches.push(match);
      return {
        ok: true,
        status: duplicate ? "duplicate" : "recorded",
        matchId: match.matchId,
        players: match.players.map((p) => {
          const place = match.placings?.[p.playerId] ?? null;
          return {
            playerId: p.playerId,
            side: p.side,
            moved: p.side === "live",
            frozen: p.side === "live" ? null : ("recorded_unrated_source" as const),
            changes: [],
            joulz: { before: 1200, after: 1200 + (place ? 10 - place : 0) },
            placement: { played: 5, of: 5 as const, done: true, label: null, justFinished: false },
            tier: { before: null, after: null },
            result: place === 1 ? ("win" as const) : ("loss" as const),
            place,
            joules: p.side === "live" ? (place === 1 ? 225 : 150) : 0,
            badges: [],
          };
        }),
      };
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
  let finishThrew = false;
  try {
    await finishMultiMatch({ matchId: "m", size, choice: "mixed", seats: [], games: [] }, { backend: stubBackend() });
  } catch (e) {
    finishThrew = e instanceof RatedMultiOffError;
  }
  check(finishThrew, `server: finishing a ${size}-player match is refused while off`);
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
check(!/window\.__/.test(readFileSync("src/lib/rated/multi/multi.server.ts", "utf8") + fnSource + readFileSync("src/config/ratedConfig.ts", "utf8")), "switches: no window override anywhere (nothing a browser can turn on)");
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
  const seats = plan.seats;
  const games: MultiGame[] = [0, 1, 2].map((g) => ({
    type: ["gridlock", "hover", "blackout"][g]!,
    pool: g === 1 ? ("arcade" as const) : ("puzzles" as const),
    category: g === 1 ? ("retro" as const) : ("logic" as const),
    signature: `sig${g}`,
    scores: seats.map((s, i) => ({ seatId: s.seatId, score: ((i + g) % 8) * 20 })),
  }));
  const out = await finishMultiMatch({ matchId: "m1", size: 8, choice: "mixed", seats, games }, { switches: ON, backend, record });
  const m = backend.matches[0]!;
  check(!!m && eq(m.format, { kind: "placings", players: 8 }) && m.choice === "mixed", "server finish: W3a gets a placings match of 8");
  check(!!m && Object.keys(m.placings ?? {}).length === 8 && out.placings.every((p) => m.placings![seats.find((s) => s.seatId === p.seatId)!.playerId] === p.place), "server finish: W3a's placings are the final placings, by player");
  check(!!m && m.players.filter((p) => p.side === "recorded").length === 3 && m.players.every((p) => p.side === "live" || (p.run.ownerId === p.playerId && p.run.source === "rated")), "server finish: recorded seats go to W3a as recorded runs owned by their player");
  check(!!m && m.games.length === 3 && m.games.every((g) => g.version === "classic" && Object.keys(g.scores).length === 8), "server finish: every game with every player's stored score");
  check(out.outcome.ok && out.outcome.players.filter((p) => p.side === "live").every((p) => p.joules === (p.place === 1 ? 225 : 150)), "server finish: Joules come from W3a's outcome (1.5× best of 3, live players only)");
  const fin = events.filter((e) => e.event === "multiplayer_match_finished");
  check(fin.length === 5 && fin.every((e) => e.props?.size === 8 && typeof e.props?.placing === "number" && typeof e.playerId === "string"), "events: multiplayer_match_finished for each live player with size and placing");
  const again = await finishMultiMatch({ matchId: "m1", size: 8, choice: "mixed", seats, games }, { switches: ON, backend, record });
  check(again.outcome.ok && again.outcome.status === "duplicate" && events.filter((e) => e.event === "multiplayer_match_finished").length === 5, "server finish: a repeat is W3a's duplicate and records no second finish event");
  const direct = multiRatedResult({ matchId: "m3", size: 4, choice: "arcade", seats: seats.slice(0, 4), games: games.map((g) => ({ ...g, scores: g.scores.slice(0, 4) })), placings: finalPlacings(4, seats.slice(0, 4).map((s) => s.seatId), games.map((g) => g.scores.slice(0, 4))) });
  check(eq(direct.format, { kind: "placings", players: 4 }) && Object.values(direct.placings ?? {}).sort().join() === "1,2,3,4", "result: a 4-player match's placings 1–4");
  const fromW3b = fromW3bCandidate({ key: "room:d:2", source: "room", ownerId: "o1", games: [{ type: "gridlock", signature: "s" }] }, "Mia", (_g, i) => `d${i + 1}`);
  check(eq(fromW3bCandidate.length, 3) && fromW3b.playerId === "o1" && fromW3b.runId === "room:d:2" && fromW3b.source === "room" && eq(fromW3b.dealKeys, ["d1"]), "filling: a W3b recorded run becomes a seat candidate (owner, key, source, deals)");
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
