/**
 * Attention rework (14 Oct 2026): Eagle Eye `scanRev 1`, Double Take `spotRev 1`
 * and Tally `countRev 2`. Shared by the server grader, the reveals and the
 * summaries so they always agree. Each rule is gated on its stamp in the stored
 * puzzle; unstamped (stored) rounds keep stagedRounds.ts / scoring.ts exactly as
 * before (scripts/attention-rework-check.ts).
 *
 * Every stamped round is also on the puzzle score shape (puzzleScoreRev 1): a
 * finish = 120 + PAR(30), unfinished credit at most 110.
 *
 *   Eagle Eye:   grid 3 has two target directions. Grids worth 40 / 40 / 30,
 *                share of eagles found − 3 per wrong tap; all three perfect = finish.
 *   Double Take: two pictures (sweet shop, then rock pool), six differences each,
 *                60 s. 10 per difference − 4 per wrong tap; a finish needs all twelve
 *                with at most 5 wrong taps in each picture.
 *   Tally:       a fourth tray asks "how many more A than B?", 60 s; 13 possible answers
 *                a tray. Trays worth 40 / 30 / 25 / 15, one off 15 %, further off 0;
 *                all four exact = finish.
 */
import { finishParts, partialParts } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";
import type {
  ArrowDir,
  CountUpPuzzleData,
  CountUpStage,
  SpotPuzzleData,
  SpotShape,
  SymbolScanPuzzleData,
  SymbolScanStage,
} from "./types";

export const SCAN_REV = 1;
export const SPOT_REV = 1;
/** Tally's comparison-tray revision (countRev 1 was the wider count ranges). */
export const COUNT_COMPARE_REV = 2;

export const ATTENTION_REWORK_TIME_MS = 60_000;

const clampMs = (ms: number, limit: number) => Math.max(0, Math.min(limit, ms));
const finish = (ms: number, limit: number) =>
  finishParts(speedBonusCurve(30, clampMs(ms, limit), limit));

/* ------------------------------ Eagle Eye ------------------------------ */

export const SCAN_REV1_WEIGHTS = [40, 40, 30] as const;
export const SCAN_REV1_WRONG = 3;

export function usesScanRev1(p: Pick<SymbolScanPuzzleData, "scanRev">): boolean {
  return (p.scanRev ?? 0) >= SCAN_REV;
}

/** The directions that count in a grid: the target and, on grid 3 of scanRev 1, the second one. */
export function scanTargetDirs(stage: SymbolScanStage): ArrowDir[] {
  return stage.alsoTarget ? [stage.target, stage.alsoTarget] : [stage.target];
}

export function scanStageMatches(stage: SymbolScanStage): number[] {
  const dirs = scanTargetDirs(stage);
  return stage.cells.flatMap((dir, i) => (dirs.includes(dir) ? [i] : []));
}

export interface ScanRev1Result {
  found: number;
  targets: number;
  wrong: number;
  points: number;
  perfect: boolean;
}

export function scanRev1StageResult(
  stage: number,
  selected: number[],
  targets: number[],
): ScanRev1Result {
  const weight = SCAN_REV1_WEIGHTS[stage] ?? 0;
  const found = targets.filter((t) => selected.includes(t)).length;
  const wrong = selected.filter((s) => !targets.includes(s)).length;
  const points = Math.max(
    0,
    Math.round((weight * found) / Math.max(1, targets.length)) - SCAN_REV1_WRONG * wrong,
  );
  return {
    found,
    targets: targets.length,
    wrong,
    points,
    perfect: found === targets.length && wrong === 0,
  };
}

export function scoreScanRev1(
  results: ScanRev1Result[],
  msRemaining: number,
  limit: number,
): number {
  if (results.length === SCAN_REV1_WEIGHTS.length && results.every((r) => r.perfect))
    return finish(msRemaining, limit);
  return partialParts(results.reduce((sum, r) => sum + r.points, 0));
}

/* ------------------------------ Double Take ----------------------------- */

export const SPOT_REV1_SCENES = 2;
export const SPOT_REV1_PER_SCENE = 6;
export const SPOT_TWO_POINTS = 10;
export const SPOT_TWO_WRONG_PENALTY = 4;
/** Wrong taps allowed in each picture for the round to still count as a finish. */
export const SPOT_TWO_WRONG_LIMIT = 5;

export type SpotTheme = "shop" | "reef";
export interface SpotScene {
  theme: SpotTheme;
  top: SpotShape[];
  bottom: SpotShape[];
}

export function usesSpotRev1(p: Pick<SpotPuzzleData, "spotRev">): boolean {
  return (p.spotRev ?? 0) >= SPOT_REV;
}

