/**
 * Strikeout rules, shared by the phone (drawing the board from the server's
 * replies, the reveal) and the server (live checks and grading).
 *
 * Rev 1 (stored rounds, `strikeoutRev` 1 or absent): five five-letter words on
 * the board at once. The answer is the action list: a letter guess ("E") or a
 * solve attempt ("2CRANE": row 2, the word CRANE).
 *
 * Rev 2 (`strikeoutRev: 2`, 14 Oct 2026): five 7–8 letter words played one at
 * a time, each starting with one or two letters showing (`givens`, every copy
 * of each starting letter). Every action names the word it is for: "0R" (guess
 * R on word 0) or "0BLANKET" (solve word 0); an action for any word but the
 * current one is ignored. See replayStrikeout2.
 *
 * Rev 3 (`strikeoutRev: 3`, 15 Oct 2026): rev 2's board and actions with ten
 * strikes shared over the round, three vowel guesses per word, one more
 * starting letter on words 1–3, and 1.5 points (not 3) per strike left on a
 * finish. The replay, view and scorer take the rules for the stored rev
 * (so2Rules); rev-2 rounds keep five strikes, two vowels and 3 per strike.
 *
 * Rev 4 (`strikeoutRev: 4`, 19 Oct 2026): rev 3 with twelve strikes, and 1.25
 * points per strike left on a finish (twelve left = 15, the same top as rev 3's
 * ten × 1.5). Words, starting letters, vowels and actions are rev 3's; rev-3
 * rounds keep ten strikes and 1.5 per strike.
 *
 * Both: the server replays the list against the stored words; a solve that is
 * not a dictionary word is rejected with no effect, so the grader stores the
 * canonical list (rejected solves and anything after the round ended removed)
 * and the reveal can replay that list without a dictionary.
 */

import { finishParts, partialParts, scoreRev1, PUZZLE_SPEED_POINTS } from "./puzzleScoreRev";
import { speedBonusCurve } from "./speedPar";

export const STRIKEOUT_REV = 1;
export const SO_ROWS = 5;
export const SO_LEN = 5;
export const SO_MAX_STRIKES = 5;
/** Plenty for 26 letters and many solve attempts; longer lists are cut. */
export const SO_MAX_ACTIONS = 120;

export type SoAction = { kind: "guess"; letter: string } | { kind: "solve"; row: number; word: string };

export type SoOutcome = "hit" | "miss" | "right" | "wrong" | "notword" | "ignored" | "vowels";

export function encodeSoAction(action: SoAction): string {
  return action.kind === "guess" ? action.letter : `${action.row}${action.word}`;
}

export function encodeStrikeout(actions: readonly SoAction[]): string {
  return actions.map(encodeSoAction).join(",");
}

export function decodeStrikeout(answer: string): SoAction[] {
  const out: SoAction[] = [];
  for (const raw of String(answer ?? "").split(",").slice(0, SO_MAX_ACTIONS)) {
    const token = raw.trim().toUpperCase();
    if (/^[A-Z]$/.test(token)) out.push({ kind: "guess", letter: token });
    else if (/^[0-4][A-Z]{5}$/.test(token)) out.push({ kind: "solve", row: Number(token[0]), word: token.slice(1) });
  }
  return out;
}

export interface SoState {
  /** revealed[row][i]: tile i of the row is showing. */
  revealed: boolean[][];
  /** Letters guessed, in order. */
  guessed: string[];
  hits: string[];
  misses: string[];
  strikes: number;
  /** Every row fully revealed (guessing or Solve). */
  done: boolean;
  /** Five strikes. */
  over: boolean;
  /** Actions that changed the board, in order (the stored answer). */
  effective: SoAction[];
  /** One outcome per submitted action. */
  outcomes: SoOutcome[];
}

export function soRowSolved(state: SoState, row: number): boolean {
  return state.revealed[row]?.every(Boolean) ?? false;
}

/**
 * Replays the action list. `isWord` decides whether a solve attempt counts at
 * all (the server passes the dictionary; the reveal replays the canonical list,
 * where every remaining solve already passed it).
 */
