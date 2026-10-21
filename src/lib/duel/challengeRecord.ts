/**
 * This device's own friend-challenge record (22 Oct 2026, device storage only): the challenges it
 * made or shared (Profile's "Your challenges" lists them with the server's results), the links it has
 * opened (so a link's opening is counted once), and whether it finished someone else's challenge, so
 * its first room and first daily afterwards are counted once each (the beta's follow-up numbers).
 * Wrapped in try/catch throughout: blocked storage only loses the convenience.
 */
export const CHALLENGE_RECORD_KEY = "duelz-challenges:v1";

export interface ChallengeRecord {
  /** Codes this device made or shared, newest first (at most 30). */
  mine: { code: string; at: number }[];
  /** Codes whose link this device has opened. */
  opened: string[];
  /** The challenge this device finished as a friend (the follow-ups' reference), if any. */
  friendFinished: string | null;
  /** Follow-ups already counted. */
  followups: ("room" | "daily")[];
}

const EMPTY: ChallengeRecord = { mine: [], opened: [], friendFinished: null, followups: [] };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readChallengeRecord(): ChallengeRecord {
  try {
    const raw = JSON.parse(
      storage()?.getItem(CHALLENGE_RECORD_KEY) ?? "null",
    ) as Partial<ChallengeRecord> | null;
    if (!raw) return { ...EMPTY };
    return {
      mine: Array.isArray(raw.mine) ? raw.mine.filter((m) => m && typeof m.code === "string") : [],
      opened: Array.isArray(raw.opened) ? raw.opened.filter((c) => typeof c === "string") : [],
      friendFinished: typeof raw.friendFinished === "string" ? raw.friendFinished : null,
      followups: Array.isArray(raw.followups)
        ? raw.followups.filter((f) => f === "room" || f === "daily")
        : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function write(record: ChallengeRecord): void {
  try {
    storage()?.setItem(CHALLENGE_RECORD_KEY, JSON.stringify(record));
  } catch {
    /* this visit only */
  }
}

/** A challenge this device made (or shared from a room): first on Profile's list. */
export function noteMyChallenge(code: string, now: number = Date.now()): void {
  const record = readChallengeRecord();
  write({
    ...record,
    mine: [{ code, at: now }, ...record.mine.filter((m) => m.code !== code)].slice(0, 30),
  });
}

/** True the first time this device opens a challenge's link (then remembered). */
export function noteChallengeOpened(code: string): boolean {
  const record = readChallengeRecord();
  if (record.opened.includes(code)) return false;
  write({ ...record, opened: [...record.opened, code].slice(-50) });
  return true;
}

/** This device finished someone else's challenge: its next room and daily are follow-ups. */
export function noteChallengeFriendFinish(code: string): void {
  const record = readChallengeRecord();
  if (record.friendFinished) return;
  write({ ...record, friendFinished: code });
}

/**
 * A room or daily this device just started: returns the challenge to count it against when it's the
 * device's first of that kind since finishing a friend's challenge (then remembered), else null.
 */
export function takeChallengeFollowup(kind: "room" | "daily"): string | null {
  const record = readChallengeRecord();
  if (!record.friendFinished || record.followups.includes(kind)) return null;
  write({ ...record, followups: [...record.followups, kind] });
  return record.friendFinished;
}
