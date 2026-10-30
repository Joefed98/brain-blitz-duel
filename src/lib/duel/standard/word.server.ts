/**
 * The scoring standard's Word games (docs/scoring-standard.md "Word", "Word decisions"), server only: Interlock, Slider,
 * Lookout, Roundabout, Strikeout, Cryptogrid and Swapword on their standard stamps. Each grade is built from the game's
 * own grade (grade.ts: the verdict and its facts) and, where the standard needs more, from the answer itself with the
 * game's own shared helpers and the server's dictionary. The numbers live in word.ts (shared with the help texts).
 */
import { isWord } from "../dictionary.server";
import { decodeTileGrid, tileGridRuns, fitsTray } from "../tileGrid";
import { judgeTileGrid } from "../tileGrid.server";
import { decodeSlideTokens, markedRowWord, WS_MARKED_ROWS } from "../wordSlide";
import { checkWordSlideRow, replayWordSlideFor } from "../wordSlide.server";
import { swapwordCounts, wordSlideMadeRows } from "../progressFigures";
import { wsDecode, wsGrade, wsSplitBonus } from "../wordSearch";
import { LW_JAR_DROPS, lwDecodeLog, lwJarKept, lwJarTally, lwMissPenalty, lwTallyLog } from "../letterWheel";
import { decodeStrikeout2, replayStrikeout2, so2EarlySolves, so2Rules, so2Tally, strikeoutRevOf } from "../strikeout";
import { codewordTally, decodeCodeword, replayCodeword } from "../codeword";
import { decodeSwapword, replaySwapword } from "../swapword";
import { PUZZLE_EFFICIENCY_POINTS } from "../puzzleScoreRev";
import type { PuzzleData, PuzzleType } from "../types";
import type { StandardGame, StandardInput } from "./grade.server";
import { cleanPoints, parPoints, speedPoints } from "./shape";
import {
  STD_CRYPTOGRID,
  STD_INTERLOCK,
  STD_LOOKOUT,
  STD_ROUNDABOUT,
  STD_SLIDER,
  STD_STRIKEOUT,
  STD_SWAPWORD,
  interlockBigWordPoints,
  strikeoutEarlySolvePoints,
  swapwordBlindSwaps,
} from "./word";

const speedOf = (input: StandardInput, max: number, fullByS: number) => speedPoints(max, input.msLeft, input.limitMs, fullByS * 1000);
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/* ------------------------------------------------------------------------------------------------ Interlock */

/** Tiles inside a real word (the game's own count, from the server's dictionary); 0 for a grid off the tray. */
function interlockWordTiles(puzzle: Extract<PuzzleData, { type: "tilegrid" }>, answer: string): number {
  return judgeTileGrid(decodeTileGrid(answer), puzzle.tray).wordTiles;
}

/** Big words: each valid run of 5+ letters (6 / 10 / 15 by length), at most 30; nothing for a grid off the tray. */
function interlockBigWords(puzzle: Extract<PuzzleData, { type: "tilegrid" }>, answer: string): { points: number; words: string[] } {
  const cells = decodeTileGrid(answer);
  if (!fitsTray(cells, puzzle.tray)) return { points: 0, words: [] };
  const words = tileGridRuns(cells).filter((r) => r.word.length >= 5 && isWord(r.word)).map((r) => r.word);
  const points = Math.min(STD_INTERLOCK.bigMax, words.reduce((sum, w) => sum + interlockBigWordPoints(w.length), 0));
  return { points, words };
}

const interlock: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "tilegrid" ? interlockWordTiles(puzzle, draft) : 0),
  grade(input, ctx) {
    const p = input.puzzle;
    if (p.type !== "tilegrid") return { finished: false, credit: 0 };
    const big = interlockBigWords(p, input.answer);
    const facts = { bigWords: big.words, bigWordPoints: big.points };
    if (input.graded.isCorrect) {
      return { finished: true, speed: speedOf(input, STD_INTERLOCK.speed, STD_INTERLOCK.fullByS), bonus: big.points, measure: "big words", facts };
    }
    const tiles = num(input.graded.extra?.["wordTiles"]);
    const credit = STD_INTERLOCK.tile * tiles + ctx.early(STD_INTERLOCK.early, tiles) + big.points;
    return { finished: false, credit, facts };
  },
};

