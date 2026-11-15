/**
 * The Speed overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/pages-review/speed/GALLERY.md) for theme-check
 * and no-wrap-check: each Speed game's page (its tile, goal, how-to lines, challenges and Play), drawn after the core
 * list (scripts/area-screens.ts finds this file). Stage 3 (the levels) adds each page's level choice here.
 */
import type { ThemeScreen } from "../theme-screens";

/** The six Speed games (Tenfall since 13 Nov 2026), by id. */
export const SPEED_PAGE_GAMES = ["reaction", "numhunt", "chain", "whack", "tendrop", "clayshoot"] as const;

const SPEED_SCREENS = (): ThemeScreen[] =>
  SPEED_PAGE_GAMES.map((type) => ({ name: `speed: game page, ${type}`, mode: "practice", plain: true, search: { page: type }, waitMs: 900 }));

/** This area's screens for theme-check and no-wrap-check (the area-file shape, scripts/area-screens.ts). */
export default (): ThemeScreen[] => SPEED_SCREENS();
