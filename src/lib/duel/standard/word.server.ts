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
import { wsDecode, wsGrade, wsRowsOf, wsSplitBonus } from "../wordSearch";
import { LW_JAR_DROPS, lwDecodeLog, lwJarKept, lwJarTally, lwMissPenalty, lwTallyLog } from "../letterWheel";
import { decodeStrikeout2, replayStrikeout2, so2EarlySolves, so2Rules, so2Tally, strikeoutRevOf, so2RulesFor } from "../strikeout";
import { codewordRuns, codewordTally, decodeCodeword, replayCodeword } from "../codeword";
import { cryptogridVisibleWrong, usesWordOverhaul } from "../wordOverhaul";
import { decodeSwapword, replaySwapword } from "../swapword";
import { PUZZLE_EFFICIENCY_POINTS } from "../puzzleScoreRev";
import type { PuzzleData, PuzzleType } from "../types";
import type { StandardGame, StandardInput } from "./grade.server";
import { cleanPoints, parPoints, speedPoints } from "./shape";
import { usesWordNov7 } from "../wordNov7";
import { ROUNDABOUT_STAR_FULL_BY_S, roundaboutStarJarFull, usesWordStar } from "../wordStar";
import { puzzleLevel } from "@/lib/levels/levels";
import { wordSlideDistance, wordSlideStartDistance } from "../wordSlideDistance.server";
import { TG_CELLS, TG_SIZE } from "../tileGrid";
import {
  STD_CRYPTOGRID,
  STD_INTERLOCK,
  STD_LOOKOUT,
  STD_ROUNDABOUT,
  STD_SLIDER,
  STD_STRIKEOUT,
  STD_SWAPWORD,
  STD_WORD_NOV7,
  interlockBigWordPoints,
  interlockFairBigPoints,
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

/** Big-word points of a grid's valid runs of 5+ letters (6 / 10 / 15 by length), uncapped, and the words. */
function bigWordSum(cells: readonly string[]): { sum: number; words: string[] } {
  const words = tileGridRuns([...cells]).filter((r) => r.word.length >= 5 && isWord(r.word)).map((r) => r.word);
  return { sum: words.reduce((sum, w) => sum + interlockBigWordPoints(w.length), 0), words };
}

/**
 * Big words: each valid run of 5+ letters (6 / 10 / 15 by length), at most 30; nothing for a grid off the tray. From
 * tileGridRev 4 (wordNov7.ts) the points are scaled so the dealt solution's own big words earn the full 30.
 */
function interlockBigWords(puzzle: Extract<PuzzleData, { type: "tilegrid" }>, answer: string): { points: number; words: string[]; top?: number } {
  const cells = decodeTileGrid(answer);
  if (!fitsTray(cells, puzzle.tray)) return { points: 0, words: [] };
  const { sum, words } = bigWordSum(cells);
  if (!usesWordNov7(puzzle)) return { points: Math.min(STD_INTERLOCK.bigMax, sum), words };
  const top = bigWordSum(puzzle.solution ?? []).sum;
  return { points: interlockFairBigPoints(sum, top), words, top };
}

/**
 * tileGridRev 4: tiles placed as in the dealt solution's grid, less those that are not, under the best placing of that
 * grid on the board (any shift, either way round: its across word down), so building the answer anywhere counts tile
 * by tile and scattering tiles counts nothing. 0 for a grid off the tray.
 */
export function interlockSolutionTiles(puzzle: Extract<PuzzleData, { type: "tilegrid" }>, cells: readonly string[]): number {
  const sol = puzzle.solution ?? [];
  if (sol.length !== TG_CELLS || !fitsTray([...cells], puzzle.tray)) return 0;
  const placed: { r: number; c: number; l: string }[] = [];
  cells.forEach((l, i) => {
    if (l) placed.push({ r: Math.floor(i / TG_SIZE), c: i % TG_SIZE, l });
  });
  let best = 0;
  for (const turned of [false, true]) {
    const at = (r: number, c: number) => (r < 0 || c < 0 || r >= TG_SIZE || c >= TG_SIZE ? "" : turned ? sol[c * TG_SIZE + r]! : sol[r * TG_SIZE + c]!);
    for (let dr = 1 - TG_SIZE; dr < TG_SIZE; dr++) {
      for (let dc = 1 - TG_SIZE; dc < TG_SIZE; dc++) {
        let matched = 0;
        for (const t of placed) if (at(t.r + dr, t.c + dc) === t.l) matched++;
        best = Math.max(best, matched - (placed.length - matched));
      }
    }
  }
  return best;
}

/** The tiles an unfinished grid is credited for: in a real word or (tileGridRev 4) placed as in the answer, whichever is more. */
function interlockTiles(puzzle: Extract<PuzzleData, { type: "tilegrid" }>, answer: string): number {
  const words = interlockWordTiles(puzzle, answer);
  return usesWordNov7(puzzle) ? Math.max(words, interlockSolutionTiles(puzzle, decodeTileGrid(answer))) : words;
}

const interlock: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "tilegrid" ? interlockTiles(puzzle, draft) : 0),
  grade(input, ctx) {
    const p = input.puzzle;
    if (p.type !== "tilegrid") return { finished: false, credit: 0 };
    const big = interlockBigWords(p, input.answer);
    const fair = usesWordNov7(p);
    const facts = { bigWords: big.words, bigWordPoints: fair ? Math.round(big.points) : big.points, ...(fair ? { bigWordTop: big.top ?? 0 } : {}) };
    if (input.graded.isCorrect) {
      return { finished: true, speed: speedOf(input, STD_INTERLOCK.speed, STD_INTERLOCK.fullByS), bonus: big.points, measure: "big words", facts };
    }
    const tiles = fair ? interlockTiles(p, input.answer) : num(input.graded.extra?.["wordTiles"]);
    const credit = STD_INTERLOCK.tile * tiles + ctx.early(STD_INTERLOCK.early, tiles) + big.points;
    return { finished: false, credit, facts: fair ? { ...facts, countedTiles: tiles } : facts };
  },
};