/* ------------------------------------------------------------------------------------------------ Slider */

/** Rows the player turned into words (a row still as it started is never counted). */
function sliderMadeRows(puzzle: Extract<PuzzleData, { type: "wordslide" }>, answer: string): number {
  const replay = replayWordSlideFor(puzzle, decodeSlideTokens(answer));
  const validRows = WS_MARKED_ROWS.filter((r) => checkWordSlideRow(markedRowWord(replay.grid, r)).valid);
  return wordSlideMadeRows(puzzle.grid, replay.grid, validRows);
}

const slider: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "wordslide" ? sliderMadeRows(puzzle, draft) : 0),
  grade(input, ctx) {
    const p = input.puzzle;
    if (p.type !== "wordslide") return { finished: false, credit: 0 };
    const moves = num(input.graded.extra?.["moves"], Infinity);
    if (input.graded.isCorrect) {
      return {
        finished: true,
        speed: speedOf(input, STD_SLIDER.speed, STD_SLIDER.fullByS),
        bonus: parPoints(STD_SLIDER.par, moves, p.par),
        measure: "par moves",
      };
    }
    const rows = sliderMadeRows(p, input.answer);
    return { finished: false, credit: STD_SLIDER.row * rows + ctx.early(STD_SLIDER.early, rows), facts: { madeRows: rows } };
  },
};

/* ------------------------------------------------------------------------------------------------ Lookout */

function lookoutFound(puzzle: Extract<PuzzleData, { type: "wordsearch" }>, answer: string): number {
  const split = wsSplitBonus(puzzle.bonus, wsDecode(answer, puzzle.size));
  return wsGrade(puzzle.placements ?? [], split.rest).found.length;
}

const lookout: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "wordsearch" ? lookoutFound(puzzle, draft) : 0),
  grade(input, ctx) {
    const extra = input.graded.extra ?? {};
    const bonus = extra["bonusFound"] === true ? STD_LOOKOUT.bonus : 0;
    if (input.graded.isCorrect) {
      return { finished: true, speed: speedOf(input, STD_LOOKOUT.speed, STD_LOOKOUT.fullByS), bonus, measure: "bonus word" };
    }
    const found = num(extra["found"]);
    const wrong = num(extra["wrong"]);
    const penalty = STD_LOOKOUT.wrongCost * Math.max(0, wrong - STD_LOOKOUT.freeWrong);
    return { finished: false, credit: Math.max(0, STD_LOOKOUT.word * found + ctx.early(STD_LOOKOUT.early, found) - penalty) + bonus };
  },
};

/* ------------------------------------------------------------------------------------------------ Roundabout */

function roundaboutSlots(puzzle: Extract<PuzzleData, { type: "letterwheel" }>, answer: string): number {
  return lwTallyLog(puzzle.words ?? [], puzzle.letters, lwDecodeLog(answer), isWord).slots.length;
}

