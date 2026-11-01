/**
 * Cards & Board round plumbing (Free Cell, Summit, Full House, Five Hands, Pyramid, Golf Solitaire, Muggins): the phone sends its move log; the server replays
 * it on the STORED seed and keeps its own score (makeArcadeRun).
 */
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";
import {
  fcCheckpoint, fcHomeCount, fcSortedCards, freecellGameFor, FC_CHECKPOINT_INTERVAL, FC_CHECKPOINT_KEYS, type FcCheckpoint, type FcState,
} from "@/lib/arcade/cards/freecell";
import {
  tpCheckpoint, tripeaksGameFor, TP_CHECKPOINT_INTERVAL, TP_CHECKPOINT_KEYS, type TpCheckpoint, type TpState,
} from "@/lib/arcade/cards/tripeaks";
import {
  psCheckpoint, psTotals, pokerSquaresGameFor, PS_CHECKPOINT_INTERVAL, PS_CHECKPOINT_KEYS, type PsCheckpoint, type PsState,
} from "@/lib/arcade/cards/pokerSquares";
import {
  fhCheckpoint, fhTotals, fiveHandsGameFor, FH_CHECKPOINT_INTERVAL, FH_CHECKPOINT_KEYS, type FhCheckpoint, type FhState,
} from "@/lib/arcade/cards/fiveHands";
import {
  pyCheckpoint, pyramidGameFor, PY_CHECKPOINT_INTERVAL, PY_CHECKPOINT_KEYS, type PyCheckpoint, type PyState,
} from "@/lib/arcade/cards/pyramid";
import {
  gsCheckpoint, golfSolGameFor, GS_CHECKPOINT_INTERVAL, GS_CHECKPOINT_KEYS, type GsCheckpoint, type GsState,
} from "@/lib/arcade/cards/golfSol";
import {
  mgCheckpoint, mugginsGameFor, MG_CHECKPOINT_INTERVAL, MG_CHECKPOINT_KEYS, type MgCheckpoint, type MgState,
} from "@/lib/arcade/cards/muggins";

const fcRun = makeArcadeRun<FcState, FcCheckpoint>({ tag: "freecell", game: freecellGameFor(1), checkpoint: fcCheckpoint, keys: FC_CHECKPOINT_KEYS, interval: FC_CHECKPOINT_INTERVAL });
/** freecellRev 2 (undo and reset): its own game and input ranges; the run's wire format is the same. */
const fcRun2 = makeArcadeRun<FcState, FcCheckpoint>({ tag: "freecell", game: freecellGameFor(2), checkpoint: fcCheckpoint, keys: FC_CHECKPOINT_KEYS, interval: FC_CHECKPOINT_INTERVAL });
const tpRun = makeArcadeRun<TpState, TpCheckpoint>({ tag: "tripeaks", game: tripeaksGameFor(1), checkpoint: tpCheckpoint, keys: TP_CHECKPOINT_KEYS, interval: TP_CHECKPOINT_INTERVAL });
const psRun = makeArcadeRun<PsState, PsCheckpoint>({ tag: "pokersquares", game: pokerSquaresGameFor(1), checkpoint: psCheckpoint, keys: PS_CHECKPOINT_KEYS, interval: PS_CHECKPOINT_INTERVAL });
/** pokerSquaresRev 2 (Full House: the core full at the elite median); the same play and wire format. */
const psRun2 = makeArcadeRun<PsState, PsCheckpoint>({ tag: "pokersquares", game: pokerSquaresGameFor(2), checkpoint: psCheckpoint, keys: PS_CHECKPOINT_KEYS, interval: PS_CHECKPOINT_INTERVAL });

const fhRun = makeArcadeRun<FhState, FhCheckpoint>({ tag: "fivehands", game: fiveHandsGameFor(1), checkpoint: fhCheckpoint, keys: FH_CHECKPOINT_KEYS, interval: FH_CHECKPOINT_INTERVAL });

const pyRun = makeArcadeRun<PyState, PyCheckpoint>({ tag: "pyramid", game: pyramidGameFor(1), checkpoint: pyCheckpoint, keys: PY_CHECKPOINT_KEYS, interval: PY_CHECKPOINT_INTERVAL });
const gsRun = makeArcadeRun<GsState, GsCheckpoint>({ tag: "golfsol", game: golfSolGameFor(1), checkpoint: gsCheckpoint, keys: GS_CHECKPOINT_KEYS, interval: GS_CHECKPOINT_INTERVAL });
const mgRun = makeArcadeRun<MgState, MgCheckpoint>({ tag: "muggins", game: mugginsGameFor(1), checkpoint: mgCheckpoint, keys: MG_CHECKPOINT_KEYS, interval: MG_CHECKPOINT_INTERVAL });

export const encodePyramidRun = pyRun.encode;
export const decodePyramidRun = pyRun.decode;
export const encodeGolfSolRun = gsRun.encode;
export const decodeGolfSolRun = gsRun.decode;
export const encodeMugginsRun = mgRun.encode;
export const decodeMugginsRun = mgRun.decode;
export const encodeFreecellRun = fcRun.encode;
export const decodeFreecellRun = fcRun.decode;
export const encodeTripeaksRun = tpRun.encode;
export const decodeTripeaksRun = tpRun.decode;
export const encodePokerSquaresRun = psRun.encode;
export const decodePokerSquaresRun = psRun.decode;
export const encodeFiveHandsRun = fhRun.encode;
export const decodeFiveHandsRun = fhRun.decode;

