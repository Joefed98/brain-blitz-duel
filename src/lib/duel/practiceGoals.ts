/**
 * Practice goals (6 Nov 2026): the device's challenge record, kept on this device only, as practice bests are
 * (practiceBest.ts). The whole record is one JSON value under PRACTICE_GOALS_KEY.
 *
 * Changed with Joe's approval, 13 Nov 2026 (stars only): the retired device stars (bronze 120, silver 160, gold 190) are removed. Stars live on
 * the account since wave 2 C1a (src/lib/practice/progress.ts, the server's 175+ star); nothing in the app read these.
 * A record stored with a `stars` field still reads: the field is ignored and dropped on the next write, and the
 * challenge record beside it is read and kept exactly as before (practice-goals-check section 5).
 *
 * Challenges (practiceChallenges.ts): each run's stored score and extra (the server's own grade) update the
 * challenge's best value (or its run count); a challenge is done once its value reaches its target, and stays done.
 *
 * Presentation and device storage only: never imported by grading, rooms or the server.
 */
import { PRACTICE_CHALLENGES, challengeLive, challengeTarget, challengeValueOf, type PracticeChallenge } from "./practiceChallenges";

export const PRACTICE_GOALS_KEY = "duelz-practice-goals:v1";

export interface ChallengeRecord {
  /** The best part points, bonus points or score in one run. */
  value: number;
  /** When it was completed (ISO date), once done. */
  done?: string;
}

export interface GoalsRecord {
  v: 1;
  challenges: Record<string, ChallengeRecord>;
}

const empty = (): GoalsRecord => ({ v: 1, challenges: {} });
/** Session-only copy when storage is blocked, and the last read (so a blocked write still shows this visit). */
let volatile: GoalsRecord | null = null;

function clean(raw: unknown): GoalsRecord {
  const out = empty();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as { challenges?: unknown };
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
  /** Challenges this run completed. */
  completed: PracticeChallenge[];
}

/**
 * Records one graded practice run (its stored score and extra): every challenge of the game. `best` is the practice
 * best after this run (practiceBest.ts's record); kept in the signature for its callers, unused since the stars went.
 */
export function recordPracticeGoals(
  type: string,
  score: number,
  extra: Record<string, unknown> | null | undefined,
  best: number | null,
  now: Date = new Date(),
): PracticeResultGoals {
  void best;
  const record = readGoals();
  const completed: PracticeChallenge[] = [];
  for (const challenge of PRACTICE_CHALLENGES) {
    if (challenge.type !== type) continue;
    // Hard and Expert challenges wait for their levels (wave 3.5): nothing is kept for them yet.
    if (!challengeLive(challenge)) continue;
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
  return { completed };
}

/** Checks only: forget the session copy (a reload). */
export function resetGoalsMemoryForChecks(): void {
  volatile = null;
}
