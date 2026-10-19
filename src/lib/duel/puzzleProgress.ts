/**
 * Progress measures for the shared puzzle helper (20 Oct 2026, `puzzleScoreRev: 3`; puzzleScoreRev3.ts,
 * docs/scoring-report-oct-2026.md section 3). Each returns the share (0–1) of the board the player's
 * answer holds when the round ends unfinished; null means "the game's rev-1 unfinished credit ÷ 110",
 * which the scoring report found to be a fair share already.
 *
 * The batch-1 fixes:
 *   - Slider: rows made on Joe's scale (1 row 30, 2 rows 70, 3 rows 90, 4 rows 110); wasted moves no
 *     longer take it to 0 (they only cut a finish's speed points).
 *   - Trail: the tiles that follow the solution from the start (a wrong turn later keeps them), or right tiles
 *     less wrong ones, whichever is more.
 *   - Counterweight: scales in deal order, equal shares, plus the current scale's weights on their
 *     solution notches.
 *   - Operator: equations in equal shares, plus the current equation's operators right from the left.
 *   - Brimful: puzzles in equal shares, plus how much closer the current jugs are to solved (solver
 *     distance, net of wasted moves).
 *   - Strikeout: words solved plus the current word's found letters, word 5 included (no cap at 4).
 *   - Interlock: tiles inside a valid word (14 of 15 is one short).
 *   - Exact: the closest any number made came to the target, off by 1 = one short, falling with the
 *     logarithm of the distance to nothing at the target's own size.
 *   - Turntable, Gridlock, Heave, Jumbled, Blackout, Hanoi: solver distance (how much closer the best
 *     board the player stood on is to solved than the start), less one per move that brought it no
 *     closer, so wandering earns little; never below the best board reached.
 *   - Lightbender: gems lit by the best layout the player stood on (a bomb lights nothing), the last ones
 *     counting a little more.
 *   - Matchmaker: pairs found, the first ones counted a little more (they are found with nothing known).
 *   - Safe Cracker: dials right on the best try, beyond the one a lucky guess gives, the second counting a
 *     little more.
 *
 * Every search is exact and bounded by a node budget per round, so grading can never stall: a board the
 * budget cannot settle counts as no closer. Server-only (imported by generate.server.ts and checks).
 */
import { judgeTileGrid } from "./tileGrid.server";
import { decodeTileGrid, fitsTray as tileGridFitsTray, tileGridRuns } from "./tileGrid";
import { decodeSlideTokens, replayWordSlide, WS_MARKED_ROWS } from "./wordSlide";
import { checkWordSlideRow } from "./wordSlide.server";
import { markedRowWord } from "./wordSlide";
import { wordSlideMadeRows } from "./progressFigures";
import { trCorrectPrefix, trCorrectTiles, trDecode } from "./trail";
import { balanceScaleCount, balanceScalesSolved, decodeBalance } from "./balance";
import { balancePlaceLimits, equationTryLimit, measureMoveLimits, splitCountSuffix } from "./moveLimits";
import { equationStageCorrect, parseOperators, splitStages } from "./stagedRounds";
import { decodeMeasureActions, measureActions, measureApply, measureSolved, splitMeasureRound } from "./measure";
import { decodeStrikeout2, replayStrikeout2, so2Rules, so2Tally, STRIKEOUT_REV2, strikeoutRevOf } from "./strikeout";
import { isCommonPrefix, isWord } from "./dictionary.server";
import { decodeSteps, madeDistance, replayTargetSteps } from "./target";
import { decodeRingTaps, freshOffsets, RING_RESET, RING_TAPS, RING_UNDO, ringsApply, ringsSolved } from "./rings";
import { applyMove, decodeMoves, isSolved as unblockSolved } from "./unblock";
import { decodePushMoves, movePusher, pushStep } from "./push";
import { decodeTileMoves, TILES_RESET, TILES_UNDO, tilesLayout, tilesSlide, tilesSolved, type TilesLayout } from "./tiles";
import { decodePresses } from "./logic";
import { decodeTowerMoves, towerCanMove, towerPegsFrom, type TowerPegs } from "./tower";
import { decodeActionLog } from "./actionLog";
import { replayLaserActions } from "./laserLog";
import { verifyLaser } from "./laser";
import { decodePairFlips, replayPairs } from "./pairmatch";
import { decodeSafePending, decodeSafeTries, dialsCorrect } from "./safe";
import { LIGHTS_CELLS, PUSH_COLS, RINGS_COUNT, UNBLOCK_COLS, UNBLOCK_EXIT_ROW, RINGS_SEGMENTS, type PuzzleData, type SlideDir, type UnblockVehicle } from "./types";

/** What the progress measures read from the rev-1 grade. */
export interface ProgressInput {
  puzzle: PuzzleData;
  answer: string;
  /** The rev-1 grade's detail (extra). */
  extra: Record<string, unknown> | null | undefined;
  /** The latest time a tap or action log may carry (grade.ts latestTapMs). */
  latestMs: number;
}

/** Slider (Joe, 20 Oct 2026): points for rows made, 0–4 of 5 (one short = 110). */
export const SLIDER_ROW_POINTS = [0, 30, 70, 90, 110] as const;

