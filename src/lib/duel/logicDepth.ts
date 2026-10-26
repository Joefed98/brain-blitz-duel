/**
 * Logic depth to 200 (25 Oct 2026, docs/depth/d6-logic.md; docs/scoring-200.md). Eleven Logic games score to 200
 * on puzzles stamped `depthRev: 1`. Older puzzles keep their stamps and grade exactly as before.
 *
 * Every finish starts from puzzleScoreRev 3's shape: 120 + 30 × min(1, time left share ÷ fast) × efficiency, so a
 * solid player of today scores what they did. The top 50 comes from one of three routes:
 *
 *   - "stretch" (Box Six, Bomb Defusal, Mosaic, Colour Flood, Tents and Trees, Shikaku, Lamplighter): the game is
 *     unchanged; time left beyond `fast` earns up to 50 more on a curve that reaches 50 only at `elite`
 *     (stretch = 50 × ((left − fast) ÷ (elite − fast))^power, times efficiency²). Today's 150 pace scores 150, a
 *     little faster about 150–165, and only a very fast, clean finish reaches 190–200. Colour Flood's stretch needs
 *     the par moves (one over earns half).
 *   - "par" (Blackout, Hanoi, Polypotions): finishing in the puzzle's minimum (its par, shown on the board) adds
 *     20, plus up to 30 on the stretch games' curve (nothing at `fast`, all of it at `elite`), so par at today's 150
 *     pace is about 170, par at the elite pace 200, and the extra 50 is only reachable at par.
 *   - "clean" (Safe Cracker): the stretch, scaled by the tries to spare: all of it on the first try, half on the
 *     second, none on the last.
 *
 * Shared and pure (the phone's texts and the server's grade read the same numbers).
 */
import type { PuzzleData, PuzzleType } from "./types";
import { preTopupPinned } from "./depthTopup";

/** The stamp: puzzles dealt with it score to 200 (and the bigger boards' games deal their bigger boards). */
export const DEPTH_REV = 1;

export type DepthRoute = "stretch" | "par" | "clean";

export interface DepthGame {
  route: DepthRoute;
  /** Time left share (0–1) a finish needs for 150 (puzzleScoreRev 3's fastShare, refitted on the bigger boards). */
  fast: number;
  /** Stretch games: the time left share where the stretch reaches its full 50. */
  elite: number;
  /** Stretch curve exponent (above 1: the first seconds past `fast` earn little). */
  power: number;
}

/**
 * Per game. `fast` is puzzleScoreRev 3's figure for the games whose board is unchanged and the refit for the four
 * bigger boards (scripts/depth-d6-bands.ts); `elite` and `power` are fitted by the same script so that the
 * near-perfect kit (today's 150s) lands about 150–165 (about 165–175 at par on the par games) and the elite kit's
 * median about 190–200.
 */
export const DEPTH_GAMES: Readonly<Partial<Record<PuzzleType, DepthGame>>> = {
  lightsout: { route: "par", fast: 0.66, elite: 0.7, power: 1 },
  tower: { route: "par", fast: 0.69, elite: 0.77, power: 1 },
  tubes: { route: "par", fast: 0.67, elite: 0.78, power: 1 },
  safe: { route: "clean", fast: 0.74, elite: 0.772, power: 1.2 },
  sudoku: { route: "stretch", fast: 0.59, elite: 0.69, power: 1.8 },
  bomb: { route: "stretch", fast: 0.75, elite: 0.85, power: 1.5 },
  nonogram: { route: "stretch", fast: 0.65, elite: 0.77, power: 1.8 },
  flood: { route: "stretch", fast: 0.73, elite: 0.79, power: 1.5 },
  tents: { route: "stretch", fast: 0.64, elite: 0.75, power: 1.5 },
  shikaku: { route: "stretch", fast: 0.58, elite: 0.69, power: 1.8 },
  lightup: { route: "stretch", fast: 0.58, elite: 0.72, power: 1.5 },
};

export const DEPTH_TYPES = Object.keys(DEPTH_GAMES) as PuzzleType[];

/**
 * The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md): `depthRev: 2` for four games whose near-perfect
 * play sat under the 200-point bar (Safe Cracker, Box Six, Colour Flood, Shikaku). Same boards and play; the curve
 * starts a little earlier, so today's 150s land about 150–165 (Safe Cracker's clean crack, a feature, about 165–175),
 * and two partial credits (Safe Cracker's clues, Colour Flood's board run out of moves) keep trying play off 0.
 * Older rounds (depthRev 1) score exactly as before.
 */
