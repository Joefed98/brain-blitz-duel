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
 */
import { inputRange, rngBelow, type ArcadeGame, type ArcadeInputEvent } from "../engine";
import { stdEach, stdLine, stdPart, stdScore, stdSpeed, stdSum, type StdPart, type StdSpec } from "../arcadeStandard";
import { bandCurve, type BandParts } from "../scoreBands";
import { cardOf, hashInts, rankOf } from "./cards";

export const PY_REV = 1;
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

/** Cards cleared towards the core: the pyramid cards removed. */
export function pyCoreUnits(state: Pick<PyState, "removed">): number {
  return state.removed;
}

export const PY_STD_SPEC: StdSpec = {
  field: "pyramidRev",
  rev: PY_REV,
  parts: [
    { key: "core", label: "Pyramid cards", max: PY_CORE_MAX, of: PY_CORE_FULL, item: "card", how: "a straight line over the 28 pyramid cards removed" },
    { key: "clear", label: "Cleared", max: PY_CLEAR_MAX, of: 1, how: "all 28 removed" },
    { key: "speed", label: "Speed", max: PY_SPEED_MAX, of: 1, how: `cleared: full by ${PY_SPEED_FULL_S} s, 0 at the buzzer` },
    { key: "pairs", label: "Pyramid pairs", max: PY_PAIR_MAX, of: PY_PAIR_FULL, item: "pair", how: "2 for each pair of two pyramid cards, up to 10" },
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

/** The two cards covering pyramid card `i` (none on the bottom row). */
export function pyCoveredBy(i: number): number[] {
  const { row, pos } = pyRowOf(i);
  if (row >= 6) return [];
  return [pyIndex(row + 1, pos), pyIndex(row + 1, pos + 1)];
}

const COVERS = Array.from({ length: PY_CARDS }, (_, i) => pyCoveredBy(i));

export function pyFree(state: Pick<PyState, "gone">, i: number): boolean {
  if (i < 0 || i >= PY_CARDS || state.gone[i]) return false;
  for (const c of COVERS[i]!) if (!state.gone[c]) return false;
  return true;
}

export function pyWasteTop(state: Pick<PyState, "pile" | "pos">): number {
  return state.pos > 0 ? state.pile[state.pos - 1]! : -1;
}

/** The card a selection or tap target stands for (-1 for none). */
export function pyCardAt(state: PyState, a: number): number {
  if (a === PY_WASTE_PILE) return pyWasteTop(state);
  if (a >= 0 && a < PY_CARDS) return pyFree(state, a) ? state.tab[a]! : -1;
  return -1;
}

/** Whether the stock can still be drawn or turned back over. */
export function pyCanDraw(state: PyState): boolean {
  return state.pos < state.pile.length || (state.pass < PY_PASSES && state.pile.length > 0);
}

/** Every removal open now: [a] for a King, [a, b] for a pair (b may be the waste). */
export function pyMoves(state: PyState): number[][] {
  const out: number[][] = [];
  const free: number[] = [];
  for (let i = 0; i < PY_CARDS; i++) if (pyFree(state, i)) free.push(i);
  const w = pyWasteTop(state);
  for (const i of free) if (rankOf(state.tab[i]!) === 13) out.push([i]);
  for (let x = 0; x < free.length; x++)
    for (let y = x + 1; y < free.length; y++) if (rankOf(state.tab[free[x]!]!) + rankOf(state.tab[free[y]!]!) === 13) out.push([free[x]!, free[y]!]);
  if (w >= 0) {
    if (rankOf(w) === 13) out.push([PY_WASTE_PILE]);
    for (const i of free) if (rankOf(state.tab[i]!) + rankOf(w) === 13) out.push([i, PY_WASTE_PILE]);
  }
  return out;
}

export function pyStuck(state: PyState): boolean {
  return !pyCanDraw(state) && pyMoves(state).length === 0;
}

/** A built deal: the pyramid's 28 cards, the stock's 24 in turning order, and the witness taps that clear it. */
export interface PyDeal {
  tab: number[];
  stock: number[];
  witness: number[];
}

/** One attempt at a deal from the PRNG state `rng`; null when the plan ran into a dead end. */
function buildAttempt(rng0: number): { deal: PyDeal | null; rng: number } {
  let rng = rng0;
  const rand = (n: number) => {
    const r = rngBelow(rng, n);
    rng = r.state;
    return r.value;
  };
  // Two to four Kings in the pyramid and every other card in pyramid pairs (one left for the waste when the count is
  // odd): the pyramid is a puzzle in full view whose pairs only all come out in the right order, so the face-down stock
  // is a bonus, never the lottery that decides a clear.
  const kings = 2 + rand(3);
  const pairs = (PY_CARDS - kings) >> 1;
  const left = { k: kings, p: pairs, w: PY_CARDS - kings - 2 * pairs };
  // Cards still unused: suits free per rank.
  const suitsLeft: number[][] = Array.from({ length: 14 }, (_, r) => (r === 0 ? [] : [0, 1, 2, 3]));
  const take = (rank: number) => {
    const list = suitsLeft[rank]!;
    const i = rand(list.length);
    const suit = list[i]!;
    list.splice(i, 1);
    return cardOf(suit, rank);
  };
  const gone = new Array<number>(PY_CARDS).fill(0);
  const tab = new Array<number>(PY_CARDS).fill(-1);
  type Ev = { kind: "k" | "p" | "w"; a: number; b: number; partner: number };
  const events: Ev[] = [];
  for (let removed = 0; removed < PY_CARDS; ) {
    const free: number[] = [];
    for (let i = 0; i < PY_CARDS; i++) if (pyFree({ gone }, i)) free.push(i);
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
  while (plain.length) stock.push(plain.pop()!);
  const witness: number[] = [];
  let sim = pyStateOf({ tab, stock, witness: [] }, 0);
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
        if (++guard > 200 || !tap(PY_STOCK_PILE)) return { deal: null, rng };
        if (pyWasteTop(sim) >= 0 && rankOf(pyWasteTop(sim)) === 13 && !tap(PY_WASTE_PILE)) return { deal: null, rng };
      }
      if (!tap(ev.a) || !tap(PY_WASTE_PILE)) return { deal: null, rng };
    }
  }
  return { deal: { tab, stock, witness }, rng };
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
  for (let i = 0; i < PY_CARDS; i++) if (pyFree(s, i)) free++;
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
  for (let guard = 0; guard < 200; guard++) {
    if (s.removed === PY_CARDS) return true;
    const moves = pyMoves(s);
    let move: number[] | null = null;
    const king = moves.find((m) => m.length === 1);
    if (king) move = king;
    else if (moves.length) {
      if (mode === 0) move = moves[0]!;
      else if (mode === 2) move = moves.find((m) => m.includes(PY_WASTE_PILE)) ?? moves[0]!;
      else if (mode === 3) {
        let best = -1;
        for (const m of moves) {
          const t = afterMove(s, m);
          const v = t ? m.length + lookAhead(t, 1) : -1;
          if (v > best) {
            best = v;
            move = m;
          }
        }
      } else {
        let best = -1;
        for (const m of moves) {
          const gone = s.gone.slice();
          for (const a of m) if (a < PY_CARDS) gone[a] = 1;
          let opened = 0;
          for (let j = 0; j < PY_CARDS; j++) if (!s.gone[j] && !pyFree(s, j) && pyFree({ gone }, j)) opened++;
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
    const d = pyApply(s, PY_STOCK_PILE);
    if (!d) return false;
    s = d.state;
  }
  return s.removed === PY_CARDS;
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

function pyStateOf(deal: PyDeal, seed: number): PyState {
  const s: PyState = {
    tick: 0, rev: PY_REV, deal: seed, tab: deal.tab.slice(), gone: new Array<number>(PY_CARDS).fill(0), pile: deal.stock.slice(), pos: 0, pass: 1,
    sel: -1, removed: 0, ppPairs: 0, pairs: 0, kings: 0, draws: 0, rejects: 0, acted: 0, ended: 0, finishTick: 0,
    hist: [], start: [], undos: 0, resets: 0, lastA: -1, lastB: -1, lastTick: 0, std: 1,
  };
  s.start = pyPack(s);
  return s;
}

/** The opening state for `seed`. */
export function pyInit(seed: number): PyState {
  return pyStateOf(pyDeal(seed), Math.trunc(seed) | 0);
}

/* ---- Undo and Reset: a position packed as integers ---- */

export function pyPack(s: Pick<PyState, "gone" | "pile" | "pos" | "pass" | "removed" | "ppPairs" | "pairs" | "kings">): number[] {
  let mask = 0;
  for (let i = 0; i < PY_CARDS; i++) if (s.gone[i]) mask |= 1 << i;
  return [mask, s.pos, s.pass, s.removed, s.ppPairs, s.pairs, s.kings, ...s.pile];
}

function unpack(p: readonly number[]): Pick<PyState, "gone" | "pile" | "pos" | "pass" | "removed" | "ppPairs" | "pairs" | "kings"> {
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
  for (const a of cards) {
    if (a === PY_WASTE_PILE) {
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
  if (a === PY_STOCK_PILE) {
    if (state.pos < state.pile.length) return { state: { ...state, pos: state.pos + 1, sel: -1, draws: state.draws + 1 }, changed: true };
    if (state.pass < PY_PASSES && state.pile.length > 0) return { state: { ...state, pos: 0, pass: state.pass + 1, sel: -1 }, changed: true };
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
  if (next.removed === PY_CARDS) {
    next.ended = 1;
    next.finishTick = next.tick;
  } else if (pyStuck(next)) next.ended = 3;
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
      next = { ...next, ...unpack(state.hist[state.hist.length - 1]!), hist: state.hist.slice(0, -1), sel: -1, undos: state.undos + 1, lastA: -1, lastB: -1, lastTick: next.tick };
    }
  } else if (input && input.k === PY_INPUT_RESET) {
    next.acted = 1;
    const now = pyPack(state);
    if (!samePacked(now, state.start)) {
      next = { ...next, ...unpack(state.start), hist: [...state.hist, now], sel: -1, resets: state.resets + 1, lastA: -1, lastB: -1, lastTick: next.tick };
    }
  }
  return finish(next);
}

/* ================================ Scoring ================================ */

export function pyramidStdParts(state: PyState): StdPart[] | null {
  if (!state || !state.std) return null;
  const done = state.ended === 1;
  return [
    stdPart(PY_STD_SPEC, "core", stdLine(PY_CORE_MAX, pyCoreUnits(state), PY_CORE_FULL), `${state.removed} / ${PY_CARDS} removed`),
    stdPart(PY_STD_SPEC, "clear", done ? PY_CLEAR_MAX : 0, done ? "all removed" : "not cleared"),
    stdPart(PY_STD_SPEC, "speed", done ? stdSpeed(PY_SPEED_MAX, state.finishTick, PY_SPEED_FULL_S * 60, PY_RUN_TICKS) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
    stdPart(PY_STD_SPEC, "pairs", stdEach(state.ppPairs, PY_PAIR_EACH, PY_PAIR_MAX), `${state.ppPairs} pyramid pair${state.ppPairs === 1 ? "" : "s"}`),
  ];
}

export function pyramidScore(state: PyState): number {
  return stdScore(pyramidStdParts(state) ?? [], Boolean(state.acted));
}

export function pyramidBandParts(state: PyState): BandParts {
  const parts = pyramidStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  return { units: pyCoreUnits(state), points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${state.removed} / 28 removed` };
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
    checksum: hashInts([state.tick, state.sel, state.pass, state.ppPairs, state.pairs, state.kings, state.ended, state.hist.length, state.undos, state.resets, ...state.gone, ...state.pile]),
  };
}

export const pyramidGame: ArcadeGame<PyState, ArcadeInputEvent | null> = {
  key: "pyramid",
  runTicks: PY_RUN_TICKS,
  init: pyInit,
  step,
  isOver: (state) => state.ended !== 0,
  score: pyramidScore,
  draw: () => {},
  inputRanges: [inputRange(PY_INPUT_TAP, [0, PY_WASTE_PILE]), inputRange(PY_INPUT_UNDO), inputRange(PY_INPUT_RESET)],
};

export function pyramidGameFor(_rev?: number | null): ArcadeGame<PyState, ArcadeInputEvent | null> {
  return pyramidGame;
}