/** The pictures in play order: the sweet shop alone on stored rounds, then the rock pool on spotRev 1. */
export function spotScenes(p: SpotPuzzleData): SpotScene[] {
  const shop: SpotScene = { theme: "shop", top: p.top, bottom: p.bottom };
  return usesSpotRev1(p) && p.reef
    ? [shop, { theme: "reef", top: p.reef.top, bottom: p.reef.bottom }]
    : [shop];
}

/** spotRev 1 answers: one comma list of tapped cells per picture, joined by "|". */
export function parseSpotTaps(answer: string | null | undefined, scenes: number): number[][] {
  const parts = (answer ?? "").split("|");
  return Array.from({ length: scenes }, (_, i) => [
    ...new Set(
      (parts[i] ?? "")
        .split(",")
        .map((v) => Number.parseInt(v, 10))
        .filter((v) => Number.isFinite(v)),
    ),
  ]);
}

export interface SpotTwoResult {
  /** Differences found per picture. */
  found: number[];
  /** Distinct wrong cells per picture. */
  wrong: number[];
  finished: boolean;
}

export function spotTwoResult(p: SpotPuzzleData, answer: string | null | undefined): SpotTwoResult {
  const taps = parseSpotTaps(answer, SPOT_REV1_SCENES);
  const differences = p.differences ?? [];
  const found: number[] = [];
  const wrong: number[] = [];
  for (let scene = 0; scene < SPOT_REV1_SCENES; scene++) {
    const own = differences.filter((d) => (d.scene ?? 0) === scene);
    const tapped = taps[scene] ?? [];
    const cells = new Set(own.flatMap((d) => d.cells));
    found.push(own.filter((d) => d.cells.some((c) => tapped.includes(c))).length);
    wrong.push(tapped.filter((c) => !cells.has(c)).length);
  }
  const finished =
    found.every((n) => n >= SPOT_REV1_PER_SCENE) && wrong.every((n) => n <= SPOT_TWO_WRONG_LIMIT);
  return { found, wrong, finished };
}

export function scoreSpotTwo(r: SpotTwoResult, msRemaining: number, limit: number): number {
  if (r.finished) return finish(msRemaining, limit);
  const found = r.found.reduce((a, b) => a + b, 0);
  const wrong = r.wrong.reduce((a, b) => a + b, 0);
  return partialParts(SPOT_TWO_POINTS * found - SPOT_TWO_WRONG_PENALTY * wrong);
}

/* -------------------------------- Tally -------------------------------- */

export const COUNT_REV2_WEIGHTS = [40, 30, 25, 15] as const;
export const COUNT_REV2_TRAYS = 4;

export function usesCountRev2(p: Pick<CountUpPuzzleData, "countRev">): boolean {
  return (p.countRev ?? 0) >= COUNT_COMPARE_REV;
}

/** The true answer for a tray, from the stored scene (never a client value). */
export function countUpStageTruth(stage: CountUpStage): number {
  if (stage.compare) {
    const { more, less } = stage.compare;
    return (
      stage.shapes.filter((s) => s.colour === more).length -
      stage.shapes.filter((s) => s.colour === less).length
    );
  }
  return stage.shapes.filter(
    (s) => s.shape === stage.targetShape && s.colour === stage.targetColour,
  ).length;
}

/** Whether a shape is one the tray's question counts (both colours on a comparison tray). */
export function countUpCounts(
  stage: CountUpStage,
  shape: { shape: string; colour: string },
): boolean {
  if (stage.compare)
    return shape.colour === stage.compare.more || shape.colour === stage.compare.less;
  return shape.shape === stage.targetShape && shape.colour === stage.targetColour;
}

/** countRev 2: one off scores this share of the tray; two or more off scores nothing (blind guesses must not pay). */
export const COUNT_REV2_NEAR = 0.15;

export function countRev2StagePoints(stage: number, given: number | null, truth: number): number {
  if (given === null) return 0;
  const weight = COUNT_REV2_WEIGHTS[stage] ?? 0;
  const away = Math.abs(given - truth);
  if (away === 0) return weight;
  if (away === 1) return Math.round(weight * COUNT_REV2_NEAR);
  return 0;
}

export function scoreCountRev2(
  given: (number | null)[],
  truths: number[],
  msRemaining: number,
  limit: number,
): number {
  if (truths.length === COUNT_REV2_TRAYS && truths.every((t, i) => given[i] === t))
    return finish(msRemaining, limit);
  return partialParts(
    truths.reduce((sum, t, i) => sum + countRev2StagePoints(i, given[i] ?? null, t), 0),
  );
}
