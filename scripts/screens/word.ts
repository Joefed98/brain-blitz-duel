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
  ];
}
