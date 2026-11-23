/**
 * TriPeaks (Cards & Board, 30 Oct 2026; docs/arcade-standard/tripeaks.md): a 60-second run on the arcade engine (90 s until the 30 Oct 2026 review, before rooms dealt it).
 *
 * Three peaks of 28 cards (the bottom row of ten face up, the rest face down until uncovered) and a 24-card stock
 * whose first card starts the discard. Tap a face-up card one higher or lower than the discard (Ace and King wrap)
 * to play it; tap the stock when stuck. The deal comes from a bank of deals proved fully clearable with a run of ten
 * (src/lib/arcade/cards/tripeaksDeals.data.ts, scripts/tripeaks-bank.ts); the puzzle's seed is the deal's index.
 *
 * Scoring (tripeaksRev 1, the arcade standard; 200 in all): the core 120 on a straight line over the 28 peak cards
 * cleared; peak tops 30 (10 each); longest run 20 (2 a card, full at 10); clear 10 and speed 20 (all 28 cleared;
 * speed full by TP_SPEED_FULL_S, 0 at the buzzer).
 *
 * tripeaksRev 2 (3 Nov 2026, Joe's Cards & Board batch; docs/arcade-standard/tripeaks.md): the same deals and play plus a
 * stock par: each bank deal's fewest stock turns on a line that clears all 28 with a run of ten
 * (tripeaksStockPar.data.ts, scripts/tripeaks-stock-par.ts), carried in the state and shown in the HUD. A new part,
 * Stock par, pays a clear that turned the stock at most par times in full, falling evenly to 0 when the whole stock is
 * turned; the parts re-fitted to the skill-band targets (TP_V2_*). The speed part was already there (rev 1: 20, full by
 * 27 s, clears only). Rev 1 runs play and score as before.
 *
 * tripeaksRev 3 (7 Nov 2026, scoring audit issue 6; docs/arcade-standard/tripeaks.md): the same deals, pars and play;
 * the 80 points locked behind a clear (clear 10, stock par 20, speed 50) split a near miss from a clear, so half the
 * speed moves onto the cards: cards 105 (straight line over the 28), peak tops 30, longest run 10, clear 10, stock par
 * 20 and speed 25, both in whole-number maths (stdSpeedInt). A clear always scores at least as much as any run that
 * misses one (27 cleared with every other part full: 101 + 30 + 10 = 141; the poorest clear: 105 + 30 + 1 + 10 = 146).
 * Rev 1 and 2 runs play and score as before.
 */
import { inputRange, type ArcadeGame, type ArcadeInputEvent } from "../engine";
import { stdEach, stdLine, stdPart, stdScore, stdSpeed, stdSpeedInt, stdSum, type StdPart, type StdSpec } from "../arcadeStandard";
import { bandCurve, type BandParts } from "../scoreBands";
import { hashInts, rankOf, shuffledDeck } from "./cards";
import { TP_DEALS } from "./tripeaksDeals.data";
import { TP_STOCK_PARS } from "./tripeaksStockPar.data";
import { TP_EXPERT_DEALS, TP_HARD_NOWRAP_DEALS } from "./tripeaksExpert.data";

/**
 * The dealt revision (rev 4: rev 3's game with the run, stock par and speed within reach; rev 3: more of the 200 on the
 * cards); rev 3 runs replay on tripeaksGameV3, rev 2 on V2, rev 1 on V1.
 */
export const TP_REV = 4;
export const TP_REV_PAR = 2;
export const TP_REV_SHARE = 3;
/**
 * tripeaksRev 4 (D6, 23 Nov 2026, Joe's Decision 1 A: a Normal scoring stamp moving only the parts the realistic elite
 * can't fill): rev 3's deals, pars, play and maximums; Longest run full at a run of TP_V4_RUN_FULL (each card 10 ÷ 6, was
 * 1 a card to ten), Stock par full within TP_V4_PAR_SLACK turns over the deal's par (was at par), Speed full by
 * TP_V4_SPEED_FULL_S s (was 20). Measured on 96 room deals (the skill-band bots under HUMAN_LIMITS): the elite at 200
 * 0 % → 44 %, the average 117 → 119. Level deals on rev 4 play TP_LEVEL_RULES_V4.
 */
export const TP_REV_EASE = 4;
export const TP_V4_RUN_FULL = 6;
export const TP_V4_PAR_SLACK = 8;
export const TP_V4_SPEED_FULL_S = 25;
export const TP_CARDS = 28;
export const TP_STOCK = 24;
/** Input: a tap, `a` the peak card's index (0–27) or TP_STOCK_PILE for the stock. */
export const TP_INPUT_TAP = 1;
export const TP_STOCK_PILE = 28;
export const TP_RUN_TICKS = 60 * 60;

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

