/**
 * Cards & Board round plumbing (FreeCell, TriPeaks, Poker Squares): the phone sends its move log; the server replays
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

const fcRun = makeArcadeRun<FcState, FcCheckpoint>({ tag: "freecell", game: freecellGameFor(1), checkpoint: fcCheckpoint, keys: FC_CHECKPOINT_KEYS, interval: FC_CHECKPOINT_INTERVAL });
const tpRun = makeArcadeRun<TpState, TpCheckpoint>({ tag: "tripeaks", game: tripeaksGameFor(1), checkpoint: tpCheckpoint, keys: TP_CHECKPOINT_KEYS, interval: TP_CHECKPOINT_INTERVAL });
const psRun = makeArcadeRun<PsState, PsCheckpoint>({ tag: "pokersquares", game: pokerSquaresGameFor(1), checkpoint: psCheckpoint, keys: PS_CHECKPOINT_KEYS, interval: PS_CHECKPOINT_INTERVAL });

export const encodeFreecellRun = fcRun.encode;
export const decodeFreecellRun = fcRun.decode;
export const encodeTripeaksRun = tpRun.encode;
export const decodeTripeaksRun = tpRun.decode;
export const encodePokerSquaresRun = psRun.encode;
export const decodePokerSquaresRun = psRun.decode;

export interface FreecellResult extends FlatReplay<FcState, FcCheckpoint> {
  home: number;
  sorted: number;
  moves: number;
  par: number;
  finished: boolean;
  finishSeconds: number;
}

/** The single place a FreeCell score is worked out. */
export function replayFreecellRun(seed: number, raw: string, _rev?: number | null): FreecellResult {
  const r = fcRun.replay(seed, raw);
  const s = r.state;
  return { ...r, home: fcHomeCount(s), sorted: fcSortedCards(s.cols), moves: s.moves, par: s.par, finished: s.ended === 1, finishSeconds: s.finishTick / 60 };
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

export function replayPokerSquaresRun(seed: number, raw: string, _rev?: number | null): PokerSquaresResult {
  const r = psRun.replay(seed, raw);
  const s = r.state;
  const t = psTotals(s.grid);
  return { ...r, total: t.total, target: s.target, made: t.made, placed: s.next };
}
