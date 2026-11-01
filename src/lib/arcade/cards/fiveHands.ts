/**
 * Five Hands (Cards & Board, 31 Oct 2026; docs/arcade-standard/fivehands.md): a 60-second run on the arcade engine.
 *
 * A seeded 52-card deck, the same for everyone in a room. Five cards are dealt, one into the leftmost slot of each of
 * the five rows. Then 20 turns: each turn turns up two cards, YOURS (a tap on a row places it in that row's next slot;
 * placed cards stay) and a DISCARD, "taken by an opponent", which goes face up onto the discard row. Rows fill evenly:
 * a row takes its next card only once every row holds as many, so after turn 5 every row has 2 cards, after turn 10
 * three, and so on (rows already filled for the round are greyed out). By the end 45 of the 52 cards have been seen
 * (5 dealt, 20 placed, 20 discarded). Only the five rows score, as poker hands (pair 3, two pair 6, three of a kind 8,
 * straight 10, flush 11, full house 13, four of a kind 15, straight flush 16; psHand, shared with Full House); at the
 * buzzer every row scores as it stands.
 *
 * The deal: the deck is shuffled from the seed and its witness found, an arrangement of the 20 cards that are yours
 * into the rows (any order within each round of five, the only freedom the rules leave) that makes a pair or better
 * in all five rows and reaches FH_CORE_FULL, by a seeded hill climb over the four rounds' orders. A deck without one
 * is reshuffled (the next attempt's seed). So every dealt deck lets perfect play reach 200; fhDeal returns the witness.
 *
 * Scoring (fiveHandsRev 1, the arcade standard; 200 in all): the core 160 on a straight line, total hand points ÷
 * FH_CORE_FULL × 160, full at the elite skill-band median (Joe's rule for this game: top marks need elite placement);
 * made hands 40 (8 for each row with a pair or better).
 *
 * fiveHandsRev 2 (1 Nov 2026, Joe's tuning; docs/arcade-standard/fivehands.md): the same play, a steeper hand table
 * (FH_HANDS_V2: pair 5, two pair 10, three of a kind 20, straight 25, flush 35, full house 50, four of a kind 60,
 * straight flush 75; high card 0) and ONE part: the hand points on a straight line to 200, full at FH_CORE_FULL_V2. No
 * made-hands part, no speed part, no row-order rule. The deck is shuffled exactly as rev 1's; the witness is climbed on
 * the rev-2 table and must reach FH_CORE_FULL_V2 (the same per-seed proof of 200). Rev-1 runs score as before
 * (fiveHandsGameFor(1)).
 */
import { inputRange, rngBelow, type ArcadeGame, type ArcadeInputEvent } from "../engine";
import { stdEach, stdLine, stdPart, stdScore, stdSum, type StdPart, type StdSpec } from "../arcadeStandard";
import { bandCurve, type BandParts } from "../scoreBands";
import { hashInts, shuffledDeck } from "./cards";
import { psHand } from "./pokerSquares";

/** The dealt revision (rev 2: the steep hand table, hand points alone to 200); rev 1 runs replay on fiveHandsGameV1. */
export const FH_REV = 2;
export const FH_REV_STEEP = 2;
export const FH_ROWS = 5;
export const FH_SLOTS = 5;
export const FH_TURNS = 20;
/** Cards seen by the end: 5 dealt, 20 placed, 20 discarded. */
export const FH_SEEN = FH_ROWS + 2 * FH_TURNS;
export const FH_INPUT_PLACE = 1;
export const FH_RUN_TICKS = 60 * 60;

export const FH_CORE_MAX = 160;
export const FH_HAND_EACH = 8;
export const FH_HANDS_MAX = 40;
/**
 * The core is full at this many hand points: the elite skill-band median (`bun scripts/cards-bands.ts fivehands
 * --seeds=100`, docs/arcade-standard/fivehands.md). Every dealt deck's witness reaches it (fhDeal).
 */
export const FH_CORE_FULL = 23;
/** The core's straight line (LIVE_BANDS and arcade-help-bands-check read it). */
export const FH_V1_BAND_CURVE = bandCurve([0, FH_CORE_FULL], [0, FH_CORE_MAX]);

