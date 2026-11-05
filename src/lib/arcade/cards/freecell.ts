/**
 * FreeCell (Cards & Board, 30 Oct 2026; docs/arcade-standard/freecell.md): a 120-second run on the arcade engine.
 *
 * The deal comes from a bank of deals proved solvable, each with a par (the fewest moves the bank's solver found;
 * src/lib/arcade/cards/freecellDeals.data.ts, built by scripts/freecell-bank.ts). The puzzle's seed is the deal's
 * index, so every player in a room gets the same deal and par; nothing random happens after the deal.
 *
 * Piles: 0–7 the columns, 8–11 the free cells, 12 home (each card goes to its own suit's pile). A move is one input:
 * a tap (kind 1: pile, index) moves the card (and the run on it) to its best legal spot, a drag (kind 2: pile, index,
 * destination) to the one named. Multi-card moves are allowed as free cells and empty columns permit. After every
 * move, and at the deal, safe cards go home by themselves (not counted as moves).
 *
 * Scoring (freecellRev 1, the arcade standard; 200 in all): the core 140 on a straight line over cards home (two units
 * each) and cards in sorted runs on the columns (one unit each, half value), full at 104 units (all 52 home); par 30
 * (finished only: full at par moves, 0 at twice par); speed 30 (finished only: full by FC_SPEED_FULL_S, 0 at the buzzer).
 *
 * freecellRev 2 (31 Oct 2026, docs/arcade-standard/freecell.md; shown as "Free Cell"): the same deals and scoring plus
 * Undo (kind 3: back to the position before the last move or reset, unlimited) and Reset (kind 4: back to the deal).
 * Each undo or reset counts as a move for par; the clock runs on. A move refused for want of free cells or empty
 * columns notes how many free cells it needed (display only: the phone's toast). freecellRev 1 plays as before: its
 * game (freecellGameV1) has no undo, reset or note and its own input ranges.
 *
 * freecellRev 3 (1 Nov 2026, Joe's tuning; docs/arcade-standard/freecell.md): rev 2's play and the same 120 s, the core
 * full at FC_CORE_UNITS_V3 units (the near-perfect skill-band median at the run's half-way mark) instead of all 52 home,
 * so a run that sends fewer cards home scores well; par and speed unchanged (finished only). The safe auto-move home
 * (every rev) is now animated: each auto move's card and where it came from are kept for the art (display only, rev 3
 * states only, outside the checksum).
 *
 * freecellRev 4 (3 Nov 2026, Joe's Cards & Board batch; docs/arcade-standard/freecell.md): a smaller deal so a whole game
 * fits the 2-minute round: Ace to 10 in each suit (40 cards), 8 columns of 5, the same 4 free cells and 4 home piles,
 * rev 3's play (undo, reset, the flying auto moves) and 120 s. The deals come from their own bank, every one solved
 * (freecellDealsV4.data.ts, scripts/freecell-bank.ts --rev=4), par the fewest moves the solver found. The parts are
 * re-fitted (FC_CORE_UNITS_V4, FC_SPEED_FULL_S_V4). Rev 1–3 runs play and score as before.
 */
import { inputRange, type ArcadeGame, type ArcadeInputEvent } from "../engine";
import { stdLine, stdPart, stdScore, stdSpeed, stdSum, type StdPart, type StdSpec } from "../arcadeStandard";
import { bandCurve, type BandParts } from "../scoreBands";
import { hashInts, isRed, NO_CARD, rankOf, shuffledDeck, suitOf } from "./cards";
import { FC_DEALS } from "./freecellDeals.data";
import { FC_DEALS_V4 } from "./freecellDealsV4.data";

/** The dealt revision (rev 4: the 40-card deal); rev 3 runs replay on freecellGameV3, rev 2 on V2, rev 1 on V1. */
export const FC_REV = 4;
export const FC_REV_UNDO = 2;
export const FC_REV_EASY = 3;
export const FC_REV_SHORT = 4;
/** freecellRev 4's deal: Ace to 10 in each suit, five to a column. */
export const FC_SHORT_TOP_RANK = 10;
export const FC_SHORT_CARDS = 40;
export const FC_COLS = 8;
export const FC_CELLS = 4;
/** Pile ids. */
export const FC_PILE_CELL = 8;
export const FC_PILE_HOME = 12;
export const FC_RUN_TICKS = 120 * 60;

