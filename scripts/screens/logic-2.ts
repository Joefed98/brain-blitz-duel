/**
 * The Logic overhaul, session 2 (15 Nov 2026): the game pages of Tents and Trees, Shikaku, Lamplighter, Trail,
 * Loopline, Regions and Island Link (their goal and how-to lines changed with the overhaul: the "?" signposts, a tap
 * removing a rectangle, a tap cycling a bridge, Trail's undo cost) for theme-check and no-wrap-check. The game screens
 * themselves (not skinned pages) are proved by logic-overhaul-2-check and the gallery.
 */
import type { ThemeScreen } from "../theme-screens";

export const LOGIC_2_GAMES = ["tents", "shikaku", "lightup", "trail", "fences", "fillomino", "bridges"] as const;

export default function logic2Screens(): ThemeScreen[] {
  return LOGIC_2_GAMES.map((type) => ({
    name: `logic 2: game page, ${type}`,
    mode: "practice" as const,
    plain: true,
    search: { page: type },
    waitMs: 900,
  }));
}
