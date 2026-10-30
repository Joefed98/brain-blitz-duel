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
 */
import { inputRange, type ArcadeGame, type ArcadeInputEvent } from "../engine";
import { stdLine, stdPart, stdScore, stdSpeed, stdSum, type StdPart, type StdSpec } from "../arcadeStandard";
import { bandCurve, type BandParts } from "../scoreBands";
import { hashInts, isRed, NO_CARD, rankOf, shuffledDeck, suitOf } from "./cards";
import { FC_DEALS } from "./freecellDeals.data";

export const FC_REV = 1;
export const FC_COLS = 8;
export const FC_CELLS = 4;
/** Pile ids. */
export const FC_PILE_CELL = 8;
export const FC_PILE_HOME = 12;
export const FC_RUN_TICKS = 120 * 60;

/** Input kinds: a tap (best legal spot) and a drag (a named destination). */
export const FC_INPUT_TAP = 1;
export const FC_INPUT_MOVE = 2;

/* ---- Scoring (freecellRev 1) ---- */
export const FC_CORE_MAX = 140;
export const FC_PAR_MAX = 30;
export const FC_SPEED_MAX = 30;
/** Core units: two a card home, one a card in a sorted run on a column; all 52 home is 104. */
export const FC_CORE_UNITS = 104;
/** Speed is full by this many seconds (the near-perfect skill-band median finish, measured: docs/arcade-standard/freecell.md). */
export const FC_SPEED_FULL_S = 66;
/** The core's straight line (LIVE_BANDS and arcade-help-bands-check read it). */
export const FC_V1_BAND_CURVE = bandCurve([0, FC_CORE_UNITS], [0, FC_CORE_MAX]);

export const FC_STD_SPEC: StdSpec = {
  field: "freecellRev",
  rev: FC_REV,
  parts: [
    { key: "core", label: "Cards", max: FC_CORE_MAX, of: FC_CORE_UNITS, how: "a straight line: cards home full value, cards in sorted runs on the columns half value; full with all 52 home" },
    { key: "par", label: "Par moves", max: FC_PAR_MAX, of: 1, how: "finished only: full at the deal's par, 0 at twice par" },
    { key: "speed", label: "Speed", max: FC_SPEED_MAX, of: 1, how: `finished only: full by ${FC_SPEED_FULL_S} s, 0 at the buzzer` },
  ],
};

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

/** Sends every safe card home (column tops and free cells) until none is left; counts them. */
function autoHome(state: FcState): void {
  let moved = true;
  while (moved) {
    moved = false;
    for (let c = 0; c < FC_COLS; c++) {
      const col = state.cols[c]!;
      const top = col[col.length - 1];
      if (top !== undefined && safeHome(state.home, top)) {
        col.pop();
        state.home[suitOf(top)] = rankOf(top);
        state.autos++;
        moved = true;
      }
    }
    for (let i = 0; i < FC_CELLS; i++) {
      const card = state.cells[i]!;
      if (card !== NO_CARD && safeHome(state.home, card)) {
        state.cells[i] = NO_CARD;
        state.home[suitOf(card)] = rankOf(card);
        state.autos++;
        moved = true;
      }
    }
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

/** The deal for a bank index: 52 cards dealt across the eight columns (four of seven, four of six). */
export function fcDealCols(dealSeed: number): number[][] {
  const { deck } = shuffledDeck(dealSeed);
  const cols: number[][] = Array.from({ length: FC_COLS }, () => []);
  deck.forEach((card, i) => cols[i % FC_COLS]!.push(card));
  return cols;
}

/** A state dealt from any deal seed and par (the bank script and the checks use it directly). */
export function fcInitFrom(dealSeed: number, par: number, deal = 0): FcState {
  const state: FcState = {
    tick: 0, rev: FC_REV, deal, par,
    cols: fcDealCols(dealSeed), cells: [NO_CARD, NO_CARD, NO_CARD, NO_CARD], home: [0, 0, 0, 0],
    moves: 0, rejects: 0, autos: 0, acted: 0, ended: 0, finishTick: 0,
    lastFrom: -1, lastTo: -1, lastCount: 0, lastTick: 0, std: 1,
  };
  autoHome(state);
  return state;
}

/** The bank entry a seed deals (the seed is the bank index; any integer maps onto the bank). */
export function fcDealOf(seed: number): { index: number; dealSeed: number; par: number } {
  const n = FC_DEALS.length;
  const index = ((Math.trunc(seed) % n) + n) % n;
  const [dealSeed, par] = FC_DEALS[index]!;
  return { index, dealSeed, par };
}

function init(seed: number): FcState {
  const d = fcDealOf(seed);
  return fcInitFrom(d.dealSeed, d.par, d.index);
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
  if (fcHomeCount(next) === 52) {
    next.ended = 1;
    next.finishTick = next.tick;
  } else if (next.tick >= FC_RUN_TICKS) next.ended = 2;
  return next;
}

/* ================================ Scoring ================================ */

export function fcCoreUnits(state: FcState): number {
  return 2 * fcHomeCount(state) + fcSortedCards(state.cols);
}

/** freecellRev 1's parts: the core, par (finished) and speed (finished). */
export function freecellStdParts(state: FcState): StdPart[] | null {
  if (!state || !state.std) return null;
  const home = fcHomeCount(state);
  const sorted = fcSortedCards(state.cols);
  const units = 2 * home + sorted;
  const done = state.ended === 1;
  const par = done ? stdSpeed(FC_PAR_MAX, state.moves, state.par, 2 * state.par) : 0;
  const speed = done ? stdSpeed(FC_SPEED_MAX, state.finishTick, FC_SPEED_FULL_S * 60, FC_RUN_TICKS) : 0;
  return [
    stdPart(FC_STD_SPEC, "core", stdLine(FC_CORE_MAX, units, FC_CORE_UNITS), `${home} home · ${sorted} in sorted runs`),
    stdPart(FC_STD_SPEC, "par", par, done ? `${state.moves} moves, par ${state.par}` : "not finished"),
    stdPart(FC_STD_SPEC, "speed", speed, done ? `finished in ${(state.finishTick / 60).toFixed(1)} s` : "not finished"),
  ];
}

export function freecellScore(state: FcState): number {
  return stdScore(freecellStdParts(state) ?? [], Boolean(state.acted));
}

/** For the skill-band tool: units the core units, points the core, bonus par and speed. */
export function freecellBandParts(state: FcState): BandParts {
  const parts = freecellStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  return { units: fcCoreUnits(state), points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${fcHomeCount(state)} / 52 home` };
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
  return { tick: state.tick, moves: state.moves, home: fcHomeCount(state), ended: state.ended, checksum: hashInts(flat) };
}

export const freecellGame: ArcadeGame<FcState, ArcadeInputEvent | null> = {
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

export function freecellGameFor(_rev?: number | null): ArcadeGame<FcState, ArcadeInputEvent | null> {
  return freecellGame;
}