/** Input kinds: a tap (best legal spot) and a drag (a named destination). */
export const FC_INPUT_TAP = 1;
export const FC_INPUT_MOVE = 2;
/** freecellRev 2: Undo and Reset (no arguments). */
export const FC_INPUT_UNDO = 3;
export const FC_INPUT_RESET = 4;

/* ---- Scoring (freecellRev 1) ---- */
export const FC_CORE_MAX = 140;
export const FC_PAR_MAX = 30;
export const FC_SPEED_MAX = 30;
/** Core units: two a card home, one a card in a sorted run on a column; all 52 home is 104. */
export const FC_CORE_UNITS = 104;
/** Speed is full by this many seconds (the near-perfect skill-band median finish, measured: docs/arcade-standard/freecell.md). */
export const FC_SPEED_FULL_S = 66;
/**
 * freecellRev 3's full figure: the near-perfect skill-band median core units 60 s into the run (half the clock, before
 * its final run of cards home; `bun scripts/cards-bands.ts freecell --at=60`, docs/arcade-standard/freecell.md). About 20
 * cards home and a dozen or so in sorted runs.
 */
export const FC_CORE_UNITS_V3 = 54;
/*
 * freecellRev 4's parts (re-fitted to the skill-band targets on room seeds 0–99 and fresh seeds 10000–10099,
 * docs/arcade-standard/freecell.md): on the 40-card deal even average players often finish, so finishing well pays:
 * cards 60 on a straight line full at 50 units (all 40 home is 80), par 50 (finished only: full at par, 0 at 1.5 × par)
 * and speed 90 (finished only: full by 32 s, 0 at the buzzer).
 */
export const FC_CORE_MAX_V4 = 60;
export const FC_PAR_MAX_V4 = 50;
export const FC_SPEED_MAX_V4 = 90;
export const FC_CORE_UNITS_V4 = 50;
export const FC_SPEED_FULL_S_V4 = 32;
/** The core's full figure on a revision. */
export function fcCoreUnitsFor(rev: number | null | undefined): number {
  const r = rev ?? 1;
  return r >= FC_REV_SHORT ? FC_CORE_UNITS_V4 : r >= FC_REV_EASY ? FC_CORE_UNITS_V3 : FC_CORE_UNITS;
}
/** Speed's "full by" seconds on a revision. */
export function fcSpeedFullFor(rev: number | null | undefined): number {
  return (rev ?? 1) >= FC_REV_SHORT ? FC_SPEED_FULL_S_V4 : FC_SPEED_FULL_S;
}
/** The cards in a revision's deal (52; rev 4 40). */
export function fcCardsFor(rev: number | null | undefined): number {
  return (rev ?? 1) >= FC_REV_SHORT ? FC_SHORT_CARDS : 52;
}
/** Every card of the deal is home. */
export function fcAllHome(state: Pick<FcState, "home" | "rev">): boolean {
  return fcHomeCount(state) === fcCardsFor(state.rev);
}
/** The core's straight line (LIVE_BANDS and arcade-help-bands-check read it). */
export const FC_V1_BAND_CURVE = bandCurve([0, FC_CORE_UNITS], [0, FC_CORE_MAX]);
export const FC_V3_BAND_CURVE = bandCurve([0, FC_CORE_UNITS_V3], [0, FC_CORE_MAX]);
export const FC_V4_BAND_CURVE = bandCurve([0, FC_CORE_UNITS_V4], [0, FC_CORE_MAX_V4]);