export function replayStrikeout(
  words: readonly string[],
  actions: readonly SoAction[],
  isWord: (word: string) => boolean,
): SoState {
  const target = words.map((w) => w.toUpperCase());
  const state: SoState = {
    revealed: target.map((w) => Array.from({ length: w.length }, () => false)),
    guessed: [],
    hits: [],
    misses: [],
    strikes: 0,
    done: false,
    over: false,
    effective: [],
    outcomes: [],
  };
  for (const action of actions) {
    if (state.done || state.over) {
      state.outcomes.push("ignored");
      continue;
    }
    if (action.kind === "guess") {
      const letter = action.letter;
      if (state.guessed.includes(letter)) {
        state.outcomes.push("ignored");
        continue;
      }
      state.guessed.push(letter);
      let hit = false;
      target.forEach((w, r) => {
        for (let i = 0; i < w.length; i++) if (w[i] === letter) { state.revealed[r]![i] = true; hit = true; }
      });
      if (hit) state.hits.push(letter);
      else {
        state.misses.push(letter);
        state.strikes++;
      }
      state.effective.push(action);
      state.outcomes.push(hit ? "hit" : "miss");
    } else {
      const row = action.row;
      if (row < 0 || row >= target.length || soRowSolved(state, row)) {
        state.outcomes.push("ignored");
        continue;
      }
      if (!isWord(action.word)) {
        state.outcomes.push("notword");
        continue;
      }
      if (action.word === target[row]) {
        state.revealed[row] = state.revealed[row]!.map(() => true);
        state.outcomes.push("right");
      } else {
        state.strikes++;
        state.outcomes.push("wrong");
      }
      state.effective.push(action);
    }
    state.done = state.revealed.every((row) => row.every(Boolean));
    state.over = !state.done && state.strikes >= SO_MAX_STRIKES;
  }
  return state;
}

export interface SoTally {
  solvedRows: number;
  /** Revealed tiles in rows that are not solved. */
  partialTiles: number;
  strikes: number;
  done: boolean;
}

export function soTally(state: SoState): SoTally {
  let solvedRows = 0;
  let partialTiles = 0;
  for (const row of state.revealed) {
    if (row.every(Boolean)) solvedRows++;
    else partialTiles += row.filter(Boolean).length;
  }
  return { solvedRows, partialTiles, strikes: state.strikes, done: state.done };
}

/** Rev 1: 3 per strike left on a solve; 27.5 per solved word when unfinished. */
export const SO_REV1_STRIKE_POINTS = 3;
export const SO_REV1_WORD_POINTS = 27.5;

/**
 * All five solved: 120 + 4 per unused strike + up to 10 for speed (par curve).
 * Otherwise 20 per solved row + 2 per revealed tile in unsolved rows, cap 110.
 */
export function scoreStrikeout(tally: SoTally, msRemaining: number, timeLimitMs: number): number {
  if (scoreRev1()) {
    // Rev 1: 120 + 3 per strike left (15 with none used) + PAR(15); unfinished 27.5 per word solved (four = 110).
    // Letters showing in unsolved words earn nothing, so guessing letters at random scores about 0.
    if (tally.done) {
      const left = Math.max(0, SO_MAX_STRIKES - tally.strikes);
      return finishParts(timeLimitMs > 0 ? speedBonusCurve(PUZZLE_SPEED_POINTS, msRemaining, timeLimitMs) : 0, SO_REV1_STRIKE_POINTS * left, "strikes");
    }
    return partialParts(SO_REV1_WORD_POINTS * tally.solvedRows);
  }
  if (tally.done) {
    const unused = Math.max(0, SO_MAX_STRIKES - tally.strikes);
    const ms = Math.max(0, Math.min(msRemaining, timeLimitMs));
    return Math.min(150, 120 + 4 * unused + (timeLimitMs > 0 ? speedBonusCurve(10, ms, timeLimitMs) : 0));
  }
  return Math.min(110, 20 * tally.solvedRows + 2 * tally.partialTiles);
}

/** What the phone may see after an action: only tiles already earned. */
export interface SoView {
  rows: string[];
  hits: string;
  misses: string;
  strikes: number;
  done: boolean;
  over: boolean;
  /** Outcome of the last submitted action. */
  last: SoOutcome | null;
  /** How many actions the reply covers (the phone ignores stale replies). */
  count: number;
  /** Rev 2 only: the word being played (5 once all are solved). */
  word?: number;
  /** Rev 2 only: vowel guesses left on the current word. */
  vowelsLeft?: number;
}

export function soView(words: readonly string[], state: SoState, count: number): SoView {
  return {
    rows: words.map((w, r) => [...w.toUpperCase()].map((ch, i) => (state.revealed[r]![i] ? ch : "_")).join("")),
    hits: state.hits.join(""),
    misses: state.misses.join(""),
    strikes: state.strikes,
    done: state.done,
    over: state.over,
    last: state.outcomes.at(-1) ?? null,
    count,
  };
}