export interface FreecellResult extends FlatReplay<FcState, FcCheckpoint> {
  home: number;
  sorted: number;
  moves: number;
  par: number;
  finished: boolean;
  finishSeconds: number;
  /** freecellRev 2: undos and resets made (0 on rev 1). */
  undos: number;
  resets: number;
}

/** The single place a FreeCell score is worked out (no stamp: freecellRev 1). */
export function replayFreecellRun(seed: number, raw: string, rev?: number | null): FreecellResult {
  const r = ((rev ?? 1) >= 2 ? fcRun2 : fcRun).replay(seed, raw);
  const s = r.state;
  return {
    ...r, home: fcHomeCount(s), sorted: fcSortedCards(s.cols), moves: s.moves, par: s.par, finished: s.ended === 1, finishSeconds: s.finishTick / 60,
    undos: s.undos ?? 0, resets: s.resets ?? 0,
  };
}

export interface TripeaksResult extends FlatReplay<TpState, TpCheckpoint> {
  cleared: number;
  peaks: number;
  bestRun: number;
  finished: boolean;
  finishSeconds: number;
  stockLeft: number;
}

export function replayTripeaksRun(seed: number, raw: string, _rev?: number | null): TripeaksResult {
  const r = tpRun.replay(seed, raw);
  const s = r.state;
  return { ...r, cleared: s.clearedCount, peaks: s.peaks, bestRun: s.bestRun, finished: s.ended === 1, finishSeconds: s.finishTick / 60, stockLeft: s.stock.length - s.stockPos };
}

export interface PokerSquaresResult extends FlatReplay<PsState, PsCheckpoint> {
  total: number;
  target: number;
  made: number;
  placed: number;
}

/** No stamp: pokerSquaresRev 1. */
export function replayPokerSquaresRun(seed: number, raw: string, rev?: number | null): PokerSquaresResult {
  const r = ((rev ?? 1) >= 2 ? psRun2 : psRun).replay(seed, raw);
  const s = r.state;
  const t = psTotals(s.grid);
  return { ...r, total: t.total, target: s.target, made: t.made, placed: s.next };
}

export interface FiveHandsResult extends FlatReplay<FhState, FhCheckpoint> {
  total: number;
  made: number;
  /** Cards placed (0–20) and whether all 20 were. */
  placed: number;
  finished: boolean;
}

/** The single place a Five Hands score is worked out. */
export function replayFiveHandsRun(seed: number, raw: string, _rev?: number | null): FiveHandsResult {
  const r = fhRun.replay(seed, raw);
  const s = r.state;
  const t = fhTotals(s.rows);
  return { ...r, total: t.total, made: t.made, placed: s.turn, finished: s.ended === 1 };
}

export interface PyramidResult extends FlatReplay<PyState, PyCheckpoint> {
  removed: number;
  ppPairs: number;
  kings: number;
  finished: boolean;
  finishSeconds: number;
  undos: number;
  resets: number;
}

/** The single place a Pyramid score is worked out. */
export function replayPyramidRun(seed: number, raw: string, _rev?: number | null): PyramidResult {
  const r = pyRun.replay(seed, raw);
  const s = r.state;
  return { ...r, removed: s.removed, ppPairs: s.ppPairs, kings: s.kings, finished: s.ended === 1, finishSeconds: s.finishTick / 60, undos: s.undos, resets: s.resets };
}

export interface GolfSolResult extends FlatReplay<GsState, GsCheckpoint> {
  cleared: number;
  runs: number;
  bestRun: number;
  finished: boolean;
  finishSeconds: number;
  stockLeft: number;
  undos: number;
  resets: number;
}

/** The single place a Golf Solitaire score is worked out. */
export function replayGolfSolRun(seed: number, raw: string, _rev?: number | null): GolfSolResult {
  const r = gsRun.replay(seed, raw);
  const s = r.state;
  return { ...r, cleared: s.cleared, runs: s.runs, bestRun: s.bestRun, finished: s.ended === 1, finishSeconds: s.finishTick / 60, stockLeft: s.stock.length - s.stockPos, undos: s.undos, resets: s.resets };
}

export interface MugginsResult extends FlatReplay<MgState, MgCheckpoint> {
  points: number;
  bigs: number;
  plays: number;
  handLeft: number;
  finished: boolean;
  finishSeconds: number;
  undos: number;
  resets: number;
}

/** The single place a Muggins score is worked out. */
export function replayMugginsRun(seed: number, raw: string, _rev?: number | null): MugginsResult {
  const r = mgRun.replay(seed, raw);
  const s = r.state;
  return { ...r, points: s.points, bigs: s.bigs, plays: s.plays, handLeft: s.hand.length, finished: s.ended === 1, finishSeconds: s.finishTick / 60, undos: s.undos, resets: s.resets };
}
