/**
 * Where levels apply (phase 2 step 4, 15 Nov 2026; docs/design/difficulty/README.md). Shared and pure.
 *
 *  - Practice: every level the game offers, all open from the start.
 *  - Rooms: the host's one level for the room (room settings); every player gets the same deal.
 *  - Tournaments: a level field on the event (default Normal); no tournament rule reads anything else yet.
 *  - Rated matches and the Daily: always Normal (`fixedLevelFor`), enforced on the server, so ratings never mix levels.
 */
import { NORMAL, type Level } from "./levels";

export type LevelMode = "practice" | "room" | "tournament" | "rated" | "daily";

/** The modes whose level is fixed at Normal whatever is asked for. */
export const NORMAL_ONLY_MODES: readonly LevelMode[] = ["rated", "daily"];

/** The level a mode deals at when `requested` is asked for (before the game's own offer, gameLevels.ts resolveLevel). */
export function modeLevel(mode: LevelMode, requested: Level | null | undefined): Level {
  if (NORMAL_ONLY_MODES.includes(mode)) return NORMAL;
  return requested ?? NORMAL;
}
