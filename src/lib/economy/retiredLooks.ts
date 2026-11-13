/**
 * Skins and world themes of retired games (13 Nov 2026, Joe's rule: retired games are out of the app). They are never
 * sold in the daily shop and never offered in Customise; whoever owns one keeps it in the database (nothing removed),
 * and it returns with its game (catalogue.ts RETIRED_TYPES is the one switch). Card backs belong to no game. Bundles are
 * the Cosmetics session's to change.
 */
import { isPlayable } from "@/lib/duel/catalogue";

/** True for an item tied to a game that is retired (its `gameType`, the catalogue's PuzzleType id). */
export function forRetiredGame(item: { gameType?: string | null }): boolean {
  return typeof item.gameType === "string" && item.gameType !== "" && !isPlayable(item.gameType);
}