/** fiveHandsRev 2's hand table, best first (high card 0). */
export const FH_HANDS_V2 = [
  ["Straight flush", 75],
  ["Four of a kind", 60],
  ["Full house", 50],
  ["Flush", 35],
  ["Straight", 25],
  ["Three of a kind", 20],
  ["Two pair", 10],
  ["Pair", 5],
] as const;
/** fiveHandsRev 2's single part: hand points to 200 on a straight line. */
export const FH_CORE_MAX_V2 = 200;
/**
 * fiveHandsRev 2's full figure in rev-2 hand points: the elite skill-band median (`bun scripts/cards-bands.ts fivehands
 * --seeds=100`, docs/arcade-standard/fivehands.md). Every rev-2 deck's witness reaches it (fhDeal(seed, 2)).
 */
export const FH_CORE_FULL_V2 = 46;
export const FH_V2_BAND_CURVE = bandCurve([0, FH_CORE_FULL_V2], [0, FH_CORE_MAX_V2]);

/** A revision's full figure (the witness must reach it). */
export function fhCoreFullFor(rev: number | null | undefined): number {
  return (rev ?? 1) >= FH_REV_STEEP ? FH_CORE_FULL_V2 : FH_CORE_FULL;
}

/** fiveHandsRev 2's spec (the dealt one: the help, LIVE_BANDS, the reveal). */
export const FH_STD_SPEC: StdSpec = {
  field: "fiveHandsRev",
  rev: FH_REV_STEEP,
  parts: [
    {
      key: "core", label: "Hand points", max: FH_CORE_MAX_V2, of: FH_CORE_FULL_V2, item: "hand point",
      how: `a straight line, full at ${FH_CORE_FULL_V2} hand points; pair 5, two pair 10, three of a kind 20, straight 25, flush 35, full house 50, four of a kind 60, straight flush 75`,
    },
  ],
};

/** fiveHandsRev 1's spec (stored rounds). */
export const FH_STD_SPEC_V1: StdSpec = {
  field: "fiveHandsRev",
  rev: 1,
  parts: [
    { key: "core", label: "Hand points", max: FH_CORE_MAX, of: FH_CORE_FULL, item: "hand point", how: `a straight line, full at ${FH_CORE_FULL} hand points` },
    { key: "hands", label: "Made hands", max: FH_HANDS_MAX, of: FH_ROWS, item: "row", how: "8 for each row with a pair or better" },
  ],
};

/** The card dealt into row `r` at the start (deck positions 0–4). */
export function fhStartCard(deck: readonly number[], r: number): number {
  return deck[r]!;
}

/** Turn `t`'s card for you (0-based turns). */
export function fhYours(deck: readonly number[], t: number): number {
  return deck[FH_ROWS + 2 * t]!;
}

/** Turn `t`'s discard. */
export function fhDiscard(deck: readonly number[], t: number): number {
  return deck[FH_ROWS + 2 * t + 1]!;
}

/** The rows that may take the next card: those holding the fewest (all of them at the start of each round). */
export function fhOpenRows(rows: readonly (readonly number[])[]): number[] {
  let min = FH_SLOTS;
  for (const row of rows) min = Math.min(min, row.length);
  const out: number[] = [];
  if (min >= FH_SLOTS) return out;
  rows.forEach((row, r) => {
    if (row.length === min) out.push(r);
  });
  return out;
}

/** A row's hand on a revision: rev 1 Full House's table (psHand), rev 2 FH_HANDS_V2 (same names, steeper points). */
export function fhRowHand(row: readonly number[], rev: number | null = 1): { points: number; name: string } {
  const h = psHand(row);
  if ((rev ?? 1) < FH_REV_STEEP || !h.name) return h;
  const v2 = FH_HANDS_V2.find(([name]) => name === h.name);
  return { points: v2 ? v2[1] : 0, name: h.name };
}

/** The rows' total hand points and the rows with a pair or better (on the revision's table). */
export function fhTotals(rows: readonly (readonly number[])[], rev: number | null = 1): { total: number; made: number } {
  let total = 0;
  let made = 0;
  for (const row of rows) {
    const p = fhRowHand(row, rev).points;
    total += p;
    if (p > 0) made++;
  }
  return { total, made };
}

/* ================================ The deal ================================ */

const HILL_STEPS = 4000;
/** A row with nothing costs this much in the climb, so every row ends with a pair or better. */
const BARE_ROW_COST = 24;

function rowValue(row: readonly number[], rev: number): number {
  const p = fhRowHand(row, rev).points;
  // Rev 2: the climb is on the steep table alone (no made-hands part, so a bare row costs nothing extra).
  if (rev >= FH_REV_STEEP) return p;
  return p > 0 ? p : -BARE_ROW_COST;
}

