/**
 * Joe's phone-test notes (27 Oct 2026; docs/phone-notes-oct-2026.md, src/lib/duel/phoneNotes.ts).
 *
 *   1. Dealt stamps: rooms deal swapwordRev 6, balanceRev 3, measureRev 3, gravityRev 4, whackRev 4, mazeRev 2,
 *      pairRev 2 and tilesRev 4; pinned (pinPrePhoneNotes), the stamps before them, exactly as before.
 *   2. Limits: Swapword minimum + 12; Counterweight and Brimful 1.5× rev 2's limits, rounded up; Topsy-Turvy 2×.
 *   3. Topsy-Turvy gravityRev 4: a ball home blocks (gravityRev 3: it rolls over); 20 dealt rounds re-verified.
 *   4. Bonk whackRev 4: the diamond stays up 27 ticks (whackRev 3: 18), the base schedule unchanged.
 *   5. Labyrinth mazeRev 2: three distinct stars, one per third of the route, anywhere but the start and exit; graded
 *      as mazeRev 1 grades the same trail.
 *   6. Matchmaker pairRev 2: the gold pair's 20 for a match in the first 30 s, none after or without a time; the
 *      time is held to the answer's receipt.
 *   7. Gradient tilesRev 4: 30 dealt rounds verified (palette readable, minimum, par, route), locked tiles can't be
 *      swapped, random play always finishes, grading on the swaps.
 *   8. Trail is a Logic game; the display name "Gradient".
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPrePhoneNotes } from "../src/lib/duel/phoneNotes";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleDef } from "../src/lib/duel/registry";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { stampMoveLimits } from "../src/lib/duel/moveLimits.server";
import { BALANCE_SPARE_HANGS, MEASURE_LIMIT_FACTOR } from "../src/lib/duel/moveLimits.server";
import { GRAVITY_REV_TOPSY, TOPSY_HOME, topsyStart, topsyTilt, topsyTiltLimit, type TopsyBoard } from "../src/lib/duel/topsy";
import { verifyTopsyPuzzle } from "../src/lib/duel/topsy.server";
import { whackGameFor, whackDiamondLife, WHACK_DIAMOND_LIFE_TICKS, WHACK_DIAMOND_LIFE_TICKS_NOTES } from "../src/lib/arcade/whack";
import { decodeMazeTrail, encodeMazeTrail, mazeStarsTaken } from "../src/lib/duel/depth/labyrinth";
import { mazeCorridorNeighbours } from "../src/lib/duel/maze";
import { PAIR_GOLD_MAX, joinPairGoldTime, pairDepthReplay, splitPairGoldTime } from "../src/lib/duel/depth/matchmaker";
import { decodePairFlips, encodePairFlips, sameCard } from "../src/lib/duel/pairmatch";
import {
  JUMBLED_CORNERS,
  encodeGradient,
  gradientLocked,
  gradientMinimum,
  replayGradient,
  type GradientSwap,
} from "../src/lib/duel/jumbled";
import { GRADIENT_OUT, verifyGradientPuzzle } from "../src/lib/duel/jumbled.server";
import { gradientReadable } from "../src/lib/duel/gradientPalette";
import type {
  BalancePuzzleData,
  GravityPuzzleData,
  MazePuzzleData,
  MeasurePuzzleData,
  PairPuzzleData,
  PuzzleData,
  PuzzleType,
  SwapwordPuzzleData,
  TilesPuzzleData,
} from "../src/lib/duel/types";

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, msg: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(msg);
};
const t0 = performance.now();
const dealt = (type: PuzzleType, seed: number) => withSeededRandom(seed, () => generatePuzzle(type)) as PuzzleData;
const upTo5 = (n: number) => Math.max(5, Math.ceil(n / 5) * 5);

/* ------------------------------------------------------------------ 1. dealt stamps */
const NEW: [PuzzleType, string, number, number][] = [
  ["swapword", "swapwordRev", 6, 5],
  ["balance", "balanceRev", 3, 2],
  ["measure", "measureRev", 3, 2],
  ["gravity", "gravityRev", 4, 3],
  ["whack", "whackRev", 4, 3],
  ["maze", "mazeRev", 2, 1],
  ["pairmatch", "pairRev", 2, 1],
  ["tiles", "tilesRev", 4, 3],
];
for (const [type, key, now, before] of NEW) {
  const p = dealt(type, 11) as unknown as Record<string, unknown>;
  ok(p[key] === now, `rooms deal ${type} ${key} ${now} (got ${p[key]})`);
  pinPrePhoneNotes(true);
  const q = dealt(type, 11) as unknown as Record<string, unknown>;
  pinPrePhoneNotes(false);
  ok(q[key] === before, `pinned: ${type} deals ${key} ${before} (got ${q[key]})`);
}

