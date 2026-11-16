/**
 * The Pattern overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/pages-review/pattern/GALLERY.md) for
 * theme-check and no-wrap-check: each of the eight Pattern games' page (/practice?page=<id>), which draws its new
 * goal and how-to lines (Gridlock's cars, Pipeline's two-way turns, Chroma Lines' cut lines, Topsy-Turvy's tilt
 * limit…), at the core sizes and the phone. The games' own play and reveal screens are proved by each game's
 * pattern-overhaul-<id>-check and the gallery. Drawn after the core list (scripts/area-screens.ts finds this file).
 */
import { gamesProgressFixture } from "./games";
import type { ThemeScreen } from "../theme-screens";

/** The eight Pattern games, by id, in the category's order. */
export const PATTERN_OVERHAUL_GAMES = ["unblock", "blockparty", "pipes", "flow", "iceslide", "push", "laser", "gravity"] as const;

export default function patternScreens(): ThemeScreen[] {
  const globals = { __harnessProgress: gamesProgressFixture() };
  return PATTERN_OVERHAUL_GAMES.map((type) => ({
    name: `pattern: game page, ${type}`,
    mode: "practice" as const,
    plain: true,
    search: { page: type },
    globals,
    sizes: [{ name: "390x844", w: 390, h: 844 }],
    waitMs: 900,
  }));
}
