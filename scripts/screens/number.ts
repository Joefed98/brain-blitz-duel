/**
 * The Number overhaul's screens (15 Nov 2026, phase 2 step 4; docs/number-overhaul.md) for theme-check and
 * no-wrap-check: each of the eight Number games' answer reveal in a room, drawn at every size. Found automatically
 * (scripts/area-screens.ts).
 */
import { ALL_SIZES, room, type ThemeScreen } from "../theme-screens";
import { NUMBER_GAMES, numberRevealFixture } from "./number-fixture";

export default function numberScreens(): ThemeScreen[] {
  return [
    ...NUMBER_GAMES.map((type) => ({
      name: `number overhaul: ${type} answer reveal`,
      mode: "room" as const,
      room: room("in_progress", "reveal", { puzzle: numberRevealFixture(type) }),
      waitMs: 1500,
      plain: true,
      sizes: ALL_SIZES,
    })),
    // The polish plan's art (A1, 21 Nov 2026): each Number game's live round in a room, on the lit stage.
    ...NUMBER_GAMES.map((type) => ({
      name: `number overhaul: ${type} live round`,
      mode: "room" as const,
      room: room("in_progress", "puzzle", { puzzle: numberRevealFixture(type) }),
      waitMs: 1500,
      sizes: ALL_SIZES,
      plain: true,
    })),
  ];
}
