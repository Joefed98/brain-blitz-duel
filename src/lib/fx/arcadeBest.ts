/**
 * Device-only arcade bests for room rounds, used only to choose the results
 * screen's "new personal best" moment. Never imported by grading, rooms or the
 * server; the stored score it reads is the server's. Practice keeps its own
 * record (practiceBest.ts) and passes its verdict in directly.
 */
const PREFIX = "duelz-arcade-room-best:";

interface Record_ {
  best: number;
  /** The run this verdict belongs to, so a remount never re-celebrates or double-counts. */
  key: string;
  improved: boolean;
}

const volatile = new Map<string, Record_>();

function read(type: string): Record_ | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + type);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record_>;
      if (
        typeof parsed.best === "number" &&
        Number.isFinite(parsed.best) &&
        typeof parsed.key === "string"
      ) {
        return { best: parsed.best, key: parsed.key, improved: parsed.improved === true };
      }
    }
  } catch {
    /* Blocked or corrupt storage falls back to this session only. */
  }
  return volatile.get(type) ?? null;
}

/** Small stable hash of a run string, for the per-run key. */
export function runKey(...parts: (string | number | null | undefined)[]): string {
  let h = 2166136261;
  const text = parts.map((p) => String(p ?? "")).join("|");
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/**
 * Records a stored room score and says whether it beat this device's previous
 * best for the game. The first ever score has nothing to beat, so it is not a
 * "new best" moment. Calling again with the same key returns the same verdict.
 */
export function recordArcadeRoomBest(type: string, score: number, key: string): boolean {
  if (typeof window === "undefined" || !Number.isFinite(score) || score < 0) return false;
  const previous = read(type);
  if (previous && previous.key === key) return previous.improved;
  const improved = previous !== null && score > previous.best;
  const next: Record_ = { best: Math.max(previous?.best ?? 0, score), key, improved };
  volatile.set(type, next);
  try {
    window.localStorage.setItem(PREFIX + type, JSON.stringify(next));
  } catch {
    /* Session-only fallback. */
  }
  return improved;
}
