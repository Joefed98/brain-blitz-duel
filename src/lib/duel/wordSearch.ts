/**
 * Word Search rules, shared by the phone (line snapping) and the server
 * (live checks and grading). A selection is a straight line in one of eight
 * directions; it counts only when its cells exactly match a stored placement,
 * forwards or backwards. The client's idea of which words it found is never used.
 */

import { finishParts, partialParts, scoreRev1 } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";
import type { WordSearchPlacement } from "./types";

export const WS_SIZE = 10;
export const WS_WORDS = 6;
/**
 * Lookout rev stamped on new puzzles (`wordSearchRev`): 1 = 76-theme bank and public word lengths (14 Oct 2026);
 * 2 = no hidden word is or contains its theme's name (wsThemeClash; 19 Oct 2026): the bank's grids that hide such a
 * word are dealt as seeded rebuilds from the theme's other words (wordSearchBankRev2.server.ts).
 */
export const WS_REV = 2;
/**
 * wordSearchRev 3 (25 Oct 2026, word depth d1; docs/depth/d1-word.md): each board hides one more, unlisted on-theme
 * word (the bonus, `bonus`, private until the reveal; wordSearchBankRev3.server.ts). Finding it is the only way past
 * 150 (the round's maximum is 200): with all six listed words found it pays a fixed WS_BONUS_FOUND, plus up to
 * WS_BONUS_SPEED only at elite pace, on the stretch games' curve (wordDepth.ts stretchFinish): 0 at rev 3's fastShare
 * (today's 150 pace), all of it at WS_STRETCH.elite of the clock left with no mistakes (× s^power × efficiency^effPower).
 * Found without finishing it adds WS_BONUS_UNFINISHED (an unfinished round stays under every finish). A drag on the
 * bonus never counts as a wrong pick.
 */
export const WS_DEPTH_REV = 3;
export const WS_BONUS_FOUND = 15;
export const WS_BONUS_SPEED = 35;
export const WS_BONUS_UNFINISHED = 9;
/** Today's 150 pace (rev 3's fastShare for Lookout, clamped to 0.75): the elite part starts beyond it. */
export const WS_BONUS_FAST_SHARE = 0.75;
/** The elite part's shape, as the stretch games' (depth/stretchShapes.ts): all of it at `elite` of the clock left. */
export const WS_STRETCH = { elite: 0.86, power: 1.5, effPower: 2 } as const;

/** True for a board that hides a bonus word (wordSearchRev 3 and later). */
export function wsHasBonus(puzzle: { wordSearchRev?: number | undefined }): boolean {
  return (puzzle.wordSearchRev ?? 0) >= WS_DEPTH_REV;
}

/**
 * The bonus word's points (rev 3): 0 unless found; found without the six, WS_BONUS_UNFINISHED; with all six found,
 * WS_BONUS_FOUND plus WS_BONUS_SPEED × s^power × efficiency^effPower, s the share of the clock left between today's
 * 150 pace and the elite share.
 */
export function wsBonusPoints(bonusFound: boolean, finished: boolean, leftShare: number, efficiency = 1): number {
  if (!bonusFound) return 0;
  if (!finished) return WS_BONUS_UNFINISHED;
  const l = Number.isFinite(leftShare) ? leftShare : 0;
  const e = Number.isFinite(efficiency) ? Math.max(0, Math.min(1, efficiency)) : 0;
  const s = Math.max(0, Math.min(1, (l - WS_BONUS_FAST_SHARE) / (WS_STRETCH.elite - WS_BONUS_FAST_SHARE)));
  return WS_BONUS_FOUND + Math.round(WS_BONUS_SPEED * Math.pow(s, WS_STRETCH.power) * Math.pow(e, WS_STRETCH.effPower));
}

/** Rev 3: the player's selections split into the bonus drags and the rest (only the rest are graded as today). */
export function wsSplitBonus(
  bonus: WordSearchPlacement | undefined,
  selections: readonly number[][],
): { bonusFound: boolean; rest: number[][] } {
  if (!bonus) return { bonusFound: false, rest: [...selections] };
  const rest: number[][] = [];
  let bonusFound = false;
  for (const cells of selections) {
    if (wsMatch([bonus], cells) === 0) bonusFound = true;
    else rest.push(cells);
  }
  return { bonusFound, rest };
}

