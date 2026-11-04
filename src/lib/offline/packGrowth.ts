/**
 * How big the offline practice packs grow, and when they start (4 Nov 2026; device storage only, no game, stamp or
 * score is read or written here). A new device used to ask the server for PACK_MAX_DEALS deals of every
 * offline-capable game 3 s after the app first opened. Now:
 *
 *  - nothing is downloaded until the player has finished a practice round (`notePracticeRoundFinished`, called by
 *    the practice screen once a round is graded); a device that already holds packs carries on as before;
 *  - each game's pack target grows with every app visit whose top-up completes: PACK_FIRST_DEALS on the first,
 *    then PACK_GROWTH_STEP more a visit, up to PACK_MAX_DEALS (3, 5, 7, 9, 10);
 *  - the top-up waits while Battery saver is on, or the browser reports Save-Data or a 2G-class connection
 *    (`lightTopUpBlocked`; metered connections were already skipped in settings.ts).
 *
 * Packs that exist are played exactly as before (offline-check).
 */
import { batterySaverOn } from "@/lib/battery";

import { PACK_MAX_DEALS } from "./offlineStatus";

/** Set once this device has finished a practice round: the first top-up waits for it. */
export const PACK_STARTED_KEY = "duelz-offline-started:v1";
/** How many app visits have completed a top-up (the pack target grows with it). */
export const PACK_LEVEL_KEY = "duelz-offline-pack-level:v1";
/** Deals a game on the first top-up. */
export const PACK_FIRST_DEALS = 3;
/** More deals a game on each later visit, up to PACK_MAX_DEALS. */
export const PACK_GROWTH_STEP = 2;
/** Connections too slow to top up on (the Network Information API's effectiveType; iOS reports none). */
const SLOW_CONNECTIONS = new Set(["slow-2g", "2g"]);

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked: this visit only */
  }
}

/** Whether this device has finished a practice round (the first top-up waits for it). */
export function practiceStarted(): boolean {
  return read(PACK_STARTED_KEY) === "1";
}

/** Marks this device's first finished practice round; true when this call set it (the first time). */
export function notePracticeRoundFinished(): boolean {
  if (practiceStarted()) return false;
  write(PACK_STARTED_KEY, "1");
  return true;
}

/** The completed-visit count the pack target is built from. */
export function packLevel(): number {
  const n = Number(read(PACK_LEVEL_KEY));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Each game's pack target at a level: 3, 5, 7, 9, then PACK_MAX_DEALS. */
export function packTargetFor(level: number): number {
  return Math.min(PACK_MAX_DEALS, PACK_FIRST_DEALS + PACK_GROWTH_STEP * Math.max(0, level));
}

/**
 * The level this visit's top-up starts from. A device with packs but no level record filled them before this change
 * (31 Oct – 4 Nov 2026): it keeps the full target. A new device records level 0 as its first top-up starts, so an
 * interrupted first top-up is never taken for an old device.
 */
let visitLevel: number | null = null;

export function packLevelForTopUp(hasPacks: boolean): number {
  // Read once a visit: a level raised by this visit's completed top-up applies from the next visit.
  if (visitLevel !== null) return visitLevel;
  if (read(PACK_LEVEL_KEY) === null) {
    visitLevel = hasPacks ? Math.ceil((PACK_MAX_DEALS - PACK_FIRST_DEALS) / PACK_GROWTH_STEP) : 0;
    write(PACK_LEVEL_KEY, String(visitLevel));
  } else {
    visitLevel = packLevel();
  }
  return visitLevel;
}

let levelRaisedThisVisit = false;

/** After a top-up that finished every game: the next visit's target grows (once per visit). */
export function notePackVisitComplete(): void {
  if (levelRaisedThisVisit) return;
  levelRaisedThisVisit = true;
  const level = visitLevel ?? packLevel();
  if (packTargetFor(level) >= PACK_MAX_DEALS) return;
  write(PACK_LEVEL_KEY, String(level + 1));
}

/** Battery saver on, Save-Data, or a 2G-class connection: no top-up now. */
export function lightTopUpBlocked(): boolean {
  if (batterySaverOn()) return true;
  try {
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    if (!connection) return false;
    return (
      connection.saveData === true || SLOW_CONNECTIONS.has(String(connection.effectiveType ?? ""))
    );
  } catch {
    return false;
  }
}
