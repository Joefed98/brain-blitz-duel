/**
 * Cards & Board round plumbing (Free Cell, Summit, Full House, Five Hands, Pyramid, Golf Solitaire, Muggins): the phone sends its move log; the server replays
 * it on the STORED seed and keeps its own score (makeArcadeRun).
 */
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";
import {
  fcCheckpoint, fcHomeCount, fcSortedCards, freecellGameFor, freecellLevelGame, FC_CHECKPOINT_INTERVAL, FC_CHECKPOINT_KEYS, type FcCheckpoint, type FcLevelName, type FcState,
} from "@/lib/arcade/cards/freecell";
import {
  tpCheckpoint, tripeaksGameFor, tripeaksLevelGame, TP_CHECKPOINT_INTERVAL, TP_CHECKPOINT_KEYS, type TpCheckpoint, type TpState,
} from "@/lib/arcade/cards/tripeaks";
import {
  psCheckpoint, psTotals, pokerSquaresGameFor, PS_CHECKPOINT_INTERVAL, PS_CHECKPOINT_KEYS, type PsCheckpoint, type PsState,
} from "@/lib/arcade/cards/pokerSquares";
import {
  fhCheckpoint, fhColumn, fhPickedHand, fhRowHand, fhTotals, FH_ROWS, FH_SLOTS, fiveHandsGameFor, fiveHandsLevelGame, FH_CHECKPOINT_INTERVAL, FH_CHECKPOINT_KEYS, type FhCheckpoint, type FhState,
} from "@/lib/arcade/cards/fiveHands";
import {
  pyCheckpoint, pyramidGameFor, pyramidLevelGame, PY_CHECKPOINT_INTERVAL, PY_REV_ROWS, PY_CHECKPOINT_KEYS, type PyCheckpoint, type PyState,
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
/** freecellRev 3 (the core full sooner, the auto moves animated): rev 2's play and wire format. */
const fcRun3 = makeArcadeRun<FcState, FcCheckpoint>({ tag: "freecell", game: freecellGameFor(3), checkpoint: fcCheckpoint, keys: FC_CHECKPOINT_KEYS, interval: FC_CHECKPOINT_INTERVAL });
/** freecellRev 4 (the 40-card deal from its own bank): rev 3's play and wire format. */
const fcRun4 = makeArcadeRun<FcState, FcCheckpoint>({ tag: "freecell", game: freecellGameFor(4), checkpoint: fcCheckpoint, keys: FC_CHECKPOINT_KEYS, interval: FC_CHECKPOINT_INTERVAL });
/** freecellRev 5 (the core rising to all 40 home): rev 4's deal, play and wire format. */
const fcRun5 = makeArcadeRun<FcState, FcCheckpoint>({ tag: "freecell", game: freecellGameFor(5), checkpoint: fcCheckpoint, keys: FC_CHECKPOINT_KEYS, interval: FC_CHECKPOINT_INTERVAL });
/** freecellRev 6 (D6: rev 5's play, par full within an eighth over par): the same wire format. */
const fcRun6 = makeArcadeRun<FcState, FcCheckpoint>({ tag: "freecell", game: freecellGameFor(6), checkpoint: fcCheckpoint, keys: FC_CHECKPOINT_KEYS, interval: FC_CHECKPOINT_INTERVAL });
const tpRun = makeArcadeRun<TpState, TpCheckpoint>({ tag: "tripeaks", game: tripeaksGameFor(1), checkpoint: tpCheckpoint, keys: TP_CHECKPOINT_KEYS, interval: TP_CHECKPOINT_INTERVAL });
/** tripeaksRev 2 (the stock par in the state, its own part): the same play and wire format. */
const tpRun2 = makeArcadeRun<TpState, TpCheckpoint>({ tag: "tripeaks", game: tripeaksGameFor(2), checkpoint: tpCheckpoint, keys: TP_CHECKPOINT_KEYS, interval: TP_CHECKPOINT_INTERVAL });
/** tripeaksRev 3 (more of the 200 on the cards): rev 2's play and wire format. */
const tpRun3 = makeArcadeRun<TpState, TpCheckpoint>({ tag: "tripeaks", game: tripeaksGameFor(3), checkpoint: tpCheckpoint, keys: TP_CHECKPOINT_KEYS, interval: TP_CHECKPOINT_INTERVAL });
/** tripeaksRev 4 (D6: rev 3's play on easier run, par and speed figures): the same wire format. */
const tpRun4 = makeArcadeRun<TpState, TpCheckpoint>({ tag: "tripeaks", game: tripeaksGameFor(4), checkpoint: tpCheckpoint, keys: TP_CHECKPOINT_KEYS, interval: TP_CHECKPOINT_INTERVAL });
const psRun = makeArcadeRun<PsState, PsCheckpoint>({ tag: "pokersquares", game: pokerSquaresGameFor(1), checkpoint: psCheckpoint, keys: PS_CHECKPOINT_KEYS, interval: PS_CHECKPOINT_INTERVAL });
/** pokerSquaresRev 2 (Full House: the core full at the elite median); the same play and wire format. */
const psRun2 = makeArcadeRun<PsState, PsCheckpoint>({ tag: "pokersquares", game: pokerSquaresGameFor(2), checkpoint: psCheckpoint, keys: PS_CHECKPOINT_KEYS, interval: PS_CHECKPOINT_INTERVAL });

const fhRun = makeArcadeRun<FhState, FhCheckpoint>({ tag: "fivehands", game: fiveHandsGameFor(1), checkpoint: fhCheckpoint, keys: FH_CHECKPOINT_KEYS, interval: FH_CHECKPOINT_INTERVAL });
/** fiveHandsRev 2 (the steep hand table, hand points alone to 200): its own deal's witness; the same play and wire format. */
const fhRun2 = makeArcadeRun<FhState, FhCheckpoint>({ tag: "fivehands", game: fiveHandsGameFor(2), checkpoint: fhCheckpoint, keys: FH_CHECKPOINT_KEYS, interval: FH_CHECKPOINT_INTERVAL });
/** fiveHandsRev 3 (the flat table, the hand points summed to 200; the first shuffle as dealt): the same play and wire format. */
const fhRun3 = makeArcadeRun<FhState, FhCheckpoint>({ tag: "fivehands", game: fiveHandsGameFor(3), checkpoint: fhCheckpoint, keys: FH_CHECKPOINT_KEYS, interval: FH_CHECKPOINT_INTERVAL });
/** fiveHandsRev 4 (rev 3's game, 200 at 112 hand points): the same play and wire format. */
const fhRun4 = makeArcadeRun<FhState, FhCheckpoint>({ tag: "fivehands", game: fiveHandsGameFor(4), checkpoint: fhCheckpoint, keys: FH_CHECKPOINT_KEYS, interval: FH_CHECKPOINT_INTERVAL });

const pyRun = makeArcadeRun<PyState, PyCheckpoint>({ tag: "pyramid", game: pyramidGameFor(1), checkpoint: pyCheckpoint, keys: PY_CHECKPOINT_KEYS, interval: PY_CHECKPOINT_INTERVAL });
/** pyramidRev 2 (more of the 200 on the cards): the same play and wire format. */
const pyRun2 = makeArcadeRun<PyState, PyCheckpoint>({ tag: "pyramid", game: pyramidGameFor(2), checkpoint: pyCheckpoint, keys: PY_CHECKPOINT_KEYS, interval: PY_CHECKPOINT_INTERVAL });
/** pyramidRev 3 (a dead end waits for Undo): the same wire format. */
const pyRun3 = makeArcadeRun<PyState, PyCheckpoint>({ tag: "pyramid", game: pyramidGameFor(3), checkpoint: pyCheckpoint, keys: PY_CHECKPOINT_KEYS, interval: PY_CHECKPOINT_INTERVAL });
/** pyramidRev 4 (D6's Normal: Speed full by 22 s): the same wire format. */
const pyRun4 = makeArcadeRun<PyState, PyCheckpoint>({ tag: "pyramid", game: pyramidGameFor(4), checkpoint: pyCheckpoint, keys: PY_CHECKPOINT_KEYS, interval: PY_CHECKPOINT_INTERVAL });
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

/** The difficulty levels (15 Nov 2026): a level's run on its own game, built once (the wire format is the game's own). */
type LevelName = "easy" | "hard" | "expert";
function isLevelName(level: string | null | undefined): level is LevelName {
  return level === "easy" || level === "hard" || level === "expert";
}
const fcLevelRuns = new Map<string, ReturnType<typeof makeArcadeRun<FcState, FcCheckpoint>>>();
/** A level deal's run: freecellRev 6's are D6's levels (23 Nov 2026), any earlier stamp the levels before them. */
function fcLevelRun(level: FcLevelName, rev: number | null | undefined) {
  const v6 = (rev ?? 0) >= 6;
  const key = `${level}:${v6 ? 6 : 5}`;
  let r = fcLevelRuns.get(key);
  if (!r) fcLevelRuns.set(key, (r = makeArcadeRun<FcState, FcCheckpoint>({ tag: "freecell", game: freecellLevelGame(level, v6 ? 6 : 5), checkpoint: fcCheckpoint, keys: FC_CHECKPOINT_KEYS, interval: FC_CHECKPOINT_INTERVAL })));
  return r;
}

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
  /** The difficulty levels: hints asked for (0 at Normal). */
  hints: number;
}

