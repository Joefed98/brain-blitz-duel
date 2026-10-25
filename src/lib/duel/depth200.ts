/**
 * Depth to 200 (25 Oct 2026, docs/depth/d3-speed-attention.md): the shared arithmetic the twelve Speed and
 * Attention games' new revisions use to score past 150 (docs/scoring-200.md). Pure, the same on every phone and
 * the server; each game's own revision and features live in `depth/<game>.ts` (rules, texts) and
 * `depth/<game>.server.ts` (grading), dispatched by `depth200.server.ts`.
 *
 * STRETCH (a finish puzzle that is unchanged in play): below the old 150 pace a finish scores exactly as
 * `puzzleScoreRev 3` (120 + 30 × min(1, left ÷ fastShare) × efficiency); from there a clean finish keeps
 * climbing, `stretchTop` points over the next stretch of the clock to `eliteShare`, so play that reached 150 today
 * lands about 150–165 and only clearly faster, error-free play reaches the top. Mistakes cut the stretch harder
 * than the speed part (efficiency squared), so the top is for clean runs only.
 */

export interface StretchCurve {
  /** Share of the clock left at today's 150 (the game's rev-3 fastShare). */
  fastShare: number;
  /** Share of the clock left where a clean finish reaches the stretch's top. */
  eliteShare: number;
  /** Points above 150 at eliteShare (≤ 50). */
  stretchTop: number;
  /** Curve shape above fastShare: 1 straight, above 1 slow at first (the first seconds past today's pace add little). */
  power?: number;
}

/** 120 + speed (as rev 3) and the stretch above 150, for a finish with `left` (0–1) of the clock and `efficiency` (0–1). */
export function stretchFinishScore(curve: StretchCurve, left: number, efficiency: number): { score: number; speed: number; stretch: number } {
  const t = clamp01(left);
  const e = clamp01(efficiency);
  const fast = Math.max(0.01, curve.fastShare);
  const speed = Math.round(30 * Math.min(1, t / fast) * e);
  const over = curve.eliteShare > fast ? clamp01((t - fast) / (curve.eliteShare - fast)) : 0;
  const stretch = Math.round(Math.max(0, Math.min(50, curve.stretchTop)) * Math.pow(over, curve.power ?? 1) * e * e);
  return { score: 120 + speed + stretch, speed, stretch };
}

/** Straight lines between [x, score] knots (x rising), flat beyond both ends, rounded (scoring.ts knotScore's shape). */
export function knots(table: readonly (readonly [number, number])[], x: number): number {
  const first = table[0]!;
  const last = table[table.length - 1]!;
  if (!(x > first[0])) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]!;
    if (x > x1) continue;
    const [x0, y0] = table[i - 1]!;
    return Math.round(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
  }
  return last[1];
}

/** Every depth score is a whole number from 0 to the 200 ceiling. */
export function depthClamp(score: number, max = 200): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(max, Math.round(score)));
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}
