/**
 * The one reveal template (the polish plan's G1; built by P2, 21 Nov 2026; src/components/duel/RevealScreen.tsx): the
 * puzzle reveal and the arcade reveal drawn through it at every size, dark and light, so theme-check and no-wrap-check
 * judge the template's slots on a phone, a tablet and a computer. A room's arcade reveal opens on its Room view (the
 * chart); it is drawn on that view and again on "Your run" (the run's picture). The art sessions (A1–A3) add their games'
 * reveals here as they move each board onto the stage. Found by scripts/area-screens.ts (name order).
 */
import type { Page } from "playwright";

import { ALL_SIZES, room, type ThemeScreen } from "../theme-screens";

/** Opens a room reveal's "Your run" view (the run's picture), for a screen that judges the picture. */
export const openYourRun = async (page: Page): Promise<void> => {
  await page.getByRole("radio", { name: "Your run" }).click();
  await page.waitForTimeout(300);
};

export default function revealScreens(): ThemeScreen[] {
  return [
    // A room's puzzle reveal (Box Six, 10 players) and arcade reveal (Gemstone, four part lines, 10 players), on the
    // Room view it opens on and on "Your run".
    { name: "reveal template: puzzle, 10 players", mode: "room", plain: true, room: room("in_progress", "reveal", { players: 10 }), waitMs: 1500, sizes: ALL_SIZES },
    { name: "reveal template: arcade, 10 players", mode: "room", plain: true, room: room("in_progress", "reveal", { arcade: true, players: 10, revealParts: true }), waitMs: 1500, sizes: ALL_SIZES },
    { name: "reveal template: arcade, 10 players, your run", mode: "room", plain: true, room: room("in_progress", "reveal", { arcade: true, players: 10, revealParts: true }), waitMs: 1500, sizes: ALL_SIZES, go: openYourRun },
  ];
}