/* ------------------------------------------------------------------ 2. limits */
for (let seed = 1; seed <= 12; seed++) {
  const sw = dealt("swapword", seed) as SwapwordPuzzleData;
  ok(sw.maxSwaps === sw.minSwaps + 12, `Swapword ${seed}: budget ${sw.maxSwaps} = minimum ${sw.minSwaps} + 12`);
  const bal = dealt("balance", seed) as BalancePuzzleData;
  const balWant = bal.scales.map((s, i) => Math.ceil(1.5 * (s.tray.length + BALANCE_SPARE_HANGS[i]!)));
  ok(JSON.stringify(bal.placeLimits) === JSON.stringify(balWant), `Counterweight ${seed}: hangs ${bal.placeLimits} = ${balWant}`);
  const mea = dealt("measure", seed) as MeasurePuzzleData;
  const meaWant = (mea.minMoves ?? []).map((m) => Math.ceil(1.5 * upTo5(MEASURE_LIMIT_FACTOR * m)));
  ok(JSON.stringify(mea.moveLimits) === JSON.stringify(meaWant), `Brimful ${seed}: pours ${mea.moveLimits} = ${meaWant}`);
}
ok(JSON.stringify((dealt("balance", 3) as BalancePuzzleData).placeLimits) === "[9,12,15,18]", "Counterweight: 9 / 12 / 15 / 18 hangs");
{
  // Pinned, the limits are exactly rev 2's (stampMoveLimits on the same puzzle).
  pinPrePhoneNotes(true);
  const b = dealt("balance", 5) as BalancePuzzleData;
  const m = dealt("measure", 5) as MeasurePuzzleData;
  pinPrePhoneNotes(false);
  ok(JSON.stringify(b.placeLimits) === "[6,8,10,12]", "pinned: Counterweight 6 / 8 / 10 / 12");
  ok(JSON.stringify(m.moveLimits) === JSON.stringify((m.minMoves ?? []).map((n) => upTo5(MEASURE_LIMIT_FACTOR * n))), "pinned: Brimful's rev-2 limits");
  ok(stampMoveLimits(b) !== null, "stampMoveLimits runs");
}

/* ------------------------------------------------------------------ 3. Topsy-Turvy */
{
  // Ball 0 drops into its hole at cell 3; ball 1, behind it on the same row, rolls on over the filled hole on
  // gravityRev 3 and stops against it on gravityRev 4.
  const board: TopsyBoard = { walls: [], starts: [1, 0, 90, 91, 92, 93], holes: [3, 7, 80, 81, 82, 83], stars: [] };
  const r3 = topsyTilt(board, new Set(), topsyStart(board), "R");
  const r4 = topsyTilt({ ...board, homeBlocks: true }, new Set(), topsyStart(board), "R");
  ok(r3.state.balls[0] === TOPSY_HOME && r3.state.balls[1] === TOPSY_HOME, "gravityRev 3: a ball rolls over a filled hole (into its own)");
  ok(r4.state.balls[0] === TOPSY_HOME && r4.state.balls[1] === 2, `gravityRev 4: a ball stops against a filled hole (at ${r4.state.balls[1]})`);
  for (let seed = 1; seed <= 20; seed++) {
    const p = dealt("gravity", 100 + seed) as GravityPuzzleData;
    ok(p.gravityRev === 4 && (p.boards ?? []).every((b) => b.homeBlocks === true), `Topsy-Turvy ${seed}: gravityRev 4 boards carry the rule`);
    ok(verifyTopsyPuzzle(p) === null, `Topsy-Turvy ${seed}: ${verifyTopsyPuzzle(p)}`);
    ok((p.tiltLimits ?? []).every((l, b) => l === 2 * topsyTiltLimit(p.boardStarMins![b]!, GRAVITY_REV_TOPSY)), `Topsy-Turvy ${seed}: 2× the tilts (${p.tiltLimits})`);
  }
}

