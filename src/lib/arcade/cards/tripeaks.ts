/**
 * TriPeaks (Cards & Board, 30 Oct 2026; docs/arcade-standard/tripeaks.md): a 90-second run on the arcade engine.
 *
 * Three peaks of 28 cards (the bottom row of ten face up, the rest face down until uncovered) and a 24-card stock
 * whose first card starts the discard. Tap a face-up card one higher or lower than the discard (Ace and King wrap)
 * to play it; tap the stock when stuck. The deal comes from a bank of deals proved fully clearable with a run of ten
 * (src/lib/arcade/cards/tripeaksDeals.data.ts, scripts/tripeaks-bank.ts); the puzzle's seed is the deal's index.
 *
 * Scoring (tripeaksRev 1, the arcade standard; 200 in all): the core 120 on a straight line over the 28 peak cards
 * cleared; peak tops 30 (10 each); longest run 20 (2 a card, full at 10); clear 10 and speed 20 (all 28 cleared;
 * speed full by TP_SPEED_FULL_S, 0 at the buzzer).
 */
import { inputRange, type ArcadeGame, type ArcadeInputEvent } from "../engine";
import { stdEach, stdLine, stdPart, stdScore, stdSpeed, stdSum, type StdPart, type StdSpec } from "../arcadeStandard";
import { bandCurve, type BandParts } from "../scoreBands";
import { hashInts, rankOf, shuffledDeck } from "./cards";
import { TP_DEALS } from "./tripeaksDeals.data";

export const TP_REV = 1;
export const TP_CARDS = 28;
export const TP_STOCK = 24;
/** Input: a tap, `a` the peak card's index (0–27) or TP_STOCK_PILE for the stock. */
export const TP_INPUT_TAP = 1;
export const TP_STOCK_PILE = 28;
export const TP_RUN_TICKS = 90 * 60;

/** Rows: three tops (0–2), six (3–8), nine (9–17), ten face up (18–27). */
export const TP_ROWS = [[0, 3], [3, 9], [9, 18], [18, 28]] as const;

/* ---- Scoring (tripeaksRev 1) ---- */
export const TP_CORE_MAX = 120;
export const TP_PEAK_EACH = 10;
export const TP_PEAK_MAX = 30;
export const TP_RUN_EACH = 2;
export const TP_RUN_MAX = 20;
export const TP_CLEAR_MAX = 10;
export const TP_SPEED_MAX = 20;
/** Speed is full by this many seconds (the near-perfect skill-band median clear, measured: docs/arcade-standard/tripeaks.md). */
export const TP_SPEED_FULL_S = 27;
export const TP_V1_BAND_CURVE = bandCurve([0, TP_CARDS], [0, TP_CORE_MAX]);

export const TP_STD_SPEC: StdSpec = {
  field: "tripeaksRev",
  rev: TP_REV,
  parts: [
    { key: "core", label: "Cards cleared", max: TP_CORE_MAX, of: TP_CARDS, item: "card", how: "a straight line over the 28 peak cards" },
    { key: "peaks", label: "Peak tops", max: TP_PEAK_MAX, of: 3, item: "peak top", how: "10 each" },
    { key: "run", label: "Longest run", max: TP_RUN_MAX, of: 10, item: "card", how: "2 a card, full at 10" },
    { key: "clear", label: "Clear", max: TP_CLEAR_MAX, of: 1, how: "all 28 cleared" },
    { key: "speed", label: "Speed", max: TP_SPEED_MAX, of: 1, how: `all 28 cleared: full by ${TP_SPEED_FULL_S} s, 0 at the buzzer` },
  ],
};

export interface TpState {
  tick: number;
  rev: number;
  deal: number;
  /** The 28 peak cards and which are cleared (1). */
  tab: number[];
  cleared: number[];
  stock: number[];
  /** The next stock card to turn. */
  stockPos: number;
  /** The discard's top card. */
  top: number;
  run: number;
  bestRun: number;
  peaks: number;
  clearedCount: number;
  plays: number;
  turns: number;
  rejects: number;
  acted: number;
  /** 0 running, 1 all cleared, 2 the buzzer, 3 no move left. */
  ended: number;
  finishTick: number;
  /** Display only: the last card played (index, or TP_STOCK_PILE) and its tick. */
  lastPlay: number;
  lastTick: number;
  std: number;
}

/** The cards that cover peak card `i` (it is face up and free once they are cleared). */
export function tpCoveredBy(i: number): number[] {
  if (i < 3) return [3 + 2 * i, 4 + 2 * i];
  if (i < 9) {
    const j = i - 3;
    const p = j >> 1;
    const k = j & 1;
    return [9 + 3 * p + k, 10 + 3 * p + k];
  }
  if (i < 18) return [18 + (i - 9), 19 + (i - 9)];
  return [];
}

const COVERS = Array.from({ length: TP_CARDS }, (_, i) => tpCoveredBy(i));

export function tpFree(state: Pick<TpState, "cleared">, i: number): boolean {
  if (state.cleared[i]) return false;
  for (const c of COVERS[i]!) if (!state.cleared[c]) return false;
  return true;
}

/** One higher or lower, Ace and King wrapping. */
export function tpNext(card: number, top: number): boolean {
  const d = Math.abs(rankOf(card) - rankOf(top));
  return d === 1 || d === 12;
}

export function tpPlayable(state: TpState, i: number): boolean {
  return i >= 0 && i < TP_CARDS && tpFree(state, i) && tpNext(state.tab[i]!, state.top);
}

