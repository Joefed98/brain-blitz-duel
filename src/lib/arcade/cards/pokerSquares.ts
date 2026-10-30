/**
 * Poker Squares (Cards & Board, 30 Oct 2026; docs/arcade-standard/pokersquares.md): a 60-second run on the arcade
 * engine. 25 cards come one at a time; a tap on an empty square of the 5 × 5 grid places the card, and a placed card
 * stays. Every row and column scores as a poker hand (pair 3, two pair 6, three of a kind 8, straight 10, flush 11,
 * full house 13, four of a kind 15, straight flush 16); squares still empty at the buzzer score whatever their lines
 * hold.
 *
 * The deal: the sim builds a strong target grid from the seed (a seeded hill climb over 25 cards in which every row
 * and column holds a pair or better and the total reaches PS_CORE_FULL), then shuffles its 25 cards into the dealing
 * order. Placing every card where the target grid has it fills the core and makes ten hands: 200 on every seed.
 *
 * Scoring (pokerSquaresRev 1, the arcade standard; 200 in all): the core 160 on a straight line, total hand points ÷
 * PS_CORE_FULL × 160, full at the near-perfect skill-band median (the standard's rule for an open-ended core: the
 * target grid is built knowing all 25 cards, which no player sees, so it is the proof of 200, not the bar); made hands
 * 40 (4 for each line with a pair or better).
 */
import { inputRange, rngBelow, type ArcadeGame, type ArcadeInputEvent } from "../engine";
import { stdEach, stdLine, stdPart, stdScore, stdSum, type StdPart, type StdSpec } from "../arcadeStandard";
import { bandCurve, type BandParts } from "../scoreBands";
import { DECK, hashInts, NO_CARD, rankOf, shuffledDeck, suitOf } from "./cards";

export const PS_REV = 1;
export const PS_SIZE = 5;
export const PS_SQUARES = 25;
export const PS_LINES = 10;
export const PS_INPUT_PLACE = 1;
export const PS_RUN_TICKS = 60 * 60;

export const PS_CORE_MAX = 160;
export const PS_HAND_EACH = 4;
export const PS_HANDS_MAX = 40;
/**
 * The core is full at this many hand points: the near-perfect skill-band median (`bun scripts/cards-bands.ts
 * pokersquares`, docs/arcade-standard/pokersquares.md). Every dealt target grid reaches it (psTargetGrid).
 */
export const PS_CORE_FULL = 68;
/** The core's straight line (LIVE_BANDS and arcade-help-bands-check read it). */
export const PS_V1_BAND_CURVE = bandCurve([0, PS_CORE_FULL], [0, PS_CORE_MAX]);

export const PS_STD_SPEC: StdSpec = {
  field: "pokerSquaresRev",
  rev: PS_REV,
  parts: [
    { key: "core", label: "Hand points", max: PS_CORE_MAX, of: PS_CORE_FULL, item: "hand point", how: `a straight line, full at ${PS_CORE_FULL} hand points` },
    { key: "hands", label: "Made hands", max: PS_HANDS_MAX, of: PS_LINES, item: "line", how: "4 for each row or column with a pair or better" },
  ],
};

/** Hand names and points, best first. */
export const PS_HANDS = [
  ["Straight flush", 16],
  ["Four of a kind", 15],
  ["Full house", 13],
  ["Flush", 11],
  ["Straight", 10],
  ["Three of a kind", 8],
  ["Two pair", 6],
  ["Pair", 3],
] as const;

/** A line's hand: its points and name ("" and 0 for nothing). Empty squares (NO_CARD) are skipped. */
export function psHand(cards: readonly number[]): { points: number; name: string } {
  const counts = new Array<number>(14).fill(0);
  const suits = [0, 0, 0, 0];
  let n = 0;
  for (const c of cards) {
    if (c < 0) continue;
    n++;
    counts[rankOf(c)]!++;
    suits[suitOf(c)]!++;
  }
  let pairs = 0;
  let trips = 0;
  let quads = 0;
  for (let r = 1; r <= 13; r++) {
    const k = counts[r]!;
    if (k === 2) pairs++;
    else if (k === 3) trips++;
    else if (k === 4) quads++;
  }
  let straight = false;
  let flush = false;
  if (n === 5) {
    flush = suits.some((s) => s === 5);
    if (pairs === 0 && trips === 0 && quads === 0) {
      let lo = 14;
      let hi = 0;
      for (let r = 1; r <= 13; r++) if (counts[r]) { lo = Math.min(lo, r); hi = Math.max(hi, r); }
      straight = hi - lo === 4 || (counts[1] === 1 && counts[10] === 1 && counts[11] === 1 && counts[12] === 1 && counts[13] === 1);
    }
  }
  const pick = (i: number) => ({ points: PS_HANDS[i]![1], name: PS_HANDS[i]![0] });
  if (straight && flush) return pick(0);
  if (quads) return pick(1);
  if (trips && pairs) return pick(2);
  if (flush) return pick(3);
  if (straight) return pick(4);
  if (trips) return pick(5);
  if (pairs >= 2) return pick(6);
  if (pairs === 1) return pick(7);
  return { points: 0, name: "" };
}