/** Each move that brought the board no closer cancels this many that did (solver-distance games). */
export const MOVE_WASTE_WEIGHT = {
  rings: 1,
  unblock: 1,
  push: 1,
  tiles: 1,
  lightsout: 1,
  tower: 1,
  measure: 1,
} as const;

/** Search nodes one round's grading may use (all boards together). */
export const PROGRESS_NODE_BUDGET = 40_000;

/** 0–1 progress for an unfinished rev-3 round, or null for the rev-1 credit. */
export function rev3Progress(input: ProgressInput): number | null {
  const { puzzle, answer } = input;
  switch (puzzle.type) {
    case "wordslide": {
      const replay = replayWordSlide(puzzle.grid, decodeSlideTokens(answer));
      const validRows = WS_MARKED_ROWS.filter((r) => checkWordSlideRow(markedRowWord(replay.grid, r)).valid);
      const made = wordSlideMadeRows(puzzle.grid, replay.grid, validRows);
      const top = SLIDER_ROW_POINTS.length - 1;
      return (SLIDER_ROW_POINTS[Math.max(0, Math.min(top, made))] ?? 0) / SLIDER_ROW_POINTS[top]!;
    }
    case "trail": {
      const path = trDecode(answer, puzzle.givens.length);
      const toPlace = puzzle.givens.filter((g) => g === null).length;
      if (!(toPlace > 0)) return 0;
      // The tiles of the path that match the solution from the start (a wrong turn later keeps them), or the right
      // tiles less the wrong ones, whichever is more: a random walk keeps neither.
      const solution = puzzle.solution ?? [];
      const prefix = trCorrectPrefix(path, solution);
      const inPrefix = path.slice(0, prefix).filter((cell) => cell >= 0 && puzzle.givens[cell] === null).length;
      const right = trCorrectTiles(puzzle.givens, path, solution);
      const placed = path.filter((cell, i) => cell >= 0 && puzzle.givens[cell] === null && i < puzzle.givens.length).length;
      return Math.max(inPrefix, right - (placed - right)) / toPlace;
    }
    case "tilegrid": {
      const cells = decodeTileGrid(answer);
      if (!puzzle.tray.length || judgeTileGrid(cells, puzzle.tray).placed === 0) return 0;
      if (!tileGridFitsTray(cells, puzzle.tray)) return 0;
      // Tiles inside a real word. A run still being extended into a longer word (TANGE on the way to
      // TANGENT: the whole run starts an everyday word) keeps the word it already spells from its start (TANG).
      const counted = new Set<number>();
      for (const run of tileGridRuns(cells)) {
        const n = run.word.length;
        let len = 0;
        if (n >= 3 && isWord(run.word)) len = n;
        else if (n >= 3 && isCommonPrefix(run.word.toLowerCase())) {
          for (let k = n - 1; k >= 3 && !len; k--) if (isWord(run.word.slice(0, k))) len = k;
        }
        for (const c of run.cells.slice(0, len)) counted.add(c);
      }
      return counted.size / puzzle.tray.length;
    }
    case "balance":
      return balanceProgress(puzzle, answer);
    case "equation":
      return equationProgress(puzzle, answer);
    case "measure":
      return measureProgress(puzzle, answer);
    case "strikeout":
      return strikeoutProgress(puzzle, answer);
    case "target": {
      // The closest any number made so far came (a step that uses it up never takes the progress back).
      const steps = decodeSteps(answer);
      let best = Infinity;
      for (let k = 1; k <= steps.length; k++) {
        const replay = replayTargetSteps(puzzle.tiles, puzzle.target, steps.slice(0, k));
        if (replay.steps.length < k) break;
        best = Math.min(best, madeDistance(puzzle.tiles, puzzle.target, replay));
      }
      return targetProgress(best, puzzle.target);
    }
    case "rings":
      return ringsProgress(puzzle.segments, puzzle.pattern, decodeRingTaps(answer), puzzle.minMoves ?? 0);
    case "unblock":
      return unblockProgress(puzzle.vehicles, decodeMoves(answer), puzzle.minMoves ?? 0);
    case "push":
      return pushProgress(puzzle, decodePushMoves(answer));
    case "tiles": {
      const layout = tilesLayout(puzzle);
      return tilesProgress(puzzle.frame, decodeTileMoves(answer, layout.count), layout, puzzle.minMoves ?? 0);
    }
    case "lightsout":
      return lightsProgress(decodePresses(answer), puzzle.solution ?? [], puzzle.minPresses ?? 0);
    case "tower":
      return towerProgress(puzzle.start ?? [], puzzle.targetPeg, puzzle.discs, decodeTowerMoves(answer), puzzle.minMoves);
    case "laser":
      return laserProgress(puzzle, answer, input.latestMs);
    case "pairmatch": {
      const replay = replayPairs(puzzle.cards, decodePairFlips(answer));
      const total = Math.max(1, puzzle.cards.length / 2);
      const misses = Math.max(0, replay.tries - replay.pairs);
      // A little more for the first pairs (found with nothing known), and wild flipping costs.
      const share = Math.max(0, replay.pairs - Math.max(0, misses - PAIR_FREE_MISSES) / PAIR_MISSES_PER_PAIR) / total;
      return Math.pow(Math.min(1, share), PAIR_CURVE);
    }
    case "safe": {
      const combination = puzzle.combination ?? [];
      if (!combination.length) return 0;
      const tries = decodeSafeTries(answer);
      const pending = tries.length >= SAFE_TRIES ? [] : [decodeSafePending(answer) ?? []];
      const right = Math.max(0, ...[...tries, ...pending].map((t) => dialsCorrect(t, combination)));
      const share = Math.max(0, right - SAFE_FREE_DIALS) / Math.max(1, combination.length - SAFE_FREE_DIALS);
      return Math.pow(share, SAFE_CURVE);
    }
    default:
      return null;
  }
}

