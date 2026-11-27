/**
 * Pyramid (Cards & Board, 1 Nov 2026; docs/arcade-standard/pyramid.md): a 90-second run on the arcade engine.
 *
 * A 28-card pyramid (seven rows, the bottom row of seven uncovered), a 24-card stock and a waste pile. Remove uncovered
 * cards in pairs that add to 13 (Q+A, J+2 … 7+6); a King goes alone. The waste's top card pairs too. One pass through
 * the stock (the waste is never turned back over). Undo (back to the position before the last action, unlimited) and
 * Reset (back to the deal, itself undoable); the clock runs on.
 *
 * The deal (pyDeal): built in the sim from the seed together with a witness line that clears the pyramid with at least
 * ten pairs of two pyramid cards (2–4 Kings and every other card in pyramid pairs, placed by removing random free
 * positions in a legal order with ranks and suits drawn to fit), proved by playing the witness through the sim, and kept
 * only when no quick player with no plan clears it (pyGreedyClears); otherwise rebuilt from the next PRNG state. So
 * every dealt seed lets perfect play reach 200 and needs the right order (scripts/cards/pyramidSolver.ts re-proves
 * samples in cards-solitaire-check). Same deal for everyone.
 *
 * Scoring (pyramidRev 1, the arcade standard; 200 in all; Joe's split, 2 Nov 2026): the core 120 on a straight line
 * over the 28 pyramid cards removed; cleared 10; speed 50 (cleared only: full by 20 s, the flawless pace, 0 at the
 * buzzer), so the players who clear are told apart by how fast; pyramid pairs 20 (2 for each pair of two pyramid cards,
 * up to 10).
 *
 * pyramidRev 2 (7 Nov 2026, scoring audit issue 6; docs/arcade-standard/pyramid.md): the same deals and play; the points
 * locked behind a clear (clear 10 + speed 50) split players who just missed it from those who cleared, so half the speed
 * moves onto the cards: the core 140 (5 a card), cleared 15, speed 25 (whole-number maths, stdSpeedInt), pyramid pairs
 * 20. A clear always scores at least as much as any run that misses one (27 removed and every pair: 135 + 20 = 155; a
 * clear at the buzzer with no pyramid pairs: 140 + 15 = 155). Rev 1 runs play and score as before.
 *
 * pyramidRev 3 (15 Nov 2026, the game reviews; Joe): a dead end no longer ends the run while Undo can take the player out
 * of it. The run ends only on a clear, at the buzzer, or stuck with nothing to undo (`pyTrulyStuck`: no action left in
 * the history, which is the deal itself). The same deals and parts as rev 2; rev 1 and 2 runs replay and score as before.
 *
 * pyramidRev 4 (D6, 23 Nov 2026; Joe's Decision 1 A, plan section 8.2). Normal: rev 3's deals, play and parts with Speed
 * full by 22 s (PY_V4_SPEED_FULL_S; was 20 s, the flawless pace: the realistic elite's clears take 18–23 s, median 20.5),
 * so the elite under human limits reaches 200 on half its runs (25 % before). Level deals: the level is the pyramid's
 * height. A rev-4 level state carries `rows` (Easy 6, Hard 8, Expert 9; 21, 36 and 45 cards, the rest in the stock);
 * every rule reads the state's shape (pyCardsOf, pyStockPileOf, pyWastePileOf: the stock and waste taps are the card
 * count and one more, 28 and 29 on seven rows, so every earlier state reads exactly as before). PY_LEVEL_RULES_V4 below.
 */
import { inputRange, rngBelow, type ArcadeGame, type ArcadeInputEvent } from "../engine";
import { stdEach, stdLine, stdPart, stdScore, stdSpeed, stdSpeedInt, stdSum, type StdPart, type StdSpec } from "../arcadeStandard";
import { bandCurve, type BandParts } from "../scoreBands";
import { cardOf, hashInts, rankOf } from "./cards";

/**
 * The dealt revision (rev 4: D6's, Speed full by 22 s and the levels' rows; rev 3: a dead end waits for Undo; rev 2: more
 * of the 200 on the cards); rev 1 runs replay on pyramidGameV1.
 */
export const PY_REV = 4;
export const PY_REV_SHARE = 2;
/** pyramidRev 3: stuck ends the run only with nothing to undo. */
export const PY_REV_UNDO_OUT = 3;
/** pyramidRev 4 (D6, 23 Nov 2026): Normal's Speed full by 22 s; a level deal's pyramid has the level's rows. */
export const PY_REV_D6 = 4;
export const PY_REV_ROWS = PY_REV_D6;
/** pyramidRev 4's Normal: Speed full by 22 s (20 s before). */
export const PY_V4_SPEED_FULL_S = 22;
/** Seven rows: every state before pyramidRev 4, and Normal's. */
export const PY_ROWS = 7;
export const PY_CARDS = 28;
export const PY_STOCK = 24;
/** One pass through the stock: the waste is never turned back over (Joe, 1 Nov 2026, before pyramidRev 1 shipped). */
export const PY_PASSES = 1;
/** Input: a tap, `a` a pyramid card (0–27), PY_STOCK_PILE or PY_WASTE_PILE. */
export const PY_INPUT_TAP = 1;
export const PY_INPUT_UNDO = 3;
export const PY_INPUT_RESET = 4;
export const PY_STOCK_PILE = 28;
export const PY_WASTE_PILE = 29;
export const PY_RUN_TICKS = 90 * 60;

/* ---- Scoring (pyramidRev 1) ---- */
export const PY_CORE_MAX = 120;
export const PY_CLEAR_MAX = 10;
export const PY_SPEED_MAX = 50;
export const PY_SPEED_FULL_S = 20;
export const PY_PAIR_EACH = 2;
export const PY_PAIR_MAX = 20;
export const PY_PAIR_FULL = 10;
/** The core is full with the pyramid cleared. */
export const PY_CORE_FULL = PY_CARDS;
export const PY_V1_BAND_CURVE = bandCurve([0, PY_CORE_FULL], [0, PY_CORE_MAX]);

/* ---- Scoring (pyramidRev 2: half the speed moved onto the cards) ---- */
export const PY_V2_CORE_MAX = 140;
export const PY_V2_CLEAR_MAX = 15;
export const PY_V2_SPEED_MAX = 25;
export const PY_V2_BAND_CURVE = bandCurve([0, PY_CORE_FULL], [0, PY_V2_CORE_MAX]);

/** Cards cleared towards the core: the pyramid cards removed. */
export function pyCoreUnits(state: Pick<PyState, "removed">): number {
  return state.removed;
}

/** pyramidRev 2 and 3's spec (stored rounds and the levels before D6: the reveal). */
export const PY_STD_SPEC_V3: StdSpec = {
  field: "pyramidRev",
  // The stamp rooms dealt on these parts: pyramidRev 3 from 15 Nov 2026 until D6 (rev 2 scores on them too).
  rev: PY_REV_UNDO_OUT,
  parts: [
    { key: "core", label: "Pyramid cards", max: PY_V2_CORE_MAX, of: PY_CORE_FULL, item: "card", how: "remove the 28 pyramid cards, each worth the same" },
    { key: "clear", label: "Cleared", max: PY_V2_CLEAR_MAX, of: 1, how: "remove all 28" },
    { key: "speed", label: "Speed", max: PY_V2_SPEED_MAX, of: 1, how: `clear it within ${PY_SPEED_FULL_S} s for all of it, falling to 0 at the buzzer` },
    { key: "pairs", label: "Pyramid pairs", max: PY_PAIR_MAX, of: PY_PAIR_FULL, item: "pair", how: "2 for each pair made of two pyramid cards" },
  ],
};

