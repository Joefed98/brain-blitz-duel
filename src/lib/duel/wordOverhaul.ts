/**
 * The Word overhaul (15 Nov 2026, phase 2 step 4; docs/design/game-reviews/word.md, the agreed changes). Five Word
 * games move up one stamp each; every older stamp deals, plays and grades exactly as before:
 *
 * - Nucleus `wordsmithRev 5` (WORDSMITH_REV_EVERYDAY): the board's word count and its "You missed" list are the
 *   everyday words only (the list boards are built from, `commonWords`); an obscure dictionary word is still accepted
 *   and still scores its word points, quietly, as a bonus word (the live check marks it `bonus`). The board, its par
 *   and every scoring number are rev 4's.
 * - Slider `wordSlideRev 6` (SLIDER_REV_PROVEN): par is the proven fewest shifts from the deal to the dealt words
 *   (wordSlideDistance.server.ts), never more than the scramble length it was before.
 * - Lookout `wordSearchRev 6` (LOOKOUT_REV_DONE): finding the last listed word no longer ends the round; the player
 *   may hunt for the bonus word and taps Done (or the clock ends it). The finish's speed is measured when the last
 *   listed word was found (from the draft timeline; without one, at the answer), so hunting for the bonus never costs
 *   speed.
 * - Roundabout `wheelRev 5` (WHEEL_REV_COMMON): boards from a new bank (letterWheelBankRev5.server.ts) where every
 *   slot word is on the common-answers list (no INS, REF or EMO) and at most two are three letters long.
 * - Cryptogrid `codewordRev 6` (CODEWORD_REV_VISIBLE): the clean bonus counts only wrong letters the player was shown
 *   to be wrong: a letter that completed a word on the grid that is no real word. A wrong letter in a word still
 *   missing letters is a trial, never a mistake.
 *
 * New deals get these stamps only on top of the stamp dealt before (so a check pinning any earlier world keeps what
 * it pinned). Checks written for the stamps before pin them with `pinPreWordOverhaul(true)`. Shared by phone and
 * server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";
import type { PuzzleData, PuzzleType } from "./types";
import { preStandardPinned } from "./standard/stamps";
import { wordNov7Dealt } from "./wordNov7";

export const WORDSMITH_REV_EVERYDAY = 5;
export const SLIDER_REV_PROVEN = 6;
export const LOOKOUT_REV_DONE = 6;
export const WHEEL_REV_COMMON = 5;
export const CODEWORD_REV_VISIBLE = 6;
/**
 * Cryptogrid codewordRev 7 (the Word overhaul, stage 3, Joe 15 Nov 2026): rev 6's board and scoring, and a full grid that
 * isn't cracked is answered with the words on it that aren't real words, which flash on the board (the live check's
 * `nonWords`). Rev 6 rounds get no names, as before.
 */
export const CODEWORD_REV_NAMES = 7;

/**
 * Each game's stamp key, the stamp a new deal must carry to move up (`from`), the overhaul's first stamp (`rev`: a puzzle
 * on it or later uses the overhaul's rules) and the stamp new deals carry (`deal`, when later than `rev`).
 */
export const WORD_OVERHAUL_STAMPS: Partial<Record<PuzzleType, { key: string; from: number; rev: number; deal?: number }>> = {
  wordsmith: { key: "wordsmithRev", from: 4, rev: WORDSMITH_REV_EVERYDAY },
  wordslide: { key: "wordSlideRev", from: 5, rev: SLIDER_REV_PROVEN },
  wordsearch: { key: "wordSearchRev", from: 5, rev: LOOKOUT_REV_DONE },
  letterwheel: { key: "wheelRev", from: 4, rev: WHEEL_REV_COMMON },
  codeword: { key: "codewordRev", from: 5, rev: CODEWORD_REV_VISIBLE, deal: CODEWORD_REV_NAMES },
};

/** Checks written for the stamps before the overhaul pin new deals to them (returns the previous setting). */
export function pinPreWordOverhaul(on: boolean): boolean {
  return setDealPin("preWordOverhaul", on);
}

export function preWordOverhaulPinned(): boolean {
  return dealPinned("preWordOverhaul");
}