export interface FhDeal {
  /** The 45 cards seen, in deck order (fhStartCard, fhYours, fhDiscard read it). */
  deck: number[];
  /** The witness: each row's five cards (its start card, then one from each round of five turns). */
  witness: number[][];
  /** The witness's row for each turn's card (what perfect play taps). */
  witnessTaps: number[];
  /** The witness's hand points. */
  target: number;
}

/**
 * The deal from a seed: a seeded deck and its witness (see the header). The climb swaps two rows' cards within one
 * round of five, kept when no worse on the two rows; integer maths and the engine's PRNG only.
 */
export function fhBuildDeal(seed: number, rev = 1): FhDeal {
  const full = fhCoreFullFor(rev);
  for (let attempt = 0; ; attempt++) {
    const shuffled = shuffledDeck((seed ^ Math.imul(attempt + 1, 0x9e3779b1)) | 0);
    let rng = shuffled.rng;
    const deck = shuffled.deck.slice(0, FH_SEEN);
    // perm[g][r]: the turn (within round g, 0–4) whose card goes to row r.
    const perm = Array.from({ length: 4 }, () => [0, 1, 2, 3, 4]);
    const rowCards = (r: number) => [fhStartCard(deck, r), ...perm.map((p, g) => fhYours(deck, g * 5 + p[r]!))];
    const values = Array.from({ length: FH_ROWS }, (_, r) => rowValue(rowCards(r), rev));
    for (let i = 0; i < HILL_STEPS; i++) {
      const g = rngBelow(rng, 4);
      const a = rngBelow(g.state, FH_ROWS);
      const b = rngBelow(a.state, FH_ROWS - 1);
      rng = b.state;
      const ra = a.value;
      const rb = b.value >= ra ? b.value + 1 : b.value;
      const p = perm[g.value]!;
      const t = p[ra]!;
      p[ra] = p[rb]!;
      p[rb] = t;
      const va = rowValue(rowCards(ra), rev);
      const vb = rowValue(rowCards(rb), rev);
      if (va + vb < values[ra]! + values[rb]!) {
        p[rb] = p[ra]!;
        p[ra] = t;
      } else {
        values[ra] = va;
        values[rb] = vb;
      }
    }
    const witness = Array.from({ length: FH_ROWS }, (_, r) => rowCards(r));
    const totals = fhTotals(witness, rev);
    // Rev 1 also needs all five hands made (its made-hands part); rev 2 only the full figure.
    if ((rev >= FH_REV_STEEP || totals.made === FH_ROWS) && totals.total >= full) {
      const witnessTaps: number[] = [];
      for (let g = 0; g < 4; g++) for (let k = 0; k < 5; k++) witnessTaps.push(perm[g]!.indexOf(k));
      return { deck, witness, witnessTaps, target: totals.total };
    }
  }
}

/** A few deals kept: the phone's stage builds its first state on every render (the seed's work is the same each time). */
const DEAL_CACHE = new Map<string, FhDeal>();

export function fhDeal(seed: number, rev = 1): FhDeal {
  const key = `${seed}:${rev >= FH_REV_STEEP ? 2 : 1}`;
  let d = DEAL_CACHE.get(key);
  if (!d) {
    d = fhBuildDeal(seed, rev >= FH_REV_STEEP ? 2 : 1);
    if (DEAL_CACHE.size >= 8) DEAL_CACHE.delete(DEAL_CACHE.keys().next().value!);
    DEAL_CACHE.set(key, d);
  }
  return { deck: d.deck.slice(), witness: d.witness.map((r) => r.slice()), witnessTaps: d.witnessTaps.slice(), target: d.target };
}

/* ================================ The run ================================ */

export interface FhState {
  tick: number;
  rev: number;
  /** The 45 cards seen, in deck order; the turn (0–20: 20 once every card is placed). */
  deck: number[];
  turn: number;
  rows: number[][];
  rejects: number;
  acted: number;
  /** 0 running, 1 every card placed, 2 the buzzer. */
  ended: number;
  finishTick: number;
  /** Display only: the last row filled and its tick. */
  lastRow: number;
  lastTick: number;
  std: number;
}

export function fhInit(seed: number, rev = 1): FhState {
  const { deck } = fhDeal(seed, rev);
  return {
    tick: 0, rev, deck, turn: 0, rows: Array.from({ length: FH_ROWS }, (_, r) => [fhStartCard(deck, r)]),
    rejects: 0, acted: 0, ended: 0, finishTick: 0, lastRow: -1, lastTick: 0, std: 1,
  };
}