function fcSpec(rev: number): StdSpec {
  const easy = rev >= FC_REV_EASY;
  if (rev >= FC_REV_SHORT) {
    return {
      field: "freecellRev",
      rev,
      parts: [
        {
          key: "core", label: "Cards", max: FC_CORE_MAX_V4, of: FC_CORE_UNITS_V4,
          how: "every card home scores, a card in a sorted run on the columns half as much; 25 cards home for all of it",
        },
        { key: "par", label: "Par moves", max: FC_PAR_MAX_V4, of: 1, how: "finish in the deal's fewest moves (par) for all of it, nothing at one and a half times par" },
        { key: "speed", label: "Speed", max: FC_SPEED_MAX_V4, of: 1, how: `finish within ${FC_SPEED_FULL_S_V4} s for all of it, falling to 0 at the buzzer` },
      ],
    };
  }
  return {
    field: "freecellRev",
    rev,
    parts: [
      {
        key: "core", label: "Cards", max: FC_CORE_MAX, of: fcCoreUnitsFor(rev),
        how: easy
          ? `a straight line: cards home full value, cards in sorted runs on the columns half value; full at ${FC_CORE_UNITS_V3} units (about 20 home and a dozen sorted)`
          : "a straight line: cards home full value, cards in sorted runs on the columns half value; full with all 52 home",
      },
      { key: "par", label: "Par moves", max: FC_PAR_MAX, of: 1, how: "finished only: full at the deal's par, 0 at twice par" },
      { key: "speed", label: "Speed", max: FC_SPEED_MAX, of: 1, how: `finished only: full by ${FC_SPEED_FULL_S} s, 0 at the buzzer` },
    ],
  };
}
/** The dealt revision's spec (the help, LIVE_BANDS, the reveal); revs 1 and 2 score on FC_STD_SPEC_V1's parts, rev 3 on V3's. */
export const FC_STD_SPEC: StdSpec = fcSpec(FC_REV);
export const FC_STD_SPEC_V1: StdSpec = fcSpec(2);
export const FC_STD_SPEC_V3: StdSpec = fcSpec(FC_REV_EASY);

export interface FcState {
  tick: number;
  rev: number;
  /** The bank deal's index and its par. */
  deal: number;
  par: number;
  cols: number[][];
  cells: number[];
  /** Top rank home for each suit (0 = empty). */
  home: number[];
  /** Player moves made (auto moves home not counted), taps that moved nothing. */
  moves: number;
  rejects: number;
  /** Cards sent home automatically. */
  autos: number;
  acted: number;
  /** 0 running, 1 every card home, 2 the buzzer. */
  ended: number;
  finishTick: number;
  /** The last move (display only reads it): from pile, to pile, cards moved, tick. */
  lastFrom: number;
  lastTo: number;
  lastCount: number;
  lastTick: number;
  std: number;
  /**
   * freecellRev 2 only. hist: the positions before each move, reset or undone move still to undo (packed by fcPack),
   * start: the deal's position; undos and resets made; the last refused move's note (1: not enough free cells or empty
   * columns, need: the cards it tried to move, cells: the free cells it needed) and its tick (display only).
   */
  hist?: number[][];
  start?: number[];
  undos?: number;
  resets?: number;
  note?: number;
  noteNeed?: number;
  noteCells?: number;
  noteTick?: number;
  /**
   * freecellRev 3 only, display only (outside the checksum): the cards the last auto move sent home, as triples (card,
   * the pile it left, its index there), in the order they went, and the tick they went (the art flies them home).
   */
  fly?: number[];
  flyTick?: number;
}

/* ================================ Rules ================================ */

/** `card` may go on `onto` in a column: one rank lower, the other colour. */
export function fcStacks(card: number, onto: number): boolean {
  return rankOf(onto) === rankOf(card) + 1 && isRed(onto) !== isRed(card);
}

/** Where the movable sorted run at the top of a column starts (its length is col.length − start). */
export function fcRunStart(col: readonly number[]): number {
  if (col.length === 0) return 0;
  let i = col.length - 1;
  while (i > 0 && fcStacks(col[i]!, col[i - 1]!)) i--;
  return i;
}

/** Cards in sorted runs on the columns: each column's run from its base card up, when two cards or more. */
export function fcSortedCards(cols: readonly (readonly number[])[]): number {
  let total = 0;
  for (const col of cols) {
    let n = col.length > 0 ? 1 : 0;
    while (n < col.length && fcStacks(col[n]!, col[n - 1]!)) n++;
    if (n >= 2) total += n;
  }
  return total;
}

