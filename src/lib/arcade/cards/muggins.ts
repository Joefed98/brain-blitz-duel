/**
 * Muggins (Cards & Board, 1 Nov 2026; docs/arcade-standard/muggins.md): solo dominoes, a 90-second run on the arcade
 * engine.
 *
 * A double-six set (28 tiles). A seeded starting tile is laid; the player holds seven and the other twenty form the draw
 * pile, in a seeded order (the same hand and pile for everyone). The pile's next tile lies face up (mgNextTile): Draw
 * takes it and turns over the one after. Lay a matching tile on either open end of the line (no
 * spinner). Whenever the two open ends add up to 5, 10, 15 or 20, that total scores; a double at an end counts both
 * halves. With no legal play, Draw takes one tile from the pile (Draw is refused while a play is open). The round ends
 * when the hand is empty, at the buzzer, or when the pile is empty and nothing can be played. Undo (back to the position
 * before the last play, unlimited) and Reset (back to the deal, itself undoable); the clock runs on. A draw is final: it
 * can't be undone, Undo never goes back past the latest draw and Reset goes back only to just after it, so the pile
 * stays hidden.
 *
 * The deal (mgDeal): the tiles are shuffled from the seed and kept only when a witness line exists (a bounded search in
 * the sim) that empties the hand with at least MG_CORE_FULL points and two big plays; otherwise the next shuffle on the
 * same PRNG stream is tried. So every dealt seed lets perfect play reach 200.
 *
 * Scoring (mugginsRev 1, the arcade standard; 200 in all): the core 150 on a straight line over Muggins points, full at
 * MG_CORE_FULL (55; the near-perfect median is 45, measured); hand cleared 20; speed 20 (cleared only: full by
 * MG_SPEED_FULL_S, 0 at the buzzer); big plays 10 (5 for a single play scoring 15 or 20, up to 2).
 */
import { inputRange, rngBelow, type ArcadeGame, type ArcadeInputEvent } from "../engine";
import { stdEach, stdLine, stdPart, stdScore, stdSpeed, stdSum, type StdPart, type StdSpec } from "../arcadeStandard";
import { bandCurve, type BandParts } from "../scoreBands";
import { hashInts } from "./cards";

export const MG_REV = 1;
export const MG_TILES = 28;
export const MG_HAND = 7;
export const MG_PILE = MG_TILES - 1 - MG_HAND;
/** Input: a play, `a` the tile (0–27), `b` the end (0 left, 1 right). */
export const MG_INPUT_PLAY = 1;
export const MG_INPUT_DRAW = 2;
export const MG_INPUT_UNDO = 3;
export const MG_INPUT_RESET = 4;
export const MG_RUN_TICKS = 90 * 60;

/* ---- Scoring (mugginsRev 1) ---- */
export const MG_CORE_MAX = 150;
/** Muggins points for the full core: 55. The near-perfect median is 45, but full there puts average to elite level at 155 (docs/arcade-standard/muggins.md). */
export const MG_CORE_FULL = 55;
export const MG_CLEAR_MAX = 20;
export const MG_SPEED_MAX = 20;
/** Speed is full by this many seconds (the near-perfect skill-band median clear, measured). */
export const MG_SPEED_FULL_S = 19;
export const MG_BIG_EACH = 5;
export const MG_BIG_MAX = 10;
export const MG_BIG_FULL = 2;
/** A play scoring at least this much is a big play. */
export const MG_BIG_AT = 15;
export const MG_V1_BAND_CURVE = bandCurve([0, MG_CORE_FULL], [0, MG_CORE_MAX]);