/**
 * A finish's efficiency where the rev-1 breakdown measures it too harshly for the helper, or null for that
 * breakdown's own (puzzleScoreRev3.ts rev3Efficiency). Strikeout: letters are guesses, so even a perfect player
 * strikes now and then; the first STRIKEOUT_FREE_STRIKES strikes cost nothing, then each costs evenly to none
 * left.
 */
export function rev3EfficiencyOverride(puzzle: PuzzleData, extra: Record<string, unknown> | null | undefined): number | null {
  if (puzzle.type === "strikeout" && strikeoutRevOf(puzzle) >= STRIKEOUT_REV2) {
    const max = so2Rules(strikeoutRevOf(puzzle)).maxStrikes;
    const strikes = typeof extra?.["strikes"] === "number" ? (extra["strikes"] as number) : 0;
    const span = Math.max(1, max - STRIKEOUT_FREE_STRIKES);
    return Math.max(0, Math.min(1, (max - strikes) / span));
  }
  return null;
}
export const STRIKEOUT_FREE_STRIKES = 3;

/* --------------------------------------------------------------- Matchmaker, Safe Cracker */

/** Mismatched tries a player may make before they start to cost. */
export const PAIR_FREE_MISSES = 14;
/** Beyond the free ones, this many mismatched tries cost one pair. */
export const PAIR_MISSES_PER_PAIR = 3;
/** Progress = share ^ PAIR_CURVE (below 1: the first pairs count a little more). */
export const PAIR_CURVE = 0.75;
const SAFE_TRIES = 3;
/** Progress = share ^ SAFE_CURVE (below 1: the second dial right counts a little more than an even share). */
export const SAFE_CURVE = 0.85;
/** Progress = share ^ LASER_CURVE (above 1: the last gems, the hard ones, count a little more). */
export const LASER_CURVE = 1.15;
/** One dial in the right place is what a guess gives: it earns nothing. */
const SAFE_FREE_DIALS = 1;

/* --------------------------------------------------------------------------------- Exact */

/** Exact: off by 1 = 1 (one short), the target itself away (or no number made) = 0, logarithmic between. */
export function targetProgress(distance: number, target: number): number {
  if (!Number.isFinite(distance)) return 0;
  const d = Math.max(0, Math.round(distance));
  if (d <= 1) return 1;
  const far = Math.max(10, Math.abs(target));
  return Math.max(0, 1 - Math.log(d) / Math.log(far));
}

/* --------------------------------------------------------------------- staged number games */

function balanceProgress(puzzle: Extract<PuzzleData, { type: "balance" }>, answer: string): number {
  const total = balanceScaleCount(puzzle);
  if (!total) return 0;
  const placeLimits = balancePlaceLimits(puzzle);
  const { body, counts: hangs } = placeLimits ? splitCountSuffix(answer) : { body: answer, counts: [] };
  const placements = decodeBalance(body, puzzle.scales);
  const withinLimit = (s: number) => !placeLimits || (hangs[s] ?? 0) <= (placeLimits[s] ?? 0);
  const solved = balanceScalesSolved(puzzle.scales, placements).map((ok, s) => ok && withinLimit(s));
  // The stage deals the scales in order: the balanced ones before the first open one count.
  let k = solved.indexOf(false);
  if (k < 0) k = total;
  let within = 0;
  const scale = puzzle.scales[k];
  const want = puzzle.solutions?.[k];
  if (scale && want && withinLimit(k)) {
    const placed = placements[k] ?? [];
    const right = scale.tray.filter((_, i) => placed[i] !== null && placed[i] === want[i]).length;
    within = right / Math.max(1, scale.tray.length);
  }
  return Math.min(1, (k + Math.min(within, 0.99)) / total);
}

function equationProgress(puzzle: Extract<PuzzleData, { type: "equation" }>, answer: string): number {
  const total = puzzle.stages.length;
  if (!total) return 0;
  const tryLimit = equationTryLimit(puzzle);
  const { body, counts: tries } = tryLimit !== null ? splitCountSuffix(answer) : { body: answer, counts: [] };
  const segments = splitStages(body, total);
  const inLimit = (i: number) => tryLimit === null || (tries[i] ?? 0) <= tryLimit;
  const correct = puzzle.stages.map((stage, i) => inLimit(i) && equationStageCorrect(stage.numbers, stage.target, segments[i] ?? ""));
  const solved = correct.filter(Boolean).length;
  // The current equation is the last one with operators in it: its operators right from the left count.
  let within = 0;
  let current = -1;
  for (let i = total - 1; i >= 0; i--) if ((segments[i] ?? "") !== "") { current = i; break; }
  const want = puzzle.operators?.[current];
  if (current >= 0 && !correct[current] && want && inLimit(current)) {
    const ops = parseOperators(segments[current] ?? "");
    let prefix = 0;
    while (prefix < ops.length && prefix < want.length && ops[prefix] === want[prefix]) prefix++;
    within = prefix / Math.max(1, want.length);
  }
  return Math.min(1, (solved + Math.min(within, 0.99)) / total);
}