export function tpAnyPlay(state: TpState): boolean {
  for (let i = 0; i < TP_CARDS; i++) if (tpPlayable(state, i)) return true;
  return false;
}

export function tpInitFrom(dealSeed: number, deal = 0): TpState {
  const { deck } = shuffledDeck(dealSeed);
  const stock = deck.slice(TP_CARDS);
  return {
    tick: 0, rev: TP_REV, deal, tab: deck.slice(0, TP_CARDS), cleared: new Array<number>(TP_CARDS).fill(0),
    stock, stockPos: 1, top: stock[0]!, run: 0, bestRun: 0, peaks: 0, clearedCount: 0, plays: 0, turns: 0, rejects: 0,
    acted: 0, ended: 0, finishTick: 0, lastPlay: -1, lastTick: 0, std: 1,
  };
}

export function tpDealOf(seed: number): { index: number; dealSeed: number } {
  const n = TP_DEALS.length;
  const index = ((Math.trunc(seed) % n) + n) % n;
  return { index, dealSeed: TP_DEALS[index]! };
}

/** Applies one tap (a peak card or the stock) as a new state, or null when it does nothing. */
export function tpApply(state: TpState, a: number): TpState | null {
  if (a === TP_STOCK_PILE) {
    if (state.stockPos >= TP_STOCK) return null;
    return { ...state, top: state.stock[state.stockPos]!, stockPos: state.stockPos + 1, run: 0, turns: state.turns + 1, lastPlay: TP_STOCK_PILE, lastTick: state.tick };
  }
  if (!tpPlayable(state, a)) return null;
  const cleared = state.cleared.slice();
  cleared[a] = 1;
  const run = state.run + 1;
  return {
    ...state, cleared, top: state.tab[a]!, run, bestRun: Math.max(state.bestRun, run), peaks: state.peaks + (a < 3 ? 1 : 0),
    clearedCount: state.clearedCount + 1, plays: state.plays + 1, lastPlay: a, lastTick: state.tick,
  };
}

function step(state: TpState, input: ArcadeInputEvent | null): TpState {
  if (state.ended) return state;
  let next: TpState = { ...state, tick: state.tick + 1 };
  if (input && input.k === TP_INPUT_TAP) {
    next.acted = 1;
    const played = tpApply(next, input.a);
    if (played) next = played;
    else next.rejects++;
  }
  if (next.clearedCount === TP_CARDS) {
    next.ended = 1;
    next.finishTick = next.tick;
  } else if (next.stockPos >= TP_STOCK && !tpAnyPlay(next)) next.ended = 3;
  else if (next.tick >= TP_RUN_TICKS) next.ended = 2;
  return next;
}

/* ================================ Scoring ================================ */

export function tripeaksStdParts(state: TpState): StdPart[] | null {
  if (!state || !state.std) return null;
  const done = state.ended === 1;
  return [
    stdPart(TP_STD_SPEC, "core", stdLine(TP_CORE_MAX, state.clearedCount, TP_CARDS), `${state.clearedCount} / ${TP_CARDS} cleared`),
    stdPart(TP_STD_SPEC, "peaks", stdEach(state.peaks, TP_PEAK_EACH, TP_PEAK_MAX), `${state.peaks} / 3 tops`),
    stdPart(TP_STD_SPEC, "run", stdEach(state.bestRun, TP_RUN_EACH, TP_RUN_MAX), `best run ${state.bestRun}`),
    stdPart(TP_STD_SPEC, "clear", done ? TP_CLEAR_MAX : 0, done ? "all cleared" : "not cleared"),
    stdPart(TP_STD_SPEC, "speed", done ? stdSpeed(TP_SPEED_MAX, state.finishTick, TP_SPEED_FULL_S * 60, TP_RUN_TICKS) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
  ];
}

export function tripeaksScore(state: TpState): number {
  return stdScore(tripeaksStdParts(state) ?? [], Boolean(state.acted));
}

export function tripeaksBandParts(state: TpState): BandParts {
  const parts = tripeaksStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  return { units: state.clearedCount, points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${state.clearedCount} / 28 cleared` };
}

/* ============================== Checkpoints ============================== */

export const TP_CHECKPOINT_INTERVAL = 300;
export const TP_CHECKPOINT_KEYS = ["tick", "cleared", "stockPos", "ended", "checksum"] as const;
export interface TpCheckpoint {
  tick: number;
  cleared: number;
  stockPos: number;
  ended: number;
  checksum: number;
}

export function tpCheckpoint(state: TpState): TpCheckpoint {
  return {
    tick: state.tick, cleared: state.clearedCount, stockPos: state.stockPos, ended: state.ended,
    checksum: hashInts([state.tick, state.top, state.run, state.bestRun, state.peaks, state.ended, ...state.cleared]),
  };
}

export const tripeaksGame: ArcadeGame<TpState, ArcadeInputEvent | null> = {
  key: "tripeaks",
  runTicks: TP_RUN_TICKS,
  init: (seed) => {
    const d = tpDealOf(seed);
    return tpInitFrom(d.dealSeed, d.index);
  },
  step,
  isOver: (state) => state.ended !== 0,
  score: tripeaksScore,
  draw: () => {},
  inputRanges: [inputRange(TP_INPUT_TAP, [0, TP_STOCK_PILE])],
};

export function tripeaksGameFor(_rev?: number | null): ArcadeGame<TpState, ArcadeInputEvent | null> {
  return tripeaksGame;
}