/* ------------------------------------------------------------------------------------------------ Slider */

/** Rows the player turned into words (a row still as it started is never counted). */
function sliderMadeRows(puzzle: Extract<PuzzleData, { type: "wordslide" }>, answer: string): number {
  const replay = replayWordSlideFor(puzzle, decodeSlideTokens(answer));
  const validRows = WS_MARKED_ROWS.filter((r) => checkWordSlideRow(markedRowWord(replay.grid, r)).valid);
  return wordSlideMadeRows(puzzle.grid, replay.grid, validRows);
}

/**
 * wordSlideRev 5: how many free shifts (rows and columns either way, wordSlideDistance.server.ts) closer the board is
 * to the dealt words than at the start, and that as a share of the start's distance; 0 when no closer.
 */
export function sliderCloser(puzzle: Extract<PuzzleData, { type: "wordslide" }>, answer: string): { start: number; closer: number; share: number } {
  const goal = [...(puzzle.words ?? []).join("")];
  const start = wordSlideStartDistance(puzzle.grid, goal, puzzle.par) ?? 0;
  if (start <= 0) return { start, closer: 0, share: 0 };
  const left = wordSlideDistance(replayWordSlideFor(puzzle, decodeSlideTokens(answer)).grid, goal, start - 1);
  const closer = left === null ? 0 : start - left;
  return { start, closer, share: closer / start };
}

/** wordSlideRev 5: rows the player made into real words other than the dealt word for that row. */
function sliderOtherRows(puzzle: Extract<PuzzleData, { type: "wordslide" }>, answer: string): number {
  const grid = replayWordSlideFor(puzzle, decodeSlideTokens(answer)).grid;
  const words = puzzle.words ?? [];
  const validRows = WS_MARKED_ROWS.filter((r) => markedRowWord(grid, r) !== words[r] && checkWordSlideRow(markedRowWord(grid, r)).valid);
  return wordSlideMadeRows(puzzle.grid, grid, validRows);
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
    if (!usesWordNov7(p)) return { finished: false, credit: STD_SLIDER.row * rows + ctx.early(STD_SLIDER.early, rows), facts: { madeRows: rows } };
    // wordSlideRev 5 (wordNov7.ts): how much closer the board is to the dealt words, or the rows made into other real
    // words, whichever is more. The dealt words' rows are already in the distance, so along a shortest line (whose
    // middle slides break rows) the credit rises with every slide.
    const closer = sliderCloser(p, input.answer);
    const other = sliderOtherRows(p, input.answer);
    const credit = Math.max(STD_WORD_NOV7.closer * closer.share, STD_SLIDER.row * other);
    return { finished: false, credit, facts: { madeRows: rows, otherWordRows: other, slidesCloser: closer.closer, slidesFromStart: closer.start } };
  },
};