/** The single place a FreeCell score is worked out (no stamp: freecellRev 1; a level deal on its level's game). */
export function replayFreecellRun(seed: number, raw: string, rev?: number | null, level?: string | null): FreecellResult {
  const v = rev ?? 1;
  const r = (isLevelName(level) ? fcLevelRun(level, rev) : v >= 6 ? fcRun6 : v >= 5 ? fcRun5 : v >= 4 ? fcRun4 : v >= 3 ? fcRun3 : v >= 2 ? fcRun2 : fcRun).replay(seed, raw);
  const s = r.state;
  return {
    ...r, home: fcHomeCount(s), sorted: fcSortedCards(s.cols), moves: s.moves, par: s.par, finished: s.ended === 1, finishSeconds: s.finishTick / 60,
    undos: s.undos ?? 0, resets: s.resets ?? 0, hints: s.hints ?? 0,
  };
}

export interface TripeaksResult extends FlatReplay<TpState, TpCheckpoint> {
  cleared: number;
  peaks: number;
  bestRun: number;
  finished: boolean;
  finishSeconds: number;
  stockLeft: number;
  /** Stock cards turned and (tripeaksRev 2) the deal's stock par (0 on rev 1). */
  stockTurns: number;
  stockPar: number;
  /** The difficulty levels: hints asked for and undos made (0 at Normal). */
  hints: number;
  undos: number;
}

