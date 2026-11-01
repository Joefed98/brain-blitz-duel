/**
 * Golf Solitaire (Cards & Board, 1 Nov 2026; docs/arcade-standard/golfsol.md): a 75-second run on the arcade engine.
 *
 * Seven columns of five cards, all face up (35), a 16-card stock whose first card starts the one foundation pile. Play
 * the exposed card of any column onto the foundation when it is one higher or lower (suits don't matter; no wrapping
 * between King and Ace); draw from the stock when stuck. Undo (back to the position before the last action, unlimited)
 * and Reset (back to the deal, itself undoable); the clock runs on. The deal comes from a bank of deals a solver proved
 * clear with five runs of five (src/lib/arcade/cards/golfSolDeals.data.ts, scripts/golfsol-bank.ts); the puzzle's seed is
 * the deal's index.
 *
 * Scoring (golfSolRev 1, the arcade standard; 200 in all): the core 140 on a straight line over the 35 tableau cards
 * cleared; all cleared 20; speed 20 (cleared only: full by GS_SPEED_FULL_S, 0 at the buzzer); runs 20 (4 for each run
 * of five or more tableau cards in a row without drawing, up to 5).
 */
import { inputRange, type ArcadeGame, type ArcadeInputEvent } from "../engine";
import { stdEach, stdLine, stdPart, stdScore, stdSpeed, stdSum, type StdPart, type StdSpec } from "../arcadeStandard";
import { bandCurve, type BandParts } from "../scoreBands";
import { hashInts, rankOf, shuffledDeck } from "./cards";
import { GS_DEALS } from "./golfSolDeals.data";

export const GS_REV = 1;
export const GS_COLS = 7;
export const GS_DEPTH = 5;
export const GS_CARDS = 35;
export const GS_STOCK = 16;
/** Input: a tap, `a` a column (0–6) or GS_STOCK_PILE. */
export const GS_INPUT_TAP = 1;
export const GS_INPUT_UNDO = 3;
export const GS_INPUT_RESET = 4;
export const GS_STOCK_PILE = 7;
export const GS_RUN_TICKS = 75 * 60;
/** A run counts once it reaches this many tableau cards. */
export const GS_RUN_LEN = 5;

/* ---- Scoring (golfSolRev 1) ---- */
export const GS_CORE_MAX = 140;
export const GS_CLEAR_MAX = 20;
export const GS_SPEED_MAX = 20;
/** Speed is full by this many seconds (the near-perfect skill-band median clear, measured: docs/arcade-standard/golfsol.md). */
export const GS_SPEED_FULL_S = 28;
export const GS_RUN_EACH = 4;
export const GS_RUN_MAX = 20;
export const GS_RUN_FULL = 5;
export const GS_V1_BAND_CURVE = bandCurve([0, GS_CARDS], [0, GS_CORE_MAX]);

export const GS_STD_SPEC: StdSpec = {
  field: "golfSolRev",
  rev: GS_REV,
  parts: [
    { key: "core", label: "Cards cleared", max: GS_CORE_MAX, of: GS_CARDS, item: "card", how: "a straight line over the 35 tableau cards" },
    { key: "clear", label: "All cleared", max: GS_CLEAR_MAX, of: 1, how: "all 35 cleared" },
    { key: "speed", label: "Speed", max: GS_SPEED_MAX, of: 1, how: `cleared: full by ${GS_SPEED_FULL_S} s, 0 at the buzzer` },
    { key: "runs", label: "Runs", max: GS_RUN_MAX, of: GS_RUN_FULL, item: "run", how: "4 for each run of five or more cards without drawing, up to 5" },
  ],
};

