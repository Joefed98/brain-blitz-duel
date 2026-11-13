/**
 * Practice challenges (6 Nov 2026; the full catalogue since wave 2 C1b, 11 Nov 2026): 261 challenges over the 92 active
 * games (practiceChallenges.data.ts, docs/challenges/catalogue.md), each read only from what the server stores with a
 * graded run. Nothing here changes how a game plays or scores.
 *
 * `evaluateChallenge` is the one checker: the server calls it on its own graded result (src/lib/challenges/
 * challenges.server.ts), never on anything the phone says. The phone uses the same functions only to draw progress.
 *
 *   part   an arcade game on the arcade scoring standard: one of its parts (the reveal line "<Label>: … → N of M",
 *          extra.reveal.lines, built by the server's replay) reaching `max` in a single run;
 *   bonus  a puzzle on the scoring standard: a finish (extra.parts.kind "finish") whose bonus (par or clean,
 *          extra.parts.efficiency) reaches `max`;
 *   speed  the same finish with its speed points (extra.parts.speed) at `max`: solved by the game's "full by" time;
 *   score  one run scoring `score` or more (the bar shows the best run so far);
 *   check  every condition holds in one run (stored fields, reveal lines and tiles; practiceChallenges.data.ts).
 *
 * Every number is the game's own: practice-goals-check proves each against the live specs, the standard's rules and
 * the sims' constants, so a retune that moves one fails the check. Shared and pure; no registry import.
 */
import { isPlayable } from "./catalogue";
import {
  CATALOGUE,
  LIVE_CHALLENGE_LEVELS,
  type ChallengeCond,
  type ChallengeGoal,
  type ChallengeLevel,
  type CmpOp,
  type PracticeChallenge,
} from "./practiceChallenges.data";

export type { ChallengeCond, ChallengeGoal, ChallengeLevel, PracticeChallenge } from "./practiceChallenges.data";
export { LIVE_CHALLENGE_LEVELS } from "./practiceChallenges.data";

export const PRACTICE_CHALLENGES: readonly PracticeChallenge[] = CATALOGUE;

const BY_ID = new Map(CATALOGUE.map((c) => [c.id, c]));
/** A challenge by id (undefined for an id not in the catalogue). */
export function challengeById(id: string): PracticeChallenge | undefined {
  return BY_ID.get(id);
}

/**
 * Whether a challenge can be completed now: its level is dealt and its game is playable (a retired game's challenges
 * are hidden and count for nothing, 13 Nov 2026; their stored completions stay and return with the game).
 */
export function challengeLive(c: PracticeChallenge): boolean {
  return LIVE_CHALLENGE_LEVELS.includes(c.level) && isPlayable(c.type);
}

/** A graded run as the server stores it. */
export interface GradedRun {
  score: number;
  isCorrect?: boolean | undefined;
  reactionAvgMs?: number | null | undefined;
  extra: Record<string, unknown> | null | undefined;
  /** The dealt level (wave 3.5); a run with none is Classic. */
  level?: ChallengeLevel | null;
}

/** A standard part line as the server stores it: "<Label>: <detail> → <points> of <max>". */
const STD_PART_LINE = /^([^:→]+): .* → (-?\d+) of (\d+)$/;

function partLine(extra: Record<string, unknown> | null | undefined, label: string): { points: number; max: number } | null {
  const lines = (extra?.["reveal"] as { lines?: unknown } | undefined)?.lines;
  if (!Array.isArray(lines)) return null;
  for (const line of lines) {
    if (typeof line !== "string") continue;
    const m = STD_PART_LINE.exec(line);
    if (m && m[1] === label) return { points: Math.max(0, Number(m[2])), max: Number(m[3]) };
  }
  return null;
}