export const DEPTH_REV_TOPUP = 2;

export interface DepthGameTopup extends DepthGame {
  /** Clean route: the fixed part of the top a first-try crack earns (the rest follows the stretch)… */
  cleanFixed?: number;
  /** …in full from `cleanFixedFull` of the clock left, rising evenly from `cleanFixedFrom` (a slow crack earns none). */
  cleanFixedFrom?: number;
  cleanFixedFull?: number;
}

export const DEPTH_GAMES_TOPUP: Readonly<Partial<Record<PuzzleType, DepthGameTopup>>> = {
  safe: { route: "clean", fast: 0.7, elite: 0.82, power: 1.5, cleanFixed: 15, cleanFixedFrom: 0.5, cleanFixedFull: 0.65 },
  sudoku: { route: "stretch", fast: 0.5, elite: 0.69, power: 1.3 },
  flood: { route: "stretch", fast: 0.73, elite: 0.79, power: 1.5 },
  shikaku: { route: "stretch", fast: 0.52, elite: 0.69, power: 1.3 },
};

export const DEPTH_TOPUP_TYPES = Object.keys(DEPTH_GAMES_TOPUP) as PuzzleType[];

/**
 * Intro demos recorded before the depth revision that no longer show the game as dealt (a bigger board, or no par
 * line / clean crack): stopped until re-recorded on depthRev 1 (introDemo.functions.ts). Box Six, Bomb Defusal and
 * Colour Flood play exactly as before, so their demos keep playing.
 */
export const DEPTH_DEMO_STOPS: ReadonlySet<string> = new Set(["nonogram", "tents", "shikaku", "lightup", "lightsout", "tower", "tubes", "safe"]);

/** The finish base and its speed points (puzzleScoreRev 3's 120 + 30). */
export const DEPTH_FINISH_BASE = 120;
export const DEPTH_SPEED_POINTS = 30;
/** The top: what a depth game adds above 150. */
export const DEPTH_TOP_POINTS = 50;
/** Par route: a par finish's fixed part; the rest (30) follows the stretch, nothing at `fast`, all of it at `elite`. */
export const DEPTH_PAR_BASE = 20;
/** Clean crack: the stretch's share by try (1st, 2nd, 3rd). */
export const DEPTH_CLEAN_SHARE = [1, 0.5, 0] as const;
/** Colour Flood: the stretch's share by moves over par (at par, one over). */
export const DEPTH_FLOOD_PAR_SHARE = [1, 0.5] as const;

export function isDepthType(type: string | null | undefined): type is PuzzleType {
  return !!type && (DEPTH_GAMES as Record<string, DepthGame | undefined>)[type] !== undefined;
}

/** The stored puzzle's depth revision (0 = before the depth change). */
export function depthRevOf(puzzle: unknown): number {
  const rev = (puzzle as { depthRev?: unknown } | null)?.depthRev;
  return typeof rev === "number" && Number.isFinite(rev) ? rev : 0;
}

/** True for a puzzle of one of the eleven games dealt on the depth revision. */
export function usesDepth(puzzle: PuzzleData | null | undefined): boolean {
  return !!puzzle && isDepthType(puzzle.type) && depthRevOf(puzzle) >= DEPTH_REV;
}

/** The depth revision new puzzles of `type` are dealt (2 for the top-up's games, 1 for the rest). */
export function dealtLogicDepthRev(type: PuzzleType): number {
  return DEPTH_GAMES_TOPUP[type] && !preTopupPinned() ? DEPTH_REV_TOPUP : DEPTH_REV;
}

/** The depth revision the app's texts state: the top-up's for its four games (never pinned by a check). */
export function liveLogicDepthRev(type: PuzzleType): number {
  return DEPTH_GAMES_TOPUP[type] ? DEPTH_REV_TOPUP : DEPTH_REV;
}