function measureProgress(puzzle: Extract<PuzzleData, { type: "measure" }>, answer: string): number {
  const boards = puzzle.boards;
  if (!boards.length) return 0;
  const limits = measureMoveLimits(puzzle);
  const parts = splitMeasureRound(answer);
  let solved = 0;
  let within = 0;
  for (let i = 0; i < boards.length; i++) {
    const board = boards[i]!;
    const limit = limits?.[i] ?? null;
    // Replay as replayMeasure does, keeping every jug state stood on.
    let amounts = [...board.start];
    const seen: number[][] = [amounts];
    let moves = 0;
    let done = measureSolved(board, amounts);
    for (const action of decodeMeasureActions(parts[i] ?? "", board.caps.length)) {
      if (done || (limit !== null && moves >= limit)) break;
      const next = measureApply(board, amounts, action);
      if (!next) continue;
      if (action.kind !== "reset") moves += 1;
      amounts = next;
      seen.push(amounts);
      done = measureSolved(board, amounts);
    }
    if (done) {
      solved++;
      continue;
    }
    // The first open puzzle: how much closer its jugs came (it ends the run here, as in the grader).
    const min = puzzle.minMoves?.[i] ?? 0;
    const dist = measureDistances(board);
    const key = (a: readonly number[]) => a.join(",");
    let best = 0;
    for (const s of seen) {
      const d = dist.get(key(s));
      if (d !== undefined) best = Math.max(best, min - d);
    }
    within = solverShare(min, best, moves, MOVE_WASTE_WEIGHT.measure);
    break;
  }
  return Math.min(1, (solved + Math.min(within, 0.99)) / boards.length);
}

/** Every jug state's fewest moves to solved (backward over the small state space). */
function measureDistances(board: Extract<PuzzleData, { type: "measure" }>["boards"][number]): Map<string, number> {
  const key = (a: readonly number[]) => a.join(",");
  // Forward graph from the start (resets lead back to it, so every state stood on is in it).
  const states: number[][] = [[...board.start]];
  const index = new Map<string, number>([[key(board.start), 0]]);
  const edges: number[][] = [];
  const actions = measureActions(board);
  for (let i = 0; i < states.length && states.length < 20_000; i++) {
    const out: number[] = [];
    for (const a of actions) {
      const next = measureApply(board, states[i]!, a);
      if (!next) continue;
      const k = key(next);
      let j = index.get(k);
      if (j === undefined) {
        j = states.length;
        index.set(k, j);
        states.push(next);
      }
      out.push(j);
    }
    edges.push(out);
  }
  // Reverse breadth-first search from every solved state.
  const reverse: number[][] = states.map(() => []);
  edges.forEach((out, i) => out.forEach((j) => reverse[j]!.push(i)));
  const dist = new Array<number>(states.length).fill(-1);
  let frontier: number[] = [];
  states.forEach((s, i) => {
    if (measureSolved(board, s)) {
      dist[i] = 0;
      frontier.push(i);
    }
  });
  for (let d = 1; frontier.length; d++) {
    const next: number[] = [];
    for (const j of frontier) for (const i of reverse[j]!) if (dist[i] === -1) { dist[i] = d; next.push(i); }
    frontier = next;
  }
  const out = new Map<string, number>();
  states.forEach((s, i) => { if (dist[i]! >= 0) out.set(key(s), dist[i]!); });
  return out;
}

function strikeoutProgress(puzzle: Extract<PuzzleData, { type: "strikeout" }>, answer: string): number | null {
  if (strikeoutRevOf(puzzle) < STRIKEOUT_REV2) return null;
  const words = puzzle.words ?? [];
  if (!words.length) return 0;
  const state = replayStrikeout2(words, puzzle.givens ?? [], decodeStrikeout2(answer), isWord, so2Rules(strikeoutRevOf(puzzle)));
  const tally = so2Tally(state);
  const w = tally.solvedWords;
  let within = 0;
  if (w < words.length) {
    const hidden = state.given[w] ? state.given[w]!.filter((g) => !g).length : (words[w] ?? "").length;
    within = hidden > 0 ? tally.foundTiles / hidden : 0;
  }
  return Math.min(1, (w + Math.min(within, 0.99)) / words.length);
}

/* ---------------------------------------------------------------------- solver distance */

/** The share of the stored minimum closed, net of waste (as solverProgress.server.ts). */
export function solverShare(minMoves: number, closer: number, moves: number, wasteWeight: number): number {
  if (!(minMoves > 0)) return 0;
  const gained = Math.max(0, Math.min(minMoves, closer));
  const waste = Math.max(0, moves - gained);
  return Math.max(0, gained - wasteWeight * waste) / minMoves;
}

type Distance = number | "dead" | "unknown";
interface Budget {
  left: number;
}

/**
 * A* from `start` to a goal with an admissible heuristic `h` (0 for breadth-first), at most `maxDepth` deep,
 * within the round's budget.
 */