/* ------------------------------------------------------------------------------------------------ Lookout */

function lookoutFound(puzzle: Extract<PuzzleData, { type: "wordsearch" }>, answer: string): number {
  const split = wsSplitBonus(puzzle.bonus, wsDecode(answer, puzzle.size, wsRowsOf(puzzle)));
  return wsGrade(puzzle.placements ?? [], split.rest).found.length;
}

/**
 * When Lookout's speed points are full: Normal's 40 s; a level board's (the Word overhaul's levels, 15 Nov 2026) the same
 * share of its own clock (40 s of 120), so a shorter clock asks for a quicker finish.
 */
function lookoutFullByMs(input: StandardInput): number {
  if (puzzleLevel(input.puzzle) === "normal") return STD_LOOKOUT.fullByS * 1000;
  return Math.round((STD_LOOKOUT.fullByS * 1000 * input.limitMs) / 120_000);
}

const lookout: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "wordsearch" ? lookoutFound(puzzle, draft) : 0),
  grade(input, ctx) {
    const extra = input.graded.extra ?? {};
    const bonus = extra["bonusFound"] === true ? STD_LOOKOUT.bonus : 0;
    if (input.graded.isCorrect) {
      // wordSearchRev 6 (wordOverhaul.ts): the round runs on after the last listed word for the bonus, so speed is
      // measured when the last listed word was found (the timeline's first draft holding every word), else at the answer.
      if (usesWordOverhaul(input.puzzle, "wordsearch") && input.puzzle.type === "wordsearch") {
        const total = num(extra["total"]);
        const doneAt = input.drafts?.find((d) => total > 0 && lookoutFound(input.puzzle as Extract<PuzzleData, { type: "wordsearch" }>, d.draft) >= total)?.t;
        const msLeft = doneAt === undefined ? input.msLeft : Math.max(input.msLeft, input.limitMs - doneAt);
        const speed = speedPoints(STD_LOOKOUT.speed, msLeft, input.limitMs, lookoutFullByMs(input));
        return { finished: true, speed, bonus, measure: "bonus word", facts: { allFoundAtMs: doneAt ?? null } };
      }
      return { finished: true, speed: speedPoints(STD_LOOKOUT.speed, input.msLeft, input.limitMs, lookoutFullByMs(input)), bonus, measure: "bonus word" };
    }
    const found = num(extra["found"]);
    const wrong = num(extra["wrong"]);
    const penalty = STD_LOOKOUT.wrongCost * Math.max(0, wrong - STD_LOOKOUT.freeWrong);
    // Levels (the Word overhaul, 15 Nov 2026): a level board's words share Normal's six words' credit (120), so five or
    // eight words are worth what six are; Normal (no level) is unchanged.
    const perWord = puzzleLevel(input.puzzle) === "normal" ? STD_LOOKOUT.word : (STD_LOOKOUT.word * 6) / Math.max(1, num(extra["total"], 6));
    const words = perWord * found + ctx.early(STD_LOOKOUT.early, found);
    // wordSearchRev 5 (wordNov7.ts): the penalty comes off the bonus word too, so drags at random never keep it.
    if (usesWordNov7(input.puzzle)) return { finished: false, credit: Math.max(0, words + bonus - penalty) };
    return { finished: false, credit: Math.max(0, words - penalty) + bonus };
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
    // wheelRev 6 (D1's refit, wordStar.ts): the jar's points are full at four fifths of it, speed full by 55 s.
    const star = usesWordStar(p, "letterwheel");
    const full = star ? roundaboutStarJarFull(size) : size;
    const fullByS = star ? ROUNDABOUT_STAR_FULL_BY_S : STD_ROUNDABOUT.fullByS;
    const jarPoints = (STD_ROUNDABOUT.jar * Math.min(kept, full)) / full;
    const facts = { bonusWords: jar.bonus.length, jarDrops: kept, jarSpilled: jar.drops - kept, jarSize: size, jarPoints: Math.round(jarPoints) };
    const penalty = lwMissPenalty(misses);
    if (input.graded.isCorrect) {
      // Today's finish efficiency (accuracy: 15 less the misses' cost) scales the speed points.
      const efficiency = Math.max(0, PUZZLE_EFFICIENCY_POINTS - penalty) / PUZZLE_EFFICIENCY_POINTS;
      return { finished: true, speed: speedOf(input, STD_ROUNDABOUT.speed, fullByS) * efficiency, bonus: jarPoints, measure: "bonus jar", facts };
    }
    const slots = num(extra["slots"]);
    const total = Math.max(1, num(extra["total"], p.slots.length));
    const credit = Math.max(0, (STD_ROUNDABOUT.share * slots) / total + ctx.early(STD_ROUNDABOUT.early / total, slots) - penalty) + jarPoints;
    return { finished: false, credit, facts };
  },
};