/* ---- Scoring (tripeaksRev 2: re-fitted with the stock par; docs/arcade-standard/tripeaks.md) ---- */
/*
 * Fitted to the skill-band targets on room seeds 0–99 and fresh seeds 10000–10099 (docs/arcade-standard/tripeaks.md):
 * every bank deal is clearable, so even weak play clears most cards; the core is lighter and a fast, frugal clear pays.
 * Speed is full by 20 s (the elite median clear, 21 s; rev 1: 27 s, the near-perfect median), so elite clears separate
 * from near-perfect ones.
 */
export const TP_V2_CORE_MAX = 80;
export const TP_V2_PEAK_EACH = 10;
export const TP_V2_PEAK_MAX = 30;
export const TP_V2_RUN_EACH = 1;
export const TP_V2_RUN_MAX = 10;
export const TP_V2_CLEAR_MAX = 10;
export const TP_V2_PAR_MAX = 20;
export const TP_V2_SPEED_MAX = 50;
export const TP_V2_SPEED_FULL_S = 20;
/** The most stock turns (the 24-card stock's first card starts the discard): the stock par part's zero. */
export const TP_STOCK_TURNS = TP_STOCK - 1;
export const TP_V2_BAND_CURVE = bandCurve([0, TP_CARDS], [0, TP_V2_CORE_MAX]);

/* ---- Scoring (tripeaksRev 3: half the speed moved onto the cards) ---- */
export const TP_V3_CORE_MAX = 105;
export const TP_V3_SPEED_MAX = 25;
export const TP_V3_BAND_CURVE = bandCurve([0, TP_CARDS], [0, TP_V3_CORE_MAX]);

/** tripeaksRev 3's spec (stored rounds). */
export const TP_STD_SPEC_V3: StdSpec = {
  field: "tripeaksRev",
  rev: TP_REV_SHARE,
  parts: [
    { key: "core", label: "Cards cleared", max: TP_V3_CORE_MAX, of: TP_CARDS, item: "card", how: "clear the 28 peak cards, each worth the same" },
    { key: "peaks", label: "Peak tops", max: TP_V2_PEAK_MAX, of: 3, item: "peak top", how: `${TP_V2_PEAK_EACH} for each peak top cleared` },
    { key: "run", label: "Longest run", max: TP_V2_RUN_MAX, of: 10, item: "card", how: `${TP_V2_RUN_EACH} for each card in your longest run` },
    { key: "clear", label: "Clear", max: TP_V2_CLEAR_MAX, of: 1, how: "clear all 28" },
    { key: "par", label: "Stock par", max: TP_V2_PAR_MAX, of: 1, how: "clear all 28 turning the stock no more than the deal’s par for all of it, nothing if you turned it all" },
    { key: "speed", label: "Speed", max: TP_V3_SPEED_MAX, of: 1, how: `clear all 28 within ${TP_V2_SPEED_FULL_S} s for all of it, falling to 0 at the buzzer` },
  ],
};

/** tripeaksRev 4's spec (what rooms deal: the help, LIVE_BANDS, the reveal); a level's spec on rev 4 sets its own figures. */
export function tpSpecV4(runFull: number, parSlack: number, speedFullS: number, hintCost = 0, rev = TP_REV_EASE): StdSpec {
  return {
    field: "tripeaksRev",
    rev,
    parts: [
      { key: "core", label: "Cards cleared", max: TP_V3_CORE_MAX, of: TP_CARDS, item: "card", how: `clear the 28 peak cards, each worth the same${hintCost ? `; each hint costs ${hintCost}` : ""}` },
      { key: "peaks", label: "Peak tops", max: TP_V2_PEAK_MAX, of: 3, item: "peak top", how: `${TP_V2_PEAK_EACH} for each peak top cleared` },
      { key: "run", label: "Longest run", max: TP_V2_RUN_MAX, of: runFull, item: "card", how: `a run of ${runFull} cards in a row for all of it` },
      { key: "clear", label: "Clear", max: TP_V2_CLEAR_MAX, of: 1, how: "clear all 28" },
      { key: "par", label: "Stock par", max: TP_V2_PAR_MAX, of: 1, how: `clear all 28 turning the stock no more than ${parSlack} over the deal’s par for all of it, nothing if you turned it all` },
      { key: "speed", label: "Speed", max: TP_V3_SPEED_MAX, of: 1, how: `clear all 28 within ${speedFullS} s for all of it, falling to 0 at the buzzer` },
    ],
  };
}
export const TP_STD_SPEC: StdSpec = tpSpecV4(TP_V4_RUN_FULL, TP_V4_PAR_SLACK, TP_V4_SPEED_FULL_S);