export function fcHomeCount(state: Pick<FcState, "home">): number {
  return state.home[0]! + state.home[1]! + state.home[2]! + state.home[3]!;
}

/** The most cards one move may carry: (free cells + 1) × 2^(empty columns), one empty column fewer when moving into one. */
export function fcCapacity(cells: readonly number[], cols: readonly (readonly number[])[], toEmpty: boolean): number {
  let freeCells = 0;
  for (const c of cells) if (c === NO_CARD) freeCells++;
  let empty = 0;
  for (const col of cols) if (col.length === 0) empty++;
  if (toEmpty) empty = Math.max(0, empty - 1);
  return (freeCells + 1) * (1 << empty);
}

function canHome(home: readonly number[], card: number): boolean {
  return home[suitOf(card)] === rankOf(card) - 1;
}

/** Safe to send home by itself: aces and twos, or a card whose lower opposite-colour cards are all home. */
function safeHome(home: readonly number[], card: number): boolean {
  if (!canHome(home, card)) return false;
  const r = rankOf(card);
  if (r <= 2) return true;
  const red = isRed(card);
  for (let s = 0; s < 4; s++) {
    const sRed = s === 1 || s === 2;
    if (sRed !== red && home[s]! < r - 1) return false;
  }
  return true;
}

/** The cards a move would take from `from` at `index` (column runs only from a sorted run), or null. */
function moving(state: FcState, from: number, index: number): number[] | null {
  if (from >= 0 && from < FC_COLS) {
    const col = state.cols[from]!;
    if (index < 0 || index >= col.length) return null;
    if (index < fcRunStart(col)) return null;
    return col.slice(index);
  }
  if (from >= FC_PILE_CELL && from < FC_PILE_CELL + FC_CELLS) {
    const card = state.cells[from - FC_PILE_CELL]!;
    return card === NO_CARD ? null : [card];
  }
  return null;
}

/** Whether the move from `from` at `index` to pile `to` is legal (cells: that cell must be empty). */
export function fcLegal(state: FcState, from: number, index: number, to: number): boolean {
  const cards = moving(state, from, index);
  if (!cards || from === to) return false;
  const first = cards[0]!;
  if (to === FC_PILE_HOME) return cards.length === 1 && canHome(state.home, first);
  if (to >= FC_PILE_CELL && to < FC_PILE_CELL + FC_CELLS) return cards.length === 1 && state.cells[to - FC_PILE_CELL] === NO_CARD;
  if (to < 0 || to >= FC_COLS) return false;
  const dest = state.cols[to]!;
  if (dest.length === 0) {
    // A whole column into an empty one changes nothing.
    if (from < FC_COLS && index === 0) return false;
    return cards.length <= fcCapacity(state.cells, state.cols, true);
  }
  return fcStacks(first, dest[dest.length - 1]!) && cards.length <= fcCapacity(state.cells, state.cols, false);
}

/**
 * A tap's destination: home for a single card that can go; else a column it builds on (the next columns round
 * from its own); else an empty column (never a whole column); else a free cell for a single card. -1: none.
 */
export function fcBestTarget(state: FcState, from: number, index: number): number {
  const cards = moving(state, from, index);
  if (!cards) return -1;
  if (fcLegal(state, from, index, FC_PILE_HOME)) return FC_PILE_HOME;
  const startCol = from < FC_COLS ? from + 1 : 0;
  for (let k = 0; k < FC_COLS; k++) {
    const c = (startCol + k) % FC_COLS;
    if (state.cols[c]!.length > 0 && fcLegal(state, from, index, c)) return c;
  }
  for (let k = 0; k < FC_COLS; k++) {
    const c = (startCol + k) % FC_COLS;
    if (state.cols[c]!.length === 0 && fcLegal(state, from, index, c)) return c;
  }
  if (from < FC_COLS && cards.length === 1) {
    for (let i = 0; i < FC_CELLS; i++) if (state.cells[i] === NO_CARD) return FC_PILE_CELL + i;
  }
  return -1;
}

