/**
 * The Word overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/pages-review/word/GALLERY.md) for theme-check
 * and no-wrap-check: every Word game's answer reveal in a room (its round-end list or board in the new look, with a
 * stored answer), and the round intros whose examples changed (Swapword's swap, Interlock's tiles, Nucleus's ring), at
 * every size. Drawn after the core list (scripts/area-screens.ts finds this file).
 */
import { generatePuzzle } from "../../src/lib/duel/generate.server";
import { withSeededRandom } from "../../src/lib/duel/random";
import { ALL_SIZES, room, type ThemeScreen } from "../theme-screens";

/** Nucleus's fixture board (the room fixture's seed): three of its words, the longest last, for the round-end list. */
function nucleusAnswer(): string {
  const p = withSeededRandom(41, () => generatePuzzle("wordsmith", { bankSeed: 41 })) as { words?: { word: string }[] };
  const words = (p.words ?? []).map((w) => w.word);
  return [...words.slice(-3), words[0] ?? ""].filter(Boolean).join(",");
}

/** Each Word game and an answer its reveal draws (a few found words, a part-solved board or an empty run). */
const REVEALS: readonly { type: string; name: string; answer: string }[] = [
  { type: "wordsmith", name: "Nucleus", answer: nucleusAnswer() },
  { type: "tilegrid", name: "Interlock", answer: "" },
  { type: "wordslide", name: "Slider", answer: "" },
  { type: "wordhunt", name: "Forage", answer: "" },
  { type: "wordsearch", name: "Lookout", answer: "" },
  { type: "letterwheel", name: "Roundabout", answer: "" },
  { type: "strikeout", name: "Strikeout", answer: "" },
  { type: "codeword", name: "Cryptogrid", answer: "" },
  { type: "swapword", name: "Swapword", answer: "" },
];

/** The intros whose example drawing the overhaul changed. */
const INTROS: readonly { type: string; name: string }[] = [
  { type: "swapword", name: "Swapword" },
  { type: "tilegrid", name: "Interlock" },
  { type: "wordsmith", name: "Nucleus" },
];

export default function wordScreens(): ThemeScreen[] {
  return [
    ...REVEALS.map(
      (g): ThemeScreen => ({
        name: `word: ${g.name} answer reveal`,
        mode: "room",
        plain: true,
        room: room("in_progress", "reveal", { puzzleType: g.type, answer: g.answer }),
        sizes: ALL_SIZES,
      }),
    ),
    ...INTROS.map(
      (g): ThemeScreen => ({
        name: `word: ${g.name} round intro`,
        mode: "room",
        plain: true,
        room: room("in_progress", "intro", { puzzleType: g.type }),
        sizes: ALL_SIZES,
      }),
    ),
  ];
}
