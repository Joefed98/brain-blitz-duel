/**
 * Move, pour, tilt, placement and try limits (13 Oct 2026). Shared by the phone
 * (the counters on the board) and the server (grading reads the stored limit).
 *
 * Random or brute-force play used to pay in these puzzles: any colour sequence
 * floods Colour Flood's board, random pours solve Polypotions, random tilts park
 * Topsy-Turvy's balls, Counterweight's small scales balance by chance and
 * Operator's CORRECT flash can be brute-forced. Each game now shows a limit
 * ("Moves 7 / 12"); running out ends that board as unfinished, scored on the
 * game's existing unfinished rules.
 *
 * Every limit is gated on its own game's stamp in the stored puzzle (floodRev,
 * tubesRev, gravityRev, balanceRev, equationRev, measureRev 2), set by
 * generatePuzzle (moveLimits.server.ts). Puzzles without the stamp, every
 * stored round included, have no limit and grade exactly as before
 * (scripts/move-limits-check.ts). The limit itself is stored on the puzzle, so
 * a later tuning can never change an old round.
 *
 * What the server can verify: Colour Flood, Polypotions, Topsy-Turvy and
 * Brimful send every move (Polypotions' Undo and Reset included from tubesRev
 * 1), so the server replays only the moves inside the limit. Counterweight and
 * Operator send their final placements / operators plus the phone's own hang /
 * try counts (after `#`); the server refuses a scale or equation whose recorded
 * count is over the limit, but the count itself is the phone's word.
 */
import type {
  BalancePuzzleData,
  EquationPuzzleData,
  FloodPuzzleData,
  GravityPuzzleData,
  MeasurePuzzleData,
  TubesPuzzleData,
} from "./types";

export const FLOOD_LIMIT_REV = 1;
/**
 * Colour Flood floodRev 2 (Pattern / Logic batch, 14 Oct 2026): par + FLOOD_REV2_SPARE_MOVES taps,
 * stored on the puzzle (`moveLimit`) like floodRev 1. A flat 15 was tried first and par + 3
 * measured; par + 2 kept good players' median at 146 (docs/puzzle-score-bands-oct-2026.md), so
 * the limit rule matches floodRev 1 and the stamp marks the batch's boards (the raised colours).
 * Every rule that reads the stored limit (the counter, the server's cut-off, the waste factor
 * reaching 0 at the limit) is unchanged.
 */
export const FLOOD_LIMIT_REV2 = 2;
export const FLOOD_REV2_SPARE_MOVES = 2;
export const TUBES_LIMIT_REV = 1;
export const GRAVITY_LIMIT_REV = 1;
export const BALANCE_LIMIT_REV = 1;
export const EQUATION_LIMIT_REV = 1;
/** Brimful's rules marker moves from 1 to 2 with the per-board move limit. */
export const MEASURE_LIMIT_REV = 2;
/**
 * Tally's current count revision: 1 (13 Oct 2026) = the wider count ranges (generation
 * only); 2 (14 Oct 2026) = the same ranges plus the comparison tray and 60 s
 * (attentionRev.ts COUNT_COMPARE_REV).
 */
export const COUNTUP_COUNT_REV = 2;

const positive = (n: unknown): number | null =>
  typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;

/** Colour Flood: taps allowed, or null on an unlimited (stored) round. */
export function floodMoveLimit(p: Pick<FloodPuzzleData, "floodRev" | "moveLimit">): number | null {
  return (p.floodRev ?? 0) >= FLOOD_LIMIT_REV ? positive(p.moveLimit) : null;
}

/** Polypotions: pours allowed (Undo and Reset never give one back), or null. */
export function tubesPourLimit(p: Pick<TubesPuzzleData, "tubesRev" | "pourLimit">): number | null {
  return (p.tubesRev ?? 0) >= TUBES_LIMIT_REV ? positive(p.pourLimit) : null;
}

/** Polypotions from tubesRev 1 sends Undo and Reset in its pour list. */
export function tubesSendsUndo(p: Pick<TubesPuzzleData, "tubesRev">): boolean {
  return (p.tubesRev ?? 0) >= TUBES_LIMIT_REV;
}

/** Topsy-Turvy: tilts allowed, or null. */
export function gravityTiltLimit(
  p: Pick<GravityPuzzleData, "gravityRev" | "tiltLimit">,
): number | null {
  return (p.gravityRev ?? 0) >= GRAVITY_LIMIT_REV ? positive(p.tiltLimit) : null;
}

/** Counterweight: hangs allowed on each scale, or null. */
export function balancePlaceLimits(
  p: Pick<BalancePuzzleData, "balanceRev" | "placeLimits">,
): number[] | null {
  if ((p.balanceRev ?? 0) < BALANCE_LIMIT_REV || !Array.isArray(p.placeLimits)) return null;
  return p.placeLimits.every((n) => positive(n) !== null) ? p.placeLimits : null;
}

/** Operator: full operator sets a player may try on each equation, or null. */
export function equationTryLimit(
  p: Pick<EquationPuzzleData, "equationRev" | "tryLimit">,
): number | null {
  return (p.equationRev ?? 0) >= EQUATION_LIMIT_REV ? positive(p.tryLimit) : null;
}

/** Brimful: moves allowed on each board, or null. */
export function measureMoveLimits(
  p: Pick<MeasurePuzzleData, "measureRev" | "moveLimits">,
): number[] | null {
  if ((p.measureRev ?? 0) < MEASURE_LIMIT_REV || !Array.isArray(p.moveLimits)) return null;
  return p.moveLimits.every((n) => positive(n) !== null) ? p.moveLimits : null;
}

/**
 * Counterweight and Operator answers carry the phone's per-stage counts after
 * a `#` ("3,5|1,2,6|…#4,7,9"). Stored rounds never contain `#`, so the body is
 * the whole answer there.
 */
export function splitCountSuffix(answer: string | null | undefined): {
  body: string;
  counts: number[];
} {
  const raw = String(answer ?? "");
  const at = raw.indexOf("#");
  if (at < 0) return { body: raw, counts: [] };
  const counts = raw
    .slice(at + 1)
    .split(",")
    .map((part) => Number.parseInt(part, 10))
    .map((n) => (Number.isInteger(n) && n >= 0 ? n : 0));
  return { body: raw.slice(0, at), counts };
}

export function joinCountSuffix(body: string, counts: readonly number[]): string {
  return `${body}#${counts.map((n) => Math.max(0, Math.round(n) || 0)).join(",")}`;
}

/** The counter on the board: "7 / 12". */
export function limitText(used: number, limit: number): string {
  return `${Math.min(used, limit)} / ${limit}`;
}
