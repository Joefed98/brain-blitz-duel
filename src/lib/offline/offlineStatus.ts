/**
 * Which practice games play with no signal (offline practice, 31 Oct 2026). Shared by the phone and the server.
 *
 *  - "provisional": arcade, card, board and sports games. Their simulations run on the phone, so a run's own
 *    score shows straight away as provisional; the server replays the run and its score is the one kept.
 *  - "pending": puzzles graded against the sealed half on the server: playable from a pack, the score shows
 *    as pending until the server grades the run.
 *  - "online": games that ask the server during play (a word checked against the server's dictionary, or a
 *    move replayed against the sealed answer). They get no pack and show "Online only" with no signal.
 *
 * offline-check proves the online list is exactly the games whose stage asks the server (checkWord /
 * checkMoves) and that every other practice game gets a pack.
 */
import type { PuzzleType } from "@/lib/duel/types";

export type OfflineStatus = "provisional" | "pending" | "online";

/** The games that ask the server during play: Nucleus, Forage, Interlock, Slider, Roundabout, Lookout, Strikeout, Cryptogrid, Swapword. */
export const ONLINE_ONLY_TYPES: ReadonlySet<PuzzleType> = new Set<PuzzleType>([
  "wordsmith",
  "wordhunt",
  "tilegrid",
  "wordslide",
  "letterwheel",
  "wordsearch",
  "strikeout",
  "codeword",
  "swapword",
]);

/** At most this many deals a game in one pack (the pack's full size), and this many games in one server call. */
export const PACK_MAX_DEALS = 10;
export const PACK_MAX_TYPES = 6;

/** A game's offline status; `arcadeScreen` is whether its round is an arcade play screen (registry). */
export function offlineStatusOf(type: PuzzleType, arcadeScreen = false): OfflineStatus {
  if (ONLINE_ONLY_TYPES.has(type)) return "online";
  return arcadeScreen ? "provisional" : "pending";
}