/* ------------------------------------------------------------------ 4. Bonk */
{
  const g3 = whackGameFor(3);
  const g4 = whackGameFor(4);
  for (const seed of [1, 7, 4242]) {
    const s3 = g3.init(seed);
    const s4 = g4.init(seed);
    ok(JSON.stringify(s3.schedule) === JSON.stringify(s4.schedule), `Bonk ${seed}: the same targets on whackRev 3 and 4`);
    ok(whackDiamondLife(s3.dp!) === WHACK_DIAMOND_LIFE_TICKS && whackDiamondLife(s4.dp!) === WHACK_DIAMOND_LIFE_TICKS_NOTES, `Bonk ${seed}: diamond life 18 → 27 ticks`);
    ok(s3.dp!.life === undefined, `Bonk ${seed}: whackRev 3's state is unchanged (no life field)`);
    // Step each to just past rev 3's life after the first diamond rises: up on rev 4, gone on rev 3.
    const at = s4.dp!.at[0]!;
    let a = s3;
    let b = s4;
    for (let t = 0; t < at + WHACK_DIAMOND_LIFE_TICKS + 3; t++) {
      a = g3.step(a, null);
      b = g4.step(b, null);
    }
    ok(a.dp!.status[0] !== b.dp!.status[0], `Bonk ${seed}: 3 ticks past 300 ms the diamond is gone on rev 3 and still up on rev 4`);
  }
}

/* ------------------------------------------------------------------ 5. Labyrinth */
for (let seed = 1; seed <= 30; seed++) {
  const m = dealt("maze", seed) as MazePuzzleData & { stars: number[]; cols: number };
  const route = m.solution ?? [];
  const stars = m.stars ?? [];
  ok(m.mazeRev === 2 && stars.length === 3 && new Set(stars).size === 3, `Labyrinth ${seed}: mazeRev 2 with three stars`);
  ok(stars.every((c) => c !== m.start && c !== m.exit), `Labyrinth ${seed}: no star on the start or exit`);
  // Reachable: breadth-first from the start through open corridors.
  const seen = new Set([m.start]);
  const queue = [m.start];
  while (queue.length) for (const n of mazeCorridorNeighbours(m.cells, queue.shift()!, m.cols)) if (!seen.has(n)) (seen.add(n), queue.push(n));
  ok(stars.every((c) => seen.has(c)), `Labyrinth ${seed}: every star reachable`);
  // Walk the route with an out-and-back detour to each star off it: all three are taken.
  const trail: number[] = [];
  for (const cell of route) {
    trail.push(cell);
    for (const s of stars) {
      if (s === cell || nearestOnRoute(m, route, s) !== cell) continue;
      const path = shortestPath(m, cell, s);
      trail.push(...path.slice(1), ...[...path].reverse().slice(1));
    }
  }
  const answer = encodeMazeTrail(trail, m.cols);
  const taken = mazeStarsTaken(decodeMazeTrail(answer, m.start, m.cols, m.cells.length), stars);
  ok(taken.length === 3, `Labyrinth ${seed}: a trail through every star takes all three (${taken.length})`);
  const g = gradeAnswer(m, answer, 45_000);
  const r1 = gradeAnswer({ ...m, mazeRev: 1 } as PuzzleData, answer, 45_000);
  ok(g.isCorrect && g.score === r1.score, `Labyrinth ${seed}: mazeRev 2 grades the trail as mazeRev 1 does (${g.score} / ${r1.score})`);
}
function shortestPath(m: MazePuzzleData & { cols: number }, from: number, to: number): number[] {
  const prev = new Map<number, number>([[from, from]]);
  const q = [from];
  while (q.length) {
    const c = q.shift()!;
    if (c === to) break;
    for (const n of mazeCorridorNeighbours(m.cells, c, m.cols)) if (!prev.has(n)) (prev.set(n, c), q.push(n));
  }
  const path = [to];
  for (let c = to; c !== from; c = prev.get(c)!) path.unshift(prev.get(c)!);
  return path;
}
function nearestOnRoute(m: MazePuzzleData & { cols: number }, route: number[], star: number): number {
  const onRoute = new Set(route);
  const seen = new Set([star]);
  const q = [star];
  while (q.length) {
    const c = q.shift()!;
    if (onRoute.has(c)) return c;
    for (const n of mazeCorridorNeighbours(m.cells, c, m.cols)) if (!seen.has(n)) (seen.add(n), q.push(n));
  }
  return -1;
}

