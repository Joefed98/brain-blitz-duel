/**
 * Cards & Board round plumbing (Free Cell, Summit, Full House, Five Hands): the phone sends its move log; the server replays
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

const fcRun = makeArcadeRun<FcState, FcCheckpoint>({ tag: "freecell", game: freecellGameFor(1), checkpoint: fcCheckpoint, keys: FC_CHECKPOINT_KEYS, interval: FC_CHECKPOINT_INTERVAL });
/** freecellRev 2 (undo and reset): its own game and input ranges; the run's wire format is the same. */
const fcRun2 = makeArcadeRun<FcState, FcCheckpoint>({ tag: "freecell", game: freecellGameFor(2), checkpoint: fcCheckpoint, keys: FC_CHECKPOINT_KEYS, interval: FC_CHECKPOINT_INTERVAL });
/** freecellRev 3 (the core full sooner, the auto moves animated): rev 2's play and wire format. */
const fcRun3 = makeArcadeRun<FcState, FcCheckpoint>({ tag: "freecell", game: freecellGameFor(3), checkpoint: fcCheckpoint, keys: FC_CHECKPOINT_KEYS, interval: FC_CHECKPOINT_INTERVAL });
const tpRun = makeArcadeRun<TpState, TpCheckpoint>({ tag: "tripeaks", game: tripeaksGameFor(1), checkpoint: tpCheckpoint, keys: TP_CHECKPOINT_KEYS, interval: TP_CHECKPOINT_INTERVAL });
const psRun = makeArcadeRun<PsState, PsCheckpoint>({ tag: "pokersquares", game: pokerSquaresGameFor(1), checkpoint: psCheckpoint, keys: PS_CHECKPOINT_KEYS, interval: PS_CHECKPOINT_INTERVAL });
/** pokerSquaresRev 2 (Full House: the core full at the elite median); the same play and wire format. */
const psRun2 = makeArcadeRun<PsState, PsCheckpoint>({ tag: "pokersquares", game: pokerSquaresGameFor(2), checkpoint: psCheckpoint, keys: PS_CHECKPOINT_KEYS, interval: PS_CHECKPOINT_INTERVAL });

const fhRun = makeArcadeRun<FhState, FhCheckpoint>({ tag: "fivehands", game: fiveHandsGameFor(1), checkpoint: fhCheckpoint, keys: FH_CHECKPOINT_KEYS, interval: FH_CHECKPOINT_INTERVAL });
/** fiveHandsRev 2 (the steep hand table, hand points alone to 200): its own deal's witness; the same play and wire format. */
const fhRun2 = makeArcadeRun<FhState, FhCheckpoint>({ tag: "fivehands", game: fiveHandsGameFor(2), checkpoint: fhCheckpoint, keys: FH_CHECKPOINT_KEYS, interval: FH_CHECKPOINT_INTERVAL });
/** fiveHandsRev 2 with a stored best (the puzzle's `fiveHandsBest`): one run per figure, kept (a handful at most). */
const fhRunsByBest = new Map<number, typeof fhRun2>();
function fhRun2For(best: number | null | undefined): typeof fhRun2 {
  if (!best) return fhRun2;
  let run = fhRunsByBest.get(best);
  if (!run) {
    run = makeArcadeRun<FhState, FhCheckpoint>({ tag: "fivehands", game: fiveHandsGameFor(2, best), checkpoint: fhCheckpoint, keys: FH_CHECKPOINT_KEYS, interval: FH_CHECKPOINT_INTERVAL });
    if (fhRunsByBest.size >= 64) fhRunsByBest.delete(fhRunsByBest.keys().next().value!);
    fhRunsByBest.set(best, run);
  }
  return run;
}

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
  const r = ((rev ?? 1) >= 3 ? fcRun3 : (rev ?? 1) >= 2 ? fcRun2 : fcRun).replay(seed, raw);
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
  /** fiveHandsRev 2: the deck's best total the score was measured against (0 on rev 1). */
  best: number;
}

/** The single place a Five Hands score is worked out (no stamp: fiveHandsRev 1). */
export function replayFiveHandsRun(seed: number, raw: string, rev?: number | null, best?: number | null): FiveHandsResult {
  const r = ((rev ?? 1) >= 2 ? fhRun2For(best) : fhRun).replay(seed, raw);
  const s = r.state;
  const t = fhTotals(s.rows, s.rev);
  return { ...r, total: t.total, made: t.made, placed: s.turn, finished: s.ended === 1, best: s.best ?? 0 };
}
