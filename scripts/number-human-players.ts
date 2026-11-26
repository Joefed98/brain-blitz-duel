/**
 * The Number games' own players where the kits cannot feel a level's lever (D2, 22 Nov 2026; scripts/number-human.ts).
 * Script-only: floats and Math are fine. Importing this file registers them (setNumberPlayer); a game without one here
 * plays its kit. Each is a stated modelling assumption, the kits' own per-action times kept wherever they apply.
 */
import { encodeMeasureRound, measureActions, measureApply, measureSolved, type MeasureAction } from "../src/lib/duel/measure";
import { personRuns } from "../src/lib/duel/measureLevels";
import { measureMoveLimits } from "../src/lib/duel/moveLimits";
import type { CheckoutPuzzleData, MeasureBoardData, MeasurePuzzleData, NumberPyramidPuzzleData, TargetNumberPuzzleData } from "../src/lib/duel/types";
import { LARGE_TILES, decodeSteps, replayTargetSteps } from "../src/lib/duel/target";
import { joinTargetRounds, targetRoundPuzzle, targetRoundsOf, usesTargetRounds } from "../src/lib/duel/targetRounds";
import { exactMinTiles } from "../src/lib/duel/standard/number.server";
import { KITS } from "./puzzle-fairness/kits";
import { npEncodeRound, type NpPlacements } from "../src/lib/duel/numberPyramid";
import { npPersonSolve } from "../src/lib/duel/numberPyramidLevels";
import { NUMBER_PYRAMID_BANK } from "../src/lib/duel/numberPyramidBank.server";
import { checkoutBustFreeOrder, checkoutOptions, checkoutValid, decodeCheckoutDarts, encodeCheckoutDarts, joinCheckoutRound } from "../src/lib/duel/checkout";
import { checkoutPersonFinds } from "../src/lib/duel/checkout.server";
import { checkoutBust } from "../src/lib/duel/numberOverhaul";
import { checkoutBoardEffort } from "./puzzle-fairness/kits-number";
import { thinkMs, type Play, type Rng, type Skill, type Step } from "./puzzle-fairness/kit";
import { setNumberPlayer } from "./number-human";

/** The phone's "CORRECT" hold between stages (StageCorrect.tsx STAGE_CORRECT_HOLD_MS), as the kits use it. */
const HOLD_MS = 1000;

/* ================================ Brimful ================================ */

/**
 * Brimful's person (the kit plays the proven shortest line, which no person finds on a long board): the textbook way of
 * measureLevels.ts `personSolve`. For each board the person weighs the textbook methods a board offers (every ordered pair
 * of jugs with the tap; every order of the three jugs without it) by turning each in their head, each method costing
 * MEASURE_WEIGH_S a move turned, until they have seen them all, then pours the shortest one at the kit's pace (2.5 s a pour
 * for a good player, MEASURE_POUR_S). A slip (skill.err a pour) pours the wrong jug pair, costs the re-plan and is put
 * right by the shortest way back on to the method. Where no method reaches the target within the board's limit the
 * person falls back to the kit's shortest line, slowly (a board a person could only half see).
 */
const MEASURE_POUR_S = 2.5;
const MEASURE_WEIGH_S = 0.2;

function measureShortestFrom(board: MeasureBoardData, from: readonly number[]): MeasureAction[] {
  if (measureSolved(board, from)) return [];
  const actions = measureActions(board);
  const key = (a: readonly number[]) => a.join(",");
  const parent = new Map<string, { prev: string; action: MeasureAction }>();
  const seen = new Set([key(from)]);
  let frontier: number[][] = [[...from]];
  while (frontier.length) {
    const next: number[][] = [];
    for (const amounts of frontier)
      for (const action of actions) {
        const after = measureApply(board, amounts, action);
        if (!after) continue;
        const id = key(after);
        if (seen.has(id)) continue;
        seen.add(id);
        parent.set(id, { prev: key(amounts), action });
        if (measureSolved(board, after)) {
          const plan: MeasureAction[] = [];
          let cursor = id;
          while (cursor !== key(from)) {
            const step = parent.get(cursor)!;
            plan.unshift(step.action);
            cursor = step.prev;
          }
          return plan;
        }
        next.push(after);
      }
    frontier = next;
  }
  return [];
}