/* ------------------------------------------------------------------ 6. Matchmaker */
{
  const p = dealt("pairmatch", 5) as PairPuzzleData;
  const goldCards = p.cards.map((c, i) => (sameCard(c, p.gold) ? i : -1)).filter((i) => i >= 0);
  const flips = [goldCards[0]!, goldCards[1]!];
  ok(pairDepthReplay(p, flips, 29_000).goldBonus === PAIR_GOLD_MAX, "Matchmaker: the gold pair at 29 s pays 20");
  ok(pairDepthReplay(p, flips, 30_000).goldBonus === PAIR_GOLD_MAX, "Matchmaker: the gold pair at 30 s pays 20");
  ok(pairDepthReplay(p, flips, 30_001).goldBonus === 0, "Matchmaker: the gold pair after 30 s pays nothing");
  ok(pairDepthReplay(p, flips, null).goldBonus === 0, "Matchmaker: no time sent, no gold bonus");
  // Late on tries but early on the clock: rev 1 would pay nothing on try 25; rev 2 pays the full 20.
  const others = p.cards.map((_, i) => i).filter((i) => !goldCards.includes(i));
  const misses: number[] = [];
  for (let k = 0; k < 24; k++) misses.push(others[0]!, others.find((i) => !sameCard(p.cards[i], p.cards[others[0]!]))!);
  const late = [...misses, ...flips];
  ok(pairDepthReplay({ ...p, pairRev: 1 }, late).goldBonus === 0 && pairDepthReplay(p, late, 20_000).goldBonus === PAIR_GOLD_MAX, "Matchmaker: tries no longer matter, the clock does");
  ok(JSON.stringify(decodePairFlips(joinPairGoldTime(encodePairFlips(late), 12_345))) === JSON.stringify(late), "Matchmaker: the time suffix never changes the flips");
  ok(splitPairGoldTime("1,2,3").goldMs === null && splitPairGoldTime("1,2@777").goldMs === 777, "Matchmaker: the time is read only from its mark");
  // Graded: the server holds the time to the receipt (a claim of 10 s on an answer received at 40 s is 10 s; a claim
  // of 50 s on an answer received at 40 s counts as 40 s, still outside the window).
  const answer = (ms: number) => joinPairGoldTime(encodePairFlips(flips), ms);
  const at10 = gradeAnswer(p, answer(10_000), 50_000, undefined, 50_000);
  const at50 = gradeAnswer(p, answer(50_000), 50_000, undefined, 50_000);
  ok(at10.extra?.["goldBonus"] === PAIR_GOLD_MAX && at50.extra?.["goldBonus"] === 0, `Matchmaker: graded gold bonus ${at10.extra?.["goldBonus"]} / ${at50.extra?.["goldBonus"]}`);
  // pairRev 1 rounds ignore the time and keep their try curve.
  const r1 = gradeAnswer({ ...p, pairRev: 1 }, encodePairFlips(flips), 50_000);
  ok(r1.extra?.["goldBonus"] === PAIR_GOLD_MAX && r1.extra?.["goldMs"] === undefined, "Matchmaker: pairRev 1 grades on tries as before");
}