const tpLevelRuns = new Map<string, ReturnType<typeof makeArcadeRun<TpState, TpCheckpoint>>>();
/** A level deal's run: tripeaksRev 4's are D6's levels (23 Nov 2026), any earlier stamp the levels before them. */
function tpLevelRun(level: LevelName, rev: number | null | undefined) {
  const v4 = (rev ?? 0) >= 4;
  const key = `${level}:${v4 ? 4 : 3}`;
  let r = tpLevelRuns.get(key);
  if (!r) tpLevelRuns.set(key, (r = makeArcadeRun<TpState, TpCheckpoint>({ tag: "tripeaks", game: tripeaksLevelGame(level, v4 ? 4 : 3), checkpoint: tpCheckpoint, keys: TP_CHECKPOINT_KEYS, interval: TP_CHECKPOINT_INTERVAL })));
  return r;
}

/** The single place a Summit score is worked out (no stamp: tripeaksRev 1; a level deal on its level's game). */
export function replayTripeaksRun(seed: number, raw: string, rev?: number | null, level?: string | null): TripeaksResult {
  const r = (isLevelName(level) ? tpLevelRun(level, rev) : (rev ?? 1) >= 4 ? tpRun4 : (rev ?? 1) >= 3 ? tpRun3 : (rev ?? 1) >= 2 ? tpRun2 : tpRun).replay(seed, raw);
  const s = r.state;
  return {
    ...r, cleared: s.clearedCount, peaks: s.peaks, bestRun: s.bestRun, finished: s.ended === 1, finishSeconds: s.finishTick / 60, stockLeft: s.stock.length - s.stockPos,
    stockTurns: s.turns, stockPar: s.stockPar ?? 0, hints: s.hints ?? 0, undos: s.undos ?? 0,
  };
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
  /** Cards placed (0–20) and whether the run finished (rev 1–2: all 20 placed; rev 3: the bonus column picked). */
  placed: number;
  finished: boolean;
  /** fiveHandsRev 3: the bonus column picked (−1 none) and its hand; `total` includes its points. */
  column: number;
  columnPoints: number;
  columnHand: string;
}