/** Sends every safe card home (column tops and free cells) until none is left; counts them (rev 3: keeps them for the art). */
function autoHome(state: FcState): void {
  const fly: number[] | null = state.rev >= FC_REV_EASY ? [] : null;
  let moved = true;
  while (moved) {
    moved = false;
    for (let c = 0; c < FC_COLS; c++) {
      const col = state.cols[c]!;
      const top = col[col.length - 1];
      if (top !== undefined && safeHome(state.home, top)) {
        fly?.push(top, c, col.length - 1);
        col.pop();
        state.home[suitOf(top)] = rankOf(top);
        state.autos++;
        moved = true;
      }
    }
    for (let i = 0; i < FC_CELLS; i++) {
      const card = state.cells[i]!;
      if (card !== NO_CARD && safeHome(state.home, card)) {
        fly?.push(card, FC_PILE_CELL + i, 0);
        state.cells[i] = NO_CARD;
        state.home[suitOf(card)] = rankOf(card);
        state.autos++;
        moved = true;
      }
    }
  }
  if (fly && fly.length > 0) {
    state.fly = fly;
    state.flyTick = state.tick;
  }
}

function clone(state: FcState): FcState {
  return { ...state, cols: state.cols.map((c) => c.slice()), cells: state.cells.slice(), home: state.home.slice() };
}

/**
 * Applies a legal move as a new state (the move counted, then safe cards home). A cell destination of any cell id
 * takes that cell when empty, else the first empty one. Returns null for an illegal move.
 */
export function fcApply(state: FcState, from: number, index: number, to: number): FcState | null {
  let dest = to;
  if (dest >= FC_PILE_CELL && dest < FC_PILE_CELL + FC_CELLS && state.cells[dest - FC_PILE_CELL] !== NO_CARD) {
    dest = -1;
    for (let i = 0; i < FC_CELLS; i++) if (state.cells[i] === NO_CARD) { dest = FC_PILE_CELL + i; break; }
  }
  if (dest < 0 || !fcLegal(state, from, index, dest)) return null;
  const next = clone(state);
  let cards: number[];
  if (from < FC_COLS) cards = next.cols[from]!.splice(index);
  else {
    cards = [next.cells[from - FC_PILE_CELL]!];
    next.cells[from - FC_PILE_CELL] = NO_CARD;
  }
  if (dest === FC_PILE_HOME) next.home[suitOf(cards[0]!)] = rankOf(cards[0]!);
  else if (dest >= FC_PILE_CELL) next.cells[dest - FC_PILE_CELL] = cards[0]!;
  else next.cols[dest]!.push(...cards);
  next.moves++;
  next.lastFrom = from;
  next.lastTo = dest;
  next.lastCount = cards.length;
  next.lastTick = next.tick;
  autoHome(next);
  return next;
}

/* ================================ The run ================================ */

/**
 * The deal for a deal seed: 52 cards dealt across the eight columns (four of seven, four of six); freecellRev 4 the 40
 * cards Ace to 10, in the order the same seeded shuffle puts them, five to a column.
 */
export function fcDealCols(dealSeed: number, rev = 1): number[][] {
  let { deck } = shuffledDeck(dealSeed);
  if (rev >= FC_REV_SHORT) deck = deck.filter((c) => rankOf(c) <= FC_SHORT_TOP_RANK);
  const cols: number[][] = Array.from({ length: FC_COLS }, () => []);
  deck.forEach((card, i) => cols[i % FC_COLS]!.push(card));
  return cols;
}

/** A state dealt from any deal seed and par (the bank script and the checks use it directly). */
export function fcInitFrom(dealSeed: number, par: number, deal = 0, rev = 1): FcState {
  const state: FcState = {
    tick: 0, rev, deal, par,
    cols: fcDealCols(dealSeed, rev), cells: [NO_CARD, NO_CARD, NO_CARD, NO_CARD], home: [0, 0, 0, 0],
    moves: 0, rejects: 0, autos: 0, acted: 0, ended: 0, finishTick: 0,
    lastFrom: -1, lastTo: -1, lastCount: 0, lastTick: 0, std: 1,
  };
  autoHome(state);
  return state;
}