/* ------------------------------------------------------------------------------------------------ Strikeout */

function strikeoutSolved(puzzle: Extract<PuzzleData, { type: "strikeout" }>, answer: string): number {
  const state = replayStrikeout2(puzzle.words ?? [], puzzle.givens ?? [], decodeStrikeout2(answer), isWord, so2RulesFor(puzzle));
  return state.solvedWords;
}

const strikeout: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "strikeout" ? strikeoutSolved(puzzle, draft) : 0),
  grade(input, ctx) {
    const p = input.puzzle;
    if (p.type !== "strikeout") return { finished: false, credit: 0 };
    const rules = so2RulesFor(p);
    const actions = decodeStrikeout2(input.answer);
    const state = replayStrikeout2(p.words ?? [], p.givens ?? [], actions, isWord, rules);
    const tally = so2Tally(state);
    const early = so2EarlySolves(p.words ?? [], p.givens ?? [], actions, isWord, rules);
    const earlySolve = strikeoutEarlySolvePoints(early.hiddenAtSolve);
    const facts = { hiddenAtSolve: early.hiddenAtSolve, earlySolvePoints: earlySolve };
    if (input.graded.isCorrect) {
      // Levels (D1, 21 Nov 2026): a level deal's free strikes don't cost the bonus (absent = 0, every round before).
      const free = Math.max(0, num((p as { strikeFree?: number }).strikeFree));
      const strikesLeft = Math.max(0, rules.maxStrikes - Math.max(0, tally.strikes - free));
      const strikePoints = Math.min(STD_STRIKEOUT.strikeMax, STD_STRIKEOUT.strikeLeft * strikesLeft);
      return {
        finished: true,
        speed: speedOf(input, STD_STRIKEOUT.speed, STD_STRIKEOUT.fullByS),
        bonus: earlySolve + strikePoints,
        measure: "early solves and strikes",
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

/**
 * codewordRev 6: wrong letters the player was shown to be wrong (each completed a run that is no real word), from the
 * draft timeline; null without one (no clean bonus then, as before).
 */
export function cryptogridShownWrong(puzzle: Extract<PuzzleData, { type: "codeword" }>, drafts: readonly { draft: string }[] | null): number | null {
  if (!drafts) return null;
  const runs = codewordRuns(puzzle.cells, puzzle.size).map((run) => run.cells.map((cell) => puzzle.cells[cell]!));
  const states = drafts.map((d) => replayCodeword(puzzle.numbers, puzzle.givens, decodeCodeword(d.draft, puzzle.numbers)));
  return cryptogridVisibleWrong(states, runs, puzzle.solution ?? "", new Set(puzzle.givens.map((g) => g.n)), isWord);
}

const cryptogrid: StandardGame = {
  parts: (puzzle, draft) => (puzzle.type === "codeword" ? cryptogridCorrect(puzzle, draft) : 0),
  grade(input, ctx) {
    const p = input.puzzle;
    if (p.type !== "codeword") return { finished: false, credit: 0 };
    if (input.graded.isCorrect) {
      // codewordRev 6 (wordOverhaul.ts): only the wrong letters the grid showed to be wrong count.
      const wrong = usesWordOverhaul(p, "codeword") ? cryptogridShownWrong(p, input.drafts) : cryptogridWrongEntries(p, input.drafts);
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
