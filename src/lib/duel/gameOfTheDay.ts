import { ACTIVE_PUZZLE_TYPES, isPlayable } from "./catalogue";
import { ukDayKey } from "./daily";
import type { PuzzleType } from "./types";

/**
 * The Games catalogue's hero (phase 2 step 3, 14 Nov 2026): one game a UK day, the same for every player all day,
 * worked out on the phone from the date alone (no server call). The Daily Puzzle's own games are dealt on the server
 * at the day's first start and can't be read by a phone, so the hero is a game of the day instead (a decision for Joe,
 * noted in the Games session's report). Each playable game draws a score from the day and its id (FNV-1a), and the
 * lowest wins: every live game takes turns, and adding or retiring one moves only the days it wins.
 */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** The game of the day for a UK day key ("2026-11-14"), from `pool` (every playable game by default). */
export function gameOfTheDay(
  day: string,
  pool: readonly PuzzleType[] = ACTIVE_PUZZLE_TYPES,
): PuzzleType | null {
  let best: PuzzleType | null = null;
  let bestScore = Infinity;
  for (const type of pool) {
    if (!isPlayable(type)) continue;
    const score = fnv1a(`${day}:${type}`);
    if (score < bestScore || (score === bestScore && best !== null && type < best)) {
      best = type;
      bestScore = score;
    }
  }
  return best;
}

/** Today's game of the day (the UK day at `nowMs`). */
export function gameOfTheDayAt(nowMs: number, pool?: readonly PuzzleType[]): PuzzleType | null {
  return gameOfTheDay(ukDayKey(nowMs), pool);
}