export interface GsState {
  tick: number;
  rev: number;
  deal: number;
  /** The 35 tableau cards, column by column (each column's five from the back), and each column's height. */
  tab: number[];
  heights: number[];
  stock: number[];
  /** The next stock card to turn. */
  stockPos: number;
  /** The foundation's top card. */
  top: number;
  /** Tableau cards played since the last draw, runs of five or more made, and the longest. */
  run: number;
  runs: number;
  bestRun: number;
  cleared: number;
  plays: number;
  draws: number;
  rejects: number;
  acted: number;
  /** 0 running, 1 all cleared, 2 the buzzer, 3 no move left. */
  ended: number;
  finishTick: number;
  hist: number[][];
  start: number[];
  undos: number;
  resets: number;
  /** Display only: the last card played (a column, or GS_STOCK_PILE) and its tick. */
  lastPlay: number;
  lastTick: number;
  std: number;
}

/** The exposed card of column `c` (-1 when empty). */
export function gsExposed(state: Pick<GsState, "tab" | "heights">, c: number): number {
  const h = state.heights[c] ?? 0;
  return h > 0 ? state.tab[c * GS_DEPTH + h - 1]! : -1;
}

/** One higher or lower, no wrapping. */
export function gsNext(card: number, top: number): boolean {
  return Math.abs(rankOf(card) - rankOf(top)) === 1;
}

export function gsPlayable(state: GsState, c: number): boolean {
  if (c < 0 || c >= GS_COLS) return false;
  const card = gsExposed(state, c);
  return card >= 0 && gsNext(card, state.top);
}

export function gsAnyPlay(state: GsState): boolean {
  for (let c = 0; c < GS_COLS; c++) if (gsPlayable(state, c)) return true;
  return false;
}

export function gsInitFrom(dealSeed: number, deal = 0): GsState {
  const { deck } = shuffledDeck(dealSeed);
  const stock = deck.slice(GS_CARDS, GS_CARDS + GS_STOCK);
  const s: GsState = {
    tick: 0, rev: GS_REV, deal, tab: deck.slice(0, GS_CARDS), heights: new Array<number>(GS_COLS).fill(GS_DEPTH), stock, stockPos: 1, top: stock[0]!,
    run: 0, runs: 0, bestRun: 0, cleared: 0, plays: 0, draws: 0, rejects: 0, acted: 0, ended: 0, finishTick: 0,
    hist: [], start: [], undos: 0, resets: 0, lastPlay: -1, lastTick: 0, std: 1,
  };
  s.start = gsPack(s);
  return s;
}

export function gsDealOf(seed: number): { index: number; dealSeed: number } {
  const n = GS_DEALS.length;
  const index = ((Math.trunc(seed) % n) + n) % n;
  return { index, dealSeed: GS_DEALS[index]! };
}

/* ---- Undo and Reset ---- */

export function gsPack(s: Pick<GsState, "heights" | "stockPos" | "top" | "run" | "runs" | "bestRun" | "cleared">): number[] {
  return [...s.heights, s.stockPos, s.top, s.run, s.runs, s.bestRun, s.cleared];
}

function unpack(p: readonly number[]): Pick<GsState, "heights" | "stockPos" | "top" | "run" | "runs" | "bestRun" | "cleared"> {
  return { heights: p.slice(0, GS_COLS), stockPos: p[7]!, top: p[8]!, run: p[9]!, runs: p[10]!, bestRun: p[11]!, cleared: p[12]! };
}