/** The bank entry a seed deals (the seed is the bank index; any integer maps onto the bank; rev 4 its own bank). */
export function fcDealOf(seed: number, rev = 1): { index: number; dealSeed: number; par: number } {
  const bank = rev >= FC_REV_SHORT ? FC_DEALS_V4 : FC_DEALS;
  const n = bank.length;
  const index = ((Math.trunc(seed) % n) + n) % n;
  const [dealSeed, par] = bank[index]!;
  return { index, dealSeed, par };
}

function init(seed: number): FcState {
  const d = fcDealOf(seed);
  return fcInitFrom(d.dealSeed, d.par, d.index);
}

function initUndo(seed: number, rev: number): FcState {
  const d = fcDealOf(seed, rev);
  const state = { ...fcInitFrom(d.dealSeed, d.par, d.index, rev), hist: [], undos: 0, resets: 0, note: 0, noteNeed: 0, noteCells: 0, noteTick: 0 };
  return { ...state, start: fcPack(state) };
}

function initV2(seed: number): FcState {
  return initUndo(seed, FC_REV_UNDO);
}

function initV3(seed: number): FcState {
  return initUndo(seed, FC_REV_EASY);
}

function initV4(seed: number): FcState {
  return initUndo(seed, FC_REV_SHORT);
}

function step(state: FcState, input: ArcadeInputEvent | null): FcState {
  if (state.ended) return state;
  let next: FcState = { ...state, tick: state.tick + 1 };
  if (input && (input.k === FC_INPUT_TAP || input.k === FC_INPUT_MOVE)) {
    next.acted = 1;
    const to = input.k === FC_INPUT_TAP ? fcBestTarget(next, input.a, input.b) : input.c;
    const moved = to < 0 ? null : fcApply(next, input.a, input.b, to);
    if (moved) next = moved;
    else next.rejects++;
  }
  if (fcAllHome(next)) {
    next.ended = 1;
    next.finishTick = next.tick;
  } else if (next.tick >= FC_RUN_TICKS) next.ended = 2;
  return next;
}

/* ---- freecellRev 2: undo, reset and the refused move's note ---- */

/** A position packed as integers: the four cells, the four home tops, then each column's length and cards. */
export function fcPack(state: Pick<FcState, "cols" | "cells" | "home">): number[] {
  const out = [...state.cells, ...state.home];
  for (const col of state.cols) out.push(col.length, ...col);
  return out;
}

function unpack(packed: readonly number[]): Pick<FcState, "cols" | "cells" | "home"> {
  const cells = packed.slice(0, FC_CELLS);
  const home = packed.slice(FC_CELLS, FC_CELLS + 4);
  const cols: number[][] = [];
  let i = FC_CELLS + 4;
  for (let c = 0; c < FC_COLS; c++) {
    const n = packed[i++]!;
    cols.push(packed.slice(i, i + n));
    i += n;
  }
  return { cols, cells, home };
}