/** How many discards are face up: this turn's and every earlier one (all 20 once the cards are placed). */
export function fhDiscardsShown(state: Pick<FhState, "turn">): number {
  return Math.min(FH_TURNS, state.turn + 1);
}

/** Places this turn's card in row `r` as a new state, or null when the row is not open or the turns are done. */
export function fhApply(state: FhState, r: number): FhState | null {
  if (state.turn >= FH_TURNS || r < 0 || r >= FH_ROWS || !fhOpenRows(state.rows).includes(r)) return null;
  const rows = state.rows.map((row, k) => (k === r ? [...row, fhYours(state.deck, state.turn)] : row));
  return { ...state, rows, turn: state.turn + 1, lastRow: r, lastTick: state.tick };
}

function step(state: FhState, input: ArcadeInputEvent | null): FhState {
  if (state.ended) return state;
  let next: FhState = { ...state, tick: state.tick + 1 };
  if (input && input.k === FH_INPUT_PLACE) {
    next.acted = 1;
    const placed = fhApply(next, input.a);
    if (placed) next = placed;
    else next.rejects++;
  }
  if (next.turn >= FH_TURNS) {
    next.ended = 1;
    next.finishTick = next.tick;
  } else if (next.tick >= FH_RUN_TICKS) next.ended = 2;
  return next;
}

/* ================================ Scoring ================================ */

export function fiveHandsStdParts(state: FhState): StdPart[] | null {
  if (!state || !state.std) return null;
  if ((state.rev ?? 1) >= FH_REV_STEEP) {
    const { total } = fhTotals(state.rows, state.rev);
    return [stdPart(FH_STD_SPEC, "core", stdLine(FH_CORE_MAX_V2, total, FH_CORE_FULL_V2), `${total} hand points`)];
  }
  const { total, made } = fhTotals(state.rows);
  return [
    stdPart(FH_STD_SPEC_V1, "core", stdLine(FH_CORE_MAX, total, FH_CORE_FULL), `${total} hand points`),
    stdPart(FH_STD_SPEC_V1, "hands", stdEach(made, FH_HAND_EACH, FH_HANDS_MAX), `${made} / ${FH_ROWS} rows`),
  ];
}

export function fiveHandsScore(state: FhState): number {
  return stdScore(fiveHandsStdParts(state) ?? [], Boolean(state.acted));
}

export function fiveHandsBandParts(state: FhState): BandParts {
  const parts = fiveHandsStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  const { total } = fhTotals(state.rows, state.rev);
  return { units: total, points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${total} hand points` };
}

/* ============================== Checkpoints ============================== */

export const FH_CHECKPOINT_INTERVAL = 300;
export const FH_CHECKPOINT_KEYS = ["tick", "turn", "ended", "checksum"] as const;
export interface FhCheckpoint {
  tick: number;
  turn: number;
  ended: number;
  checksum: number;
}

export function fhCheckpoint(state: FhState): FhCheckpoint {
  const flat: number[] = [state.tick, state.turn, state.ended];
  for (const row of state.rows) flat.push(100 + row.length, ...row);
  return { tick: state.tick, turn: state.turn, ended: state.ended, checksum: hashInts(flat) };
}

/** fiveHandsRev 1's game (the checks and tools that play Five Hands without a stamp mean rev 1). */
export const fiveHandsGame: ArcadeGame<FhState, ArcadeInputEvent | null> = {
  key: "fivehands",
  runTicks: FH_RUN_TICKS,
  init: (seed) => fhInit(seed, 1),
  step,
  isOver: (state) => state.ended !== 0,
  score: fiveHandsScore,
  draw: () => {},
  inputRanges: [inputRange(FH_INPUT_PLACE, [0, FH_ROWS - 1])],
};

export const fiveHandsGameV1 = fiveHandsGame;

/** fiveHandsRev 2's game: the same play, the steep hand table, hand points alone to 200. */
export const fiveHandsGameV2: ArcadeGame<FhState, ArcadeInputEvent | null> = { ...fiveHandsGame, init: (seed) => fhInit(seed, 2) };

export function fiveHandsGameFor(rev?: number | null): ArcadeGame<FhState, ArcadeInputEvent | null> {
  return (rev ?? 1) >= FH_REV_STEEP ? fiveHandsGameV2 : fiveHandsGame;
}
