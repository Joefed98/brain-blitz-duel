/**
 * The puzzle action log (format: docs/puzzle-action-log.md).
 *
 * A puzzle stamped `alogRev: 1` is answered with every action the player took,
 * each timed on the round clock (ms since the puzzle phase started,
 * `serverNow() - phaseStartedAt` on the phone: the same clock as the tap logs).
 * The server replays the log against the stored puzzle and works out the
 * result itself; the phone's own summary is never read. Lightbender (`laser`)
 * is the first puzzle on it (laserLog.ts).
 *
 *   alog1:<action>@<t>,<action>@<t>,…
 *
 * An action is a lower-case letter followed by up to 23 letters, digits or
 * hyphens; each game defines its own verbs. `t` is a whole number of ms.
 *
 * The server repairs a bad log rather than rejecting it, and counts every
 * repair, as with the tap logs: actions out of time order are put back in time
 * order (a stable sort, so equal times keep their order) and counted; actions
 * before the round, after it, after the server received the log (plus the 1.5 s
 * network allowance), beyond the cap, or unreadable are dropped. A game's
 * replay then ignores, and counts, any action the board does not allow.
 */

/** The action-log answer format revision stamped on a puzzle (`alogRev`). */
export const ACTION_LOG_REV = 1;
/** Every action-log answer starts with this, so an older answer is never misread as a log. */
export const ACTION_LOG_PREFIX = "alog1:";
/** The most actions the server reads; the phone stops logging here. */
export const ACTION_LOG_MAX = 1_500;
/** Answer length the server accepts for an action log. */
export const ACTION_LOG_ANSWER_CAP = 24_000;

const ACTION = /^[a-z][a-z0-9-]{0,23}$/;
const INT = /^-?\d+$/;

export interface LoggedAction {
  /** The game's own action code, e.g. Lightbender's "p23s" or "f". */
  a: string;
  /** Round-clock ms. */
  t: number;
}

/** What the server did to a log before replaying it (stored on the round). */
export interface ActionLogDiag {
  /** Actions in the answer. */
  received: number;
  /** Actions kept but moved back into time order. */
  clamped: number;
  /** Actions that could not be replayed (dropped here, or refused by the game's replay). */
  dropped: number;
  /** The first repair's reason, if any. */
  first: string | null;
}

export function usesActionLog(puzzle: unknown): boolean {
  return (puzzle as { alogRev?: number } | null)?.alogRev === ACTION_LOG_REV;
}

export function encodeActionLog(actions: readonly LoggedAction[]): string {
  return (
    ACTION_LOG_PREFIX +
    actions
      .slice(0, ACTION_LOG_MAX)
      .map((x) => `${x.a}@${Math.max(0, Math.round(x.t))}`)
      .join(",")
  );
}

/** Appends one action on the phone, keeping times strictly rising so an honest log is always in order. */
export function appendAction(log: readonly LoggedAction[], a: string, t: number): LoggedAction[] {
  if (log.length >= ACTION_LOG_MAX) return [...log];
  const previous = log.length ? log[log.length - 1]!.t : -1;
  return [...log, { a, t: Math.max(0, Math.round(t), previous + 1) }];
}

export function emptyActionDiag(): ActionLogDiag {
  return { received: 0, clamped: 0, dropped: 0, first: null };
}

export function noteRepair(diag: ActionLogDiag, kind: "clamped" | "dropped", reason: string): void {
  diag[kind] += 1;
  if (!diag.first) diag.first = reason;
}

/**
 * Reads an action log. `latestMs` is the last round-clock ms an action may
 * carry: the end of the round, or in a room the server's receipt time plus the
 * network allowance (grade.ts `latestTapMs`). Returns the kept actions in time
 * order.
 */
export function decodeActionLog(
  answer: string,
  latestMs: number,
): { actions: LoggedAction[]; diag: ActionLogDiag } {
  const diag = emptyActionDiag();
  const raw = typeof answer === "string" ? answer : "";
  if (!raw.startsWith(ACTION_LOG_PREFIX)) {
    if (raw.length > 0) {
      diag.received = 1;
      noteRepair(diag, "dropped", "not an action log");
    }
    return { actions: [], diag };
  }
  const body = raw.slice(ACTION_LOG_PREFIX.length, ACTION_LOG_ANSWER_CAP);
  const items = body.length ? body.split(",") : [];
  diag.received = items.length;
  const kept: LoggedAction[] = [];
  items.forEach((item, index) => {
    if (index >= ACTION_LOG_MAX) return noteRepair(diag, "dropped", "beyond the action cap");
    const at = item.lastIndexOf("@");
    const a = at > 0 ? item.slice(0, at) : "";
    const tRaw = at > 0 ? item.slice(at + 1) : "";
    if (!ACTION.test(a) || !INT.test(tRaw)) return noteRepair(diag, "dropped", "unreadable action");
    const t = Number(tRaw);
    if (!Number.isSafeInteger(t)) return noteRepair(diag, "dropped", "unreadable action");
    if (t < 0) return noteRepair(diag, "dropped", "action before the round");
    if (t > latestMs) return noteRepair(diag, "dropped", "action after the round");
    kept.push({ a, t });
  });
  // Time order is the order of play: a log whose items were shuffled replays
  // exactly as the honest one, never with a later change before an earlier shot.
  let previous = -1;
  for (const action of kept) {
    if (action.t < previous) noteRepair(diag, "clamped", "action out of order");
    previous = Math.max(previous, action.t);
  }
  const ordered = kept
    .map((action, index) => ({ action, index }))
    .sort((x, y) => x.action.t - y.action.t || x.index - y.index);
  return { actions: ordered.map((x) => x.action), diag };
}
