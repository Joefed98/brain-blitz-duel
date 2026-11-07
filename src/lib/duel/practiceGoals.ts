/**
 * Practice goals (6 Nov 2026): mastery stars and challenges, kept on this device only, as practice bests are
 * (practiceBest.ts). To move to accounts later: the whole record is one JSON value under PRACTICE_GOALS_KEY.
 *
 * Stars: bronze at a practice best of 120, silver at 160, gold at 190 (every game scores out of 200). A star once
 * earned is kept, even when a game's new stamps start a fresh best; the tier shown is the higher of the stored one
 * and the current best's.
 *
 * Challenges (practiceChallenges.ts): each run's stored score and extra (the server's own grade) update the
 * challenge's best value (or its run count); a challenge is done once its value reaches its target, and stays done.
 *
 * Presentation and device storage only: never imported by grading, rooms or the server.
 */
import { PRACTICE_CHALLENGES, challengeTarget, challengeValueOf, type PracticeChallenge } from "./practiceChallenges";

export const PRACTICE_GOALS_KEY = "duelz-practice-goals:v1";

export type StarTier = 0 | 1 | 2 | 3;
/** Bronze, silver, gold: the practice best each needs. */
export const STAR_THRESHOLDS = [120, 160, 190] as const;
export const STAR_NAMES = ["", "Bronze", "Silver", "Gold"] as const;
export const STARS_PER_GAME = 3;

/** The tier a score earns. */
export function starsFor(score: number | null | undefined): StarTier {
  if (typeof score !== "number" || !Number.isFinite(score)) return 0;
  let tier = 0;
  for (const t of STAR_THRESHOLDS) if (score >= t) tier += 1;
  return tier as StarTier;
}

export interface ChallengeRecord {
  /** The best part points, bonus points or score in one run. */
  value: number;
  /** When it was completed (ISO date), once done. */
  done?: string;
}

export interface GoalsRecord {
  v: 1;
  stars: Record<string, number>;
  challenges: Record<string, ChallengeRecord>;
}

const empty = (): GoalsRecord => ({ v: 1, stars: {}, challenges: {} });
/** Session-only copy when storage is blocked, and the last read (so a blocked write still shows this visit). */
let volatile: GoalsRecord | null = null;

function clean(raw: unknown): GoalsRecord {
  const out = empty();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as { stars?: unknown; challenges?: unknown };
  if (r.stars && typeof r.stars === "object")
    for (const [k, v] of Object.entries(r.stars as Record<string, unknown>))
      if (typeof v === "number" && Number.isFinite(v)) out.stars[k] = Math.max(0, Math.min(STARS_PER_GAME, Math.floor(v)));
  if (r.challenges && typeof r.challenges === "object")
    for (const [k, v] of Object.entries(r.challenges as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const c = v as { value?: unknown; done?: unknown };
      const value = typeof c.value === "number" && Number.isFinite(c.value) ? Math.max(0, c.value) : 0;
      out.challenges[k] = typeof c.done === "string" ? { value, done: c.done } : { value };
    }
  return out;
}

/** This device's goals record (empty when nothing is stored or storage is unavailable). */
export function readGoals(): GoalsRecord {
  try {
    const raw = window.localStorage.getItem(PRACTICE_GOALS_KEY);
    if (raw) {
      volatile = clean(JSON.parse(raw));
      return volatile;
    }
  } catch {
    /* Blocked or corrupt storage: fall back to this visit's copy. */
  }
  return volatile ? clean(volatile) : empty();
}

function writeGoals(record: GoalsRecord): void {
  volatile = record;
  try {
    window.localStorage.setItem(PRACTICE_GOALS_KEY, JSON.stringify(record));
  } catch {
    /* Session-only fallback. */
  }
}

/** A game's stars: the stored tier or the current best's, whichever is higher. */
export function starsOf(type: string, best: number | null, record: GoalsRecord = readGoals()): StarTier {
  return Math.max(record.stars[type] ?? 0, starsFor(best)) as StarTier;
}

/** Stars earned across `types` and the most there are ("41 / 276 stars"). */
export function starTotal(types: readonly string[], bestOf: (type: string) => number | null, record: GoalsRecord = readGoals()): { earned: number; total: number } {
  let earned = 0;
  for (const t of types) earned += starsOf(t, bestOf(t), record);
  return { earned, total: types.length * STARS_PER_GAME };
}

export interface ChallengeState {
  challenge: PracticeChallenge;
  value: number;
  target: number;
  /** 0–1 for the bar. */
  progress: number;
  status: "new" | "progress" | "done";
}

export function challengeState(challenge: PracticeChallenge, record: GoalsRecord = readGoals()): ChallengeState {
  const stored = record.challenges[challenge.id];
  const target = challengeTarget(challenge.goal);
  const value = Math.min(target, stored?.value ?? 0);
  const done = Boolean(stored?.done) || value >= target;
  return {
    challenge,
    value,
    target,
    progress: target > 0 ? (done ? 1 : value / target) : 0,
    status: done ? "done" : value > 0 ? "progress" : "new",
  };
}

export interface PracticeResultGoals {
  /** The game's stars before and after this run. */
  starsBefore: StarTier;
  starsAfter: StarTier;
  /** Challenges this run completed. */
  completed: PracticeChallenge[];
}

/**
 * Records one graded practice run (its stored score and extra): the stars its best earns and every challenge of
 * the game. `best` is the practice best after this run (practiceBest.ts's record).
 */
export function recordPracticeGoals(
  type: string,
  score: number,
  extra: Record<string, unknown> | null | undefined,
  best: number | null,
  now: Date = new Date(),
): PracticeResultGoals {
  const record = readGoals();
  const starsBefore = (record.stars[type] ?? 0) as StarTier;
  const starsAfter = Math.max(starsBefore, starsFor(best), starsFor(score)) as StarTier;
  record.stars[type] = starsAfter;
  const completed: PracticeChallenge[] = [];
  for (const challenge of PRACTICE_CHALLENGES) {
    if (challenge.type !== type) continue;
    const got = challengeValueOf(challenge.goal, score, extra);
    const prev = record.challenges[challenge.id] ?? { value: 0 };
    if (prev.done) continue;
    const value = Math.max(prev.value, got);
    const next: ChallengeRecord = { value };
    if (value >= challengeTarget(challenge.goal)) {
      next.done = now.toISOString().slice(0, 10);
      completed.push(challenge);
    }
    record.challenges[challenge.id] = next;
  }
  writeGoals(record);
  return { starsBefore, starsAfter, completed };
}

/** The star line under the new-best moment ("Silver star earned"), or null when no star was earned. */
export function starLine(goals: Pick<PracticeResultGoals, "starsBefore" | "starsAfter"> | null): string | null {
  if (!goals || goals.starsAfter <= goals.starsBefore) return null;
  return `${STAR_NAMES[goals.starsAfter]} star earned`;
}

/** Checks only: forget the session copy (a reload). */
export function resetGoalsMemoryForChecks(): void {
  volatile = null;
}
