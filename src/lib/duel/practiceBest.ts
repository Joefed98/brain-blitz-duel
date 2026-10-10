/** Device-only practice records. Never imported by grading or room code. */
const PREFIX = "duelz-practice-best:";
const volatile = new Map<string, number>();
export function readPracticeBest(type: string): number | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + type);
    const score = raw === null || raw.trim() === "" ? NaN : Number(raw);
    if (Number.isFinite(score) && score >= 0) {
      const best = Math.max(score, volatile.get(type) ?? 0);
      volatile.set(type, best);
      return best;
    }
  } catch {
    /* Empty, unavailable or blocked storage must not affect practice. */
  }
  return volatile.get(type) ?? null;
}
export function recordPracticeBest(
  type: string,
  score: number,
): { best: number | null; improved: boolean } {
  const previous = readPracticeBest(type);
  if (!Number.isFinite(score) || score < 0) return { best: previous, improved: false };
  const best = Math.max(previous ?? 0, score);
  volatile.set(type, best);
  try {
    window.localStorage.setItem(PREFIX + type, String(best));
  } catch {
    /* Session-only fallback. */
  }
  return { best, improved: score > (previous ?? 0) };
}