/* ------------------------------------------------------------------ 7. Gradient */
{
  const palettes = new Set<string>();
  for (let seed = 1; seed <= 30; seed++) {
    const p = dealt("tiles", 200 + seed) as TilesPuzzleData;
    ok(p.tilesRev === 4, `Gradient ${seed}: tilesRev 4`);
    const why = verifyGradientPuzzle(p, gradientReadable);
    ok(why === null, `Gradient ${seed}: ${why}`);
    palettes.add((p.palette ?? []).join(""));
    ok(p.frame.filter((t, c) => t !== c).length === GRADIENT_OUT, `Gradient ${seed}: ${GRADIENT_OUT} tiles out of place`);
    // Locked tiles (anchors and tiles home) can't be swapped; the swap is ignored and not counted.
    const home = p.frame.findIndex((t, c) => t === c && !JUMBLED_CORNERS.includes(c));
    const out = p.frame.findIndex((t, c) => t !== c);
    const locked = replayGradient(p.frame, [{ a: home, b: out }, { a: 0, b: out }]);
    ok(locked.moves === 0 && locked.frame.join() === p.frame.join(), `Gradient ${seed}: a locked tile can't be swapped`);
    // Random play (any two unlocked tiles) always finishes: locking never traps the player.
    let frame = [...p.frame];
    const swaps: GradientSwap[] = [];
    let rng = seed * 7919;
    const next = (n: number) => ((rng = (rng * 1103515245 + 12345) % 2147483648), rng % n);
    for (let k = 0; k < 400 && frame.some((t, c) => t !== c); k++) {
      const free = frame.map((_, c) => c).filter((c) => !gradientLocked(frame, c));
      ok(free.length !== 1, `Gradient ${seed}: never exactly one tile left unlocked`);
      const a = free[next(free.length)]!;
      const b = free.filter((c) => c !== a)[next(free.length - 1)]!;
      swaps.push({ a, b });
      frame = replayGradient(frame, [{ a, b }]).frame;
    }
    const run = replayGradient(p.frame, swaps);
    ok(run.solved, `Gradient ${seed}: random swaps finish the board`);
    // The stored route is a shortest solve; graded as a finish at or under par.
    const route = (p.solution ?? []).map((n) => ({ a: Math.floor(n / 100), b: n % 100 }));
    const best = gradeAnswer(p, encodeGradient(route), 90_000);
    ok(best.isCorrect && route.length === gradientMinimum(p.frame) && best.score >= 150, `Gradient ${seed}: the shortest route scores ${best.score}`);
    const slow = gradeAnswer(p, encodeGradient(swaps), 10_000);
    ok(slow.isCorrect && slow.score >= 120 && slow.score < best.score, `Gradient ${seed}: a slow, wasteful finish scores ${slow.score}`);
    const half = gradeAnswer(p, encodeGradient(route.slice(0, Math.floor(route.length / 2))), 30_000);
    ok(!half.isCorrect && half.score > 0 && half.score < 110, `Gradient ${seed}: half the route scores ${half.score}`);
    ok(gradeAnswer(p, "R21,C34", 60_000).score === 0, `Gradient ${seed}: slides do nothing on tilesRev 4`);
  }
  ok(palettes.size === 30, `Gradient: 30 rounds, ${palettes.size} different colour schemes`);
}

/* ------------------------------------------------------------------ 8. Trail, names */
ok(puzzleDef("trail").category === "logic", "Trail is a Logic game");
ok(gameDisplayName("tiles") === "Gradient", "tiles shows as Gradient");

const secs = ((performance.now() - t0) / 1000).toFixed(1);
console.log(`${checks} checks, ${secs} s`);
if (failures.length) {
  console.log(`FAIL phone-notes-check: ${failures.length} failed`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("phone-notes-check: all passed");