/** The game's curve on a depth revision (by default the one dealt today, which the texts state). */
export function depthGame(type: PuzzleType, rev = dealtLogicDepthRev(type)): DepthGameTopup {
  if (rev >= DEPTH_REV_TOPUP && DEPTH_GAMES_TOPUP[type]) return DEPTH_GAMES_TOPUP[type]!;
  return DEPTH_GAMES[type] ?? { route: "stretch", fast: 0.6, elite: 0.8, power: 1.5 };
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/** The 0–30 speed points (puzzleScoreRev 3's, on this game's `fast`). */
export function depthSpeedPoints(type: PuzzleType, left: number, efficiency: number, rev?: number): number {
  const t = Math.min(1, clamp(left, 0, 1) / depthGame(type, rev).fast);
  return Math.round(DEPTH_SPEED_POINTS * t * clamp(efficiency, 0, 1));
}

/** The stretch curve, 0 at `fast` (and below), 1 at `elite` (and above). */
export function depthStretchShare(type: PuzzleType, left: number, rev?: number): number {
  const g = depthGame(type, rev);
  if (g.elite <= g.fast) return 0;
  const x = clamp((clamp(left, 0, 1) - g.fast) / (g.elite - g.fast), 0, 1);
  return Math.pow(x, g.power);
}

export interface DepthFinishInput {
  /** Time left share 0–1. */
  left: number;
  /** puzzleScoreRev 3's efficiency (0–1): the game's own mistakes. */
  efficiency: number;
  /** Moves made and the par (par games and Colour Flood). */
  moves?: number | undefined;
  par?: number | undefined;
  /** Safe Cracker: the try that opened the safe (1–3). */
  openedOn?: number;
}

export interface DepthFinish {
  score: number;
  /** 120 + speed (0–30) + top (0–50). */
  speed: number;
  top: number;
  /** What earned the top: "par", "clean crack", or "" for the stretch (shown as speed). */
  topLabel: string;
  atPar?: boolean;
}

/** A finish on the depth revision. */
export function depthFinish(type: PuzzleType, input: DepthFinishInput, rev?: number): DepthFinish {
  const g = depthGame(type, rev);
  const eff = clamp(input.efficiency, 0, 1);
  const speed = depthSpeedPoints(type, input.left, eff, rev);
  let top = 0;
  let topLabel = "";
  let atPar: boolean | undefined;
  if (g.route === "par") {
    atPar = input.par !== undefined && input.par > 0 && input.moves !== undefined && input.moves <= input.par;
    top = atPar ? DEPTH_PAR_BASE + Math.round((DEPTH_TOP_POINTS - DEPTH_PAR_BASE) * depthStretchShare(type, input.left, rev)) : 0;
    topLabel = "par";
  } else if (g.route === "clean") {
    const share = DEPTH_CLEAN_SHARE[clamp(Math.round(input.openedOn ?? 3), 1, 3) - 1] ?? 0;
    const fixed = g.cleanFixed ?? 0;
    const ramp = g.cleanFixedFull !== undefined && g.cleanFixedFrom !== undefined ? clamp((input.left - g.cleanFixedFrom) / Math.max(0.01, g.cleanFixedFull - g.cleanFixedFrom), 0, 1) : 1;
    top = Math.round(fixed * ramp * share + (DEPTH_TOP_POINTS - fixed) * depthStretchShare(type, input.left, rev) * share);
    topLabel = "clean crack";
  } else {
    let share = eff * eff;
    if (type === "flood") {
      const over = input.par !== undefined && input.moves !== undefined ? input.moves - input.par : 99;
      share *= over <= 0 ? DEPTH_FLOOD_PAR_SHARE[0] : over === 1 ? DEPTH_FLOOD_PAR_SHARE[1] : 0;
      atPar = over <= 0;
    }
    top = Math.round(DEPTH_TOP_POINTS * depthStretchShare(type, input.left, rev) * share);
  }
  top = clamp(top, 0, DEPTH_TOP_POINTS);
  return { score: DEPTH_FINISH_BASE + speed + top, speed, top, topLabel, ...(atPar !== undefined ? { atPar } : {}) };
}

/** Seconds a clean finish must leave for 150 (the texts' "about N s"). */
export function depthFastSeconds(type: PuzzleType, limitMs: number, rev?: number): number {
  return Math.round((limitMs * (1 - depthGame(type, rev).fast)) / 1000);
}

/** Seconds of play a clean finish may take for the full top (stretch and clean games). */
export function depthEliteSeconds(type: PuzzleType, limitMs: number, rev?: number): number {
  return Math.round((limitMs * (1 - depthGame(type, rev).elite)) / 1000);
}
