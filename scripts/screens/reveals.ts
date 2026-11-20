/**
 * The one reveal template (the polish plan's G1, 20 Nov 2026; src/components/duel/RevealScreen.tsx): the puzzle reveal
 * and the arcade reveal drawn through it at every size, dark and light, so theme-check and no-wrap-check judge the
 * template's slots on a phone, a tablet and a computer. The family sessions (S3–S5) add their games' reveals here as
 * they move each board onto the stage box. Found by scripts/area-screens.ts (name order).
 */
import { ALL_SIZES, room, type ThemeScreen } from "../theme-screens";

export default function revealScreens(): ThemeScreen[] {
  return [
    // A room's puzzle reveal (Box Six, 10 players) and arcade reveal (Gemstone, four part lines, 10 players: the Room view).
    { name: "reveal template: puzzle, 10 players", mode: "room", plain: true, room: room("in_progress", "reveal", { players: 10 }), waitMs: 1500, sizes: ALL_SIZES },
    { name: "reveal template: arcade, 10 players", mode: "room", plain: true, room: room("in_progress", "reveal", { arcade: true, players: 10, revealParts: true }), waitMs: 1500, sizes: ALL_SIZES },
  ];
}