/** tripeaksRev 2's spec (stored rounds). */
export const TP_STD_SPEC_V2: StdSpec = {
  field: "tripeaksRev",
  rev: TP_REV_PAR,
  parts: [
    { key: "core", label: "Cards cleared", max: TP_V2_CORE_MAX, of: TP_CARDS, item: "card", how: "clear the 28 peak cards, each worth the same" },
    { key: "peaks", label: "Peak tops", max: TP_V2_PEAK_MAX, of: 3, item: "peak top", how: `${TP_V2_PEAK_EACH} for each peak top cleared` },
    { key: "run", label: "Longest run", max: TP_V2_RUN_MAX, of: 10, item: "card", how: `${TP_V2_RUN_EACH} for each card in your longest run` },
    { key: "clear", label: "Clear", max: TP_V2_CLEAR_MAX, of: 1, how: "clear all 28" },
    { key: "par", label: "Stock par", max: TP_V2_PAR_MAX, of: 1, how: "clear all 28 turning the stock no more than the deal’s par for all of it, nothing if you turned it all" },
    { key: "speed", label: "Speed", max: TP_V2_SPEED_MAX, of: 1, how: `clear all 28 within ${TP_V2_SPEED_FULL_S} s for all of it, falling to 0 at the buzzer` },
  ],
};