/** Joining words in theme names that never count as the theme ("Toys and games", "On the farm"). */
const WS_THEME_STOP = new Set(["AND", "THE"]);

/**
 * The forms of a theme's name a rev-2 hidden word may not contain: every word of the name of 3+ letters
 * (upper case, joining words AND / THE left out) and its singular: -IES → -Y, -SHES / -CHES / -XES / -SSES /
 * -ZES lose ES, any other -S (not -SS or -US) loses S; forms under 3 letters are dropped.
 * "Nuts, seeds and grains" → NUTS NUT SEEDS SEED GRAINS GRAIN.
 */
export function wsThemeForms(category: string): { names: string[]; forms: string[] } {
  const names = category.toUpperCase().split(/[^A-Z]+/).filter((t) => t.length >= 3 && !WS_THEME_STOP.has(t));
  const forms = new Set<string>();
  for (const t of names) {
    forms.add(t);
    if (t.endsWith("IES")) forms.add(`${t.slice(0, -3)}Y`);
    else if (/(SH|CH|X|SS|Z)ES$/.test(t)) forms.add(t.slice(0, -2));
    else if (t.endsWith("S") && !t.endsWith("SS") && !t.endsWith("US")) forms.add(t.slice(0, -1));
  }
  return { names, forms: [...forms].filter((f) => f.length >= 3) };
}

/**
 * Rev 2: true when a word gives its theme away: it contains a form of the theme's name (BULLDOG for "Dogs",
 * PUDDING for "Sweets and puddings", SEAL for "Sea creatures") or is part of a word of the name (DRINK for
 * "Drinks", FAIR for "Circus and funfair", COOK for "Ways of cooking"). Case-insensitive.
 */
export function wsThemeClash(category: string, word: string): boolean {
  const w = word.toUpperCase();
  const { names, forms } = wsThemeForms(category);
  return forms.some((f) => w.includes(f)) || names.some((t) => t.includes(w));
}

/**
 * Letter count of each word still to find, in chip order, or null when the puzzle carries none
 * (stored rounds before rev 1 show blank chips). Found words take the first open slot of their length.
 */
export function wsChipSlots(
  wordLengths: readonly number[] | undefined,
  found: readonly string[],
): { length: number; word: string | null }[] | null {
  if (!wordLengths || wordLengths.length === 0) return null;
  const slots = wordLengths.map((length) => ({ length, word: null as string | null }));
  for (const word of found) {
    const slot = slots.find((s) => s.word === null && s.length === word.length);
    if (slot) slot.word = word;
  }
  return slots;
}
const MAX_SELECTIONS = 300;

/** Cells of the straight line start → end, or null if it is not one of the eight directions. */
export function wsLine(start: number, end: number, size: number): number[] | null {
  const r0 = Math.floor(start / size);
  const c0 = start % size;
  const r1 = Math.floor(end / size);
  const c1 = end % size;
  if ([r0, c0, r1, c1].some((v) => v < 0 || v >= size)) return null;
  const dr = r1 - r0;
  const dc = c1 - c0;
  if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
  const len = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  return Array.from({ length: len + 1 }, (_, i) => (r0 + sr * i) * size + (c0 + sc * i));
}

/** The phone's drag: snaps the finger to the nearest of the eight directions. */
export function wsSnapLine(start: number, current: number, size: number): number[] {
  const r0 = Math.floor(start / size);
  const c0 = start % size;
  const dr = Math.floor(current / size) - r0;
  const dc = (current % size) - c0;
  if (dr === 0 && dc === 0) return [start];
  const octant = Math.round(Math.atan2(dr, dc) / (Math.PI / 4));
  const angle = (octant * Math.PI) / 4;
  const sr = Math.round(Math.sin(angle));
  const sc = Math.round(Math.cos(angle));
  let len = Math.max(Math.abs(dr), Math.abs(dc));
  while (len > 0) {
    const r = r0 + sr * len;
    const c = c0 + sc * len;
    if (r >= 0 && r < size && c >= 0 && c < size) break;
    len--;
  }
  return Array.from({ length: len + 1 }, (_, i) => (r0 + sr * i) * size + (c0 + sc * i));
}

