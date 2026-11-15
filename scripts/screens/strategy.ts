/**
 * The Strategy overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/pages-review/strategy/GALLERY.md) for
 * theme-check and no-wrap-check: each Strategy game's page (Tilt, Gemstone, Coral Pop, Rainbow Bridge and Ball
 * Tracker: its goal, how-to lines and challenges, which the overhaul rewrote for the fast shot, the treasure chest and
 * the moving pot), in the dark theme at the navigation sizes. Drawn after the core list (scripts/area-screens.ts).
 */
import { gamesChallengesFixture, gamesProgressFixture } from "./games";
import { NAV_SIZES, type ThemeScreen } from "../theme-screens";

/** The five Strategy games, by registry id and shown name. */
export const STRATEGY_GAMES = [
  ["tilt", "Tilt"],
  ["matchup", "Gemstone"],
  ["bubble", "Coral Pop"],
  ["inkbridge", "Rainbow Bridge"],
  ["balltrack", "Ball Tracker"],
] as const;

export default function strategyScreens(): ThemeScreen[] {
  const globals = { __harnessProgress: gamesProgressFixture(), __DUELZ_CHALLENGES__: gamesChallengesFixture() };
  return STRATEGY_GAMES.map(([type, name]) => ({
    name: `strategy: game page, ${name}`,
    mode: "practice" as const,
    plain: true,
    search: { page: type },
    globals,
    sizes: NAV_SIZES,
    waitMs: 900,
  }));
}
