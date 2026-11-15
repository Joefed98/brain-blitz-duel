/**
 * The Attention overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/attention-overhaul.md) for theme-check and
 * no-wrap-check: each of the six Attention games' pages (their goal and how-to lines, changed for the new stamps: Double
 * Take's Next and misses, Tally's marks, Labyrinth's backtracking and controls, Bomb Defusal's "nothing reacts live",
 * Matchmaker's quick flip-back) and Settings with its Game controls (the arrows / joystick choice Labyrinth's game menu
 * now shares), at every size. Drawn after the core list (scripts/area-screens.ts finds this file).
 */
import { ALL_SIZES, NAV_SIZES, type ThemeScreen } from "../theme-screens";

const GAMES = [
  ["symscan", "Eagle Eye"],
  ["spotdiff", "Double Take"],
  ["countup", "Tally"],
  ["maze", "Labyrinth"],
  ["bomb", "Bomb Defusal"],
  ["pairmatch", "Matchmaker"],
] as const;

export default function attentionScreens(): ThemeScreen[] {
  return [
    ...GAMES.map(([type, name]): ThemeScreen => ({
      name: `attention: game page, ${name}`,
      mode: "practice",
      plain: true,
      search: { page: type },
      sizes: NAV_SIZES,
      waitMs: 900,
    })),
    { name: "attention: settings, game controls", mode: "settings", plain: true, sizes: ALL_SIZES, waitMs: 600 },
  ];
}