/** Index of the placement these cells exactly cover (either way round), or -1. */
export function wsMatch(placements: readonly WordSearchPlacement[], cells: readonly number[]): number {
  const key = cells.join(".");
  const back = [...cells].reverse().join(".");
  return placements.findIndex((p) => {
    const k = p.cells.join(".");
    return k === key || k === back;
  });
}

/** "start.end,start.end" — one pair per selection. */
export function wsEncode(selections: readonly number[][]): string {
  return selections.map((cells) => `${cells[0]}.${cells[cells.length - 1]}`).join(",");
}

export function wsDecode(answer: string, size: number): number[][] {
  const out: number[][] = [];
  for (const part of String(answer ?? "").split(",").slice(0, MAX_SELECTIONS)) {
    const m = /^(\d{1,3})\.(\d{1,3})$/.exec(part);
    if (!m) continue;
    const line = wsLine(Number(m[1]), Number(m[2]), size);
    if (line && line.length >= 2) out.push(line);
  }
  return out;
}

/** Found placement indices and selections that matched no hidden word. */
export function wsGrade(
  placements: readonly WordSearchPlacement[],
  selections: readonly number[][],
): { found: number[]; wrong: number } {
  const found = new Set<number>();
  let wrong = 0;
  for (const cells of selections) {
    const i = wsMatch(placements, cells);
    if (i < 0) wrong++;
    else found.add(i);
  }
  return { found: [...found].sort((a, b) => a - b), wrong };
}

/**
 * Live check of one drag, against the private placements. Rev 3: a drag on the private bonus answers
 * `{ valid: true, bonus: true, word }` (the stage shows it in the bonus chip, never in the six); any other drag
 * answers as before, so the bonus never leaks before it is found.
 */
export function checkWordSearchPath(
  placements: readonly WordSearchPlacement[],
  size: number,
  path: readonly number[],
  already: readonly string[],
  bonus?: WordSearchPlacement,
): { valid: boolean; points: number; word: string; reason?: string; bonus?: boolean } {
  const line = path.length >= 2 ? wsLine(path[0]!, path[path.length - 1]!, size) : null;
  if (!line || line.join(".") !== path.join(".")) return { valid: false, points: 0, word: "", reason: "Not a line" };
  if (bonus && wsMatch([bonus], line) === 0) {
    if (already.map((w) => w.toUpperCase()).includes(bonus.word)) return { valid: false, points: 0, word: bonus.word, reason: "Already found" };
    return { valid: true, points: 0, word: bonus.word, bonus: true };
  }
  const i = wsMatch(placements, line);
  if (i < 0) return { valid: false, points: 0, word: "", reason: "Not a hidden word" };
  const word = placements[i]!.word;
  if (already.map((w) => w.toUpperCase()).includes(word)) {
    return { valid: false, points: 0, word, reason: "Already found" };
  }
  return { valid: true, points: 0, word };
}

/**
 * All six found: 130 + round(20 × ms left ÷ registry limit), capped at 150.
 * Otherwise: 20 per word. Wrong selections never affect the score.
 */
/** Lookout rev 1: wrong selections beyond this many cost WS_REV1_WRONG_PENALTY each (unfinished credit only). */
export const WS_REV1_FREE_WRONG = 5;
export const WS_REV1_WRONG_PENALTY = 2;

export function scoreWordSearch(
  found: number,
  total: number,
  wrong: number,
  msRemaining: number,
  timeLimitMs: number,
): number {
  if (scoreRev1()) {
    // Rev 1: 120 + PAR(30); unfinished 22 per word (five of six = 110), less 2 per wrong selection beyond the first 5.
    if (found >= total && total > 0) return finishParts(timeLimitMs > 0 ? speedBonusCurve(30, msRemaining, timeLimitMs) : 0);
    return partialParts((110 * Math.max(0, found)) / Math.max(1, total - 1) - WS_REV1_WRONG_PENALTY * Math.max(0, wrong - WS_REV1_FREE_WRONG));
  }
  if (found >= total && total > 0) {
    const ms = Math.max(0, Math.min(msRemaining, timeLimitMs));
    return Math.min(150, 130 + (timeLimitMs > 0 ? speedBonusCurve(20, ms, timeLimitMs) : 0));
  }
  return Math.min(120, 20 * Math.max(0, found));
}