/** A value at a dotted path of the stored extra: numbers as they are, booleans as 1 / 0, else null. */
export function extraNumber(extra: Record<string, unknown> | null | undefined, path: string): number | null {
  let v: unknown = extra;
  for (const k of path.split(".")) {
    if (!v || typeof v !== "object") return null;
    v = (v as Record<string, unknown>)[k];
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function extraArray(extra: Record<string, unknown> | null | undefined, path: string): unknown[] | null {
  let v: unknown = extra;
  for (const k of path.split(".")) {
    if (!v || typeof v !== "object") return null;
    v = (v as Record<string, unknown>)[k];
  }
  return Array.isArray(v) ? v : null;
}

function tileNumber(extra: Record<string, unknown> | null | undefined, label: string): number | null {
  const tiles = (extra?.["reveal"] as { tiles?: unknown } | undefined)?.tiles;
  if (!Array.isArray(tiles)) return null;
  for (const t of tiles) {
    const tt = t as { label?: unknown; value?: unknown } | null;
    if (tt?.label !== label) continue;
    const m = /^\s*(-?\d+)/.exec(String(tt.value ?? ""));
    return m ? Number(m[1]) : null;
  }
  return null;
}

function cmp(a: number, op: CmpOp, b: number): boolean {
  switch (op) {
    case "eq":
      return a === b;
    case "gte":
      return a >= b;
    case "lte":
      return a <= b;
    case "lt":
      return a < b;
    case "gt":
      return a > b;
  }
}

function isFinish(extra: Record<string, unknown> | null | undefined): boolean {
  if (extra?.["standard"] !== 1) return false;
  const parts = extra["parts"] as { kind?: string } | undefined;
  return parts?.kind === "finish";
}

/** One condition on one run: whether it holds, and the measure it read (for the progress bar). */
export function condOn(cond: ChallengeCond, run: GradedRun): { ok: boolean; value: number | null } {
  const extra = run.extra;
  switch (cond.c) {
    case "finish": {
      const ok = isFinish(extra);
      return { ok, value: ok ? 1 : 0 };
    }
    case "score": {
      const v = Number.isFinite(run.score) ? Math.max(0, run.score) : 0;
      return { ok: cmp(v, cond.op, cond.v), value: v };
    }
    case "correct":
      return { ok: run.isCorrect === true, value: run.isCorrect === true ? 1 : 0 };
    case "avgMs": {
      const v = typeof run.reactionAvgMs === "number" && Number.isFinite(run.reactionAvgMs) ? run.reactionAvgMs : null;
      return { ok: v !== null && cmp(v, cond.op, cond.v), value: v };
    }
    case "field": {
      const a = extraNumber(extra, cond.path);
      const b = typeof cond.v === "string" ? extraNumber(extra, cond.v.slice(1)) : cond.v;
      return { ok: a !== null && b !== null && cmp(a, cond.op, b), value: a };
    }
    case "len": {
      const arr = extraArray(extra, cond.path);
      const n = arr ? arr.length : null;
      return { ok: n !== null && cmp(n, cond.op, cond.v), value: n };
    }
    case "all": {
      const arr = extraArray(extra, cond.path);
      const ok = Boolean(arr && arr.length > 0 && arr.every((x) => x === true));
      return { ok, value: ok ? 1 : 0 };
    }
    case "line": {
      const p = partLine(extra, cond.label);
      return { ok: p !== null && cmp(p.points, cond.op, cond.v), value: p ? p.points : null };
    }
    case "full": {
      const p = partLine(extra, cond.label);
      return { ok: p !== null && p.max === cond.max && p.points >= cond.max, value: p ? p.points : null };
    }
    case "tile": {
      const v = tileNumber(extra, cond.label);
      return { ok: v !== null && cmp(v, cond.op, cond.v), value: v };
    }
  }
}

/** The condition a check's progress bar follows: `bar`, else the last one with a numeric target. */
function barCond(goal: Extract<ChallengeGoal, { kind: "check" }>): ChallengeCond | null {
  if (goal.bar !== undefined) return goal.all[goal.bar] ?? null;
  for (let i = goal.all.length - 1; i >= 0; i--) {
    const c = goal.all[i]!;
    if (c.c === "full" || ((c.c === "score" || c.c === "line" || c.c === "tile" || c.c === "len") && (c.op === "gte" || c.op === "gt")))
      return c;
    if (c.c === "field" && typeof c.v === "number" && (c.op === "gte" || c.op === "gt") && c.v > 1) return c;
  }
  return null;
}

/** The challenge's target on its progress bar (the part's or bonus's maximum, the score needed, or 1 for a yes / no). */
export function challengeTarget(goal: ChallengeGoal): number {
  if (goal.kind === "score") return goal.score;
  if (goal.kind !== "check") return goal.max;
  const c = barCond(goal);
  if (!c) return 1;
  if (c.c === "full") return c.max;
  if (c.c === "field") return typeof c.v === "number" ? c.v : 1;
  return "v" in c && typeof c.v === "number" ? c.v : 1;
}

/**
 * What one graded run gives a challenge: the part's or bonus's points, the run's score, the bar's measure, or for a
 * yes / no check 1 when it holds. Read only from the stored score and extra (the server's own grade); a run with no
 * such part reads 0. A check's value counts towards its target only on a run that meets every condition but the bar's
 * (otherwise it reads at most target − 1, so a bar never shows done for a run that didn't complete it).
 */
export function challengeValueOf(goal: ChallengeGoal, score: number, extra: Record<string, unknown> | null | undefined, run?: Partial<GradedRun>): number {
  if (goal.kind === "score") return Number.isFinite(score) ? Math.max(0, score) : 0;
  if (goal.kind === "part") {
    const p = partLine(extra, goal.label);
    return p ? p.points : 0;
  }
  if (goal.kind === "bonus" || goal.kind === "speed") {
    // A puzzle on the scoring standard: only a finish counts.
    if (!isFinish(extra)) return 0;
    const parts = extra!["parts"] as { efficiency?: number; speed?: number };
    const v = goal.kind === "bonus" ? parts.efficiency : parts.speed;
    return typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;
  }
  const full: GradedRun = { score, extra, isCorrect: run?.isCorrect, reactionAvgMs: run?.reactionAvgMs };
  const target = challengeTarget(goal);
  const met = goal.all.every((c) => condOn(c, full).ok);
  if (met) return Math.max(target, barValue(goal, full));
  const v = barValue(goal, full);
  return Math.max(0, Math.min(target - (target > 1 ? 1 : target), v));
}

function barValue(goal: Extract<ChallengeGoal, { kind: "check" }>, run: GradedRun): number {
  const c = barCond(goal);
  if (!c) return goal.all.every((x) => condOn(x, run).ok) ? 1 : 0;
  const v = condOn(c, run).value;
  return v === null ? 0 : Math.max(0, v);
}

/** Whether one run completes a challenge's goal (ignoring its level). */
export function goalMet(goal: ChallengeGoal, run: GradedRun): boolean {
  if (goal.kind === "check") return goal.all.every((c) => condOn(c, run).ok);
  return challengeValueOf(goal, run.score, run.extra) >= challengeTarget(goal);
}

/**
 * The checker: whether one server-graded run completes a challenge, and the value it shows on the bar. A Hard or
 * Expert challenge never completes while its level isn't live, and only on a run dealt at its level.
 */
export function evaluateChallenge(c: PracticeChallenge, run: GradedRun): { met: boolean; value: number } {
  const value = challengeValueOf(c.goal, run.score, run.extra, run);
  const level = run.level ?? "classic";
  const met = challengeLive(c) && level === c.level && goalMet(c.goal, run);
  return { met, value };
}

/** The challenges for one game. */
export function challengesFor(type: string): PracticeChallenge[] {
  return PRACTICE_CHALLENGES.filter((c) => c.type === type);
}