/** Line `l`'s squares: rows 0–4, then columns 5–9. */
export function psLine(l: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < PS_SIZE; k++) out.push(l < PS_SIZE ? l * PS_SIZE + k : k * PS_SIZE + (l - PS_SIZE));
  return out;
}
const LINES = Array.from({ length: PS_LINES }, (_, l) => psLine(l));

export function psLineHand(grid: readonly number[], l: number): { points: number; name: string } {
  return psHand(LINES[l]!.map((i) => grid[i]!));
}

/** The grid's total and its lines with a pair or better. */
export function psTotals(grid: readonly number[]): { total: number; made: number } {
  let total = 0;
  let made = 0;
  for (let l = 0; l < PS_LINES; l++) {
    const p = psLineHand(grid, l).points;
    total += p;
    if (p > 0) made++;
  }
  return { total, made };
}

const HILL_STEPS = 20000;
/** A line with nothing costs this much in the climb, so every line ends with a pair or better. */
const BARE_LINE_COST = 24;

function lineValue(grid: readonly number[], l: number): number {
  const p = psLineHand(grid, l).points;
  return p > 0 ? p : -BARE_LINE_COST;
}

/**
 * The deal's target grid from a seed: 25 cards from a seeded deck, improved by a seeded hill climb (swap two squares,
 * or a square with an unused card; kept when no worse, judged on the lines it touches) until every line holds a pair
 * or better. Integer maths and the engine's PRNG only. Also returns the PRNG's state for the dealing order.
 */
export function psTargetGrid(seed: number): { grid: number[]; target: number; rng: number } {
  for (let attempt = 0; ; attempt++) {
    const shuffled = shuffledDeck((seed ^ Math.imul(attempt, 0x9e3779b1)) | 0);
    let rng = shuffled.rng;
    const grid = shuffled.deck.slice(0, PS_SQUARES);
    const pool = shuffled.deck.slice(PS_SQUARES, DECK);
    const values = Array.from({ length: PS_LINES }, (_, l) => lineValue(grid, l));
    const touched: number[] = [];
    const before: number[] = [];
    const tryChange = (sqA: number, sqB: number, undo: () => void) => {
      touched.length = 0;
      for (const sq of sqB < 0 ? [sqA] : [sqA, sqB]) {
        const row = Math.floor(sq / PS_SIZE);
        const col = PS_SIZE + (sq % PS_SIZE);
        if (!touched.includes(row)) touched.push(row);
        if (!touched.includes(col)) touched.push(col);
      }
      let delta = 0;
      before.length = 0;
      for (const l of touched) {
        const v = lineValue(grid, l);
        before.push(values[l]!);
        delta += v - values[l]!;
        values[l] = v;
      }
      if (delta < 0) {
        undo();
        touched.forEach((l, k) => (values[l] = before[k]!));
      }
    };
    for (let i = 0; i < HILL_STEPS; i++) {
      const a = rngBelow(rng, PS_SQUARES);
      const b = rngBelow(a.state, PS_SQUARES + pool.length);
      rng = b.state;
      const sa = a.value;
      if (b.value < PS_SQUARES) {
        const sb = b.value;
        if (sa === sb) continue;
        const t = grid[sa]!;
        grid[sa] = grid[sb]!;
        grid[sb] = t;
        tryChange(sa, sb, () => {
          grid[sb] = grid[sa]!;
          grid[sa] = t;
        });
      } else {
        const p = b.value - PS_SQUARES;
        const t = grid[sa]!;
        grid[sa] = pool[p]!;
        pool[p] = t;
        tryChange(sa, -1, () => {
          pool[p] = grid[sa]!;
          grid[sa] = t;
        });
      }
    }
    const totals = psTotals(grid);
    if (totals.made === PS_LINES && totals.total >= PS_CORE_FULL) return { grid, target: totals.total, rng };
  }
}

/** The deal: the target grid's 25 cards in a seeded dealing order, and the target. */
const DEAL_CACHE = new Map<number, { order: number[]; target: number }>();