function astar<S>(
  start: S,
  key: (s: S) => string | number,
  isGoal: (s: S) => boolean,
  next: (s: S) => S[],
  h: (s: S) => number,
  budget: Budget,
  maxDepth: number,
): Distance {
  if (isGoal(start)) return 0;
  const heap: { f: number; g: number; s: S }[] = [];
  const less = (a: { f: number; g: number }, b: { f: number; g: number }) => a.f < b.f || (a.f === b.f && a.g > b.g);
  const push = (n: (typeof heap)[number]) => {
    heap.push(n);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!less(heap[i]!, heap[p]!)) break;
      [heap[i], heap[p]] = [heap[p]!, heap[i]!];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && less(heap[l]!, heap[m]!)) m = l;
        if (r < heap.length && less(heap[r]!, heap[m]!)) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m]!, heap[i]!];
        i = m;
      }
    }
    return top;
  };
  const best = new Map<string | number, number>([[key(start), 0]]);
  push({ f: h(start), g: 0, s: start });
  while (heap.length) {
    const node = pop();
    if (isGoal(node.s)) return node.g;
    if (node.f > maxDepth) return "unknown";
    if ((best.get(key(node.s)) ?? Infinity) < node.g) continue;
    if (budget.left-- <= 0) return "unknown";
    for (const s of next(node.s)) {
      const k = key(s);
      const g = node.g + 1;
      if ((best.get(k) ?? Infinity) <= g) continue;
      best.set(k, g);
      push({ f: g + h(s), g, s });
    }
  }
  return "dead";
}

/**
 * The best `closer` (stored minimum less the fewest moves left) over every board the player stood on, newest
 * first. The board at position i was reached in at most i moves, so it is at most i closer: the walk stops
 * once no earlier board could beat the best found.
 */
function bestCloser<S>(minMoves: number, boards: S[], key: (s: S) => string | number, distance: (s: S, budget: Budget, maxDepth: number) => Distance): number {
  if (!(minMoves > 0) || boards.length < 2) return 0;
  const budget: Budget = { left: PROGRESS_NODE_BUDGET };
  const start = key(boards[0]!);
  const tried = new Set<string | number>([start]);
  let best = 0;
  for (let i = boards.length - 1; i > best && budget.left > 0; i--) {
    const k = key(boards[i]!);
    if (tried.has(k)) continue;
    tried.add(k);
    // Only a board fewer than (minimum − best) moves from solved can beat the best.
    const d = distance(boards[i]!, budget, minMoves - best - 1);
    if (typeof d === "number") best = Math.max(best, minMoves - d);
  }
  return best;
}

/** Turntable: turns commute, so each board's distance is a table lookup (one search per round over 8⁵ offsets). */
function ringsProgress(segments: number[][], pattern: number, taps: number[], minMoves: number): number {
  const boards: number[][] = [freshOffsets()];
  const history: number[][] = [boards[0]!];
  let moves = 0;
  for (const tap of taps) {
    if (tap === RING_UNDO) {
      if (history.length > 1) history.pop();
      boards.push(history[history.length - 1]!);
      continue;
    }
    if (tap === RING_RESET) {
      history.length = 1;
      boards.push(history[0]!);
      continue;
    }
    if (ringsSolved(segments, history[history.length - 1]!)) break;
    const next = ringsApply(history[history.length - 1]!, tap, pattern);
    history.push(next);
    boards.push(next);
    moves++;
  }
  const S = RINGS_SEGMENTS;
  const size = S ** RINGS_COUNT;
  const enc = (o: readonly number[]) => o.reduce((acc, v) => acc * S + (((v % S) + S) % S), 0);
  const dec = (code: number) => {
    const o = new Array<number>(RINGS_COUNT);
    for (let r = RINGS_COUNT - 1; r >= 0; r--) { o[r] = code % S; code = Math.floor(code / S); }
    return o;
  };
  const len = ringsWordLengths(pattern);
  // Solved offsets (every spoke aligned).
  const goals: number[][] = [];
  for (let c = 0; c < size; c++) if (len[c]! >= 0) { const o = dec(c); if (ringsSolved(segments, o)) goals.push(o); }
  const distance = (o: number[]) => {
    let best = Infinity;
    for (const g of goals) {
      const l = len[enc(g.map((v, r) => v - (o[r] ?? 0)))]!;
      if (l >= 0) best = Math.min(best, l);
    }
    return best;
  };
  let closer = 0;
  for (const b of boards) { const d = distance(b); if (Number.isFinite(d)) closer = Math.max(closer, minMoves - d); }
  return solverShare(minMoves, closer, moves, MOVE_WASTE_WEIGHT.rings);
}

/** Fewest turns for every displacement of the five rings under a link pattern (cached per pattern). */
const RING_TABLES = new Map<number, Int16Array>();
function ringsWordLengths(pattern: number): Int16Array {
  const found = RING_TABLES.get(pattern);
  if (found) return found;
  const S = RINGS_SEGMENTS;
  const size = S ** RINGS_COUNT;
  const enc = (o: readonly number[]) => o.reduce((acc, v) => acc * S + v, 0);
  const len = new Int16Array(size).fill(-1);
  len[0] = 0;
  const queue = new Int32Array(size);
  let head = 0, tail = 0;
  queue[tail++] = 0;
  while (head < tail) {
    let c = queue[head++]!;
    const code = c;
    const o = new Array<number>(RINGS_COUNT);
    for (let r = RINGS_COUNT - 1; r >= 0; r--) { o[r] = c % S; c = Math.floor(c / S); }
    for (const tap of RING_TAPS) {
      const n = enc(ringsApply(o, tap, pattern));
      if (len[n] === -1) { len[n] = len[code]! + 1; queue[tail++] = n; }
    }
  }
  RING_TABLES.set(pattern, len);
  return len;
}