/** pyramidRev 4's spec (what rooms deal: the help, LIVE_BANDS, the reveal): rev 3's parts, Speed full by 22 s. */
export const PY_STD_SPEC: StdSpec = {
  ...PY_STD_SPEC_V3,
  rev: PY_REV,
  parts: PY_STD_SPEC_V3.parts.map((p) => (p.key === "speed" ? { ...p, how: `clear it within ${PY_V4_SPEED_FULL_S} s for all of it, falling to 0 at the buzzer` } : p)),
};

/** pyramidRev 1's spec (stored rounds). */
export const PY_STD_SPEC_V1: StdSpec = {
  field: "pyramidRev",
  rev: 1,
  parts: [
    { key: "core", label: "Pyramid cards", max: PY_CORE_MAX, of: PY_CORE_FULL, item: "card", how: "remove the 28 pyramid cards, each worth the same" },
    { key: "clear", label: "Cleared", max: PY_CLEAR_MAX, of: 1, how: "remove all 28" },
    { key: "speed", label: "Speed", max: PY_SPEED_MAX, of: 1, how: `clear it within ${PY_SPEED_FULL_S} s for all of it, falling to 0 at the buzzer` },
    { key: "pairs", label: "Pyramid pairs", max: PY_PAIR_MAX, of: PY_PAIR_FULL, item: "pair", how: "2 for each pair made of two pyramid cards" },
  ],
};

export interface PyState {
  tick: number;
  rev: number;
  deal: number;
  /** The 28 pyramid cards (row by row from the top) and which are gone (1). */
  tab: number[];
  gone: number[];
  /** The stock and waste: the stock's cards still in play, in order; [0, pos) is the waste (top pile[pos - 1]). */
  pile: number[];
  pos: number;
  /** The pass through the stock (1–3). */
  pass: number;
  /** The selected card: a pyramid index, PY_WASTE_PILE, or -1. */
  sel: number;
  removed: number;
  ppPairs: number;
  pairs: number;
  kings: number;
  draws: number;
  rejects: number;
  acted: number;
  /** 0 running, 1 cleared, 2 the buzzer, 3 no move left. */
  ended: number;
  finishTick: number;
  /** Positions before each action still to undo (pyPack), the deal's position, undos and resets made. */
  hist: number[][];
  start: number[];
  undos: number;
  resets: number;
  /** Display only: the last removal (cards, -1 for none) and its tick. */
  lastA: number;
  lastB: number;
  lastTick: number;
  std: number;
  /**
   * The difficulty levels (15 Nov 2026; level deals only): the level (PY_LV_*), the passes through the stock allowed
   * (Easy 3), hints asked for and the last one's tick.
   */
  lv?: number;
  passes?: number;
  hints?: number;
  hintTick?: number;
  /** pyramidRev 4's level deals (D6): the pyramid's rows (absent: seven). */
  rows?: number;
}

/** The pyramid's rows (seven unless a pyramidRev 4 level deal says otherwise). */
export function pyRowsOf(s: { rows?: number }): number {
  return s.rows ?? PY_ROWS;
}
/** The cards in a pyramid of `rows` rows. */
export function pyCardsIn(rows: number): number {
  return (rows * (rows + 1)) / 2;
}
/** A state's pyramid cards (28 on seven rows). */
export function pyCardsOf(s: { rows?: number }): number {
  return pyCardsIn(pyRowsOf(s));
}
/** The stock's tap: the pyramid's card count (PY_STOCK_PILE, 28, on seven rows). */
export function pyStockPileOf(s: { rows?: number }): number {
  return pyCardsOf(s);
}
/** The waste's tap: one more (PY_WASTE_PILE, 29, on seven rows). */
export function pyWastePileOf(s: { rows?: number }): number {
  return pyCardsOf(s) + 1;
}

/** A pyramid card's row (0 at the top) and place in it. */
export function pyRowOf(i: number): { row: number; pos: number } {
  let row = 0;
  while (((row + 1) * (row + 2)) / 2 <= i) row++;
  return { row, pos: i - (row * (row + 1)) / 2 };
}

export function pyIndex(row: number, pos: number): number {
  return (row * (row + 1)) / 2 + pos;
}

/** The two cards covering pyramid card `i` (none on the bottom row) in a pyramid of `rows` rows. */
export function pyCoveredBy(i: number, rows = PY_ROWS): number[] {
  const { row, pos } = pyRowOf(i);
  if (row >= rows - 1) return [];
  return [pyIndex(row + 1, pos), pyIndex(row + 1, pos + 1)];
}

const COVERS = Array.from({ length: PY_CARDS }, (_, i) => pyCoveredBy(i));
const COVERS_BY_ROWS = new Map<number, number[][]>([[PY_ROWS, COVERS]]);
function coversOf(rows: number): number[][] {
  let c = COVERS_BY_ROWS.get(rows);
  if (!c) COVERS_BY_ROWS.set(rows, (c = Array.from({ length: pyCardsIn(rows) }, (_, i) => pyCoveredBy(i, rows))));
  return c;
}

export function pyFree(state: Pick<PyState, "gone"> & { rows?: number }, i: number): boolean {
  const covers = state.rows === undefined ? COVERS : coversOf(state.rows);
  if (i < 0 || i >= covers.length || state.gone[i]) return false;
  for (const c of covers[i]!) if (!state.gone[c]) return false;
  return true;
}

export function pyWasteTop(state: Pick<PyState, "pile" | "pos">): number {
  return state.pos > 0 ? state.pile[state.pos - 1]! : -1;
}

/** The card a selection or tap target stands for (-1 for none). */
export function pyCardAt(state: PyState, a: number): number {
  if (a === pyWastePileOf(state)) return pyWasteTop(state);
  if (a >= 0 && a < pyCardsOf(state)) return pyFree(state, a) ? state.tab[a]! : -1;
  return -1;
}

/** Whether the stock can still be drawn or turned back over. */
export function pyCanDraw(state: PyState): boolean {
  return state.pos < state.pile.length || (state.pass < (state.passes ?? PY_PASSES) && state.pile.length > 0);
}

/** Every removal open now: [a] for a King, [a, b] for a pair (b may be the waste). */
export function pyMoves(state: PyState): number[][] {
  const out: number[][] = [];
  const free: number[] = [];
  const cards = pyCardsOf(state);
  const waste = cards + 1;
  for (let i = 0; i < cards; i++) if (pyFree(state, i)) free.push(i);
  const w = pyWasteTop(state);
  for (const i of free) if (rankOf(state.tab[i]!) === 13) out.push([i]);
  for (let x = 0; x < free.length; x++)
    for (let y = x + 1; y < free.length; y++) if (rankOf(state.tab[free[x]!]!) + rankOf(state.tab[free[y]!]!) === 13) out.push([free[x]!, free[y]!]);
  if (w >= 0) {
    if (rankOf(w) === 13) out.push([waste]);
    for (const i of free) if (rankOf(state.tab[i]!) + rankOf(w) === 13) out.push([i, waste]);
  }
  return out;
}