// ───────────────────────── Rev 2: one long word at a time ─────────────────────────

export const STRIKEOUT_REV2 = 2;
export const SO2_WORDS = 5;
export const SO2_MIN_LEN = 7;
export const SO2_MAX_LEN = 8;
export const SO2_VOWELS = "AEIOU";
/** Vowel guesses allowed per word; further vowels are refused (no effect, no strike). */
export const SO2_MAX_VOWELS = 2;
/** Generous: five words × every letter, plus solves; longer lists are cut. */
export const SO2_MAX_ACTIONS = 200;
/** Rev 2 unfinished credit: per word solved, and per tile the player found in the current word. */
export const SO2_WORD_POINTS = 30;
export const SO2_TILE_POINTS = 2;
export const SO2_STRIKE_POINTS = 3;

// Rev 3 (15 Oct 2026): rev 2's game with more room for mistakes.
export const STRIKEOUT_REV3 = 3;
export const SO3_MAX_STRIKES = 10;
export const SO3_MAX_VOWELS = 3;
/** 1.5 per strike left: ten left = 15, so a finish still tops out at 120 + 15 + PAR(15) = 150. */
export const SO3_STRIKE_POINTS = 1.5;
/** Words 1–3 (indexes below this) start with one more letter showing than rev 2's so2GivenCount. */
export const SO3_EXTRA_GIVEN_WORDS = 3;

// Rev 4 (19 Oct 2026): rev 3 with twelve strikes.
export const STRIKEOUT_REV4 = 4;
export const SO4_MAX_STRIKES = 12;
/** 1.25 per strike left: twelve left = 15, so a finish still tops out at 120 + 15 + PAR(15) = 150. */
export const SO4_STRIKE_POINTS = 1.25;

/** The per-rev rules the rev-2 style replay, view and scorer read. */
export interface So2Rules {
  /** Strikes (shared over the round) that end it. */
  maxStrikes: number;
  /** Vowel guesses allowed per word. */
  maxVowels: number;
  /** Finish points per strike left. */
  strikePoints: number;
}

export const SO2_RULES: So2Rules = { maxStrikes: SO_MAX_STRIKES, maxVowels: SO2_MAX_VOWELS, strikePoints: SO2_STRIKE_POINTS };
export const SO3_RULES: So2Rules = { maxStrikes: SO3_MAX_STRIKES, maxVowels: SO3_MAX_VOWELS, strikePoints: SO3_STRIKE_POINTS };
export const SO4_RULES: So2Rules = { maxStrikes: SO4_MAX_STRIKES, maxVowels: SO3_MAX_VOWELS, strikePoints: SO4_STRIKE_POINTS };

// Rev 5 (25 Oct 2026, word depth to 200; docs/depth/d1-word.md): rev 4's rules exactly, scored to 200 with the
// early-solve bonus (depth/strikeout.server.ts). so2Rules treats 5 as 4.
export const STRIKEOUT_REV5 = 5;
/** The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md): rev 5's rules and boards, its bonuses retuned (depth/strikeout.server.ts). */
export const STRIKEOUT_REV_TOPUP = 6;

/** The rules for a stored rev (2, 3, 4 or 5; rev 1 has its own replay). */
export function so2Rules(rev: number): So2Rules {
  return rev >= STRIKEOUT_REV4 ? SO4_RULES : rev >= STRIKEOUT_REV3 ? SO3_RULES : SO2_RULES;
}

/** Rev 3: extra starting letters on word w (one on words 1–3, none after). */
export function so3ExtraGivens(w: number): number {
  return w < SO3_EXTRA_GIVEN_WORDS ? 1 : 0;
}

export function strikeoutRevOf(puzzle: { strikeoutRev?: number } | null | undefined): number {
  const rev = puzzle?.strikeoutRev;
  return typeof rev === "number" && Number.isFinite(rev) ? rev : 1;
}

export type So2Action = { kind: "guess"; word: number; letter: string } | { kind: "solve"; word: number; guess: string };

export type So2Outcome = SoOutcome;

export function encodeSo2Action(action: So2Action): string {
  return `${action.word}${action.kind === "guess" ? action.letter : action.guess}`;
}

export function encodeStrikeout2(actions: readonly So2Action[]): string {
  return actions.map(encodeSo2Action).join(",");
}