/** tripeaksRev 1's spec (stored rounds). */
export const TP_STD_SPEC_V1: StdSpec = {
  field: "tripeaksRev",
  rev: 1,
  parts: [
    { key: "core", label: "Cards cleared", max: TP_CORE_MAX, of: TP_CARDS, item: "card", how: "clear the 28 peak cards, each worth the same" },
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
  /** tripeaksRev 2 only: the deal's stock par (the fewest stock turns on a clearing line with a run of ten). */
  stockPar?: number;
  /**
   * The difficulty levels (15 Nov 2026; level deals only): the level (TP_LV_*), no Ace–King wrap (Expert), the
   * positions before each action still to undo (Easy, packed by tpPack) and the undos made, hints asked for and the
   * last one's tick.
   */
  lv?: number;
  noWrap?: number;
  hist?: number[][];
  undos?: number;
  hints?: number;
  hintTick?: number;
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
  if (!(i >= 0 && i < TP_CARDS && tpFree(state, i))) return false;
  // Expert (the difficulty levels): one higher or lower only, no Ace–King wrap.
  if (state.noWrap) return Math.abs(rankOf(state.tab[i]!) - rankOf(state.top)) === 1;
  return tpNext(state.tab[i]!, state.top);
}

export function tpAnyPlay(state: TpState): boolean {
  for (let i = 0; i < TP_CARDS; i++) if (tpPlayable(state, i)) return true;
  return false;
}

export function tpInitFrom(dealSeed: number, deal = 0, rev = 1, stockPar?: number): TpState {
  const { deck } = shuffledDeck(dealSeed);
  const stock = deck.slice(TP_CARDS);
  return {
    ...(rev >= TP_REV_PAR ? { stockPar: stockPar ?? TP_STOCK_TURNS } : {}),
    tick: 0, rev, deal, tab: deck.slice(0, TP_CARDS), cleared: new Array<number>(TP_CARDS).fill(0),
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

/** Stock par's points for a clear (rev 2): full at par or fewer stock turns, even to 0 at the whole stock turned. */
export function tpStockParPoints(turns: number, par: number, rev = TP_REV_PAR): number {
  if (turns <= par) return TP_V2_PAR_MAX;
  return (rev >= TP_REV_SHARE ? stdSpeedInt : stdSpeed)(TP_V2_PAR_MAX, turns, par, TP_STOCK_TURNS);
}

/** tripeaksRev 4's parts on given figures (Normal: TP_V4_*; a rev-4 level: its own), the hint cost off the cards part. */
function tpPartsV4(state: TpState, spec: StdSpec, runFull: number, parSlack: number, speedFullS: number, runTicks: number, hintCost = 0): StdPart[] {
  const done = state.ended === 1;
  const par = state.stockPar ?? TP_STOCK_TURNS;
  const hints = state.hints ?? 0;
  const cost = hintCost * hints;
  const slackPar = Math.min(TP_STOCK_TURNS, par + parSlack);
  const parPts = !done ? 0 : state.turns <= slackPar ? TP_V2_PAR_MAX : stdSpeedInt(TP_V2_PAR_MAX, state.turns, slackPar, TP_STOCK_TURNS);
  return [
    stdPart(spec, "core", Math.max(0, stdLine(TP_V3_CORE_MAX, state.clearedCount, TP_CARDS) - cost), `${state.clearedCount} / ${TP_CARDS} cleared${cost ? ` · ${hints} ${hints === 1 ? "hint" : "hints"} (−${cost})` : ""}`),
    stdPart(spec, "peaks", stdEach(state.peaks, TP_V2_PEAK_EACH, TP_V2_PEAK_MAX), `${state.peaks} / 3 tops`),
    stdPart(spec, "run", stdLine(TP_V2_RUN_MAX, state.bestRun, runFull), `best run ${state.bestRun}`),
    stdPart(spec, "clear", done ? TP_V2_CLEAR_MAX : 0, done ? "all cleared" : "not cleared"),
    stdPart(spec, "par", parPts, done ? `${state.turns} stock cards, par ${par}` : "not cleared"),
    stdPart(spec, "speed", done ? stdSpeedInt(TP_V3_SPEED_MAX, state.finishTick, speedFullS * 60, runTicks) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
  ];
}

export function tripeaksStdParts(state: TpState): StdPart[] | null {
  if (!state || !state.std) return null;
  if (state.lv) return tpLevelParts(state);
  const done = state.ended === 1;
  if ((state.rev ?? 1) >= TP_REV_EASE) return tpPartsV4(state, TP_STD_SPEC, TP_V4_RUN_FULL, TP_V4_PAR_SLACK, TP_V4_SPEED_FULL_S, TP_RUN_TICKS);
  if ((state.rev ?? 1) >= TP_REV_SHARE) {
    const par = state.stockPar ?? TP_STOCK_TURNS;
    return [
      stdPart(TP_STD_SPEC_V3, "core", stdLine(TP_V3_CORE_MAX, state.clearedCount, TP_CARDS), `${state.clearedCount} / ${TP_CARDS} cleared`),
      stdPart(TP_STD_SPEC_V3, "peaks", stdEach(state.peaks, TP_V2_PEAK_EACH, TP_V2_PEAK_MAX), `${state.peaks} / 3 tops`),
      stdPart(TP_STD_SPEC_V3, "run", stdEach(state.bestRun, TP_V2_RUN_EACH, TP_V2_RUN_MAX), `best run ${state.bestRun}`),
      stdPart(TP_STD_SPEC_V3, "clear", done ? TP_V2_CLEAR_MAX : 0, done ? "all cleared" : "not cleared"),
      stdPart(TP_STD_SPEC_V3, "par", done ? tpStockParPoints(state.turns, par, TP_REV_SHARE) : 0, done ? `${state.turns} stock cards, par ${par}` : "not cleared"),
      stdPart(TP_STD_SPEC_V3, "speed", done ? stdSpeedInt(TP_V3_SPEED_MAX, state.finishTick, TP_V2_SPEED_FULL_S * 60, TP_RUN_TICKS) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
    ];
  }
  if ((state.rev ?? 1) >= TP_REV_PAR) {
    const par = state.stockPar ?? TP_STOCK_TURNS;
    return [
      stdPart(TP_STD_SPEC_V2, "core", stdLine(TP_V2_CORE_MAX, state.clearedCount, TP_CARDS), `${state.clearedCount} / ${TP_CARDS} cleared`),
      stdPart(TP_STD_SPEC_V2, "peaks", stdEach(state.peaks, TP_V2_PEAK_EACH, TP_V2_PEAK_MAX), `${state.peaks} / 3 tops`),
      stdPart(TP_STD_SPEC_V2, "run", stdEach(state.bestRun, TP_V2_RUN_EACH, TP_V2_RUN_MAX), `best run ${state.bestRun}`),
      stdPart(TP_STD_SPEC_V2, "clear", done ? TP_V2_CLEAR_MAX : 0, done ? "all cleared" : "not cleared"),
      stdPart(TP_STD_SPEC_V2, "par", done ? tpStockParPoints(state.turns, par) : 0, done ? `${state.turns} stock cards, par ${par}` : "not cleared"),
      stdPart(TP_STD_SPEC_V2, "speed", done ? stdSpeed(TP_V2_SPEED_MAX, state.finishTick, TP_V2_SPEED_FULL_S * 60, TP_RUN_TICKS) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
    ];
  }
  return [
    stdPart(TP_STD_SPEC_V1, "core", stdLine(TP_CORE_MAX, state.clearedCount, TP_CARDS), `${state.clearedCount} / ${TP_CARDS} cleared`),
    stdPart(TP_STD_SPEC_V1, "peaks", stdEach(state.peaks, TP_PEAK_EACH, TP_PEAK_MAX), `${state.peaks} / 3 tops`),
    stdPart(TP_STD_SPEC_V1, "run", stdEach(state.bestRun, TP_RUN_EACH, TP_RUN_MAX), `best run ${state.bestRun}`),
    stdPart(TP_STD_SPEC_V1, "clear", done ? TP_CLEAR_MAX : 0, done ? "all cleared" : "not cleared"),
    stdPart(TP_STD_SPEC_V1, "speed", done ? stdSpeed(TP_SPEED_MAX, state.finishTick, TP_SPEED_FULL_S * 60, TP_RUN_TICKS) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
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
    checksum: hashInts(state.lv
      ? [state.tick, state.top, state.run, state.bestRun, state.peaks, state.ended, ...state.cleared, 300 + (state.hints ?? 0), 400 + (state.hist?.length ?? 0)]
      : [state.tick, state.top, state.run, state.bestRun, state.peaks, state.ended, ...state.cleared]),
  };
}

/** tripeaksRev 1's game (the checks and tools that play Summit without a stamp mean rev 1). */
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

export const tripeaksGameV1 = tripeaksGame;

/** tripeaksRev 2's game: the same deals and play, the deal's stock par in the state. */
export const tripeaksGameV2: ArcadeGame<TpState, ArcadeInputEvent | null> = {
  ...tripeaksGame,
  init: (seed) => {
    const d = tpDealOf(seed);
    return tpInitFrom(d.dealSeed, d.index, TP_REV_PAR, TP_STOCK_PARS[d.index]);
  },
};

/** tripeaksRev 3's game: rev 2's deals, pars and play, scored on rev 3's parts. */
export const tripeaksGameV3: ArcadeGame<TpState, ArcadeInputEvent | null> = {
  ...tripeaksGame,
  init: (seed) => {
    const d = tpDealOf(seed);
    return tpInitFrom(d.dealSeed, d.index, TP_REV_SHARE, TP_STOCK_PARS[d.index]);
  },
};

/** tripeaksRev 4's game: rev 3's deals, pars and play, scored on rev 4's figures. */
export const tripeaksGameV4: ArcadeGame<TpState, ArcadeInputEvent | null> = {
  ...tripeaksGame,
  init: (seed) => {
    const d = tpDealOf(seed);
    return tpInitFrom(d.dealSeed, d.index, TP_REV_EASE, TP_STOCK_PARS[d.index]);
  },
};

export function tripeaksGameFor(rev?: number | null): ArcadeGame<TpState, ArcadeInputEvent | null> {
  const r = rev ?? 1;
  return r >= TP_REV_EASE ? tripeaksGameV4 : r >= TP_REV_SHARE ? tripeaksGameV3 : r >= TP_REV_PAR ? tripeaksGameV2 : tripeaksGame;
}

/* ================================ Difficulty levels (15 Nov 2026) ================================ */

/*
 * The levels (docs/design/difficulty/README.md; docs/arcade-standard/tripeaks.md "Levels"): Normal is tripeaksRev 3
 * exactly (no `level` on the puzzle, none of this code runs). A level deal carries `level` and tripeaksRev 3; its game is
 * rev 3's play and parts with:
 *
 *   Easy    playable cards glow, Ace and King wrap, 3 undos (TP_INPUT_UNDO), speed full by 25 s, hints free (and the
 *           hint's glow shows by itself after 8 s without a play).
 *   Hard    no glow (display), no Ace–King wrap, speed full by 20 s, a hint costs TP_HINT_COST from the cards part;
 *           dealt from the easier deals that clear without the wrap (16 Nov 2026, Joe: Hard and Expert need real steps,
 *           the deal itself harder; tripeaksExpert.data.ts's TP_HARD_NOWRAP_DEALS, each with its no-wrap stock par).
 *   Expert  no glow, no wrap, speed full by 16 s, one hint; dealt only from the bank deals the solver clears without
 *           the wrap with a run of ten, each with its own stock par (tripeaksExpert.data.ts, scripts/tripeaks-expert-bank.ts).
 *
 * Easy and Hard deal the Normal bank (every deal proved clearable with a run of ten, with the wrap) and its stock pars.
 * A hint (TP_INPUT_HINT) is counted by the sim; its move (tpHintMove, tripeaksSolver.ts) is display only.
 */
export const TP_INPUT_HINT = 2;
export const TP_INPUT_UNDO = 3;
export const TP_LV_EASY = 1;
export const TP_LV_HARD = 3;
export const TP_LV_EXPERT = 4;
export const TP_HINT_COST = 5;
export type TpLevelName = "easy" | "hard" | "expert";

export interface TpLevelRules {
  lv: number;
  glow: boolean;
  wrap: boolean;
  undoLimit: number;
  speedFullS: number;
  hintCost: number;
  hintLimit: number;
  /** D6's levels (tripeaksRev 4): the clock, the stock turns allowed, the deals' highest stock par, run and par figures. */
  seconds?: number;
  stockTurns?: number;
  maxPar?: number;
  runFull?: number;
  parSlack?: number;
}

export const TP_LEVEL_RULES: Readonly<Record<TpLevelName, TpLevelRules>> = {
  easy: { lv: TP_LV_EASY, glow: true, wrap: true, undoLimit: 3, speedFullS: 25, hintCost: 0, hintLimit: -1 },
  hard: { lv: TP_LV_HARD, glow: false, wrap: false, undoLimit: 0, speedFullS: 20, hintCost: TP_HINT_COST, hintLimit: -1 },
  expert: { lv: TP_LV_EXPERT, glow: false, wrap: false, undoLimit: 0, speedFullS: 16, hintCost: 0, hintLimit: 1 },
};

/**
 * D6's levels (23 Nov 2026, the polish plan's difficulty spec: the lever is seconds on the clock; Joe's ladder test): a
 * level deal on tripeaksRev 4 plays these rules (the state carries rev 4; a level state on rev 3 keeps TP_LEVEL_RULES
 * exactly). Every level deals the Normal bank (proved clearable with the wrap and a run of ten) filtered by its stock
 * par, so a clear within par fits the shorter stock. Hard and Expert carry no aid (no glow, undo or hints).
 *
 *   Easy    90 s; the whole stock (23 turns); deals with stock par 12 or less; glow, wrap, 3 undos, free hints; run
 *           full at 5, stock par within par + 10, speed by 30 s.
 *   Hard    45 s; the stock cut to 18 turns; deals with stock par 13 or less; no glow; wrap; no undo, no hints; run full
 *           at 6, stock par within par + 8, speed by 31 s.
 *   Expert  32 s; the stock cut to 14 turns; deals with stock par 11 or less; no glow; wrap; no undo, no hints; run
 *           full at 6, stock par within par + 5, speed by 27 s.
 *
 * The spec proposed 25 s for Expert; measured, the elite (no glow, under HUMAN_LIMITS) clears 3 deals in 96 at 25 s
 * (finish median 28 s), so the clock is 32 s. Each level's run, stock par and speed figures are set from 96 room deals
 * (scripts/d6-ladder.ts): the average player 153 / 119 (Normal) / 61 / 46, the elite at 200 65 % / 44 % / 32 % / 21 %.
 */
export const TP_LEVEL_RULES_V4: Readonly<Record<TpLevelName, TpLevelRules>> = {
  easy: { lv: TP_LV_EASY, glow: true, wrap: true, undoLimit: 3, speedFullS: 30, hintCost: 0, hintLimit: -1, seconds: 90, stockTurns: TP_STOCK_TURNS, maxPar: 12, runFull: 5, parSlack: 10 },
  hard: { lv: TP_LV_HARD, glow: false, wrap: true, undoLimit: 0, speedFullS: 31, hintCost: 0, hintLimit: 0, seconds: 45, stockTurns: 18, maxPar: 13, runFull: 6, parSlack: 8 },
  expert: { lv: TP_LV_EXPERT, glow: false, wrap: true, undoLimit: 0, speedFullS: 27, hintCost: 0, hintLimit: 0, seconds: 32, stockTurns: 14, maxPar: 11, runFull: 6, parSlack: 5 },
};

function tpLevelName(lv: number | undefined): TpLevelName | null {
  return lv === TP_LV_EASY ? "easy" : lv === TP_LV_HARD ? "hard" : lv === TP_LV_EXPERT ? "expert" : null;
}
/** A level's rules on a revision (rev 4: D6's; earlier: the levels before). */
export function tpLevelRulesFor(rev: number | null | undefined, level: TpLevelName): TpLevelRules {
  return (rev ?? 0) >= TP_REV_EASE ? TP_LEVEL_RULES_V4[level] : TP_LEVEL_RULES[level];
}
export function tpLevelRulesOf(state: Pick<TpState, "lv"> & { rev?: number }): TpLevelRules | null {
  const n = tpLevelName(state.lv);
  return n ? tpLevelRulesFor(state.rev, n) : null;
}
/** Whether a level state has the Hint button (D6's Hard and Expert have none). Display and input mapping only. */
export function tpHintButtonOn(state: Pick<TpState, "lv"> & { rev?: number }): boolean {
  const r = tpLevelRulesOf(state);
  return Boolean(r) && r!.hintLimit !== 0;
}
/** D6's level deals: the Normal bank's deals (indices) with a stock par of the level's `maxPar` or less, in bank order. */
const TP_V4_DEALS = new Map<TpLevelName, readonly number[]>();
export function tpV4Deals(level: TpLevelName): readonly number[] {
  let d = TP_V4_DEALS.get(level);
  if (!d) TP_V4_DEALS.set(level, (d = TP_STOCK_PARS.flatMap((par, i) => (par <= TP_LEVEL_RULES_V4[level].maxPar! ? [i] : []))));
  return d;
}

/** Whether playable cards glow (Normal and Easy; display only). */
export function tpGlows(state: Pick<TpState, "lv">): boolean {
  return tpLevelRulesOf(state)?.glow ?? true;
}

export function tpHintsLeft(state: TpState): number {
  const r = tpLevelRulesOf(state);
  if (!r) return 0;
  return r.hintLimit < 0 ? Infinity : Math.max(0, r.hintLimit - (state.hints ?? 0));
}
export function tpUndosLeft(state: TpState): number {
  const r = tpLevelRulesOf(state);
  return r ? Math.max(0, r.undoLimit - (state.undos ?? 0)) : 0;
}

/**
 * Easy's deals: the Normal bank's deals with a stock par of TP_EASY_MAX_PAR or less (the ones that clear turning the
 * fewest stock cards), in bank order; an Easy puzzle's seed indexes this list.
 */
export const TP_EASY_MAX_PAR = 12;
export const TP_EASY_DEALS: readonly number[] = TP_STOCK_PARS.flatMap((par, i) => (par <= TP_EASY_MAX_PAR ? [i] : []));


/** A level deal: the bank entry its seed names (Easy: the easiest deals; Expert: the no-wrap bank, its own pars). */
export function tpLevelDealOf(seed: number, level: TpLevelName): { index: number; dealSeed: number; stockPar: number } {
  if (level === "hard") {
    const n = TP_HARD_NOWRAP_DEALS.length;
    const index = ((Math.trunc(seed) % n) + n) % n;
    const [dealSeed, stockPar] = TP_HARD_NOWRAP_DEALS[index]!;
    return { index, dealSeed, stockPar };
  }
  if (level === "easy") {
    const list = TP_EASY_DEALS;
    const n = list.length;
    const index = list[((Math.trunc(seed) % n) + n) % n]!;
    return { index, dealSeed: TP_DEALS[index]!, stockPar: TP_STOCK_PARS[index]! };
  }
  if (level === "expert") {
    const n = TP_EXPERT_DEALS.length;
    const index = ((Math.trunc(seed) % n) + n) % n;
    const [dealSeed, stockPar] = TP_EXPERT_DEALS[index]!;
    return { index, dealSeed, stockPar };
  }
  const d = tpDealOf(seed);
  return { index: d.index, dealSeed: d.dealSeed, stockPar: TP_STOCK_PARS[d.index]! };
}

export function tpLevelInitFrom(level: TpLevelName, dealSeed: number, deal: number, stockPar: number, rev: number = TP_REV_SHARE): TpState {
  const v4 = rev >= TP_REV_EASE;
  const r = tpLevelRulesFor(rev, level);
  const base = tpInitFrom(dealSeed, deal, v4 ? TP_REV_EASE : TP_REV_SHARE, stockPar);
  // D6: a shorter stock is the stock's first `stockTurns` turns moved to the end of the array, so the same cards turn in
  // the same order, the count left (TP_STOCK − stockPos) reads true and the stock empties after them.
  const cut = v4 ? TP_STOCK_TURNS - r.stockTurns! : 0;
  const stock = cut ? [...base.stock.slice(1 + r.stockTurns!), ...base.stock.slice(0, 1 + r.stockTurns!)] : base.stock;
  return {
    ...base,
    ...(cut ? { stock, stockPos: cut + 1, top: stock[cut]! } : {}),
    lv: r.lv, ...(r.wrap ? {} : { noWrap: 1 }), ...(r.undoLimit > 0 ? { hist: [], undos: 0 } : {}), hints: 0, hintTick: 0,
  };
}

/** A position packed as integers (Undo): the cleared flags, then the counters a play or stock turn moves. */
export function tpPack(s: TpState): number[] {
  return [...s.cleared, s.stockPos, s.top, s.run, s.bestRun, s.peaks, s.clearedCount, s.plays, s.turns];
}
function tpUnpack(s: TpState, p: readonly number[]): TpState {
  const c = p.slice(TP_CARDS);
  return {
    ...s, cleared: p.slice(0, TP_CARDS), stockPos: c[0]!, top: c[1]!, run: c[2]!, bestRun: c[3]!, peaks: c[4]!, clearedCount: c[5]!, plays: c[6]!, turns: c[7]!,
    lastPlay: -1, lastTick: s.tick,
  };
}

function stepLevel(state: TpState, input: ArcadeInputEvent | null): TpState {
  if (state.ended) return state;
  if (input && input.k === TP_INPUT_HINT) {
    const next = step(state, null);
    if (next.ended || tpHintsLeft(state) <= 0) return { ...next, acted: 1 };
    return { ...next, acted: 1, hints: (state.hints ?? 0) + 1, hintTick: next.tick };
  }
  if (input && input.k === TP_INPUT_UNDO) {
    const next = step(state, null);
    const hist = state.hist ?? [];
    if (next.ended || tpUndosLeft(state) <= 0 || hist.length === 0) return { ...next, acted: 1 };
    return { ...tpUnpack(next, hist[hist.length - 1]!), acted: 1, hist: hist.slice(0, -1), undos: (state.undos ?? 0) + 1 };
  }
  let next = step(state, input);
  // D6's levels: the level's own clock (the shared step times out at Normal's 60 s).
  const r = tpLevelRulesOf(state)!;
  if (r.seconds) {
    const ticks = r.seconds * 60;
    if (next.ended === 2 && next.tick < ticks) next = { ...next, ended: 0 };
    if (next.ended === 0 && next.tick >= ticks) next = { ...next, ended: 2 };
  }
  // Easy: each play or stock turn goes on the undo history.
  if (state.hist && input && input.k === TP_INPUT_TAP && (next.plays !== state.plays || next.turns !== state.turns)) next = { ...next, hist: [...state.hist, tpPack(state)] };
  // Easy: a dead end waits while an undo can leave it (the run ends on it only with none left).
  if (next.ended === 3 && (next.hist?.length ?? 0) > 0 && tpUndosLeft(next) > 0) next = { ...next, ended: 0 };
  return next;
}

/** A level's spec (the help and the reveal); `rev` 4 is D6's levels. */
export function tpLevelSpec(level: TpLevelName, rev: number | null = TP_REV_SHARE): StdSpec {
  const r = tpLevelRulesFor(rev, level);
  if ((rev ?? 0) >= TP_REV_EASE) return tpSpecV4(r.runFull!, r.parSlack!, r.speedFullS, r.hintCost);
  return {
    ...TP_STD_SPEC_V3,
    parts: TP_STD_SPEC_V3.parts.map((p) =>
      p.key === "speed"
        ? { ...p, how: `clear all 28 within ${r.speedFullS} s for all of it, falling to 0 at the buzzer` }
        : p.key === "core" && r.hintCost
          ? { ...p, how: `${p.how}; each hint costs ${r.hintCost}` }
          : p,
    ),
  };
}

function tpLevelParts(state: TpState): StdPart[] {
  const r = tpLevelRulesOf(state)!;
  if ((state.rev ?? 0) >= TP_REV_EASE) return tpPartsV4(state, tpLevelSpec(tpLevelName(state.lv)!, TP_REV_EASE), r.runFull!, r.parSlack!, r.speedFullS, r.seconds! * 60, r.hintCost);
  const spec = tpLevelSpec(tpLevelName(state.lv)!);
  const done = state.ended === 1;
  const par = state.stockPar ?? TP_STOCK_TURNS;
  const hints = state.hints ?? 0;
  const cost = r.hintCost * hints;
  const core = Math.max(0, stdLine(TP_V3_CORE_MAX, state.clearedCount, TP_CARDS) - cost);
  return [
    stdPart(spec, "core", core, `${state.clearedCount} / ${TP_CARDS} cleared${cost ? ` · ${hints} ${hints === 1 ? "hint" : "hints"} (−${cost})` : ""}`),
    stdPart(spec, "peaks", stdEach(state.peaks, TP_V2_PEAK_EACH, TP_V2_PEAK_MAX), `${state.peaks} / 3 tops`),
    stdPart(spec, "run", stdEach(state.bestRun, TP_V2_RUN_EACH, TP_V2_RUN_MAX), `best run ${state.bestRun}`),
    stdPart(spec, "clear", done ? TP_V2_CLEAR_MAX : 0, done ? "all cleared" : "not cleared"),
    stdPart(spec, "par", done ? tpStockParPoints(state.turns, par, TP_REV_SHARE) : 0, done ? `${state.turns} stock cards, par ${par}` : "not cleared"),
    stdPart(spec, "speed", done ? stdSpeedInt(TP_V3_SPEED_MAX, state.finishTick, r.speedFullS * 60, TP_RUN_TICKS) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
  ];
}

const TP_LEVEL_GAMES = new Map<string, ArcadeGame<TpState, ArcadeInputEvent | null>>();
/** A level's game (`rev` 4: D6's levels, TP_LEVEL_RULES_V4: its clock, shorter stock and deals; earlier: the levels before). */
export function tripeaksLevelGame(level: TpLevelName, rev: number | null = TP_REV_SHARE): ArcadeGame<TpState, ArcadeInputEvent | null> {
  const v4 = (rev ?? 0) >= TP_REV_EASE;
  const key = `${level}:${v4 ? 4 : 3}`;
  let g = TP_LEVEL_GAMES.get(key);
  if (!g) {
    const r = tpLevelRulesFor(v4 ? TP_REV_EASE : TP_REV_SHARE, level);
    g = {
      ...tripeaksGameV3,
      ...(v4 ? { runTicks: r.seconds! * 60 } : {}),
      init: (seed) => {
        if (v4) {
          const list = tpV4Deals(level);
          const n = list.length;
          const index = list[((Math.trunc(seed) % n) + n) % n]!;
          return tpLevelInitFrom(level, TP_DEALS[index]!, index, TP_STOCK_PARS[index]!, TP_REV_EASE);
        }
        const d = tpLevelDealOf(seed, level);
        return tpLevelInitFrom(level, d.dealSeed, d.index, d.stockPar);
      },
      step: stepLevel,
      inputRanges: [inputRange(TP_INPUT_TAP, [0, TP_STOCK_PILE]), inputRange(TP_INPUT_HINT), inputRange(TP_INPUT_UNDO)],
    };
    TP_LEVEL_GAMES.set(key, g);
  }
  return g;
}

export function tripeaksGameAt(rev: number | null | undefined, level: string | null | undefined): ArcadeGame<TpState, ArcadeInputEvent | null> {
  return level === "easy" || level === "hard" || level === "expert" ? tripeaksLevelGame(level, rev ?? null) : tripeaksGameFor(rev);
}