/** A layout's key: each block's position (column for a sideways block, row for an upright one), base 8. */
const unblockKey = (vs: UnblockVehicle[]) => vs.reduce((k, v) => k * 8 + (v.axis === "h" ? v.col : v.row), 0);
const UNBLOCK_TABLES = new Map<string, Map<number, number>>();
/** States a layout's table may hold (a Gridlock board reaches a few thousand). */
const UNBLOCK_STATE_CAP = 200_000;

/**
 * Every layout reachable from the start, with its fewest moves to solved (breadth-first from the start, then
 * backwards from every solved layout), cached per starting layout: a move slides one block any distance.
 */
function unblockDistances(start: UnblockVehicle[]): Map<number, number> {
  const id = start.map((v) => `${v.id}${v.axis}${v.len}${v.row}${v.col}`).join(",");
  const found = UNBLOCK_TABLES.get(id);
  if (found) return found;
  const N = UNBLOCK_COLS;
  const V = start.length;
  const horiz = start.map((v) => v.axis === "h");
  const lens = start.map((v) => v.len);
  const line = start.map((v) => (v.axis === "h" ? v.row : v.col));
  const gold = start.findIndex((v) => v.id === 0);
  const cell = (i: number, p: number, k: number) => (horiz[i] ? line[i]! * N + p + k : (p + k) * N + line[i]!);
  const solved = (pos: Uint8Array) => gold >= 0 && horiz[gold]! && line[gold] === UNBLOCK_EXIT_ROW && pos[gold]! + lens[gold]! === N;
  const keyOf = (pos: Uint8Array) => { let k = 0; for (let i = 0; i < V; i++) k = k * 8 + pos[i]!; return k; };
  const first = Uint8Array.from(start, (v) => (v.axis === "h" ? v.col : v.row));
  const states: Uint8Array[] = [first];
  const index = new Map<number, number>([[keyOf(first), 0]]);
  const reverse: number[][] = [[]];
  const occ = new Uint8Array(N * N);
  for (let s = 0; s < states.length && states.length < UNBLOCK_STATE_CAP; s++) {
    const pos = states[s]!;
    occ.fill(0);
    for (let i = 0; i < V; i++) for (let k = 0; k < lens[i]!; k++) occ[cell(i, pos[i]!, k)] = 1;
    for (let i = 0; i < V; i++) {
      const p = pos[i]!;
      let lo = p;
      while (lo - 1 >= 0 && !occ[cell(i, lo - 1, 0)]) lo--;
      let hi = p;
      while (hi + lens[i]! <= N - 1 && !occ[cell(i, hi + lens[i]!, 0)]) hi++;
      for (let to = lo; to <= hi; to++) {
        if (to === p) continue;
        const next = pos.slice();
        next[i] = to;
        const k = keyOf(next);
        let j = index.get(k);
        if (j === undefined) {
          j = states.length;
          index.set(k, j);
          states.push(next);
          reverse.push([]);
        }
        reverse[j]!.push(s);
      }
    }
  }
  const dist = new Int32Array(states.length).fill(-1);
  let frontier: number[] = [];
  states.forEach((pos, i) => { if (solved(pos)) { dist[i] = 0; frontier.push(i); } });
  for (let d = 1; frontier.length; d++) {
    const next: number[] = [];
    for (const j of frontier) for (const i of reverse[j]!) if (dist[i] === -1) { dist[i] = d; next.push(i); }
    frontier = next;
  }
  const out = new Map<number, number>();
  for (const [k, i] of index) if (dist[i]! >= 0) out.set(k, dist[i]!);
  if (UNBLOCK_TABLES.size > 64) UNBLOCK_TABLES.clear();
  UNBLOCK_TABLES.set(id, out);
  return out;
}

/** Gridlock: each layout's fewest moves from a table of the whole board (a move slides one block any distance). */
function unblockProgress(start: UnblockVehicle[], played: { id: number; to: number }[], minMoves: number): number {
  let state = start.map((v) => ({ ...v }));
  const history = [state];
  const boards = [state];
  let moves = 0;
  for (const move of played) {
    if (move.id === -1 && move.to === 0) { if (history.length > 1) history.pop(); state = history[history.length - 1]!; boards.push(state); continue; }
    if (move.id === -2 && move.to === 0) { history.length = 1; state = history[0]!; boards.push(state); continue; }
    const next = applyMove(state, move);
    if (!next) continue;
    state = next;
    history.push(state);
    boards.push(state);
    moves++;
    if (unblockSolved(state)) break;
  }
  const dist = unblockDistances(start);
  let closer = 0;
  for (const b of boards) {
    const d = dist.get(unblockKey(b));
    if (d !== undefined) closer = Math.max(closer, minMoves - d);
  }
  return solverShare(minMoves, closer, moves, MOVE_WASTE_WEIGHT.unblock);
}