function measurePlayer(p: unknown, rng: Rng, skill: Skill): Play {
  const puzzle = p as MeasurePuzzleData;
  const limits = measureMoveLimits(puzzle) ?? [];
  const steps: Step[] = [];
  let t = 0;
  const all: MeasureAction[][] = puzzle.boards.map(() => []);
  for (let b = 0; b < puzzle.boards.length; b++) {
    const board = puzzle.boards[b]!;
    const limit = limits[b] ?? 200;
    const runs = personRuns(board, limit);
    // Weighing the methods: each one turned in the head until it reaches the target, or until it is longer than the best
    // found so far (the first is turned to the limit).
    let bestLen = Infinity;
    let turned = 0;
    for (const run of runs) {
      const len = run ? run.length : limit;
      turned += Math.min(len, bestLen === Infinity ? limit : bestLen);
      if (run) bestLen = Math.min(bestLen, run.length);
    }
    t += thinkMs(rng, MEASURE_WEIGH_S * turned, skill);
    const best = runs.filter((r): r is MeasureAction[] => r !== null).sort((x, y) => x.length - y.length)[0];
    let plan: MeasureAction[] = best ? [...best] : measureShortestFrom(board, board.start);
    const slow = best ? 1 : 1.6;
    let amounts = [...board.start];
    let guard = 0;
    while (!measureSolved(board, amounts) && guard++ < 200 && all[b]!.length < limit) {
      let action = plan.shift();
      if (!action) break;
      let slipped = false;
      if (rng.chance(skill.err)) {
        const legal = measureActions(board).filter((a) => measureApply(board, amounts, a) && JSON.stringify(a) !== JSON.stringify(action));
        if (legal.length) {
          action = rng.pick(legal);
          slipped = true;
          t += thinkMs(rng, MEASURE_POUR_S * 0.5, skill);
        }
      }
      const after = measureApply(board, amounts, action);
      if (!after) break;
      t += thinkMs(rng, MEASURE_POUR_S * slow, skill);
      all[b]!.push(action);
      steps.push({ answer: encodeMeasureRound(all), atMs: t });
      amounts = after;
      // Back on to a plan after a slip: the shortest way from here.
      if (slipped || (!plan.length && !measureSolved(board, amounts))) plan = measureShortestFrom(board, amounts);
    }
    if (b < puzzle.boards.length - 1) t += HOLD_MS;
  }
  return { steps };
}

setNumberPlayer("measure", measurePlayer);

/* ================================ Checkout ================================ */

/**
 * Checkout's person: the route the person-like solver finds chasing the bonus (checkout.server.ts `checkoutPersonFinds`
 * with `bigFirst`: the fewest darts first, the big finishers first, then the biggest, a checkout table's way), thrown in an order that never busts, not the stored
 * shortest route the kit throws; the kit's time per dart (5 s for a good player, longer on a stranger board,
 * kits-number.ts `checkoutBoardEffort`). A slip (skill.err a dart) throws a wrong dart, the board refuses the round, and
 * the person undoes and throws again. A board the person-like solver misses falls back to the stored route, slowly.
 */
const CHECKOUT_DART_S = 5;