const fhLevelRuns = new Map<string, ReturnType<typeof makeArcadeRun<FhState, FhCheckpoint>>>();
/** A level deal's run: fiveHandsRev 4's are D6's levels (23 Nov 2026), any earlier stamp the levels before them. */
function fhLevelRun(level: LevelName, rev: number | null | undefined) {
  const key = `${level}:${rev === 4 ? 4 : 3}`;
  let r = fhLevelRuns.get(key);
  if (!r) fhLevelRuns.set(key, (r = makeArcadeRun<FhState, FhCheckpoint>({ tag: "fivehands", game: fiveHandsLevelGame(level, rev === 4 ? 4 : null), checkpoint: fhCheckpoint, keys: FH_CHECKPOINT_KEYS, interval: FH_CHECKPOINT_INTERVAL })));
  return r;
}

/** The single place a Five Hands score is worked out (no stamp: fiveHandsRev 1; a level deal on its level's game). */
export function replayFiveHandsRun(seed: number, raw: string, rev?: number | null, level?: string | null): FiveHandsResult {
  const r = (isLevelName(level) ? fhLevelRun(level, rev) : rev === 4 ? fhRun4 : (rev ?? 1) >= 3 ? fhRun3 : (rev ?? 1) >= 2 ? fhRun2 : fhRun).replay(seed, raw);
  const s = r.state;
  const t = fhTotals(s.rows, s.rev);
  const col = fhPickedHand(s);
  return { ...r, total: t.total + col.points, made: t.made, placed: s.turn, finished: s.ended === 1, column: col.column, columnPoints: col.points, columnHand: col.name };
}

/**
 * fiveHandsRev 3: the most a bonus column could add on this table (each of the five columns' hands, the best one), or
 * null until every row is complete (the pick needs them all). Display data for practice challenges (wave 2 C1b): read
 * from the final state, never part of the score.
 */
export function fiveHandsBestColumnPoints(s: Pick<FhState, "rows" | "rev">): number | null {
  if (s.rows.length < FH_ROWS || s.rows.some((row) => row.length < FH_SLOTS)) return null;
  let best = 0;
  for (let k = 0; k < FH_SLOTS; k++) best = Math.max(best, fhRowHand(fhColumn(s.rows, k), s.rev).points);
  return best;
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

const pyLevelRuns = new Map<string, ReturnType<typeof makeArcadeRun<PyState, PyCheckpoint>>>();
/** A level's replay (`rev` 4: D6's rows, pyramidRev 4; earlier level rounds on rev 3's level game). */
function pyLevelRun(level: LevelName, rev?: number | null) {
  const r4 = (rev ?? 1) >= PY_REV_ROWS;
  const key = `${level}:${r4 ? 4 : 3}`;
  let r = pyLevelRuns.get(key);
  if (!r) pyLevelRuns.set(key, (r = makeArcadeRun<PyState, PyCheckpoint>({ tag: "pyramid", game: pyramidLevelGame(level, r4 ? PY_REV_ROWS : null), checkpoint: pyCheckpoint, keys: PY_CHECKPOINT_KEYS, interval: PY_CHECKPOINT_INTERVAL })));
  return r;
}

/** The single place a Pyramid score is worked out (a level deal on its level's game). */
export function replayPyramidRun(seed: number, raw: string, rev?: number | null, level?: string | null): PyramidResult {
  const r = (isLevelName(level) ? pyLevelRun(level, rev) : (rev ?? 1) >= 4 ? pyRun4 : (rev ?? 1) >= 3 ? pyRun3 : (rev ?? 1) >= 2 ? pyRun2 : pyRun).replay(seed, raw);
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