function samePacked(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Applies one tap (a column or the stock) as a new state, or null when it does nothing. */
export function gsApply(state: GsState, a: number): GsState | null {
  if (a === GS_STOCK_PILE) {
    if (state.stockPos >= GS_STOCK) return null;
    return { ...state, top: state.stock[state.stockPos]!, stockPos: state.stockPos + 1, run: 0, draws: state.draws + 1, lastPlay: GS_STOCK_PILE, lastTick: state.tick };
  }
  if (!gsPlayable(state, a)) return null;
  const heights = state.heights.slice();
  const card = gsExposed(state, a);
  heights[a]!--;
  const run = state.run + 1;
  return {
    ...state, heights, top: card, run, runs: state.runs + (run === GS_RUN_LEN ? 1 : 0), bestRun: Math.max(state.bestRun, run),
    cleared: state.cleared + 1, plays: state.plays + 1, lastPlay: a, lastTick: state.tick,
  };
}

function step(state: GsState, input: ArcadeInputEvent | null): GsState {
  if (state.ended) return state;
  let next: GsState = { ...state, tick: state.tick + 1 };
  if (input && input.k === GS_INPUT_TAP) {
    next.acted = 1;
    const played = gsApply(next, input.a);
    if (played) next = { ...played, hist: [...state.hist, gsPack(state)] };
    else next.rejects++;
  } else if (input && input.k === GS_INPUT_UNDO) {
    next.acted = 1;
    if (state.hist.length > 0) next = { ...next, ...unpack(state.hist[state.hist.length - 1]!), hist: state.hist.slice(0, -1), undos: state.undos + 1, lastPlay: -1, lastTick: next.tick };
  } else if (input && input.k === GS_INPUT_RESET) {
    next.acted = 1;
    const now = gsPack(state);
    if (!samePacked(now, state.start)) next = { ...next, ...unpack(state.start), hist: [...state.hist, now], resets: state.resets + 1, lastPlay: -1, lastTick: next.tick };
  }
  if (next.cleared === GS_CARDS) {
    next.ended = 1;
    next.finishTick = next.tick;
  } else if (next.stockPos >= GS_STOCK && !gsAnyPlay(next)) next.ended = 3;
  else if (next.tick >= GS_RUN_TICKS) next.ended = 2;
  return next;
}

/* ================================ Scoring ================================ */

export function golfSolStdParts(state: GsState): StdPart[] | null {
  if (!state || !state.std) return null;
  const done = state.ended === 1;
  return [
    stdPart(GS_STD_SPEC, "core", stdLine(GS_CORE_MAX, state.cleared, GS_CARDS), `${state.cleared} / ${GS_CARDS} cleared`),
    stdPart(GS_STD_SPEC, "clear", done ? GS_CLEAR_MAX : 0, done ? "all cleared" : "not cleared"),
    stdPart(GS_STD_SPEC, "speed", done ? stdSpeed(GS_SPEED_MAX, state.finishTick, GS_SPEED_FULL_S * 60, GS_RUN_TICKS) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
    stdPart(GS_STD_SPEC, "runs", stdEach(state.runs, GS_RUN_EACH, GS_RUN_MAX), `${state.runs} run${state.runs === 1 ? "" : "s"} of 5+`),
  ];
}

export function golfSolScore(state: GsState): number {
  return stdScore(golfSolStdParts(state) ?? [], Boolean(state.acted));
}

export function golfSolBandParts(state: GsState): BandParts {
  const parts = golfSolStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  return { units: state.cleared, points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${state.cleared} / 35 cleared` };
}

/* ============================== Checkpoints ============================== */

export const GS_CHECKPOINT_INTERVAL = 300;
export const GS_CHECKPOINT_KEYS = ["tick", "cleared", "stockPos", "ended", "checksum"] as const;
export interface GsCheckpoint {
  tick: number;
  cleared: number;
  stockPos: number;
  ended: number;
  checksum: number;
}

export function gsCheckpoint(state: GsState): GsCheckpoint {
  return {
    tick: state.tick, cleared: state.cleared, stockPos: state.stockPos, ended: state.ended,
    checksum: hashInts([state.tick, state.top, state.run, state.runs, state.bestRun, state.ended, state.hist.length, state.undos, state.resets, ...state.heights]),
  };
}

export const golfSolGame: ArcadeGame<GsState, ArcadeInputEvent | null> = {
  key: "golfsol",
  runTicks: GS_RUN_TICKS,
  init: (seed) => {
    const d = gsDealOf(seed);
    return gsInitFrom(d.dealSeed, d.index);
  },
  step,
  isOver: (state) => state.ended !== 0,
  score: golfSolScore,
  draw: () => {},
  inputRanges: [inputRange(GS_INPUT_TAP, [0, GS_STOCK_PILE]), inputRange(GS_INPUT_UNDO), inputRange(GS_INPUT_RESET)],
};

export function golfSolGameFor(_rev?: number | null): ArcadeGame<GsState, ArcadeInputEvent | null> {
  return golfSolGame;
}