export function pyStuck(state: PyState): boolean {
  return !pyCanDraw(state) && pyMoves(state).length === 0;
}

/** Stuck with no way out: no move, no draw and nothing to undo (pyramidRev 3's end; Reset from the deal is refused). */
export function pyTrulyStuck(state: PyState): boolean {
  return pyStuck(state) && state.hist.length === 0;
}

/** Why the board shows a dead-end note (display only): "wait" a dead end Undo can leave (pyramidRev 3), "over" the run ended stuck. */
export function pyDeadEnd(state: PyState): "wait" | "over" | null {
  if (state.ended === 3) return "over";
  if (!state.ended && (state.rev ?? 1) >= PY_REV_UNDO_OUT && pyStuck(state)) return "wait";
  return null;
}

/** A built deal: the pyramid's 28 cards, the stock's 24 in turning order, and the witness taps that clear it. */
export interface PyDeal {
  tab: number[];
  stock: number[];
  witness: number[];
  /** pyramidRev 4's level deals: the pyramid's rows (absent: seven). */
  rows?: number;
}

/** pyramidRev 4's deal shape (D6): the rows, and the Kings the pyramid may hold (one picked from the seed). */
export interface PyShape {
  rows: number;
  kings: readonly number[];
}

/** One attempt at a deal from the PRNG state `rng`; null when the plan ran into a dead end. */
function buildAttempt(rng0: number, kingsMin = 2, kingsSpan = 3, shape?: PyShape): { deal: PyDeal | null; rng: number } {
  let rng = rng0;
  const rand = (n: number) => {
    const r = rngBelow(rng, n);
    rng = r.state;
    return r.value;
  };
  // Two to four Kings in the pyramid and every other card in pyramid pairs (one left for the waste when the count is
  // odd): the pyramid is a puzzle in full view whose pairs only all come out in the right order, so the face-down stock
  // is a bonus, never the lottery that decides a clear.
  const CARDS = shape ? pyCardsIn(shape.rows) : PY_CARDS;
  const rows = shape?.rows;
  const kings = shape ? shape.kings[rand(shape.kings.length)]! : kingsMin + rand(kingsSpan);
  const pairs = (CARDS - kings) >> 1;
  const left = { k: kings, p: pairs, w: CARDS - kings - 2 * pairs };
  // Cards still unused: suits free per rank.
  const suitsLeft: number[][] = Array.from({ length: 14 }, (_, r) => (r === 0 ? [] : [0, 1, 2, 3]));
  const take = (rank: number) => {
    const list = suitsLeft[rank]!;
    const i = rand(list.length);
    const suit = list[i]!;
    list.splice(i, 1);
    return cardOf(suit, rank);
  };
  const gone = new Array<number>(CARDS).fill(0);
  const tab = new Array<number>(CARDS).fill(-1);
  type Ev = { kind: "k" | "p" | "w"; a: number; b: number; partner: number };
  const events: Ev[] = [];
  const shaped = rows === undefined ? { gone } : { gone, rows };
  for (let removed = 0; removed < CARDS; ) {
    const free: number[] = [];
    for (let i = 0; i < CARDS; i++) if (pyFree(shaped, i)) free.push(i);
    const options: ("k" | "p" | "w")[] = [];
    if (left.k > 0 && suitsLeft[13]!.length > 0) options.push("k");
    if (left.p > 0 && free.length >= 2) options.push("p", "p", "p");
    if (left.w > 0) options.push("w");
    if (options.length === 0) return { deal: null, rng };
    const kind = options[rand(options.length)]!;
    const pick = () => {
      const i = rand(free.length);
      const pos = free[i]!;
      free.splice(i, 1);
      return pos;
    };
    if (kind === "k") {
      const a = pick();
      tab[a] = take(13);
      gone[a] = 1;
      left.k--;
      removed++;
      events.push({ kind, a, b: -1, partner: -1 });
      continue;
    }
    // A rank pair (r, 13 - r) with a card of each still free.
    const types: number[] = [];
    for (let r = 1; r <= 12; r++) if (suitsLeft[r]!.length > 0 && suitsLeft[13 - r]!.length > (r === 13 - r ? 1 : 0)) types.push(r);
    if (types.length === 0) return { deal: null, rng };
    const r = types[rand(types.length)]!;
    if (kind === "p") {
      const a = pick();
      const b = pick();
      tab[a] = take(r);
      tab[b] = take(13 - r);
      gone[a] = 1;
      gone[b] = 1;
      left.p--;
      removed += 2;
      events.push({ kind, a, b, partner: -1 });
    } else {
      const a = pick();
      tab[a] = take(r);
      gone[a] = 1;
      left.w--;
      removed++;
      events.push({ kind, a, b: -1, partner: take(13 - r) });
    }
  }
  // The stock (one pass): each waste partner in the line's order after 0–3 other cards, the rest after. A partner shows
  // on the waste once and is buried by the next draw, so its pyramid card must be uncovered in time.
  const fillers: number[] = [];
  for (let rank = 1; rank <= 13; rank++) for (const suit of suitsLeft[rank]!) fillers.push(cardOf(suit, rank));
  for (let i = fillers.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    const t = fillers[i]!;
    fillers[i] = fillers[j]!;
    fillers[j] = t;
  }
  // The stock: each waste partner (at most one) after a seeded gap, the stock's Kings among the first cards.
  const kingsLeft = fillers.filter((c) => rankOf(c) === 13);
  const plain = fillers.filter((c) => rankOf(c) !== 13);
  const partners = events.filter((ev) => ev.kind === "w").length;
  const kingGap = kingsLeft.map(() => rand(Math.max(1, partners)));
  const stock: number[] = [];
  let w = 0;
  for (const ev of events) {
    if (ev.kind !== "w") continue;
    const gap = Math.min(plain.length, rand(4));
    for (let g = 0; g < gap; g++) stock.push(plain.pop()!);
    kingsLeft.forEach((k, i) => {
      if (kingGap[i] === w) stock.push(k);
    });
    stock.push(ev.partner);
    w++;
  }
  // pyramidRev 4: with no waste partner the stock's Kings go at seeded places among the rest (before it, a deal with
  // no waste partner left them out of the stock; kept for the deals already made).
  if (shape && partners === 0) {
    for (const k of kingsLeft) plain.splice(rand(plain.length + 1), 0, k);
  }
  while (plain.length) stock.push(plain.pop()!);
  const witness: number[] = [];
  let sim = pyStateOf(rows === undefined ? { tab, stock, witness: [] } : { tab, stock, witness: [], rows }, 0);
  const STOCK = CARDS;
  const WASTE = CARDS + 1;
  const tap = (a: number): boolean => {
    const r = pyApply(sim, a);
    if (!r) return false;
    sim = r.state;
    witness.push(a);
    return true;
  };
  for (const ev of events) {
    if (ev.kind === "k") {
      if (!tap(ev.a)) return { deal: null, rng };
    } else if (ev.kind === "p") {
      if (!tap(ev.a) || !tap(ev.b)) return { deal: null, rng };
    } else {
      let guard = 0;
      while (pyWasteTop(sim) !== ev.partner) {
        if (++guard > 200 || !tap(STOCK)) return { deal: null, rng };
        if (pyWasteTop(sim) >= 0 && rankOf(pyWasteTop(sim)) === 13 && !tap(WASTE)) return { deal: null, rng };
      }
      if (!tap(ev.a) || !tap(WASTE)) return { deal: null, rng };
    }
  }
  return { deal: rows === undefined ? { tab, stock, witness } : { tab, stock, witness, rows }, rng };
}

