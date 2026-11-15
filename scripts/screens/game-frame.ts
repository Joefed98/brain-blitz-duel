/**
 * The games foundation's screens (phase 2 step 4, 15 Nov 2026; docs/design/game-fx/README.md,
 * docs/design/pages-review/game-frame/GALLERY.md) for theme-check and no-wrap-check: the result screens the frame
 * step restyled and gave the effects kit's payoff (a room's round leaderboard after a puzzle and an arcade round, the
 * two-player final results and the Daily's results), each at every size (VIEWPORTS plus ALL_SIZES). Drawn after the
 * core list (scripts/area-screens.ts finds this file). The live round's frame itself is not a skinned page; its
 * geometry is proved by bottom-clearance, safe-area-screens, arcade-play and the desktop checks, unchanged.
 */
import { dailyFixture } from "../daily-fixture";
import { ALL_SIZES, room, type ThemeScreen } from "../theme-screens";

export default function gameFrameScreens(): ThemeScreen[] {
  return [
    { name: "game frame: round leaderboard, 4 players", mode: "room", room: room("in_progress", "result", { players: 4, rounds: 2 }), waitMs: 2500, sizes: ALL_SIZES },
    { name: "game frame: round leaderboard after an arcade round, 4 players", mode: "room", room: room("in_progress", "result", { players: 4, arcade: true, rounds: 2 }), waitMs: 2500, sizes: ALL_SIZES },
    { name: "game frame: final results, 2 players", mode: "room", room: room("finished", "result", { rounds: 6 }), waitMs: 3000, sizes: ALL_SIZES },
    {
      name: "game frame: daily results",
      mode: "daily",
      daily: () => dailyFixture().after,
      sizes: ALL_SIZES,
      go: async (page) => {
        await page.locator("[data-daily-results]").click();
        await page.locator("[data-async-results]").waitFor({ timeout: 20_000 });
        await page.waitForTimeout(900);
      },
    },
  ];
}
