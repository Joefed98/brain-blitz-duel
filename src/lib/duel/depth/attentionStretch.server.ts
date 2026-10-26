/**
 * Depth to 200, Attention (25 Oct 2026): the stretch grade Eagle Eye scanRev 2, Double Take spotRev 2 and Tally
 * countRev 3 share. An unfinished round is puzzleScoreRev 3's exactly (110 × progress ÷ the game's one-short share,
 * puzzleProgress.ts); a finish is rev 3's 120 + 30 × min(1, left ÷ fastShare) × efficiency, then the stretch above
 * 150 (depth200.ts stretchFinishScore), cut by `keep` (the game's own mistake measure, 0–1, squared), plus a
 * feature bonus on a finish. The breakdown in `extra` adds up to the score.
 */
import { latestTapMs, type Graded } from "../grade";
import { depthClamp, stretchFinishScore, type StretchCurve } from "../depth200";
import type { DepthGradeInput } from "../depth200.server";
import { PUZZLE_FINISH_BASE, storedScoreParts, type ScoreParts } from "../puzzleScoreRev";
import { rev3Efficiency, rev3Game, rev3Unfinished } from "../puzzleScoreRev3";
import { rev3EfficiencyOverride, rev3Progress } from "../puzzleProgress";
import { puzzleTimeLimitMs } from "../registry";

export interface StretchOptions {
  curve: StretchCurve;
  /** The game's mistake measure for the climb above 150 (1 = clean). */
  keep: number;
  /** The puzzle top-up: where the stretch starts (a share of the clock left below rev 3's fastShare); the speed part stays rev 3's. */
  stretchFrom?: number;
  /** Feature points on a finish (Double Take's hidden difference). */
  bonus?: { points: number; measure: string };
}

export function attentionStretchGrade({ puzzle, answer, graded, receivedMsRemaining }: DepthGradeInput, opts: StretchOptions): Graded {
  const limit = puzzleTimeLimitMs(puzzle);
  const parts1 = storedScoreParts(graded.extra);
  const finished = graded.isCorrect && (parts1 === null || parts1.kind === "finish");
  if (!finished) {
    const r = rev3Unfinished(
      puzzle.type,
      rev3Progress({ puzzle, answer, extra: graded.extra, latestMs: latestTapMs(limit, receivedMsRemaining) }) ??
        Math.max(0, parts1 ? parts1.base : graded.score) / 110,
    );
    return { ...graded, isCorrect: false, score: r.score, extra: { ...(graded.extra ?? {}), parts: r.parts, rev1Score: graded.score, progressShare: r.progress } };
  }
  const eff = rev3EfficiencyOverride(puzzle, graded.extra) ?? rev3Efficiency(parts1, graded.storedMs, limit);
  const left = limit > 0 ? Math.max(0, Math.min(limit, graded.storedMs)) / limit : 0;
  // The speed part is rev 3's own (the same fastShare), so every finish up to the old 150 pace scores as before.
  const curve = { ...opts.curve, fastShare: rev3Game(puzzle.type).fastShare };
  const { speed } = stretchFinishScore(curve, left, eff);
  const keep = Math.max(0, Math.min(1, opts.keep));
  const stretchCurve = opts.stretchFrom !== undefined ? { ...opts.curve, fastShare: opts.stretchFrom } : curve;
  const { stretch } = stretchFinishScore(stretchCurve, left, eff * keep);
  const bonus = opts.bonus && opts.bonus.points > 0 ? Math.round(opts.bonus.points) : 0;
  const score = depthClamp(PUZZLE_FINISH_BASE + speed + stretch + bonus);
  const parts: ScoreParts = {
    kind: "finish",
    base: PUZZLE_FINISH_BASE,
    speed: score - PUZZLE_FINISH_BASE - bonus,
    ...(bonus ? { efficiency: bonus, measure: opts.bonus!.measure } : {}),
  };
  return {
    ...graded,
    isCorrect: true,
    score,
    extra: {
      ...(graded.extra ?? {}),
      parts,
      rev1Score: graded.score,
      time: round3(left),
      efficiency: round3(eff),
      stretch,
      keep: round3(keep),
      ...(opts.bonus ? { bonusPoints: bonus } : {}),
    },
  };
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