export function psDeal(seed: number): { order: number[]; target: number } {
  const cached = DEAL_CACHE.get(seed);
  if (cached) return { order: cached.order.slice(), target: cached.target };
  const { grid, target, rng: start } = psTargetGrid(seed);
  const order = grid.slice();
  let rng = start;
  for (let i = order.length - 1; i > 0; i--) {
    const r = rngBelow(rng, i + 1);
    rng = r.state;
    const t = order[i]!;
    order[i] = order[r.value]!;
    order[r.value] = t;
  }
  // A few deals kept: the phone's stage builds its first state on every render (the seed's work is the same each time).
  if (DEAL_CACHE.size >= 8) DEAL_CACHE.delete(DEAL_CACHE.keys().next().value!);
  DEAL_CACHE.set(seed, { order: order.slice(), target });
  return { order, target };
}

export interface PsState {
  tick: number;
  rev: number;
  /** The 25 cards in dealing order, the next to place, and the deal's target. */
  order: number[];
  next: number;
  target: number;
  grid: number[];
  rejects: number;
  acted: number;
  /** 0 running, 1 every card placed, 2 the buzzer. */
  ended: number;
  finishTick: number;
  /** Display only: the last square filled and its tick. */
  lastSquare: number;
  lastTick: number;
  std: number;
}

export function psInit(seed: number): PsState {
  const { order, target } = psDeal(seed);
  return {
    tick: 0, rev: PS_REV, order, next: 0, target, grid: new Array<number>(PS_SQUARES).fill(NO_CARD),
    rejects: 0, acted: 0, ended: 0, finishTick: 0, lastSquare: -1, lastTick: 0, std: 1,
  };
}

/** Places the next card on square `sq` as a new state, or null when the square is taken or the cards are out. */
export function psApply(state: PsState, sq: number): PsState | null {
  if (sq < 0 || sq >= PS_SQUARES || state.grid[sq] !== NO_CARD || state.next >= PS_SQUARES) return null;
  const grid = state.grid.slice();
  grid[sq] = state.order[state.next]!;
  return { ...state, grid, next: state.next + 1, lastSquare: sq, lastTick: state.tick };
}

function step(state: PsState, input: ArcadeInputEvent | null): PsState {
  if (state.ended) return state;
  let next: PsState = { ...state, tick: state.tick + 1 };
  if (input && input.k === PS_INPUT_PLACE) {
    next.acted = 1;
    const placed = psApply(next, input.a);
    if (placed) next = placed;
    else next.rejects++;
  }
  if (next.next >= PS_SQUARES) {
    next.ended = 1;
    next.finishTick = next.tick;
  } else if (next.tick >= PS_RUN_TICKS) next.ended = 2;
  return next;
}

/* ================================ Scoring ================================ */

export function pokerSquaresStdParts(state: PsState): StdPart[] | null {
  if (!state || !state.std) return null;
  const { total, made } = psTotals(state.grid);
  return [
    stdPart(PS_STD_SPEC, "core", stdLine(PS_CORE_MAX, total, PS_CORE_FULL), `${total} hand points`),
    stdPart(PS_STD_SPEC, "hands", stdEach(made, PS_HAND_EACH, PS_HANDS_MAX), `${made} / ${PS_LINES} lines`),
  ];
}

export function pokerSquaresScore(state: PsState): number {
  return stdScore(pokerSquaresStdParts(state) ?? [], Boolean(state.acted));
}

export function pokerSquaresBandParts(state: PsState): BandParts {
  const parts = pokerSquaresStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  const { total } = psTotals(state.grid);
  return { units: total, points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${total} hand points` };
}

/* ============================== Checkpoints ============================== */

export const PS_CHECKPOINT_INTERVAL = 300;
export const PS_CHECKPOINT_KEYS = ["tick", "next", "ended", "checksum"] as const;
export interface PsCheckpoint {
  tick: number;
  next: number;
  ended: number;
  checksum: number;
}

export function psCheckpoint(state: PsState): PsCheckpoint {
  return { tick: state.tick, next: state.next, ended: state.ended, checksum: hashInts([state.tick, state.next, state.target, state.ended, ...state.grid]) };
}

export const pokerSquaresGame: ArcadeGame<PsState, ArcadeInputEvent | null> = {
  key: "pokersquares",
  runTicks: PS_RUN_TICKS,
  init: psInit,
  step,
  isOver: (state) => state.ended !== 0,
  score: pokerSquaresScore,
  draw: () => {},
  inputRanges: [inputRange(PS_INPUT_PLACE, [0, PS_SQUARES - 1])],
};

export function pokerSquaresGameFor(_rev?: number | null): ArcadeGame<PsState, ArcadeInputEvent | null> {
  return pokerSquaresGame;
}