const PUSH_TABLES = new Map<string, (crates: readonly number[]) => number>();

/**
 * Heave's distance: each crate's fewest pushes to each target on the empty warehouse (walls only), and the best
 * way to give every crate its own target. It never counts more pushes than a solve needs from that layout (other
 * crates and where the pusher can walk only add to it), costs microseconds, and is cached per warehouse; an
 * exact search of a warehouse's push states took seconds on some room boards.
 */
function pushDistanceFn(puzzle: Extract<PuzzleData, { type: "push" }>): (crates: readonly number[]) => number {
  const id = `${puzzle.walls.join(".")}|${puzzle.targets.join(".")}`;
  const found = PUSH_TABLES.get(id);
  if (found) return found;
  const N = PUSH_COLS;
  const CELLS = N * N;
  const wall = new Uint8Array(CELLS);
  for (const w of puzzle.walls) if (w >= 0 && w < CELLS) wall[w] = 1;
  const step = (c: number, d: number): number => {
    const r = (c / N) | 0, col = c % N;
    if (d === 0) return r > 0 ? c - N : -1;
    if (d === 1) return r < N - 1 ? c + N : -1;
    if (d === 2) return col > 0 ? c - 1 : -1;
    return col < N - 1 ? c + 1 : -1;
  };
  const back = [1, 0, 3, 2];
  // Backwards from each target: a crate at c reaches n = c + d when the pusher can stand at c − d.
  const toTarget = puzzle.targets.map((t) => {
    const dist = new Int16Array(CELLS).fill(-1);
    dist[t] = 0;
    const queue = [t];
    for (let q = 0; q < queue.length; q++) {
      const n = queue[q]!;
      for (let d = 0; d < 4; d++) {
        const c = step(n, back[d]!);
        if (c < 0 || wall[c]) continue;
        const stand = step(c, back[d]!);
        if (stand < 0 || wall[stand] || dist[c] !== -1) continue;
        dist[c] = dist[n]! + 1;
        queue.push(c);
      }
    }
    return dist;
  });
  const perms = (n: number): number[][] =>
    n === 0 ? [[]] : perms(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]));
  const orders = perms(puzzle.targets.length);
  const fn = (crates: readonly number[]) => {
    let best = Infinity;
    for (const order of orders) {
      let sum = 0;
      for (let i = 0; i < crates.length && sum < best; i++) {
        const d = toTarget[order[i]!]![crates[i]!]!;
        sum += d < 0 ? 1_000 : d;
      }
      best = Math.min(best, sum);
    }
    return best;
  };
  if (PUSH_TABLES.size > 64) PUSH_TABLES.clear();
  PUSH_TABLES.set(id, fn);
  return fn;
}

/** Heave: how much nearer the crates came to their targets (pushDistanceFn), net of wasted pushes. */
function pushProgress(puzzle: Extract<PuzzleData, { type: "push" }>, dirs: SlideDir[]): number {
  const walls = new Set(puzzle.walls);
  const targets = puzzle.targets;
  const min = puzzle.minPushes ?? 0;
  let state = { pusher: puzzle.pusher, crates: [...puzzle.crates] };
  const boards = [state];
  let pushes = 0;
  for (const dir of dirs) {
    const r = movePusher(state, dir, walls);
    if (!r.moved) continue;
    state = r.state;
    if (r.pushed) { pushes++; boards.push(state); }
    if (state.crates.every((c) => targets.includes(c))) break;
  }
  const dist = pushDistanceFn(puzzle);
  const h0 = dist(puzzle.crates);
  if (!(h0 > 0 && h0 < 1_000)) return 0;
  let closer = 0;
  for (const b of boards) closer = Math.max(closer, h0 - dist(b.crates));
  // In the stored minimum's units. The measure is a bound, so a push on the best line may not lower it: only
  // pushes beyond the stored minimum count as wasted.
  closer = (closer * min) / h0;
  if (!(min > 0)) return 0;
  return Math.max(0, closer - MOVE_WASTE_WEIGHT.push * Math.max(0, pushes - min)) / min;
}

/** Jumbled: A* with each tile's grid distance to its home cell. */
function tilesProgress(start: number[], moves: number[], layout: TilesLayout, minMoves: number): number {
  const history: number[][] = [[...start]];
  const boards: number[][] = [history[0]!];
  let count = 0;
  for (const move of moves) {
    const frame = history[history.length - 1]!;
    if (tilesSolved(frame, layout)) break;
    if (move === TILES_RESET) { history.length = 1; boards.push(history[0]!); continue; }
    if (move === TILES_UNDO) { if (history.length > 1) history.pop(); boards.push(history[history.length - 1]!); continue; }
    const next = tilesSlide(frame, move, layout);
    if (next) { history.push(next); boards.push(next); count++; }
  }
  const home = new Map<number, number>();
  layout.goal.forEach((v, i) => home.set(v, i));
  const h = (f: number[]) => {
    let sum = 0;
    f.forEach((v, i) => {
      if (v === 0) return;
      const a = layout.cells[i]!, b = layout.cells[home.get(v)!]!;
      sum += Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
    });
    return sum;
  };
  const key = (f: number[]) => f.join("");
  const next = (f: number[]) => {
    const out: number[][] = [];
    for (let t = 1; t <= layout.count; t++) { const n = tilesSlide(f, t, layout); if (n) out.push(n); }
    return out;
  };
  const closer = bestCloser(minMoves, boards, key, (b, budget, maxDepth) => astar(b, key, (f) => tilesSolved(f, layout), next, h, budget, maxDepth));
  return solverShare(minMoves, closer, count, MOVE_WASTE_WEIGHT.tiles);
}

