/**
 * The Home Run and Top Bins overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/pages-review/home-run-top-bins/)
 * for theme-check and no-wrap-check: each game's page in Games (the new goal, how-to lines and challenges), dark at
 * every size and the sideways tablet, light at every size. The game screens and reveals themselves are canvas and
 * per-game art, drawn by scripts/shots/capture.ts for the gallery.
 */
import { gamesProgressFixture, gamesChallengesFixture } from "./games";
import { ALL_SIZES, NAV_SIZES, type ThemeScreen } from "../theme-screens";

export default function homeRunTopBinsScreens(): ThemeScreen[] {
  const data = { __harnessProgress: gamesProgressFixture(), __DUELZ_CHALLENGES__: gamesChallengesFixture() };
  const light = { ...data, __harnessTheme: "light" };
  return (["homerun", "freekick"] as const).flatMap((type) => [
    { name: `home run and top bins: game page, ${type}`, mode: "practice" as const, plain: true, search: { page: type }, globals: data, sizes: NAV_SIZES, waitMs: 900 },
    { name: `home run and top bins light: game page, ${type}`, mode: "practice" as const, plain: true, search: { page: type }, globals: light, sizes: ALL_SIZES, waitMs: 900 },
  ]);
}