export function decodeStrikeout2(answer: string): So2Action[] {
  const out: So2Action[] = [];
  for (const raw of String(answer ?? "").split(",").slice(0, SO2_MAX_ACTIONS)) {
    const token = raw.trim().toUpperCase();
    if (/^[0-4][A-Z]$/.test(token)) out.push({ kind: "guess", word: Number(token[0]), letter: token[1]! });
    else if (/^[0-4][A-Z]{7,8}$/.test(token)) out.push({ kind: "solve", word: Number(token[0]), guess: token.slice(1) });
  }
  return out;
}

export interface So2State {
  /** The word being played (SO2_WORDS once all are solved). */
  word: number;
  /** revealed[w][i]: tile i of word w is showing (starting letters included). */
  revealed: boolean[][];
  /** given[w][i]: tile i of word w was showing from the start. */
  given: boolean[][];
  /** Letters guessed on the current word, in order (the keypad resets per word). */
  guessed: string[];
  hits: string[];
  misses: string[];
  /** Vowel guesses used on the current word. */
  vowelsUsed: number;
  /** Shared across the whole round. */
  strikes: number;
  solvedWords: number;
  done: boolean;
  over: boolean;
  /** Actions that changed the board, in order (the stored answer). */
  effective: So2Action[];
  /** One outcome per submitted action. */
  outcomes: So2Outcome[];
}

/** The letters showing at the start of word w (from its public pattern). */
export function so2GivenLetters(givens: readonly string[], w: number): Set<string> {
  return new Set([...(givens[w] ?? "")].filter((ch) => ch !== "_"));
}

/**
 * Rev 2 replay. Word by word: a guess on the current word reveals every copy
 * of the letter (a miss is a strike); a letter already guessed or already
 * showing is ignored; a vowel guess past the rules' maxVowels on one word (the
 * third under rev 2, the fourth under rev 3) is refused ("vowels": no effect,
 * no strike). A solve must be the current word's length; a non-word is
 * refused free, a wrong word is a strike, the right one completes the word. A
 * completed word (by guesses or Solve) moves play to the next word with a fresh
 * keypad. Strikes are shared: the rules' maxStrikes (five under rev 2, ten
 * under rev 3, twelve under rev 4) end the round.
 */
export function replayStrikeout2(
  words: readonly string[],
  givens: readonly string[],
  actions: readonly So2Action[],
  isWord: (word: string) => boolean,
  rules: So2Rules = SO2_RULES,
): So2State {
  const target = words.map((w) => w.toUpperCase());
  const given = target.map((w, wi) => [...w].map((_, i) => (givens[wi]?.[i] ?? "_") !== "_"));
  const state: So2State = {
    word: 0,
    revealed: given.map((row) => [...row]),
    given,
    guessed: [],
    hits: [],
    misses: [],
    vowelsUsed: 0,
    strikes: 0,
    solvedWords: 0,
    done: target.length === 0,
    over: false,
    effective: [],
    outcomes: [],
  };
  const complete = () => {
    state.solvedWords++;
    state.word++;
    state.guessed = [];
    state.hits = [];
    state.misses = [];
    state.vowelsUsed = 0;
    state.done = state.word >= target.length;
  };
  for (const action of actions) {
    if (state.done || state.over || action.word !== state.word) {
      state.outcomes.push("ignored");
      continue;
    }
    const w = state.word;
    const word = target[w]!;
    if (action.kind === "guess") {
      const letter = action.letter;
      if (state.guessed.includes(letter) || so2GivenLetters(givens, w).has(letter)) {
        state.outcomes.push("ignored");
        continue;
      }
      const vowel = SO2_VOWELS.includes(letter);
      if (vowel && state.vowelsUsed >= rules.maxVowels) {
        state.outcomes.push("vowels");
        continue;
      }
      if (vowel) state.vowelsUsed++;
      state.guessed.push(letter);
      let hit = false;
      for (let i = 0; i < word.length; i++) if (word[i] === letter) { state.revealed[w]![i] = true; hit = true; }
      state.effective.push(action);
      if (hit) {
        state.hits.push(letter);
        state.outcomes.push("hit");
        if (state.revealed[w]!.every(Boolean)) complete();
      } else {
        state.misses.push(letter);
        state.strikes++;
        state.outcomes.push("miss");
      }
    } else {
      if (action.guess.length !== word.length) {
        state.outcomes.push("ignored");
        continue;
      }
      if (action.guess !== word && !isWord(action.guess)) {
        state.outcomes.push("notword");
        continue;
      }
      state.effective.push(action);
      if (action.guess === word) {
        state.revealed[w] = state.revealed[w]!.map(() => true);
        state.outcomes.push("right");
        complete();
      } else {
        state.strikes++;
        state.outcomes.push("wrong");
      }
    }
    state.over = !state.done && state.strikes >= rules.maxStrikes;
  }
  return state;
}