/** Blackout: on 6×6 the presses that solve a board are unique, so the presses left are the stored solution's still undone. */
function lightsProgress(actions: number[], solution: number[], minPresses: number): number {
  const odd = new Uint8Array(LIGHTS_CELLS);
  const history: Uint8Array[] = [odd.slice()];
  let current = odd;
  const want = new Uint8Array(LIGHTS_CELLS);
  for (const c of solution) if (c >= 0 && c < LIGHTS_CELLS) want[c] = 1;
  const left = (o: Uint8Array) => { let n = 0; for (let i = 0; i < LIGHTS_CELLS; i++) if (o[i] !== want[i]) n++; return n; };
  let presses = 0;
  let closer = 0;
  for (const cell of actions) {
    if (cell === -1) { if (history.length > 1) history.pop(); current = history[history.length - 1]!.slice(); }
    else if (cell === -2) { history.length = 1; current = history[0]!.slice(); }
    else if (cell >= 0 && cell < LIGHTS_CELLS) { current = current.slice(); current[cell] = current[cell]! ^ 1; history.push(current); presses++; }
    else continue;
    closer = Math.max(closer, minPresses - left(current));
  }
  return solverShare(minPresses, closer, presses, MOVE_WASTE_WEIGHT.lightsout);
}

/** Hanoi: every spread's fewest moves to the target peg, by one backward search per peg count and target (cached). */
const TOWER_TABLES = new Map<string, Uint8Array>();
function towerTable(pegs: number, target: number, discs: number): Uint8Array {
  const id = `${pegs}:${target}:${discs}`;
  const found = TOWER_TABLES.get(id);
  if (found) return found;
  const size = pegs ** discs;
  const dist = new Uint8Array(size).fill(255);
  // Code: disc d (1 = smallest) on peg digit d−1.
  let goal = 0;
  for (let d = discs; d >= 1; d--) goal = goal * pegs + target;
  dist[goal] = 0;
  let frontier = [goal];
  const pow = Array.from({ length: discs }, (_, i) => pegs ** i);
  for (let depth = 1; frontier.length && depth < 255; depth++) {
    const nextFrontier: number[] = [];
    for (const code of frontier) {
      // The top disc of each peg is its smallest disc.
      const top = new Array<number>(pegs).fill(0);
      for (let d = discs; d >= 1; d--) top[Math.floor(code / pow[d - 1]!) % pegs] = d;
      for (let from = 0; from < pegs; from++) {
        const disc = top[from]!;
        if (!disc) continue;
        for (let to = 0; to < pegs; to++) {
          if (to === from || (top[to]! && top[to]! < disc)) continue;
          const n = code + (to - from) * pow[disc - 1]!;
          if (dist[n] === 255) { dist[n] = depth; nextFrontier.push(n); }
        }
      }
    }
    frontier = nextFrontier;
  }
  TOWER_TABLES.set(id, dist);
  return dist;
}

function towerProgress(start: number[][], targetPeg: number, discs: number, moves: { from: number; to: number }[], minMoves: number): number {
  let pegs: TowerPegs = towerPegsFrom(start);
  const n = pegs.length;
  const table = towerTable(n, targetPeg, discs);
  const code = (p: TowerPegs) => {
    let c = 0;
    const at = new Array<number>(discs + 1).fill(0);
    p.forEach((peg, i) => peg.forEach((d) => { at[d] = i; }));
    for (let d = discs; d >= 1; d--) c = c * n + at[d]!;
    return c;
  };
  let closer = Math.max(0, minMoves - table[code(pegs)]!);
  let count = 0;
  for (const m of moves) {
    if (!towerCanMove(pegs, m.from, m.to)) break;
    pegs = pegs.map((peg) => [...peg]);
    pegs[m.to]!.push(pegs[m.from]!.pop()!);
    count++;
    const d = table[code(pegs)]!;
    if (d !== 255) closer = Math.max(closer, minMoves - d);
    if ((pegs[targetPeg] ?? []).length === discs) break;
  }
  return solverShare(minMoves, closer, count, MOVE_WASTE_WEIGHT.tower);
}

/** Lightbender: the most gems any layout the player stood on lights without a bomb. */
function laserProgress(puzzle: Extract<PuzzleData, { type: "laser" }>, answer: string, latestMs: number): number {
  const { actions, diag } = decodeActionLog(answer, latestMs);
  const total = Math.max(1, puzzle.gems.length);
  let best = 0;
  for (let i = 1; i <= actions.length; i++) {
    const replay = replayLaserActions(puzzle, actions.slice(0, i), { ...diag });
    const verdict = verifyLaser(puzzle, replay.layout);
    if (!verdict.trace.hitBomb) best = Math.max(best, verdict.gemsLit);
  }
  return Math.pow(Math.min(1, best / total), LASER_CURVE);
}