/** Plays a witness through the sim's rules from the deal (no clock): the state it ends in. */
function proveDeal(deal: PyDeal): PyState {
  let s = pyStateOf(deal, 0);
  for (const a of deal.witness) {
    const r = pyApply(s, a);
    if (!r) return s;
    s = r.state;
  }
  return s;
}

/** The state after one removal (a King, or a pair's two taps), or null. */
function afterMove(s: PyState, move: readonly number[]): PyState | null {
  let t: PyState = { ...s, sel: -1 };
  for (const a of move) {
    const r = pyApply(t, a);
    if (!r) return null;
    t = r.state;
  }
  return t;
}

/** The most cards a line of `depth` removals in view takes, plus 0.3 for each free card it leaves. */
function lookAhead(s: PyState, depth: number): number {
  let free = 0;
  const cards = pyCardsOf(s);
  for (let i = 0; i < cards; i++) if (pyFree(s, i)) free++;
  let best = 0.3 * free;
  if (depth === 0) return best;
  for (const m of pyMoves(s)) {
    const t = afterMove(s, m);
    if (t) best = Math.max(best, m.length + lookAhead(t, depth - 1));
  }
  return best;
}

/**
 * A quick player with no plan (the deal filter, never the score): Kings at once, then the removal that `mode` likes
 * (0 the first pair seen, 1 the one uncovering most, 2 pairs with the waste first, 3 the best two-removal line in
 * view), drawing only when nothing pairs.
 * Whether it clears the pyramid.
 */
export function pyGreedyClears(deal: PyDeal, mode: number): boolean {
  let s = pyStateOf(deal, 0);
  const cards = pyCardsOf(s);
  const waste = cards + 1;
  for (let guard = 0; guard < 200; guard++) {
    if (s.removed === cards) return true;
    const moves = pyMoves(s);
    let move: number[] | null = null;
    const king = moves.find((m) => m.length === 1);
    if (king) move = king;
    else if (moves.length) {
      if (mode === 0) move = moves[0]!;
      else if (mode === 2) move = moves.find((m) => m.includes(waste)) ?? moves[0]!;
      else if (mode >= 3) {
        // 3: the best two-removal line in view; 4 and 5 (the difficulty levels' filters): the best three- and
        // four-removal lines.
        let best = -1;
        for (const m of moves) {
          const t = afterMove(s, m);
          const v = t ? m.length + lookAhead(t, mode - 2) : -1;
          if (v > best) {
            best = v;
            move = m;
          }
        }
      } else {
        let best = -1;
        for (const m of moves) {
          const gone = s.gone.slice();
          for (const a of m) if (a < cards) gone[a] = 1;
          let opened = 0;
          const after = s.rows === undefined ? { gone } : { gone, rows: s.rows };
          for (let j = 0; j < cards; j++) if (!s.gone[j] && !pyFree(s, j) && pyFree(after, j)) opened++;
          if (opened > best) {
            best = opened;
            move = m;
          }
        }
      }
    }
    if (move) {
      for (const a of move) {
        const r = pyApply(s, a);
        if (!r) return false;
        s = r.state;
      }
      continue;
    }
    const d = pyApply(s, cards);
    if (!d) return false;
    s = d.state;
  }
  return s.removed === cards;
}

/** Builds and proves the deal for `seed` (every attempt on one PRNG stream, so the same deal everywhere). */
export function pyBuildDeal(seed: number): PyDeal {
  let rng = (Math.trunc(seed) ^ 0x5a17c3) | 0;
  for (let attempt = 0; attempt < 4000; attempt++) {
    const out = buildAttempt(rng);
    rng = out.rng;
    if (!out.deal) continue;
    const end = proveDeal(out.deal);
    if (end.removed !== PY_CARDS || end.ppPairs < PY_PAIR_FULL) continue;
    // Deals that need a plan: none of the quick players (first pair, most uncovered, best two-removal line) clears them.
    if (pyGreedyClears(out.deal, 0) || pyGreedyClears(out.deal, 1) || pyGreedyClears(out.deal, 3)) continue;
    return out.deal;
  }
  throw new Error(`pyramid: no deal for seed ${seed}`);
}

const dealCache = new Map<number, PyDeal>();
/** The deal for `seed` (cached: the build is deterministic). */
export function pyDeal(seed: number): PyDeal {
  const key = Math.trunc(seed) | 0;
  let d = dealCache.get(key);
  if (!d) {
    d = pyBuildDeal(key);
    if (dealCache.size > 64) dealCache.clear();
    dealCache.set(key, d);
  }
  return d;
}

function pyStateOf(deal: PyDeal, seed: number, rev = 1): PyState {
  const s: PyState = {
    tick: 0, rev, deal: seed, tab: deal.tab.slice(), gone: new Array<number>(deal.rows === undefined ? PY_CARDS : pyCardsIn(deal.rows)).fill(0), pile: deal.stock.slice(), pos: 0, pass: 1,
    sel: -1, removed: 0, ppPairs: 0, pairs: 0, kings: 0, draws: 0, rejects: 0, acted: 0, ended: 0, finishTick: 0,
    hist: [], start: [], undos: 0, resets: 0, lastA: -1, lastB: -1, lastTick: 0, std: 1,
  };
  if (deal.rows !== undefined) s.rows = deal.rows;
  s.start = pyPack(s);
  return s;
}

/** The opening state for `seed` (pyramidRev 1 unless `rev` says otherwise; the deal is the same on every revision). */
export function pyInit(seed: number, rev = 1): PyState {
  return pyStateOf(pyDeal(seed), Math.trunc(seed) | 0, rev);
}

/* ---- Undo and Reset: a position packed as integers ---- */

export function pyPack(s: Pick<PyState, "gone" | "pile" | "pos" | "pass" | "removed" | "ppPairs" | "pairs" | "kings"> & { rows?: number }): number[] {
  if (s.rows !== undefined) {
    // pyramidRev 4: up to 45 cards, so the gone mask takes two words of 30 bits.
    let lo = 0;
    let hi = 0;
    const cards = pyCardsIn(s.rows);
    for (let i = 0; i < cards; i++) if (s.gone[i]) i < 30 ? (lo |= 1 << i) : (hi |= 1 << (i - 30));
    return [lo, hi, s.pos, s.pass, s.removed, s.ppPairs, s.pairs, s.kings, ...s.pile];
  }
  let mask = 0;
  for (let i = 0; i < PY_CARDS; i++) if (s.gone[i]) mask |= 1 << i;
  return [mask, s.pos, s.pass, s.removed, s.ppPairs, s.pairs, s.kings, ...s.pile];
}