export const MG_STD_SPEC: StdSpec = {
  field: "mugginsRev",
  rev: MG_REV,
  parts: [
    { key: "core", label: "Muggins points", max: MG_CORE_MAX, of: MG_CORE_FULL, item: "point", how: `a straight line, full at ${MG_CORE_FULL} points` },
    { key: "clear", label: "Hand cleared", max: MG_CLEAR_MAX, of: 1, how: "every tile played before the buzzer" },
    { key: "speed", label: "Speed", max: MG_SPEED_MAX, of: 1, how: `hand cleared: full by ${MG_SPEED_FULL_S} s, 0 at the buzzer` },
    { key: "big", label: "Big plays", max: MG_BIG_MAX, of: MG_BIG_FULL, item: "big play", how: "5 for a single play scoring 15 or 20, up to 2" },
  ],
};

/** The 28 tiles: tile id → [low, high] pips, in the order 0-0, 0-1 … 0-6, 1-1 … 6-6. */
export const MG_TILE_PIPS: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) out.push([a, b]);
  return out;
})();

export function mgIsDouble(tile: number): boolean {
  const p = MG_TILE_PIPS[tile]!;
  return p[0] === p[1];
}

export interface MgState {
  tick: number;
  rev: number;
  seed: number;
  /** The line from left to right, each laid tile as leftPip × 7 + rightPip (a double: both the same). */
  line: number[];
  /** The tiles in hand (dealt order, then drawn), and the pile in drawing order with the next to draw. */
  hand: number[];
  pile: number[];
  pilePos: number;
  points: number;
  bigs: number;
  plays: number;
  draws: number;
  /** The last play's score and tick (display), the last tile laid and its end. */
  lastScore: number;
  lastTile: number;
  lastEnd: number;
  lastTick: number;
  rejects: number;
  acted: number;
  /** 0 running, 1 hand cleared, 2 the buzzer, 3 no move left. */
  ended: number;
  finishTick: number;
  /** Positions before each play since the latest draw (Undo), and where Reset goes: the deal, or just after the latest draw. */
  hist: number[][];
  start: number[];
  undos: number;
  resets: number;
  std: number;
}

/** The open end values (left, right) and whether each end tile is a double. */
export function mgEnds(state: Pick<MgState, "line">): { l: number; r: number; ld: boolean; rd: boolean } {
  const first = state.line[0]!;
  const last = state.line[state.line.length - 1]!;
  const l = Math.floor(first / 7);
  const r = last % 7;
  return { l, r, ld: l === first % 7, rd: r === Math.floor(last / 7) };
}

/** The ends' count: each end's value (doubled for a double), a lone tile its whole pips. */
export function mgEndSum(state: Pick<MgState, "line">): number {
  if (state.line.length === 1) {
    const t = state.line[0]!;
    return Math.floor(t / 7) + (t % 7);
  }
  const e = mgEnds(state);
  return (e.ld ? 2 * e.l : e.l) + (e.rd ? 2 * e.r : e.r);
}

/** The pile's next tile, face up for everyone (what Draw takes), or -1 when the pile is empty. */
export function mgNextTile(state: Pick<MgState, "pile" | "pilePos">): number {
  return state.pilePos < state.pile.length ? state.pile[state.pilePos]! : -1;
}

/** Whether `tile` can be laid on end `end` (0 left, 1 right). */
export function mgFits(state: Pick<MgState, "line">, tile: number, end: number): boolean {
  const p = MG_TILE_PIPS[tile];
  if (!p) return false;
  const e = mgEnds(state);
  const v = end === 0 ? e.l : e.r;
  return p[0] === v || p[1] === v;
}

/** Every play open now as [tile, end] (a tile fitting both ends of equal value is listed once). */
export function mgPlays(state: Pick<MgState, "line" | "hand">): [number, number][] {
  const out: [number, number][] = [];
  const e = mgEnds(state);
  for (const t of state.hand) {
    if (mgFits(state, t, 0)) out.push([t, 0]);
    if (mgFits(state, t, 1) && !(e.l === e.r && mgFits(state, t, 0) && state.line.length === 1)) out.push([t, 1]);
  }
  return out;
}