const roundabout: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "letterwheel" ? roundaboutSlots(puzzle, draft) : 0),
  grade(input, ctx) {
    const p = input.puzzle;
    if (p.type !== "letterwheel") return { finished: false, credit: 0 };
    const extra = input.graded.extra ?? {};
    const misses = num(extra["misses"]);
    const size = Math.max(1, p.jarSize ?? LW_JAR_DROPS);
    const jar = lwJarTally(p.words ?? [], p.letters, lwDecodeLog(input.answer), isWord);
    const kept = lwJarKept(jar.drops, misses);
    const jarPoints = (STD_ROUNDABOUT.jar * Math.min(kept, size)) / size;
    const facts = { bonusWords: jar.bonus.length, jarDrops: kept, jarSpilled: jar.drops - kept, jarSize: size, jarPoints: Math.round(jarPoints) };
    const penalty = lwMissPenalty(misses);
    if (input.graded.isCorrect) {
      // Today's finish efficiency (accuracy: 15 less the misses' cost) scales the speed points.
      const efficiency = Math.max(0, PUZZLE_EFFICIENCY_POINTS - penalty) / PUZZLE_EFFICIENCY_POINTS;
      return { finished: true, speed: speedOf(input, STD_ROUNDABOUT.speed, STD_ROUNDABOUT.fullByS) * efficiency, bonus: jarPoints, measure: "bonus jar", facts };
    }
    const slots = num(extra["slots"]);
    const total = Math.max(1, num(extra["total"], p.slots.length));
    const credit = Math.max(0, (STD_ROUNDABOUT.share * slots) / total + ctx.early(STD_ROUNDABOUT.early / total, slots) - penalty) + jarPoints;
    return { finished: false, credit, facts };
  },
};

/* ------------------------------------------------------------------------------------------------ Strikeout */

function strikeoutSolved(puzzle: Extract<PuzzleData, { type: "strikeout" }>, answer: string): number {
  const state = replayStrikeout2(puzzle.words ?? [], puzzle.givens ?? [], decodeStrikeout2(answer), isWord, so2Rules(strikeoutRevOf(puzzle)));
  return state.solvedWords;
}

const strikeout: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "strikeout" ? strikeoutSolved(puzzle, draft) : 0),
  grade(input, ctx) {
    const p = input.puzzle;
    if (p.type !== "strikeout") return { finished: false, credit: 0 };
    const rules = so2Rules(strikeoutRevOf(p));
    const actions = decodeStrikeout2(input.answer);
    const state = replayStrikeout2(p.words ?? [], p.givens ?? [], actions, isWord, rules);
    const tally = so2Tally(state);
    const early = so2EarlySolves(p.words ?? [], p.givens ?? [], actions, isWord, rules);
    const earlySolve = strikeoutEarlySolvePoints(early.hiddenAtSolve);
    const facts = { hiddenAtSolve: early.hiddenAtSolve, earlySolvePoints: earlySolve };
    if (input.graded.isCorrect) {
      const strikesLeft = Math.max(0, rules.maxStrikes - tally.strikes);
      const strikePoints = Math.min(STD_STRIKEOUT.strikeMax, STD_STRIKEOUT.strikeLeft * strikesLeft);
      return {
        finished: true,
        speed: speedOf(input, STD_STRIKEOUT.speed, STD_STRIKEOUT.fullByS),
        bonus: earlySolve + strikePoints,
        measure: "solve bonus",
        facts: { ...facts, strikePoints },
      };
    }
    const credit = STD_STRIKEOUT.word * tally.solvedWords + STD_STRIKEOUT.tile * tally.foundTiles + ctx.early(STD_STRIKEOUT.early, tally.solvedWords) + earlySolve;
    return { finished: false, credit, facts };
  },
};

/* ------------------------------------------------------------------------------------------------ Cryptogrid */

function cryptogridCorrect(puzzle: Extract<PuzzleData, { type: "codeword" }>, answer: string): number {
  const letters = replayCodeword(puzzle.numbers, puzzle.givens, decodeCodeword(answer, puzzle.numbers));
  return codewordTally(letters, puzzle.solution ?? "", puzzle.givens).correct;
}

/**
 * Wrong letters ever entered: every assignment in every draft of the timeline that put a letter on a hidden number
 * other than its own (an assignment the replay ignores, on a given number or with a given letter, is not one).
 * Null without a timeline (no clean bonus then).
 */
