/**
 * The Word overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/pages-review/word/GALLERY.md) for theme-check
 * and no-wrap-check: every Word game's answer reveal in a room (its round-end list or board in the new look, with a
 * stored answer), at every size, and (stage 3) a game's page with a level picked. (Round intros are game screens, never skinned: the gallery shows Swapword's.) Drawn after the core list (scripts/area-screens.ts finds this file).
 */
import { generatePuzzle } from "../../src/lib/duel/generate.server";
import { withSeededRandom } from "../../src/lib/duel/random";
import type { Page } from "playwright";

import { ALL_SIZES, room, type ThemeScreen } from "../theme-screens";

/** A game's page with a level picked (stage 3): the level switch, then the level's one line under it. */
const pickLevel = (level: string) => async (page: Page) => {
  await page.locator(`[data-level-option="${level}"]`).first().click();
  await page.locator("[data-game-page-level-about]").first().waitFor({ timeout: 15_000 });
};

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

export default function wordScreens(): ThemeScreen[] {
  return [
    // Stage 3 (levels): a game's page with a level picked shows that level's line under the switch.
    { name: "word: game page, Cryptogrid Hard", mode: "practice", plain: true, search: { page: "codeword" }, sizes: ALL_SIZES, waitMs: 900, go: pickLevel("hard") },
    { name: "word: game page, Lookout Expert", mode: "practice", plain: true, search: { page: "wordsearch" }, sizes: ALL_SIZES, waitMs: 900, go: pickLevel("expert") },
    ...REVEALS.map(
      (g): ThemeScreen => ({
        name: `word: ${g.name} answer reveal`,
        mode: "room",
        plain: true,
        room: room("in_progress", "reveal", { puzzleType: g.type, answer: g.answer }),
        sizes: ALL_SIZES,
      }),
    ),
    // Added with Joe's approval, 22 Nov 2026: the other seven games' pages with a level picked (D1's level lines), each
    // on its longest line.
    { name: "word: game page, Nucleus Hard", mode: "practice", plain: true, search: { page: "wordsmith" }, sizes: ALL_SIZES, waitMs: 900, go: pickLevel("hard") }, // Added with Joe's approval, 22 Nov 2026
    { name: "word: game page, Forage Easy", mode: "practice", plain: true, search: { page: "wordhunt" }, sizes: ALL_SIZES, waitMs: 900, go: pickLevel("easy") }, // Added with Joe's approval, 22 Nov 2026
    { name: "word: game page, Roundabout Hard", mode: "practice", plain: true, search: { page: "letterwheel" }, sizes: ALL_SIZES, waitMs: 900, go: pickLevel("hard") }, // Added with Joe's approval, 22 Nov 2026
    { name: "word: game page, Strikeout Expert", mode: "practice", plain: true, search: { page: "strikeout" }, sizes: ALL_SIZES, waitMs: 900, go: pickLevel("expert") }, // Added with Joe's approval, 22 Nov 2026
    { name: "word: game page, Swapword Hard", mode: "practice", plain: true, search: { page: "swapword" }, sizes: ALL_SIZES, waitMs: 900, go: pickLevel("hard") }, // Added with Joe's approval, 22 Nov 2026
    { name: "word: game page, Interlock Expert", mode: "practice", plain: true, search: { page: "tilegrid" }, sizes: ALL_SIZES, waitMs: 900, go: pickLevel("expert") }, // Added with Joe's approval, 22 Nov 2026
    { name: "word: game page, Slider Expert", mode: "practice", plain: true, search: { page: "wordslide" }, sizes: ALL_SIZES, waitMs: 900, go: pickLevel("expert") }, // Added with Joe's approval, 22 Nov 2026
  ];
}