/** The line after laying `tile` on `end`. */
function laid(line: readonly number[], tile: number, end: number): number[] {
  const [a, b] = MG_TILE_PIPS[tile]!;
  const e = mgEnds({ line: line as number[] });
  if (end === 0) {
    const out = a === e.l ? b * 7 + a : a * 7 + b;
    return [out, ...line];
  }
  const out = a === e.r ? a * 7 + b : b * 7 + a;
  return [...line, out];
}

/** Points a sum scores (5, 10, 15 or 20; else 0). */
export function mgScoreOf(sum: number): number {
  return sum > 0 && sum % 5 === 0 ? sum : 0;
}

/* ---- The deal ---- */

export interface MgDeal {
  start: number;
  hand: number[];
  pile: number[];
  /** The witness: plays as [tile, end] and draws as [-1, 0], in order. */
  witness: [number, number][];
  witnessPoints: number;
}

/** A bounded search for a line that empties the hand with ≥ MG_CORE_FULL points and two big plays. */
function findWitness(start: number, hand: number[], pile: number[], budget: number): { line: [number, number][]; points: number } | null {
  let nodes = 0;
  const seen = new Set<number>();
  const out: [number, number][] = [];
  let best: { line: [number, number][]; points: number } | null = null;
  const go = (line: number[], h: number[], pos: number, points: number, bigs: number): boolean => {
    if (h.length === 0) {
      if (points >= MG_CORE_FULL && bigs >= MG_BIG_FULL) {
        best = { line: out.slice(), points };
        return true;
      }
      return false;
    }
    if (++nodes > budget) return false;
    const e = mgEnds({ line });
    let mask = 0;
    for (const t of h) mask |= 1 << t;
    const ends = ((e.l * 2 + (e.ld ? 1 : 0)) * 7 + e.r) * 2 + (e.rd ? 1 : 0);
    const key = (((ends * 268435456 + mask) * 21 + pos) * 64 + Math.min(points, MG_CORE_FULL) / 5) * 3 + Math.min(bigs, MG_BIG_FULL);
    if (seen.has(key)) return false;
    seen.add(key);
    const plays = mgPlays({ line, hand: h });
    if (plays.length === 0) {
      if (pos >= pile.length) return false;
      out.push([-1, 0]);
      if (go(line, [...h, pile[pos]!], pos + 1, points, bigs)) return true;
      out.pop();
      return false;
    }
    const scored = plays.map(([t, end]) => {
      const nl = laid(line, t, end);
      return { t, end, nl, pts: mgScoreOf(mgEndSum({ line: nl })) };
    });
    scored.sort((x, y) => y.pts - x.pts || x.t - y.t || x.end - y.end);
    for (const p of scored) {
      out.push([p.t, p.end]);
      if (go(p.nl, h.filter((x) => x !== p.t), pos, points + p.pts, bigs + (p.pts >= MG_BIG_AT ? 1 : 0))) return true;
      out.pop();
    }
    return false;
  };
  go([MG_TILE_PIPS[start]![0] * 7 + MG_TILE_PIPS[start]![1]], hand, 0, 0, 0);
  return best;
}

export function mgBuildDeal(seed: number): MgDeal {
  let rng = (Math.trunc(seed) ^ 0x3c6ef372) | 0;
  for (let attempt = 0; attempt < 400; attempt++) {
    const tiles = Array.from({ length: MG_TILES }, (_, i) => i);
    for (let i = MG_TILES - 1; i > 0; i--) {
      const r = rngBelow(rng, i + 1);
      rng = r.state;
      const t = tiles[i]!;
      tiles[i] = tiles[r.value]!;
      tiles[r.value] = t;
    }
    const start = tiles[0]!;
    const hand = tiles.slice(1, 1 + MG_HAND);
    const pile = tiles.slice(1 + MG_HAND);
    const w = findWitness(start, hand, pile, 3000);
    if (w) return { start, hand, pile, witness: w.line, witnessPoints: w.points };
  }
  throw new Error(`muggins: no deal for seed ${seed}`);
}