function unpack(p: readonly number[], rows?: number): Pick<PyState, "gone" | "pile" | "pos" | "pass" | "removed" | "ppPairs" | "pairs" | "kings"> {
  if (rows !== undefined) {
    const cards = pyCardsIn(rows);
    const gone = new Array<number>(cards);
    for (let i = 0; i < cards; i++) gone[i] = i < 30 ? (p[0]! >>> i) & 1 : (p[1]! >>> (i - 30)) & 1;
    return { gone, pos: p[2]!, pass: p[3]!, removed: p[4]!, ppPairs: p[5]!, pairs: p[6]!, kings: p[7]!, pile: p.slice(8) };
  }
  const gone = new Array<number>(PY_CARDS);
  for (let i = 0; i < PY_CARDS; i++) gone[i] = (p[0]! >>> i) & 1;
  return { gone, pos: p[1]!, pass: p[2]!, removed: p[3]!, ppPairs: p[4]!, pairs: p[5]!, kings: p[6]!, pile: p.slice(7) };
}

function samePacked(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Removes one or two cards (pyramid indexes or the waste) from a state. */
function removeCards(state: PyState, cards: number[]): PyState {
  const gone = state.gone.slice();
  let pile = state.pile;
  let pos = state.pos;
  let pyr = 0;
  const waste = pyWastePileOf(state);
  for (const a of cards) {
    if (a === waste) {
      pile = pile.slice();
      pile.splice(pos - 1, 1);
      pos--;
    } else {
      gone[a] = 1;
      pyr++;
    }
  }
  const pair = cards.length === 2;
  return {
    ...state, gone, pile, pos, sel: -1, removed: state.removed + pyr, pairs: state.pairs + (pair ? 1 : 0), ppPairs: state.ppPairs + (pair && pyr === 2 ? 1 : 0),
    kings: state.kings + (pair ? 0 : 1), lastA: cards[0]!, lastB: cards[1] ?? -1, lastTick: state.tick,
  };
}

/**
 * Applies one tap as a new state, or null when it is refused. A refused pair (not 13) moves the selection to the new
 * card and is counted by the caller.
 */
export function pyApply(state: PyState, a: number): { state: PyState; changed: boolean } | null {
  if (a === pyStockPileOf(state)) {
    if (state.pos < state.pile.length) return { state: { ...state, pos: state.pos + 1, sel: -1, draws: state.draws + 1 }, changed: true };
    if (state.pass < (state.passes ?? PY_PASSES) && state.pile.length > 0) return { state: { ...state, pos: 0, pass: state.pass + 1, sel: -1 }, changed: true };
    return null;
  }
  const card = pyCardAt(state, a);
  if (card < 0) return null;
  if (rankOf(card) === 13) return { state: removeCards(state, [a]), changed: true };
  if (state.sel < 0) return { state: { ...state, sel: a }, changed: false };
  if (state.sel === a) return { state: { ...state, sel: -1 }, changed: false };
  const other = pyCardAt(state, state.sel);
  if (other >= 0 && rankOf(other) + rankOf(card) === 13) return { state: removeCards(state, [state.sel, a]), changed: true };
  return null;
}

function finish(next: PyState): PyState {
  if (next.removed === pyCardsOf(next)) {
    next.ended = 1;
    next.finishTick = next.tick;
  } else if ((next.rev ?? 1) >= PY_REV_UNDO_OUT ? pyTrulyStuck(next) : pyStuck(next)) next.ended = 3;
  else if (next.tick >= PY_RUN_TICKS) next.ended = 2;
  return next;
}

function step(state: PyState, input: ArcadeInputEvent | null): PyState {
  if (state.ended) return state;
  let next: PyState = { ...state, tick: state.tick + 1 };
  if (input && input.k === PY_INPUT_TAP) {
    next.acted = 1;
    const r = pyApply(next, input.a);
    if (r) next = r.changed ? { ...r.state, hist: [...state.hist, pyPack(state)] } : r.state;
    else {
      next.rejects++;
      // A pair that doesn't make 13: the new card becomes the selection when it can be.
      next.sel = pyCardAt(next, input.a) >= 0 && rankOf(pyCardAt(next, input.a)) !== 13 ? input.a : -1;
    }
  } else if (input && input.k === PY_INPUT_UNDO) {
    next.acted = 1;
    if (state.hist.length > 0) {
      next = { ...next, ...unpack(state.hist[state.hist.length - 1]!, state.rows), hist: state.hist.slice(0, -1), sel: -1, undos: state.undos + 1, lastA: -1, lastB: -1, lastTick: next.tick };
    }
  } else if (input && input.k === PY_INPUT_RESET) {
    next.acted = 1;
    const now = pyPack(state);
    if (!samePacked(now, state.start)) {
      next = { ...next, ...unpack(state.start, state.rows), hist: [...state.hist, now], sel: -1, resets: state.resets + 1, lastA: -1, lastB: -1, lastTick: next.tick };
    }
  }
  return finish(next);
}

/* ================================ Scoring ================================ */

export function pyramidStdParts(state: PyState): StdPart[] | null {
  if (!state || !state.std) return null;
  if (state.lv) return pyLevelParts(state);
  const done = state.ended === 1;
  if ((state.rev ?? 1) >= PY_REV_SHARE) {
    // pyramidRev 4 (D6): Speed full by 22 s; rev 2 and 3 by 20 s.
    const d6 = (state.rev ?? 1) >= PY_REV_D6;
    const spec = d6 ? PY_STD_SPEC : PY_STD_SPEC_V3;
    const fullS = d6 ? PY_V4_SPEED_FULL_S : PY_SPEED_FULL_S;
    return [
      stdPart(spec, "core", stdLine(PY_V2_CORE_MAX, pyCoreUnits(state), PY_CORE_FULL), `${state.removed} / ${PY_CARDS} removed`),
      stdPart(spec, "clear", done ? PY_V2_CLEAR_MAX : 0, done ? "all removed" : "not cleared"),
      stdPart(spec, "speed", done ? stdSpeedInt(PY_V2_SPEED_MAX, state.finishTick, fullS * 60, PY_RUN_TICKS) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
      stdPart(spec, "pairs", stdEach(state.ppPairs, PY_PAIR_EACH, PY_PAIR_MAX), `${state.ppPairs} pyramid pair${state.ppPairs === 1 ? "" : "s"}`),
    ];
  }
  return [
    stdPart(PY_STD_SPEC_V1, "core", stdLine(PY_CORE_MAX, pyCoreUnits(state), PY_CORE_FULL), `${state.removed} / ${PY_CARDS} removed`),
    stdPart(PY_STD_SPEC_V1, "clear", done ? PY_CLEAR_MAX : 0, done ? "all removed" : "not cleared"),
    stdPart(PY_STD_SPEC_V1, "speed", done ? stdSpeed(PY_SPEED_MAX, state.finishTick, PY_SPEED_FULL_S * 60, PY_RUN_TICKS) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
    stdPart(PY_STD_SPEC_V1, "pairs", stdEach(state.ppPairs, PY_PAIR_EACH, PY_PAIR_MAX), `${state.ppPairs} pyramid pair${state.ppPairs === 1 ? "" : "s"}`),
  ];
}

export function pyramidScore(state: PyState): number {
  return stdScore(pyramidStdParts(state) ?? [], Boolean(state.acted));
}

export function pyramidBandParts(state: PyState): BandParts {
  const parts = pyramidStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  return { units: pyCoreUnits(state), points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${state.removed} / ${pyCardsOf(state)} removed` };
}

/* ============================== Checkpoints ============================== */

export const PY_CHECKPOINT_INTERVAL = 300;
export const PY_CHECKPOINT_KEYS = ["tick", "removed", "pos", "ended", "checksum"] as const;
export interface PyCheckpoint {
  tick: number;
  removed: number;
  pos: number;
  ended: number;
  checksum: number;
}

export function pyCheckpoint(state: PyState): PyCheckpoint {
  return {
    tick: state.tick, removed: state.removed, pos: state.pos, ended: state.ended,
    checksum: hashInts(state.lv
      ? [state.tick, state.sel, state.pass, state.ppPairs, state.pairs, state.kings, state.ended, state.hist.length, state.undos, state.resets, ...state.gone, ...state.pile, 300 + (state.hints ?? 0), ...(state.rows === undefined ? [] : [400 + state.rows])]
      : [state.tick, state.sel, state.pass, state.ppPairs, state.pairs, state.kings, state.ended, state.hist.length, state.undos, state.resets, ...state.gone, ...state.pile]),
  };
}

export const pyramidGame: ArcadeGame<PyState, ArcadeInputEvent | null> = {
  key: "pyramid",
  runTicks: PY_RUN_TICKS,
  init: (seed) => pyInit(seed, 1),
  step,
  isOver: (state) => state.ended !== 0,
  score: pyramidScore,
  draw: () => {},
  inputRanges: [inputRange(PY_INPUT_TAP, [0, PY_WASTE_PILE]), inputRange(PY_INPUT_UNDO), inputRange(PY_INPUT_RESET)],
};

/** pyramidRev 1's game (the checks and tools that play Pyramid without a stamp mean rev 1). */
export const pyramidGameV1 = pyramidGame;

/** pyramidRev 2's game: the same deals and play, scored on rev 2's parts. */
export const pyramidGameV2: ArcadeGame<PyState, ArcadeInputEvent | null> = { ...pyramidGame, init: (seed) => pyInit(seed, PY_REV_SHARE) };

/** pyramidRev 3's game: rev 2's deals and parts; a dead end waits for Undo or Reset, ending only with nothing to undo. */
export const pyramidGameV3: ArcadeGame<PyState, ArcadeInputEvent | null> = { ...pyramidGame, init: (seed) => pyInit(seed, PY_REV_UNDO_OUT) };

/** pyramidRev 4's Normal (D6): rev 3's deals and play, Speed full by 22 s. */
export const pyramidGameV4: ArcadeGame<PyState, ArcadeInputEvent | null> = { ...pyramidGame, init: (seed) => pyInit(seed, PY_REV_D6) };

export function pyramidGameFor(rev?: number | null): ArcadeGame<PyState, ArcadeInputEvent | null> {
  const r = rev ?? 1;
  return r >= PY_REV_D6 ? pyramidGameV4 : r >= PY_REV_UNDO_OUT ? pyramidGameV3 : r >= PY_REV_SHARE ? pyramidGameV2 : pyramidGame;
}

/* ================================ Difficulty levels (15 Nov 2026) ================================ */

/*
 * The levels (docs/design/difficulty/README.md; docs/arcade-standard/pyramid.md "Levels"): Normal is pyramidRev 3
 * exactly (no `level` on the puzzle, none of this code runs). A level deal carries `level` and pyramidRev 3; its game is
 * rev 3's play and parts, its deal built in the sim the same way (a witness line proved through the sim, kept only when
 * quick players with no plan don't clear it) with the level's Kings and filters, plus hints:
 *
 *   Easy    3 passes through the stock, 3–4 Kings, the partner glow, hints free; any proved deal (no quick-player filter,
 *           16 Nov 2026: the average player's step up to Normal).
 *   Hard    1 pass, 2–3 Kings, no glow, a harder deal (Normal's filter, the waste-first player and a player looking
 *           three removals ahead all fail it), a hint costs 5.
 *   Expert  1 pass, 3 Kings (so one pair must come off the waste in time), no glow, the hardest deal (a player looking
 *           four removals ahead fails it too), one hint. (16 Nov 2026, Joe: the steps must be clearly felt. Two Kings
 *           measured easier than Hard: 26 cards then pair among themselves and the waste never matters.)
 *
 * Each level's deal draws from its own stream of the seed, so it never repeats Normal's.
 */
export const PY_INPUT_HINT = 5;
export const PY_LV_EASY = 1;
export const PY_LV_HARD = 3;
export const PY_LV_EXPERT = 4;
export const PY_HINT_COST = 5;
export type PyLevelName = "easy" | "hard" | "expert";

export interface PyLevelRules {
  lv: number;
  passes: number;
  kingsMin: number;
  kingsSpan: number;
  /** The greedy players that must fail (pyGreedyClears modes). */
  filters: readonly number[];
  glow: boolean;
  hintCost: number;
  hintLimit: number;
}

export const PY_LEVEL_RULES: Readonly<Record<PyLevelName, PyLevelRules>> = {
  easy: { lv: PY_LV_EASY, passes: 3, kingsMin: 3, kingsSpan: 2, filters: [], glow: true, hintCost: 0, hintLimit: -1 },
  hard: { lv: PY_LV_HARD, passes: 1, kingsMin: 2, kingsSpan: 2, filters: [0, 1, 2, 3, 4], glow: false, hintCost: PY_HINT_COST, hintLimit: -1 },
  expert: { lv: PY_LV_EXPERT, passes: 1, kingsMin: 3, kingsSpan: 1, filters: [0, 1, 2, 3, 4, 5], glow: false, hintCost: 0, hintLimit: 1 },
};

/** D6's levels on pyramidRev 4: a pyramid of `rows` rows, its Kings picked from `kingsList`, speed full by `speedFullS`, pyramid pairs full at `pairsFull`. */
export interface PyLevelRulesV4 extends PyLevelRules {
  rows: number;
  kingsList: readonly number[];
  speedFullS: number;
  pairsFull: number;
}

/**
 * D6's levels (23 Nov 2026, the polish plan's difficulty spec: the lever is the pyramid's height, seen before the first
 * tap). Level deals on pyramidRev 4; every pyramid card pairs inside the pyramid (the Kings' count matches the cards'
 * parity), so the face-down stock never decides a clear. Hard and Expert carry no hints (the spec's rule 5).
 *
 *   Easy    6 rows (21 cards, 31 in the stock), 3 passes, 1 or 3 Kings, the partner glow, free hints with the idle glow;
 *           any proved deal; speed full by 20 s.
 *   Hard    8 rows (36 cards, 16 in the stock), one pass, 2 or 4 Kings, no glow, no hints; a deal no quick player with no
 *           plan clears (pyGreedyClears modes 0–4: first pair, most uncovered, waste first, two and three removals ahead);
 *           speed full by 35 s.
 *   Expert  9 rows (45 cards, 7 in the stock), one pass, 3 Kings, no glow, no hints; modes 0–6 fail (up to five removals
 *           ahead); speed full by 42 s.
 *
 * Speed and the filters set from 96 room deals each (scripts/d6-ladder.ts, the skill-band bots under HUMAN_LIMITS; the
 * realistic elite's clears take a median 15 / 34 / 41 s): the average player 178 / 134 (Normal) / 98 / 79, the elite at
 * 200 99 % / 50 % / 44 % / 29 %.
 */
export const PY_LEVEL_RULES_V4: Readonly<Record<PyLevelName, PyLevelRulesV4>> = {
  easy: { lv: PY_LV_EASY, rows: 6, passes: 3, kingsMin: 1, kingsSpan: 0, kingsList: [1, 3], filters: [], glow: true, hintCost: 0, hintLimit: -1, speedFullS: 20, pairsFull: 9 },
  hard: { lv: PY_LV_HARD, rows: 8, passes: 1, kingsMin: 2, kingsSpan: 0, kingsList: [2, 4], filters: [0, 1, 2, 3, 4], glow: false, hintCost: 0, hintLimit: 0, speedFullS: 35, pairsFull: 16 },
  expert: { lv: PY_LV_EXPERT, rows: 9, passes: 1, kingsMin: 3, kingsSpan: 0, kingsList: [3], filters: [0, 1, 2, 3, 4, 5, 6], glow: false, hintCost: 0, hintLimit: 0, speedFullS: 42, pairsFull: 21 },
};

function pyLevelName(lv: number | undefined): PyLevelName | null {
  return lv === PY_LV_EASY ? "easy" : lv === PY_LV_HARD ? "hard" : lv === PY_LV_EXPERT ? "expert" : null;
}
/** A level's rules on a revision (pyramidRev 4: D6's; earlier: the levels before). */
export function pyLevelRulesFor(rev: number | null | undefined, level: PyLevelName): PyLevelRules | PyLevelRulesV4 {
  return (rev ?? 1) >= PY_REV_ROWS ? PY_LEVEL_RULES_V4[level] : PY_LEVEL_RULES[level];
}
export function pyLevelRulesOf(state: Pick<PyState, "lv"> & { rev?: number }): PyLevelRules | null {
  const n = pyLevelName(state.lv);
  return n ? pyLevelRulesFor(state.rev, n) : null;
}
/** Whether a selected card's partners glow (Normal and Easy; display only). */
export function pyGlows(state: Pick<PyState, "lv"> & { rev?: number }): boolean {
  return pyLevelRulesOf(state)?.glow ?? true;
}
/** The pyramid pairs that fill the pairs part (PY_PAIR_FULL; a pyramidRev 4 level its own, PY_LEVEL_RULES_V4). */
export function pyPairsFullOf(state: Pick<PyState, "lv"> & { rev?: number }): number {
  const r = pyLevelRulesOf(state);
  return r && "pairsFull" in r ? (r as PyLevelRulesV4).pairsFull : PY_PAIR_FULL;
}
/** The same for a puzzle's stamp and level (reveals). */
export function pyPairsFullFor(rev: number | null | undefined, level: string | null | undefined): number {
  return (rev ?? 1) >= PY_REV_ROWS && (level === "easy" || level === "hard" || level === "expert") ? PY_LEVEL_RULES_V4[level].pairsFull : PY_PAIR_FULL;
}
/** Whether a level state has the Hint button (D6's Hard and Expert have none). Display and input mapping only. */
export function pyHintButtonOn(state: Pick<PyState, "lv"> & { rev?: number }): boolean {
  const r = pyLevelRulesOf(state);
  return Boolean(r) && r!.hintLimit !== 0;
}
export function pyHintsLeft(state: PyState): number {
  const r = pyLevelRulesOf(state);
  if (!r) return 0;
  return r.hintLimit < 0 ? Infinity : Math.max(0, r.hintLimit - (state.hints ?? 0));
}

/** Builds and proves a level's deal for `seed` (its own PRNG stream, every attempt on it); `rev` 4 is D6's rows. */
export function pyBuildLevelDeal(seed: number, level: PyLevelName, rev: number = PY_REV_UNDO_OUT): PyDeal {
  if (rev >= PY_REV_ROWS) return pyBuildLevelDealV4(seed, level);
  const r = PY_LEVEL_RULES[level];
  let rng = (Math.trunc(seed) ^ 0x5a17c3 ^ (0x9e3779b1 * r.lv)) | 0;
  for (let attempt = 0; attempt < 20_000; attempt++) {
    const out = buildAttempt(rng, r.kingsMin, r.kingsSpan);
    rng = out.rng;
    if (!out.deal) continue;
    const end = proveDeal(out.deal);
    if (end.removed !== PY_CARDS || end.ppPairs < PY_PAIR_FULL) continue;
    if (r.filters.some((mode) => pyGreedyClears(out.deal!, mode))) continue;
    return out.deal;
  }
  throw new Error(`pyramid: no ${level} deal for seed ${seed}`);
}

/** pyramidRev 4's level deal: the level's rows and Kings, every pyramid card paired inside it, the witness proved. */
function pyBuildLevelDealV4(seed: number, level: PyLevelName): PyDeal {
  const r = PY_LEVEL_RULES_V4[level];
  const cards = pyCardsIn(r.rows);
  let rng = (Math.trunc(seed) ^ 0x5a17c3 ^ (0x9e3779b1 * r.lv) ^ 0x0d6d6) | 0;
  for (let attempt = 0; attempt < 20_000; attempt++) {
    const out = buildAttempt(rng, 0, 0, { rows: r.rows, kings: r.kingsList });
    rng = out.rng;
    if (!out.deal) continue;
    const end = proveDeal(out.deal);
    if (end.removed !== cards || end.ppPairs < r.pairsFull) continue;
    if (r.filters.some((mode) => pyGreedyClears(out.deal!, mode))) continue;
    return out.deal;
  }
  throw new Error(`pyramid: no ${level} deal for seed ${seed} on pyramidRev 4`);
}

const levelDealCache = new Map<string, PyDeal>();
export function pyLevelDeal(seed: number, level: PyLevelName, rev: number = PY_REV_UNDO_OUT): PyDeal {
  const r4 = rev >= PY_REV_ROWS;
  const key = `${level}:${r4 ? 4 : 3}:${Math.trunc(seed) | 0}`;
  let d = levelDealCache.get(key);
  if (!d) {
    d = pyBuildLevelDeal(Math.trunc(seed) | 0, level, r4 ? PY_REV_ROWS : PY_REV_UNDO_OUT);
    if (levelDealCache.size > 64) levelDealCache.clear();
    levelDealCache.set(key, d);
  }
  return d;
}

/** The deal a state was dealt (a level state's level deal on its revision, else the seed's deal): tools and bots. */
export function pyDealOfState(state: Pick<PyState, "deal" | "lv" | "rev">): PyDeal {
  const level = pyLevelName(state.lv);
  return level ? pyLevelDeal(state.deal, level, state.rev) : pyDeal(state.deal);
}

export function pyLevelInit(seed: number, level: PyLevelName, rev: number = PY_REV_UNDO_OUT): PyState {
  const r4 = rev >= PY_REV_ROWS;
  const r = pyLevelRulesFor(r4 ? PY_REV_ROWS : PY_REV_UNDO_OUT, level);
  const s = pyStateOf(pyLevelDeal(seed, level, rev), Math.trunc(seed) | 0, r4 ? PY_REV_ROWS : PY_REV_UNDO_OUT);
  return { ...s, lv: r.lv, passes: r.passes, hints: 0, hintTick: 0 };
}

function stepLevel(state: PyState, input: ArcadeInputEvent | null): PyState {
  if (state.ended) return state;
  if (input && input.k === PY_INPUT_HINT) {
    const next = finish({ ...state, tick: state.tick + 1, acted: 1 });
    if (next.ended || pyHintsLeft(state) <= 0) return next;
    return { ...next, hints: (state.hints ?? 0) + 1, hintTick: next.tick };
  }
  return step(state, input);
}

/** A level's spec (the help and the reveal); `rev` 4 is D6's rows. */
export function pyLevelSpec(level: PyLevelName, rev?: number | null): StdSpec {
  if ((rev ?? 1) >= PY_REV_ROWS) {
    const r = PY_LEVEL_RULES_V4[level];
    const cards = pyCardsIn(r.rows);
    return {
      field: "pyramidRev",
      rev: PY_REV_ROWS,
      parts: [
        { key: "core", label: "Pyramid cards", max: PY_V2_CORE_MAX, of: cards, item: "card", how: `remove the ${cards} pyramid cards, each worth the same` },
        { key: "clear", label: "Cleared", max: PY_V2_CLEAR_MAX, of: 1, how: `remove all ${cards}` },
        { key: "speed", label: "Speed", max: PY_V2_SPEED_MAX, of: 1, how: `clear it within ${r.speedFullS} s for all of it, falling to 0 at the buzzer` },
        { key: "pairs", label: "Pyramid pairs", max: PY_PAIR_MAX, of: r.pairsFull, item: "pair", how: `pairs made of two pyramid cards, all of it at ${r.pairsFull}` },
      ],
    };
  }
  const r = PY_LEVEL_RULES[level];
  return { ...PY_STD_SPEC_V3, parts: PY_STD_SPEC_V3.parts.map((p) => (p.key === "core" && r.hintCost ? { ...p, how: `${p.how}; each hint costs ${r.hintCost}` } : p)) };
}

function pyLevelPartsV4(state: PyState): StdPart[] {
  const level = pyLevelName(state.lv)!;
  const r = PY_LEVEL_RULES_V4[level];
  const spec = pyLevelSpec(level, PY_REV_ROWS);
  const cards = pyCardsIn(r.rows);
  const done = state.ended === 1;
  return [
    stdPart(spec, "core", stdLine(PY_V2_CORE_MAX, pyCoreUnits(state), cards), `${state.removed} / ${cards} removed`),
    stdPart(spec, "clear", done ? PY_V2_CLEAR_MAX : 0, done ? "all removed" : "not cleared"),
    stdPart(spec, "speed", done ? stdSpeedInt(PY_V2_SPEED_MAX, state.finishTick, r.speedFullS * 60, PY_RUN_TICKS) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
    stdPart(spec, "pairs", stdLine(PY_PAIR_MAX, state.ppPairs, r.pairsFull), `${state.ppPairs} pyramid pair${state.ppPairs === 1 ? "" : "s"}`),
  ];
}

function pyLevelParts(state: PyState): StdPart[] {
  if ((state.rev ?? 1) >= PY_REV_ROWS) return pyLevelPartsV4(state);
  const r = pyLevelRulesOf(state)!;
  const spec = pyLevelSpec(pyLevelName(state.lv)!);
  const done = state.ended === 1;
  const hints = state.hints ?? 0;
  const cost = r.hintCost * hints;
  return [
    stdPart(spec, "core", Math.max(0, stdLine(PY_V2_CORE_MAX, pyCoreUnits(state), PY_CORE_FULL) - cost), `${state.removed} / ${PY_CARDS} removed${cost ? ` · ${hints} ${hints === 1 ? "hint" : "hints"} (−${cost})` : ""}`),
    stdPart(spec, "clear", done ? PY_V2_CLEAR_MAX : 0, done ? "all removed" : "not cleared"),
    stdPart(spec, "speed", done ? stdSpeedInt(PY_V2_SPEED_MAX, state.finishTick, PY_SPEED_FULL_S * 60, PY_RUN_TICKS) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
    stdPart(spec, "pairs", stdEach(state.ppPairs, PY_PAIR_EACH, PY_PAIR_MAX), `${state.ppPairs} pyramid pair${state.ppPairs === 1 ? "" : "s"}`),
  ];
}

/**
 * The hint (display only, never read by the sim): a King; else the removal with the best line three removals ahead in
 * view; else a draw from the stock; null when nothing is left.
 */
export function pyHintMove(state: PyState): number[] | null {
  if (state.ended !== 0) return null;
  const moves = pyMoves(state);
  const king = moves.find((m) => m.length === 1);
  if (king) return king;
  let best: number[] | null = null;
  let bestV = -1;
  for (const m of moves) {
    const t = afterMove(state, m);
    const v = t ? m.length + lookAhead(t, 2) : -1;
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  if (best) return best;
  return pyCanDraw(state) ? [pyStockPileOf(state)] : null;
}

const PY_LEVEL_GAMES = new Map<string, ArcadeGame<PyState, ArcadeInputEvent | null>>();
/** A level's game (`rev` 4: D6's rows, PY_LEVEL_RULES_V4; earlier: the levels before on rev 3). */
export function pyramidLevelGame(level: PyLevelName, rev?: number | null): ArcadeGame<PyState, ArcadeInputEvent | null> {
  const r4 = (rev ?? 1) >= PY_REV_ROWS;
  const key = `${level}:${r4 ? 4 : 3}`;
  let g = PY_LEVEL_GAMES.get(key);
  if (!g) {
    const cards = r4 ? pyCardsIn(PY_LEVEL_RULES_V4[level].rows) : PY_CARDS;
    g = {
      ...pyramidGameV3,
      init: (seed) => pyLevelInit(seed, level, r4 ? PY_REV_ROWS : PY_REV_UNDO_OUT),
      step: stepLevel,
      inputRanges: r4
        ? [inputRange(PY_INPUT_TAP, [0, cards + 1]), inputRange(PY_INPUT_UNDO), inputRange(PY_INPUT_RESET), inputRange(PY_INPUT_HINT)]
        : [...(pyramidGameV3.inputRanges ?? []), inputRange(PY_INPUT_HINT)],
    };
    PY_LEVEL_GAMES.set(key, g);
  }
  return g;
}

export function pyramidGameAt(rev: number | null | undefined, level: string | null | undefined): ArcadeGame<PyState, ArcadeInputEvent | null> {
  return level === "easy" || level === "hard" || level === "expert" ? pyramidLevelGame(level, rev) : pyramidGameFor(rev);
}
