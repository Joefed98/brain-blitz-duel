/**
 * One word or trace in a live round, checked against the round's puzzle (async rooms; the same
 * per-game checks a room's checkWordFn and practice's practiceCheckWordFn run). The private half is
 * read only for the games that match against it; only the verdict goes back.
 */
import { mergePuzzle } from "./secrets";
import type { PuzzleData } from "./types";

export async function checkRoundWord(
  pub: PuzzleData,
  priv: () => Promise<Record<string, unknown> | undefined>,
  data: { word: string; found: string[]; path?: number[] },
) {
  const found = Array.isArray(data.found) ? data.found.slice(0, 200).map(String) : [];
  if (pub.type === "letterwheel") {
    const puzzle = mergePuzzle(pub, await priv());
    if (puzzle.type !== "letterwheel") return { valid: false as const, points: 0, word: "" };
    const { checkLetterWheelWord } = await import("./letterWheel");
    const { isWord } = await import("./dictionary.server");
    const word = String(data.word ?? "")
      .trim()
      .toLowerCase();
    return checkLetterWheelWord(puzzle.words ?? [], word, found, word.length >= 3 && isWord(word));
  }
  if (pub.type === "wordsearch") {
    const puzzle = mergePuzzle(pub, await priv());
    if (puzzle.type !== "wordsearch") return { valid: false as const, points: 0, word: "" };
    const { checkWordSearchPath } = await import("./wordSearch");
    const path = Array.isArray(data.path) ? data.path.slice(0, 16).map(Number) : [];
    return checkWordSearchPath(puzzle.placements ?? [], puzzle.size, path, found, puzzle.bonus);
  }
  if (pub.type === "wordhunt") {
    const { checkWordHuntPath } = await import("./wordHunt.server");
    const path = Array.isArray(data.path) ? data.path.slice(0, 16).map(Number) : [];
    return checkWordHuntPath(pub.grid, path, found);
  }
  if (pub.type === "tilegrid") {
    const { checkTileGridWord } = await import("./tileGrid.server");
    return checkTileGridWord(String(data.word ?? ""));
  }
  if (pub.type === "wordslide") {
    const { checkWordSlideRow } = await import("./wordSlide.server");
    return checkWordSlideRow(String(data.word ?? ""));
  }
  if (pub.type !== "wordsmith")
    return { valid: false as const, points: 0, word: "", reason: "Not this round." };
  const { checkWordsmithWord } = await import("./wordsmith.server");
  return checkWordsmithWord(pub.letters, String(data.word ?? ""), found);
}
