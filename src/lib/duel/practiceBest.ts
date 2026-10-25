/**
 * Device-only practice records. Never imported by grading or room code; practice_plays stays
 * server-only (clients can't read it), so the best lives in this device's storage.
 *
 * A best is kept per game and per version-stamp signature (practiceStamps.ts): a game dealt under
 * new stamps starts a fresh best, never compared with runs of older rules. Bests kept before
 * 17 Oct 2026 (`duelz-practice-best:<type>`, no stamps) are left unread: their rules are unknown.
 *
 * Bests v3 (25 Oct 2026, Joe's decision with the 200-point foundation, docs/scoring-200.md): every
 * device's practice bests start fresh once. Bests are read and written only under PRACTICE_BEST_PREFIX;
 * the v2 values (`duelz-practice-best:v2:<type>@<stamps>`) stay in storage untouched and are never read,
 * so nothing old can show, even for a frame: the first run under v3 shows no best and no "New best!"
 * until a second run beats it. Daily records, recent rooms and challenges keep their own keys.
 */
export const PRACTICE_BEST_PREFIX = "duelz-practice-best:v3:";
/** Earlier prefixes, kept only so checks can prove they are never read. */
export const RETIRED_PRACTICE_BEST_PREFIXES = ["duelz-practice-best:", "duelz-practice-best:v2:"] as const;
const PREFIX = PRACTICE_BEST_PREFIX;
const volatile = new Map<string, number>();

export function practiceBestKey(type: string, stamp: string): string {
  return storageKey(type, stamp);
}

function storageKey(type: string, stamp: string): string {
  return `${PREFIX}${type}@${stamp}`;
}

/** This device's best practice score for the game under these stamps, or null before any run. */
export function readPracticeBest(type: string, stamp: string): number | null {
  const key = storageKey(type, stamp);
  try {
    const raw = window.localStorage.getItem(key);
    const score = raw === null || raw.trim() === "" ? NaN : Number(raw);
    if (Number.isFinite(score) && score >= 0) {
      const best = Math.max(score, volatile.get(key) ?? 0);
      volatile.set(key, best);
      return best;
    }
  } catch {
    /* Empty, unavailable or blocked storage must not affect practice. */
  }
  return volatile.get(key) ?? null;
}

/**
 * Records a graded practice score. The best only ever rises; `improved` is true only when there was
 * an earlier best under the same stamps and this score is higher, so a first run is never a
 * "New best!".
 */
export function recordPracticeBest(
  type: string,
  stamp: string,
  score: number,
): { best: number | null; improved: boolean } {
  const previous = readPracticeBest(type, stamp);
  if (!Number.isFinite(score) || score < 0) return { best: previous, improved: false };
  const best = Math.max(previous ?? score, score);
  const key = storageKey(type, stamp);
  volatile.set(key, best);
  if (best !== previous) {
    try {
      window.localStorage.setItem(key, String(best));
    } catch {
      /* Session-only fallback. */
    }
  }
  return { best, improved: previous !== null && score > previous };
}