function checkoutPlayer(p: unknown, rng: Rng, skill: Skill): Play {
  const puzzle = p as CheckoutPuzzleData;
  const steps: Step[] = [];
  let t = 0;
  const solved: string[] = puzzle.stages.map(() => "");
  const bust = checkoutBust(puzzle);
  for (let i = 0; i < puzzle.stages.length; i++) {
    const s = puzzle.stages[i]!;
    const found = checkoutPersonFinds(s, true);
    const stored = decodeCheckoutDarts(puzzle.routes?.[i] ?? "", s.maxDarts);
    const route = checkoutBustFreeOrder(s, found.route ?? stored);
    const base = CHECKOUT_DART_S * checkoutBoardEffort(s) * (found.route ? 1 : 1.6);
    const options = checkoutOptions(s);
    let guard = 0;
    while (!solved[i] && guard++ < 10) {
      const darts = route.map((d) => (rng.chance(skill.err) ? rng.pick(options) : d));
      for (let k = 0; k < darts.length; k++) {
        t += thinkMs(rng, base, skill);
        steps.push({ answer: joinCheckoutRound(solved), atMs: t });
      }
      t += 350;
      if (checkoutValid(s, darts, bust)) {
        solved[i] = encodeCheckoutDarts(darts);
        steps.push({ answer: joinCheckoutRound(solved), atMs: t });
      } else {
        t += thinkMs(rng, base * 0.6, skill) + darts.length * 350;
        steps.push({ answer: joinCheckoutRound(solved), atMs: t });
      }
    }
    t += 900;
  }
  return { steps };
}

setNumberPlayer("checkout", checkoutPlayer);

/* ============================ Integer Pyramid ============================ */

/**
 * Integer Pyramid's person (the kit takes 4 s a stone whatever its numbers): stones in the order the person-like solver
 * (numberPyramidLevels.ts `npPersonSolve`) deduces them, each a sum or a difference of the stones beside it, or the only
 * tile that fits; a stone's time is the kit's 4 s (a good player) × its sum's size, PYRAMID_DIGITS_COST more for every
 * digit the larger number carries past one, normalised so today's Normal boards average exactly the kit's 4 s (the
 * modelling assumption: a three-digit sum takes about twice a one-digit one). An "only tile" deduction scans the tray:
 * PYRAMID_SCAN_COST × that. A slip (skill.err a stone) drops a wrong tile, seen and replaced 0.6 of a stone later (the
 * board's broken sum shows it). A board the solver cannot finish is placed in the kit's order, slowly.
 */
const PYRAMID_STONE_S = 4;
const PYRAMID_DIGITS_COST = 0.5;
const PYRAMID_SCAN_COST = 1.3;

function digitsOf(n: number): number {
  return String(Math.max(1, Math.abs(Math.round(n)))).length;
}

function stoneCost(rows: number, cell: number, value: number, why: "sum" | "only-tile", solution: readonly number[]): number {
  // The larger number of the sum: the stone itself on a "sum" from below (it is the total), else the stone over it.
  const r = Math.floor((Math.sqrt(8 * cell + 1) - 1) / 2);
  const c = cell - (r * (r + 1)) / 2;
  const above = r > 0 ? Math.max(c > 0 ? solution[((r - 1) * r) / 2 + c - 1] ?? 0 : 0, c < r ? solution[((r - 1) * r) / 2 + c] ?? 0 : 0) : 0;
  void rows;
  const big = Math.max(value, above);
  return (1 + PYRAMID_DIGITS_COST * (digitsOf(big) - 1)) * (why === "only-tile" ? PYRAMID_SCAN_COST : 1);
}

let pyramidNorm: number | null = null;
/** The mean stone cost on today's Normal boards (the first 200 sets of the Normal bank): the normaliser. */
function pyramidNormal(): number {
  if (pyramidNorm !== null) return pyramidNorm;
  let sum = 0;
  let n = 0;
  for (const entry of NUMBER_PYRAMID_BANK.slice(0, 200))
    for (const b of entry.pyramids) {
      const run = npPersonSolve(b.givens, b.tray, b.rows, b.solution);
      for (const st of run.steps) {
        sum += stoneCost(b.rows, st.cell, st.value, st.why, b.solution);
        n++;
      }
    }
  pyramidNorm = n ? sum / n : 1;
  return pyramidNorm;
}

