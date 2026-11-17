/**
 * The Action overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/pages-review/action/GALLERY.md) for
 * theme-check and no-wrap-check: each of the six Action games' page (Roofbound, Grappler, Moon Climb, Iron Wall, High
 * Rise, Orbit), whose goal, how-to and challenge lines the overhaul rewrites, in the dark theme at every size. Drawn
 * after the core list (scripts/area-screens.ts finds this file).
 */
import { gamesChallengesFixture, gamesProgressFixture } from "./games";
import { ALL_SIZES, type ThemeScreen } from "../theme-screens";

/** The six Action games, in the review's order (docs/design/game-reviews/action.md). */
export const ACTION_GAMES = [
  { type: "flip", name: "Roofbound" },
  { type: "swing", name: "Grappler" },
  { type: "ricochet", name: "Moon Climb" },
  { type: "bastion", name: "Iron Wall" },
  { type: "skyline", name: "High Rise" },
  { type: "orbit", name: "Orbit" },
] as const;

export const ACTION_SCREENS = (): ThemeScreen[] => {
  const globals = { __harnessProgress: gamesProgressFixture(), __DUELZ_CHALLENGES__: gamesChallengesFixture() };
  return ACTION_GAMES.map((g) => ({
    name: `action: game page, ${g.name}`,
    mode: "practice" as const,
    plain: true,
    search: { page: g.type },
    globals,
    sizes: ALL_SIZES,
    waitMs: 900,
  }));
};

/** This area's screens for theme-check and no-wrap-check (the area-file shape, scripts/area-screens.ts). */
export default (): ThemeScreen[] => ACTION_SCREENS();
