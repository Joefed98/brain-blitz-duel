/**
 * The polish plan's A2 (21 Nov 2026): the Speed and Attention answer reveals whose numbers became the reveal template's
 * facts strip and whose boards take the template's stage width (G6), drawn at every size for theme-check and
 * no-wrap-check. The live rounds' new paint (Spotlight's lit pieces) has no screen here: game screens are not skinned.
 * Found by scripts/area-screens.ts (name order).
 */
import { ALL_SIZES, room, type ThemeScreen } from "../theme-screens";

const REVEALS = [
  { type: "reaction", name: "Flash" },
  { type: "chain", name: "Don't Break the Chain" },
  { type: "symscan", name: "Eagle Eye" },
  { type: "countup", name: "Tally" },
  { type: "maze", name: "Labyrinth" },
  { type: "bomb", name: "Bomb Defusal" },
];

export default function speedAttentionRevealScreens(): ThemeScreen[] {
  return REVEALS.map(
    (g): ThemeScreen => ({
      name: `a2 speed and attention: ${g.name} answer reveal`,
      mode: "room",
      plain: true,
      room: room("in_progress", "reveal", { puzzleType: g.type, answer: "" }),
      sizes: ALL_SIZES,
    }),
  );
}