/** True while new rounds of `type` are dealt the overhaul's stamp (the help and intro texts describe it). */
export function wordOverhaulDealt(type: "wordsmith" | "wordslide" | "wordsearch" | "letterwheel" | "codeword"): boolean {
  if (dealPinned("preWordOverhaul")) return false;
  if (type === "wordsmith") return !dealPinned("preTopup") && !dealPinned("preDepth");
  if (preStandardPinned()) return false;
  if (type === "wordslide" || type === "wordsearch") return wordNov7Dealt(type);
  return true;
}

function stampOf(puzzle: unknown, key: string): number | null {
  const v = (puzzle as Record<string, unknown> | null)?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** True for a stored puzzle of `type` on the overhaul's stamp (or later). */
export function usesWordOverhaul(puzzle: unknown, type?: PuzzleType): boolean {
  const p = puzzle as { type?: PuzzleType } | null;
  if (!p?.type || (type && p.type !== type)) return false;
  const st = WORD_OVERHAUL_STAMPS[p.type];
  if (!st) return false;
  const v = stampOf(p, st.key);
  return v !== null && v >= st.rev;
}

/**
 * The stamp only (no content change): the overhaul's when the puzzle carries the stamp before it, unchanged
 * otherwise or while pinned. The server's layer (wordOverhaul.server.ts) rebuilds what a stamp changes in the deal.
 */
export function overhaulStamp<T extends PuzzleData>(puzzle: T): T {
  const st = WORD_OVERHAUL_STAMPS[puzzle.type];
  if (!st || dealPinned("preWordOverhaul")) return puzzle;
  if (stampOf(puzzle, st.key) !== st.from) return puzzle;
  return { ...puzzle, [st.key]: st.deal ?? st.rev } as T;
}

/* ------------------------------------------------------------------------------------- Cryptogrid (rev 6) */

/**
 * Cryptogrid codewordRev 6: the wrong letters the player was shown to be wrong. Each draft (in order) is a letter
 * assignment (index n − 1, "" when empty); an assignment of a wrong letter counts once it completes a run (every cell
 * of an across or down word filled) whose word is not a real word. `runs` are the grid's runs as number lists;
 * `isWord` the dictionary. A pair (number, letter) counts once however often it is entered.
 */
export function cryptogridVisibleWrong(
  drafts: readonly (readonly string[])[],
  runs: readonly (readonly number[])[],
  solution: string,
  givenNumbers: ReadonlySet<number>,
  isWord: (word: string) => boolean,
): number {
  const counted = new Set<string>();
  let before: readonly string[] = [];
  for (const letters of drafts) {
    for (let i = 0; i < letters.length; i++) {
      const n = i + 1;
      const letter = letters[i] ?? "";
      if (!letter || letter === (before[i] ?? "") || givenNumbers.has(n) || letter === solution[i]) continue;
      const key = `${n}${letter}`;
      if (counted.has(key)) continue;
      // Shown wrong: some full run through this number reads as no real word.
      const shown = runs.some((run) => run.includes(n) && run.every((m) => (letters[m - 1] ?? "") !== "") && !isWord(run.map((m) => letters[m - 1]).join("")));
      if (shown) counted.add(key);
    }
    before = letters;
  }
  return counted.size;
}

/**
 * The overhaul's answer reveals (Joe's reveal brief, 15 Nov 2026) are drawn for the stamps the Word games deal today and
 * later; stored rounds on older stamps keep the reveal they were shown (their markup is proved against main by the
 * games' legacy checks). Display only.
 */
const REVEAL_FROM: Partial<Record<PuzzleType, { key: string; from: number }>> = {
  wordsmith: { key: "wordsmithRev", from: WORDSMITH_REV_EVERYDAY },
  tilegrid: { key: "tileGridRev", from: 4 },
  wordslide: { key: "wordSlideRev", from: SLIDER_REV_PROVEN },
  wordhunt: { key: "wordHuntRev", from: 4 },
  wordsearch: { key: "wordSearchRev", from: LOOKOUT_REV_DONE },
  letterwheel: { key: "wheelRev", from: WHEEL_REV_COMMON },
  strikeout: { key: "strikeoutRev", from: 7 },
  codeword: { key: "codewordRev", from: CODEWORD_REV_VISIBLE },
  swapword: { key: "swapwordRev", from: 7 },
};

export function overhaulReveal(puzzle: unknown): boolean {
  const p = puzzle as { type?: PuzzleType } | null;
  const r = p?.type ? REVEAL_FROM[p.type] : undefined;
  if (!r) return false;
  const v = stampOf(p, r.key);
  return v !== null && v >= r.from;
}