function pyramidPlayer(p: unknown, rng: Rng, skill: Skill): Play {
  const puzzle = p as NumberPyramidPuzzleData;
  const norm = pyramidNormal();
  const steps: Step[] = [];
  let t = 0;
  const boards: NpPlacements[] = puzzle.pyramids.map(() => ({}));
  puzzle.pyramids.forEach((b, i) => {
    const sol = puzzle.solutions?.[i] ?? [];
    const run = npPersonSolve(b.givens, b.tray, b.rows, sol);
    const order: { cell: number; value: number; why: "sum" | "only-tile"; slow: number }[] = run.solved
      ? run.steps.map((st) => ({ ...st, slow: 1 }))
      : b.givens.map((g, cell) => (g == null ? { cell, value: sol[cell]!, why: "only-tile" as const, slow: 1.6 } : null)).filter((x): x is NonNullable<typeof x> => x !== null);
    const used = new Set<number>();
    const tileFor = (value: number) => {
      const k = b.tray.findIndex((v, j) => v === value && !used.has(j));
      used.add(k);
      return k;
    };
    const pl = boards[i]!;
    for (const st of order) {
      const cost = (stoneCost(b.rows, st.cell, st.value, st.why, sol) / norm) * st.slow;
      t += thinkMs(rng, PYRAMID_STONE_S * cost, skill);
      const right = tileFor(st.value);
      const decoys = b.tray.map((_, k) => k).filter((k) => !used.has(k) && b.tray[k] !== st.value);
      if (rng.chance(skill.err) && decoys.length) {
        pl[st.cell] = rng.pick(decoys);
        steps.push({ answer: npEncodeRound(i, boards), atMs: t });
        t += thinkMs(rng, PYRAMID_STONE_S * 0.6 * cost, skill);
      }
      pl[st.cell] = right;
      steps.push({ answer: npEncodeRound(i, boards), atMs: t });
    }
    if (i < puzzle.pyramids.length - 1) {
      t += HOLD_MS;
      steps.push({ answer: npEncodeRound(i + 1, boards), atMs: t });
    } else steps.push({ answer: npEncodeRound(puzzle.pyramids.length, boards), atMs: t });
  });
  return { steps };
}

setNumberPlayer("numpyramid", pyramidPlayer);

/* ================================ Exact ================================ */

/**
 * Exact's round of targets in a row (targetRounds.ts): each target played by the kit (kits-number.ts targetKit: 8 s a
 * step for a good player, the stored route with dead ends at skill.err) at the search time its kind of board takes, the
 * kit's own level factors read by the board, not the level: a target that needs all six from one large number is the
 * kit's Hard (2.6 ×), one from small numbers only is its Expert (3 ×), one large and five or six numbers its Hard, and a
 * Normal-style target today's Normal (1 ×). Targets are played in turn, the next rack after the hit's 1.1 s hold. A
 * one-target puzzle plays the kit as it always has.
 */
const TARGET_ROUND_HOLD_MS = 1100;

function targetKind(tiles: readonly number[], target: number): "normal" | "hard" | "expert" {
  const large = tiles.filter((t) => LARGE_TILES.includes(t)).length;
  const min = exactMinTiles(tiles, target);
  if (min >= 6 && large === 0) return "expert";
  if (min >= 5 && large <= 1) return "hard";
  return "normal";
}

function targetPlayer(p: unknown, rng: Rng, skill: Skill, limitMs: number): Play {
  const puzzle = p as TargetNumberPuzzleData;
  const kit = KITS.target!;
  if (!usesTargetRounds(puzzle)) return kit.play(puzzle, rng, skill, limitMs);
  const rounds = targetRoundsOf(puzzle);
  const steps: Step[] = [];
  const done: string[] = [];
  let t = 0;
  for (let i = 0; i < rounds.length; i++) {
    const one = targetRoundPuzzle(puzzle, i);
    const kind = targetKind(one.tiles, one.target);
    const tagged = (kind === "normal" ? one : { ...one, level: kind }) as TargetNumberPuzzleData;
    const play = kit.play(tagged, rng, skill, limitMs);
    let last = "";
    for (const st of play.steps) {
      steps.push({ answer: joinTargetRounds([...done, st.answer]), atMs: t + st.atMs });
      last = st.answer;
    }
    t += play.steps.length ? play.steps[play.steps.length - 1]!.atMs : 0;
    if (replayTargetSteps(one.tiles, one.target, decodeSteps(last)).distance !== 0) break;
    done.push(last);
    t += TARGET_ROUND_HOLD_MS;
  }
  return { steps };
}

setNumberPlayer("target", targetPlayer);