export interface So2Tally {
  solvedWords: number;
  /** Tiles the player revealed in the current, unsolved word (starting letters not counted). */
  foundTiles: number;
  strikes: number;
  done: boolean;
}

export function so2Tally(state: So2State): So2Tally {
  const w = state.word;
  let foundTiles = 0;
  if (!state.done && w < state.revealed.length) {
    state.revealed[w]!.forEach((on, i) => { if (on && !state.given[w]![i]) foundTiles++; });
  }
  return { solvedWords: state.solvedWords, foundTiles, strikes: state.strikes, done: state.done };
}

/**
 * Rev 2: all five solved = 120 + 3 per strike left + PAR(15) (123–150).
 * Rev 3: all five solved = 120 + 1.5 per strike left (rounded as finishParts
 * rounds each part) + PAR(15) (122–150).
 * Rev 4: all five solved = 120 + 1.25 per strike left (rounded) + PAR(15) (121–150).
 * Unfinished (both): 30 per word solved + 2 per tile found in the current word,
 * cap 110. Starting letters earn nothing.
 */
export function scoreStrikeout2(tally: So2Tally, msRemaining: number, timeLimitMs: number, rules: So2Rules = SO2_RULES): number {
  if (tally.done) {
    const left = Math.max(0, rules.maxStrikes - tally.strikes);
    return finishParts(timeLimitMs > 0 ? speedBonusCurve(PUZZLE_SPEED_POINTS, msRemaining, timeLimitMs) : 0, rules.strikePoints * left, "strikes");
  }
  return partialParts(SO2_WORD_POINTS * tally.solvedWords + SO2_TILE_POINTS * tally.foundTiles);
}

/**
 * Rev 2 reply: `rows` holds every word (solved words in full, the current word
 * as far as it shows, later words blank), `hits` / `misses` the current word's
 * keys only, plus the current word and its vowel guesses left.
 */
export function so2View(words: readonly string[], state: So2State, count: number, rules: So2Rules = SO2_RULES): SoView {
  return {
    rows: words.map((w, wi) =>
      [...w.toUpperCase()].map((ch, i) => (wi <= state.word && state.revealed[wi]![i] ? ch : "_")).join(""),
    ),
    hits: state.hits.join(""),
    misses: state.misses.join(""),
    strikes: state.strikes,
    done: state.done,
    over: state.over,
    last: state.outcomes.at(-1) ?? null,
    count,
    word: state.word,
    vowelsLeft: Math.max(0, rules.maxVowels - state.vowelsUsed),
  };
}

/**
 * Rev 5's early solves (public information: the phone shows the same): for each word solved with a right Solve,
 * the tiles still hidden at that moment, and for every word the tiles hidden at its start (not starting letters).
 * `share` = hidden at the solves ÷ hidden at the starts over all five words (0 when every word was guessed out).
 */
export interface So2EarlySolves {
  /** Per word: tiles still hidden when it was solved with Solve (0 if guessed out or unsolved). */
  hiddenAtSolve: number[];
  /** Per word: tiles hidden at its start. */
  openAtStart: number[];
  share: number;
}

export function so2EarlySolves(
  words: readonly string[],
  givens: readonly string[],
  actions: readonly So2Action[],
  isWord: (word: string) => boolean,
  rules: So2Rules = SO2_RULES,
): So2EarlySolves {
  const target = words.map((w) => w.toUpperCase());
  const openAtStart = target.map((w, wi) => [...w].filter((_, i) => (givens[wi]?.[i] ?? "_") === "_").length);
  const hiddenAtSolve = target.map(() => 0);
  const full = replayStrikeout2(words, givens, actions, isWord, rules);
  actions.forEach((action, i) => {
    if (action.kind !== "solve" || full.outcomes[i] !== "right") return;
    const before = replayStrikeout2(words, givens, actions.slice(0, i), isWord, rules);
    hiddenAtSolve[action.word] = before.revealed[action.word]!.filter((on) => !on).length;
  });
  const open = openAtStart.reduce((a, b) => a + b, 0);
  const hidden = hiddenAtSolve.reduce((a, b) => a + b, 0);
  return { hiddenAtSolve, openAtStart, share: open > 0 ? hidden / open : 0 };
}