export function cryptogridWrongEntries(puzzle: Extract<PuzzleData, { type: "codeword" }>, drafts: readonly { draft: string }[] | null): number | null {
  if (!drafts) return null;
  const solution = puzzle.solution ?? "";
  const givenNumbers = new Set(puzzle.givens.map((g) => g.n));
  const givenLetters = new Set(puzzle.givens.map((g) => g.letter));
  const wrong = new Set<string>();
  for (const d of drafts) {
    for (const a of decodeCodeword(d.draft, puzzle.numbers)) {
      if (a.letter === null || givenNumbers.has(a.n) || givenLetters.has(a.letter)) continue;
      if (a.letter !== solution[a.n - 1]) wrong.add(`${a.n}${a.letter}`);
    }
  }
  return wrong.size;
}

const cryptogrid: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "codeword" ? cryptogridCorrect(puzzle, draft) : 0),
  grade(input, ctx) {
    const p = input.puzzle;
    if (p.type !== "codeword") return { finished: false, credit: 0 };
    if (input.graded.isCorrect) {
      const wrong = cryptogridWrongEntries(p, input.drafts);
      const clean = wrong === null ? 0 : cleanPoints(STD_CRYPTOGRID.clean, STD_CRYPTOGRID.clean, wrong);
      return { finished: true, speed: speedOf(input, STD_CRYPTOGRID.speed, STD_CRYPTOGRID.fullByS), bonus: clean, measure: "clean crack", facts: { wrongEntered: wrong } };
    }
    const letters = replayCodeword(p.numbers, p.givens, decodeCodeword(input.answer, p.numbers));
    const tally = codewordTally(letters, p.solution ?? "", p.givens);
    const hidden = Math.max(1, tally.hidden);
    const credit = (STD_CRYPTOGRID.share * tally.correct) / hidden + ctx.early(STD_CRYPTOGRID.early / hidden, tally.correct) - STD_CRYPTOGRID.wrongCost * (tally.wrong ?? 0);
    return { finished: false, credit: Math.max(0, credit) };
  },
};

/* ------------------------------------------------------------------------------------------------ Swapword */

/** Tiles in place net of those moved out of place (today's rev-1 measure) and of blind swaps (word.ts). */
function swapwordNet(puzzle: Extract<PuzzleData, { type: "swapword" }>, answer: string): { net: number; toPlace: number; blind: number } {
  const swaps = decodeSwapword(answer);
  const solution = puzzle.solution ?? "";
  const run = replaySwapword(puzzle.start, swaps, puzzle.maxSwaps, puzzle.solution);
  const blind = swapwordBlindSwaps(puzzle.start, swaps, run.swaps, solution);
  const c = swapwordCounts(puzzle.start, run.board, solution);
  return { net: Math.max(0, c.placed - c.displaced - blind), toPlace: c.toPlace, blind };
}

const swapword: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "swapword" ? swapwordNet(puzzle, draft).net : 0),
  grade(input, ctx) {
    const p = input.puzzle;
    if (p.type !== "swapword") return { finished: false, credit: 0 };
    if (input.graded.isCorrect) {
      const swaps = num(input.graded.extra?.["swaps"], Infinity);
      return { finished: true, speed: speedOf(input, STD_SWAPWORD.speed, STD_SWAPWORD.fullByS), bonus: parPoints(STD_SWAPWORD.par, swaps, p.minSwaps), measure: "par swaps" };
    }
    const { net, toPlace, blind } = swapwordNet(p, input.answer);
    const n = Math.max(1, toPlace);
    return { finished: false, credit: (STD_SWAPWORD.share * net) / n + ctx.early(STD_SWAPWORD.early / n, net), facts: { netPlaced: net, blindSwaps: blind } };
  },
};

/** This category's standard games, read by the grader (games.server.ts). */
export const WORD_STANDARD_GAMES: Partial<Record<PuzzleType, StandardGame>> = { tilegrid: interlock, wordslide: slider, wordsearch: lookout, letterwheel: roundabout, strikeout, codeword: cryptogrid, swapword };