function samePacked(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Why a move of the cards at `from`/`index` was refused, when it is for want of free cells or empty columns: the
 * cards it would carry and the free cells it needed beyond those free now. A tap asks of every column the run builds
 * on (or an empty one); a drag of the column named. Null when capacity was not the reason.
 */
export function fcCapacityShort(state: FcState, from: number, index: number, to: number | null): { need: number; cells: number } | null {
  const cards = moving(state, from, index);
  if (!cards || cards.length < 2) return null;
  const first = cards[0]!;
  const short = (dest: number): { need: number; cells: number } | null => {
    if (dest < 0 || dest >= FC_COLS || dest === from) return null;
    const col = state.cols[dest]!;
    const toEmpty = col.length === 0;
    if (toEmpty && from < FC_COLS && index === 0) return null;
    if (!toEmpty && !fcStacks(first, col[col.length - 1]!)) return null;
    if (cards.length <= fcCapacity(state.cells, state.cols, toEmpty)) return null;
    let free = 0;
    for (const c of state.cells) if (c === NO_CARD) free++;
    let empty = 0;
    for (const c of state.cols) if (c.length === 0) empty++;
    if (toEmpty) empty = Math.max(0, empty - 1);
    const per = 1 << empty;
    return { need: cards.length, cells: Math.ceil(cards.length / per) - 1 - free };
  };
  if (to !== null) return short(to);
  let best: { need: number; cells: number } | null = null;
  for (let c = 0; c < FC_COLS; c++) {
    const s = short(c);
    if (s && (!best || s.cells < best.cells)) best = s;
  }
  return best;
}

/** The toast for a refused move's note ("Need a free cell to move 2 cards"); "" for none. */
export function fcNoteText(state: Pick<FcState, "note" | "noteNeed" | "noteCells">): string {
  if (state.note !== 1) return "";
  const n = state.noteNeed ?? 0;
  const k = state.noteCells ?? 0;
  return k <= 1 ? `Need a free cell to move ${n} cards` : `Need ${k} free cells to move ${n} cards`;
}

function stepV2(state: FcState, input: ArcadeInputEvent | null): FcState {
  if (state.ended) return state;
  let next: FcState = { ...state, tick: state.tick + 1 };
  if (input && (input.k === FC_INPUT_TAP || input.k === FC_INPUT_MOVE)) {
    next.acted = 1;
    const to = input.k === FC_INPUT_TAP ? fcBestTarget(next, input.a, input.b) : input.c;
    const moved = to < 0 ? null : fcApply(next, input.a, input.b, to);
    if (moved) next = { ...moved, hist: [...(state.hist ?? []), fcPack(state)] };
    else {
      next.rejects++;
      const short = fcCapacityShort(next, input.a, input.b, input.k === FC_INPUT_TAP ? null : input.c);
      if (short) next = { ...next, note: 1, noteNeed: short.need, noteCells: short.cells, noteTick: next.tick };
    }
  } else if (input && input.k === FC_INPUT_UNDO) {
    next.acted = 1;
    const hist = state.hist ?? [];
    if (hist.length > 0) {
      next = { ...next, ...unpack(hist[hist.length - 1]!), hist: hist.slice(0, -1), moves: next.moves + 1, undos: (next.undos ?? 0) + 1 };
      if (next.fly) next.fly = [];
      next.lastFrom = -1;
      next.lastTo = -1;
      next.lastCount = 0;
      next.lastTick = next.tick;
    }
  } else if (input && input.k === FC_INPUT_RESET) {
    next.acted = 1;
    const now = fcPack(state);
    if (state.start && !samePacked(now, state.start)) {
      next = { ...next, ...unpack(state.start), hist: [...(state.hist ?? []), now], moves: next.moves + 1, resets: (next.resets ?? 0) + 1 };
      if (next.fly) next.fly = [];
      next.lastFrom = -1;
      next.lastTo = -1;
      next.lastCount = 0;
      next.lastTick = next.tick;
    }
  }
  if (fcAllHome(next)) {
    next.ended = 1;
    next.finishTick = next.tick;
  } else if (next.tick >= FC_RUN_TICKS) next.ended = 2;
  return next;
}

/* ================================ Scoring ================================ */

export function fcCoreUnits(state: FcState): number {
  return 2 * fcHomeCount(state) + fcSortedCards(state.cols);
}

/** The parts: the core (full at all 52 home on revs 1–2, FC_CORE_UNITS_V3 on rev 3), par (finished) and speed (finished). */
export function freecellStdParts(state: FcState): StdPart[] | null {
  if (!state || !state.std) return null;
  const home = fcHomeCount(state);
  const sorted = fcSortedCards(state.cols);
  const units = 2 * home + sorted;
  const done = state.ended === 1;
  const r = state.rev ?? 1;
  const short = r >= FC_REV_SHORT;
  // Rev 4: par 0 at 1.5 × par (in halves, so the line is whole numbers).
  const par = !done ? 0 : short ? stdSpeed(FC_PAR_MAX_V4, 2 * state.moves, 2 * state.par, 3 * state.par) : stdSpeed(FC_PAR_MAX, state.moves, state.par, 2 * state.par);
  const speed = done ? stdSpeed(short ? FC_SPEED_MAX_V4 : FC_SPEED_MAX, state.finishTick, fcSpeedFullFor(state.rev) * 60, FC_RUN_TICKS) : 0;
  const spec = r >= FC_REV_SHORT ? FC_STD_SPEC : r >= FC_REV_EASY ? FC_STD_SPEC_V3 : FC_STD_SPEC_V1;
  return [
    stdPart(spec, "core", stdLine(short ? FC_CORE_MAX_V4 : FC_CORE_MAX, units, fcCoreUnitsFor(state.rev)), `${home} home · ${sorted} in sorted runs`),
    stdPart(spec, "par", par, done ? `${state.moves} moves, par ${state.par}` : "not finished"),
    stdPart(spec, "speed", speed, done ? `finished in ${(state.finishTick / 60).toFixed(1)} s` : "not finished"),
  ];
}

export function freecellScore(state: FcState): number {
  return stdScore(freecellStdParts(state) ?? [], Boolean(state.acted));
}

/** For the skill-band tool: units the core units, points the core, bonus par and speed. */
export function freecellBandParts(state: FcState): BandParts {
  const parts = freecellStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  return { units: fcCoreUnits(state), points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${fcHomeCount(state)} / ${fcCardsFor(state.rev)} home` };
}

/* ============================== Checkpoints ============================== */

export const FC_CHECKPOINT_INTERVAL = 300;
export const FC_CHECKPOINT_KEYS = ["tick", "moves", "home", "ended", "checksum"] as const;
export interface FcCheckpoint {
  tick: number;
  moves: number;
  home: number;
  ended: number;
  checksum: number;
}

export function fcCheckpoint(state: FcState): FcCheckpoint {
  const flat: number[] = [state.tick, state.moves, state.ended, ...state.home, ...state.cells];
  for (const col of state.cols) flat.push(100 + col.length, ...col);
  // freecellRev 2: the undo stack's depth too (rev 1 states have none, so their checksums are as before).
  if (state.hist) flat.push(200 + state.hist.length);
  return { tick: state.tick, moves: state.moves, home: fcHomeCount(state), ended: state.ended, checksum: hashInts(flat) };
}

/** freecellRev 1's game (no undo or reset): the replay of every rev-1 run. */
export const freecellGameV1: ArcadeGame<FcState, ArcadeInputEvent | null> = {
  key: "freecell",
  runTicks: FC_RUN_TICKS,
  init,
  step,
  isOver: (state) => state.ended !== 0,
  score: freecellScore,
  draw: () => {},
  inputRanges: [
    inputRange(FC_INPUT_TAP, [0, 11], [0, 51]),
    inputRange(FC_INPUT_MOVE, [0, 11], [0, 51], [0, 12]),
  ],
};

/** freecellRev 2's game: undo and reset. */
export const freecellGameV2: ArcadeGame<FcState, ArcadeInputEvent | null> = {
  ...freecellGameV1,
  init: initV2,
  step: stepV2,
  inputRanges: [...(freecellGameV1.inputRanges ?? []), inputRange(FC_INPUT_UNDO), inputRange(FC_INPUT_RESET)],
};

/** freecellRev 3's game: rev 2's play, the core full at FC_CORE_UNITS_V3, the auto moves kept for the art. */
export const freecellGameV3: ArcadeGame<FcState, ArcadeInputEvent | null> = { ...freecellGameV2, init: initV3 };

/** freecellRev 4's game: rev 3's play on the 40-card deal from its own bank. */
export const freecellGameV4: ArcadeGame<FcState, ArcadeInputEvent | null> = { ...freecellGameV2, init: initV4 };

/** The checks and tools that play "FreeCell" without a stamp mean rev 1: freecellGameV1. */
export const freecellGame = freecellGameV1;

export function freecellGameFor(rev?: number | null): ArcadeGame<FcState, ArcadeInputEvent | null> {
  const r = rev ?? 1;
  return r >= FC_REV_SHORT ? freecellGameV4 : r >= FC_REV_EASY ? freecellGameV3 : r >= FC_REV_UNDO ? freecellGameV2 : freecellGameV1;
}