const dealCache = new Map<number, MgDeal>();
export function mgDeal(seed: number): MgDeal {
  const key = Math.trunc(seed) | 0;
  let d = dealCache.get(key);
  if (!d) {
    d = mgBuildDeal(key);
    if (dealCache.size > 64) dealCache.clear();
    dealCache.set(key, d);
  }
  return d;
}

/* ---- Undo and Reset ---- */

export function mgPack(s: Pick<MgState, "line" | "hand" | "pilePos" | "points" | "bigs" | "plays" | "draws" | "lastScore">): number[] {
  return [s.pilePos, s.points, s.bigs, s.plays, s.draws, s.lastScore, s.line.length, ...s.line, s.hand.length, ...s.hand];
}

function unpack(p: readonly number[]): Pick<MgState, "line" | "hand" | "pilePos" | "points" | "bigs" | "plays" | "draws" | "lastScore"> {
  const n = p[6]!;
  const line = p.slice(7, 7 + n);
  const m = p[7 + n]!;
  const hand = p.slice(8 + n, 8 + n + m);
  return { pilePos: p[0]!, points: p[1]!, bigs: p[2]!, plays: p[3]!, draws: p[4]!, lastScore: p[5]!, line, hand };
}

function samePacked(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function mgInit(seed: number): MgState {
  const d = mgDeal(seed);
  const [a, b] = MG_TILE_PIPS[d.start]!;
  const s: MgState = {
    tick: 0, rev: MG_REV, seed: Math.trunc(seed) | 0, line: [a * 7 + b], hand: d.hand.slice(), pile: d.pile.slice(), pilePos: 0,
    points: 0, bigs: 0, plays: 0, draws: 0, lastScore: 0, lastTile: -1, lastEnd: -1, lastTick: 0, rejects: 0, acted: 0, ended: 0, finishTick: 0,
    hist: [], start: [], undos: 0, resets: 0, std: 1,
  };
  s.start = mgPack(s);
  return s;
}

/** Applies one play (tile, end) or a draw (tile -1) as a new state, or null when it is refused. */
export function mgApply(state: MgState, tile: number, end: number): MgState | null {
  if (tile < 0) {
    if (state.pilePos >= state.pile.length || mgPlays(state).length > 0) return null;
    return { ...state, hand: [...state.hand, state.pile[state.pilePos]!], pilePos: state.pilePos + 1, draws: state.draws + 1, lastScore: 0, lastTile: -1, lastEnd: -1, lastTick: state.tick };
  }
  if (!state.hand.includes(tile) || (end !== 0 && end !== 1) || !mgFits(state, tile, end)) return null;
  const line = laid(state.line, tile, end);
  const pts = mgScoreOf(mgEndSum({ line }));
  return {
    ...state, line, hand: state.hand.filter((t) => t !== tile), points: state.points + pts, bigs: state.bigs + (pts >= MG_BIG_AT ? 1 : 0), plays: state.plays + 1,
    lastScore: pts, lastTile: tile, lastEnd: end, lastTick: state.tick,
  };
}

export function mgStuck(state: MgState): boolean {
  return state.pilePos >= state.pile.length && mgPlays(state).length === 0;
}

function step(state: MgState, input: ArcadeInputEvent | null): MgState {
  if (state.ended) return state;
  let next: MgState = { ...state, tick: state.tick + 1 };
  if (input && (input.k === MG_INPUT_PLAY || input.k === MG_INPUT_DRAW)) {
    next.acted = 1;
    const r = input.k === MG_INPUT_DRAW ? mgApply(next, -1, 0) : mgApply(next, input.a, input.b);
    // A draw is for good: it can't be undone, Undo stops at it and Reset goes back to just after it (so nobody can draw,
    // look and take it back: the pile stays hidden).
    if (r) next = input.k === MG_INPUT_DRAW ? { ...r, hist: [], start: mgPack(r) } : { ...r, hist: [...state.hist, mgPack(state)] };
    else next.rejects++;
  } else if (input && input.k === MG_INPUT_UNDO) {
    next.acted = 1;
    if (state.hist.length > 0) next = { ...next, ...unpack(state.hist[state.hist.length - 1]!), hist: state.hist.slice(0, -1), undos: state.undos + 1, lastTile: -1, lastEnd: -1, lastScore: 0, lastTick: next.tick };
  } else if (input && input.k === MG_INPUT_RESET) {
    next.acted = 1;
    const now = mgPack(state);
    if (!samePacked(now, state.start)) next = { ...next, ...unpack(state.start), hist: [...state.hist, now], resets: state.resets + 1, lastTile: -1, lastEnd: -1, lastScore: 0, lastTick: next.tick };
  }
  if (next.hand.length === 0) {
    next.ended = 1;
    next.finishTick = next.tick;
  } else if (mgStuck(next)) next.ended = 3;
  else if (next.tick >= MG_RUN_TICKS) next.ended = 2;
  return next;
}

/* ================================ Scoring ================================ */

export function mugginsStdParts(state: MgState): StdPart[] | null {
  if (!state || !state.std) return null;
  const done = state.ended === 1;
  return [
    stdPart(MG_STD_SPEC, "core", stdLine(MG_CORE_MAX, state.points, MG_CORE_FULL), `${state.points} points (full at ${MG_CORE_FULL})`),
    stdPart(MG_STD_SPEC, "clear", done ? MG_CLEAR_MAX : 0, done ? "hand cleared" : `${state.hand.length} tile${state.hand.length === 1 ? "" : "s"} left`),
    stdPart(MG_STD_SPEC, "speed", done ? stdSpeed(MG_SPEED_MAX, state.finishTick, MG_SPEED_FULL_S * 60, MG_RUN_TICKS) : 0, done ? `cleared in ${(state.finishTick / 60).toFixed(1)} s` : "not cleared"),
    stdPart(MG_STD_SPEC, "big", stdEach(state.bigs, MG_BIG_EACH, MG_BIG_MAX), `${state.bigs} play${state.bigs === 1 ? "" : "s"} of 15+`),
  ];
}

export function mugginsScore(state: MgState): number {
  return stdScore(mugginsStdParts(state) ?? [], Boolean(state.acted));
}

export function mugginsBandParts(state: MgState): BandParts {
  const parts = mugginsStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  return { units: state.points, points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${state.points} points` };
}

/* ============================== Checkpoints ============================== */

export const MG_CHECKPOINT_INTERVAL = 300;
export const MG_CHECKPOINT_KEYS = ["tick", "points", "pilePos", "ended", "checksum"] as const;
export interface MgCheckpoint {
  tick: number;
  points: number;
  pilePos: number;
  ended: number;
  checksum: number;
}

export function mgCheckpoint(state: MgState): MgCheckpoint {
  return {
    tick: state.tick, points: state.points, pilePos: state.pilePos, ended: state.ended,
    checksum: hashInts([state.tick, state.bigs, state.plays, state.ended, state.hist.length, state.undos, state.resets, ...state.line, -1, ...state.hand]),
  };
}

export const mugginsGame: ArcadeGame<MgState, ArcadeInputEvent | null> = {
  key: "muggins",
  runTicks: MG_RUN_TICKS,
  init: mgInit,
  step,
  isOver: (state) => state.ended !== 0,
  score: mugginsScore,
  draw: () => {},
  inputRanges: [inputRange(MG_INPUT_PLAY, [0, MG_TILES - 1], [0, 1]), inputRange(MG_INPUT_DRAW), inputRange(MG_INPUT_UNDO), inputRange(MG_INPUT_RESET)],
};

export function mugginsGameFor(_rev?: number | null): ArcadeGame<MgState, ArcadeInputEvent | null> {
  return mugginsGame;
}
