/**
 * The scoring standard's Word games (docs/scoring-standard.md "Word", "Word decisions"): Interlock, Slider, Lookout,
 * Roundabout, Strikeout, Cryptogrid and Swapword.
 *
 *   - new deals carry the standard stamp (live + 1); with the standard pinned off they carry the live one;
 *   - worked examples through the real gradeAnswer with a phone-style answer (sentAnswer: the draft timeline), the
 *     expected scores worked out by hand in the comments: a fast finish, a slow finish, half done, blank;
 *   - the history and mid-puzzle rules: Cryptogrid's clean crack (needs the timeline, lost by a wrong letter even when
 *     fixed), Swapword's blind swaps, Lookout's bonus word, Interlock's big words and Strikeout's early solves counting
 *     unfinished, Strikeout's old early-solve / pace formula gone;
 *   - kit play (8 room seeds): medians nothing ≤ spam (≤ 10) < average < good < great < near-perfect (equal only at
 *     200), and every finish above every unfinished run.
 *
 *   bun scripts/standard-word-check.ts [--print]
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { STANDARD_STAMPS, pinPreStandard } from "../src/lib/duel/standard/stamps";
import { encodeTileGrid } from "../src/lib/duel/tileGrid";
import { isWord } from "../src/lib/duel/dictionary.server";
import { wsEncode } from "../src/lib/duel/wordSearch";
import { lwEncodeLog } from "../src/lib/duel/letterWheel";
import { encodeSwapword, type SwSwap } from "../src/lib/duel/swapword";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LEVELS, SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { gradeSteps, median, sentAnswer } from "./standard-lib";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { pinPrePuzzleNotes } from "../src/lib/duel/puzzleNotes";
import { WORD_STANDARD_HELP, strikeoutEarlySolvePoints, swapwordBlindSwaps } from "../src/lib/duel/standard/word";
import { solutionProgress } from "../src/lib/duel/progressFigures";

// Written for the standard's stamps: Joe's puzzle notes (28 Oct 2026, puzzleNotes.ts) deal Slider and Tally one above,
// so new deals here keep the standard's (puzzle-notes-check proves the new stamps).
pinPrePuzzleNotes(true);

const PRINT = process.argv.includes("--print");
const GAMES: PuzzleType[] = ["tilegrid", "wordslide", "wordsearch", "letterwheel", "strikeout", "codeword", "swapword"];
let fail = 0;
let checks = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  checks++;
  if (!cond) {
    fail++;
    console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
};
const eq = (name: string, got: unknown, want: unknown) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

type Draft = { answer: string; atMs: number };
/** Grades a phone-style answer: its drafts with their times; a finish is sent at the last draft's time, else at the buzzer. */
function grade(puzzle: PuzzleData, drafts: Draft[], finished: boolean, timeline = true) {
  const limit = puzzleTimeLimitMs(puzzle);
  const last = drafts[drafts.length - 1]!;
  const sent = timeline ? sentAnswer(puzzle, drafts) : last.answer;
  return gradeAnswer(puzzle, sent, finished ? limit - last.atMs : 0);
}
function example(name: string, puzzle: PuzzleData, drafts: Draft[], finished: boolean, want: number, timeline = true) {
  const g = grade(puzzle, drafts, finished, timeline);
  if (PRINT) console.log(`${name}: ${g.score} ${g.isCorrect ? "finished" : "unfinished"} ${JSON.stringify(g.extra?.["parts"])}`);
  eq(`${name} score`, g.score, want);
  eq(`${name} finished`, g.isCorrect, finished);
  eq(`${name} standard`, g.extra?.["standard"], 1);
  return g;
}
/** Drafts at `times` (seconds), each answer the first k+1 of `steps` joined by commas. */
const steps = (parts: string[], times: number[]): Draft[] => parts.map((_, i) => ({ answer: parts.slice(0, i + 1).join(","), atMs: times[i]! * 1000 }));

/* ------------------------------------------------------------------------------------------------ stamps */

for (const type of GAMES) {
  const st = STANDARD_STAMPS[type]!;
  const p = roomPuzzle(type, 6100) as unknown as Record<string, unknown>;
  eq(`${type}: new deal carries ${st.key} ${st.rev}`, p[st.key], st.rev);
  eq(`${type}: standard stamp is live + 1`, st.rev, st.live + 1);
  ok(`${type}: timed`, st.timed === true);
  const before = pinPreStandard(true);
  try {
    const old = roomPuzzle(type, 6100) as unknown as Record<string, unknown>;
    eq(`${type}: pinned deal carries ${st.key} ${st.live}`, old[st.key], st.live);
  } finally {
    pinPreStandard(before);
  }
  // Blank: nothing done scores 0.
  const blank = gradeAnswer(roomPuzzle(type, 6100), "", 0);
  eq(`${type}: blank`, blank.score, 0);
}
const clocks = Object.fromEntries(GAMES.map((t) => [t, puzzleTimeLimitMs(roomPuzzle(t, 6100)) / 1000]));
eq("clocks", clocks, { tilegrid: 100, wordslide: 100, wordsearch: 120, letterwheel: 100, strikeout: 100, codeword: 120, swapword: 120 });

/* ------------------------------------------------------------------------------------------------ Interlock */
{
  // A hand-made grid: GARDENS across the top, GOT down from G, DOG down from D, STONE down from S (15 tiles).
  const base = roomPuzzle("tilegrid", 6100) as Extract<PuzzleData, { type: "tilegrid" }>;
  const cells: string[] = Array(49).fill("");
  [..."GARDENS"].forEach((ch, i) => (cells[i] = ch));
  const put = (col: number, word: string) => [...word].forEach((ch, r) => (cells[r * 7 + col] = ch));
  put(0, "GOT");
  put(3, "DOG");
  put(6, "STONE");
  for (const w of ["GARDENS", "GOT", "DOG", "STONE"]) ok(`interlock: ${w} is a word`, isWord(w));
  const tray = cells.filter(Boolean);
  eq("interlock: 15 tiles", tray.length, 15);
  const p = { ...base, tray: [...tray].sort() } as PuzzleData;
  const full = encodeTileGrid(cells);
  const garden = encodeTileGrid(cells.map((c, i) => (i < 7 ? c : "")));
  // Fast: done at 30 s (≤ 33 s): 150 + 20 speed + big words GARDENS (7) 15 + STONE (5) 6 = 191.
  example("interlock fast", p, [{ answer: garden, atMs: 10_000 }, { answer: full, atMs: 30_000 }], true, 191);
  // Slow: done at 80 s, 20 s left of the 67 s after 33 s: 20 × 20 ÷ 67 = 5.97 → 6; 150 + 6 + 21 = 177.
  example("interlock slow", p, [{ answer: garden, atMs: 10_000 }, { answer: full, atMs: 80_000 }], true, 177);
  // Half: GARDENS alone at 20 s: 7 tiles × 8 = 56, early 7 × 1 × (1 − 20/100) = 5.6, big word 15 → 76.6 → 77.
  example("interlock half", p, [{ answer: garden, atMs: 20_000 }], false, 77);
  // Without the timeline the early extras are 0: 56 + 15 = 71 (the big word counts unfinished).
  example("interlock half, no timeline", p, [{ answer: garden, atMs: 20_000 }], false, 71, false);
}

/* ------------------------------------------------------------------------------------------------ Slider */
{
  const base = roomPuzzle("wordslide", 6100) as Extract<PuzzleData, { type: "wordslide" }>;
  const words = ["HOUSE", "WATER", "STONE", "PLANT", "LIGHT"];
  for (const w of words) ok(`slider: ${w} is a word`, isWord(w));
  const rot = (w: string) => w.slice(4) + w.slice(0, 4); // shifted right by one: HOUSE → EHOUS
  const one = { ...base, grid: [...[rot(words[0]!), ...words.slice(1)].join("")], par: 2 } as PuzzleData;
  // Fast: r0- at 20 s solves it in 1 move (par 2): 150 + 35 speed + 15 par = 200.
  example("slider fast", one, steps(["r0-"], [20]), true, 200);
  // Slow: r0+, r0-, r0- (3 moves) done at 80 s: speed 35 × 20 ÷ 67 = 10.45 → 10; par 15 × (4 − 3) ÷ (4 − 2) = 7.5 → 8;
  // 150 + 10 + 8 = 168.
  example("slider slow", one, steps(["r0+", "r0-", "r0-"], [30, 60, 80]), true, 168);
  const four = { ...base, grid: [...[...words.slice(0, 4).map(rot), words[4]!].join("")], par: 4 } as PuzzleData;
  // Half: rows 0 and 1 made at 10 s and 30 s: 2 × 24 = 48, early 2 × 0.9 + 2 × 0.7 = 3.2 → 51.2 → 51.
  // (Row 4 is a word but was never changed: never counted.)
  example("slider half", four, steps(["r0-", "r1-"], [10, 30]), false, 51);
}

/* ------------------------------------------------------------------------------------------------ Lookout */
{
  const p = roomPuzzle("wordsearch", 6100) as Extract<PuzzleData, { type: "wordsearch" }>;
  const words = (p.placements ?? []).map((pl) => wsEncode([pl.cells]));
  const bonus = wsEncode([p.bonus!.cells]);
  eq("lookout: six words and a bonus", [words.length, !!p.bonus], [6, true]);
  // A drag that is no word: two cells nowhere near a placement's ends (checked: matches nothing).
  const wrong = "0.1";
  // Fast: the bonus at 5 s, the six words by 30 s: 150 + 20 speed + 30 bonus = 200.
  example("lookout fast", p, steps([bonus, ...words], [5, 10, 14, 18, 22, 26, 30]), true, 200);
  // Slow: the six words, the last at 100 s (20 s left of the 80 s after 40 s): 20 × 20 ÷ 80 = 5; no bonus: 155.
  example("lookout slow", p, steps(words, [20, 40, 60, 70, 80, 100]), true, 155);
  // Half: three words at 12, 24 and 36 s and 7 wrong drags: 3 × 20 = 60, early 1.5 × (0.9 + 0.8 + 0.7) = 3.6,
  // 2 wrong over the free 5 cost 4: 59.6 → 60.
  example("lookout half", p, steps([...words.slice(0, 3), ...Array(7).fill(wrong)], [12, 24, 36, 40, 41, 42, 43, 44, 45, 46]), false, 60);
  // Half with the bonus word: 60 + 3.6 + 30 = 93.6 → 94 (the bonus counts unfinished).
  example("lookout half + bonus", p, steps([...words.slice(0, 3), bonus], [12, 24, 36, 50]), false, 94);
}

/* ------------------------------------------------------------------------------------------------ Roundabout */
{
  const p = roomPuzzle("letterwheel", 6100) as Extract<PuzzleData, { type: "letterwheel" }>;
  const words = p.words ?? [];
  const total = p.slots.length;
  if (PRINT) console.log(`roundabout: ${total} slots, jar ${p.jarSize}`);
  eq("roundabout: 14 slots on seed 6100", total, 14);
  const times = words.map((_, i) => 5 + i * 2);
  // Fast: every slot by 31 s, no misses, no bonus words: 150 + 20 speed + 0 jar = 170.
  example("roundabout fast", p, steps(words, times), true, 170);
  // Slow: 7 misses first (2 over the free 5: efficiency (15 − 6) ÷ 15 = 0.6), every slot, the last at 74 s:
  // speed 20 × 26 ÷ 60 × 0.6 = 5.2 → 5; 150 + 5 = 155.
  const misses = Array(7).fill("QQQ");
  example("roundabout slow", p, steps([...misses, ...words], [...misses.map((_, i) => 1 + i), ...words.map((_, i) => 48 + i * 2)]), true, 155);
  // Half: 6 of 14 slots at 10, 20 … 60 s: 120 × 6 ÷ 14 = 51.43, early (10 ÷ 14) × (0.9 + 0.8 + 0.7 + 0.6 + 0.5 + 0.4) = 2.79
  // → 54.21 → 54.
  example("roundabout half", p, steps(words.slice(0, 6), [10, 20, 30, 40, 50, 60]), false, 54);
}

/* ------------------------------------------------------------------------------------------------ Strikeout */
{
  const p = roomPuzzle("strikeout", 6100) as Extract<PuzzleData, { type: "strikeout" }>;
  const words = (p.words ?? []).map((w) => w.toUpperCase());
  const givens = p.givens ?? [];
  const hiddenOf = (w: number) => [...(givens[w] ?? "")].filter((c) => c === "_").length;
  ok("strikeout: every word starts with 3+ hidden", words.every((_, w) => hiddenOf(w) >= 3));
  const solves = words.map((w, i) => `${i}${w}`);
  // Fast: Solve each word at once (all hidden: 5 early solves × 4 = 20), no strikes (10 of 12 left count: 10),
  // done by 30 s: 150 + 20 speed + 30 = 200.
  example("strikeout fast", p, steps(solves, [6, 12, 18, 24, 30]), true, 200);
  // Slow: every word guessed out letter by letter (no early solves), two strikes (letters in none of the words), done at
  // 80 s: speed 20 × 20 ÷ 60 = 6.67 → 7; strikes left 10 → 10; 150 + 7 + 10 = 167.
  const absent = [..."ZQXJKVWYFBPMGHCDLNRST"].filter((ch) => !words[0]!.includes(ch)).slice(0, 2);
  const guesses: string[] = absent.map((ch) => `0${ch}`);
  words.forEach((w, i) => {
    const shown = new Set([...(givens[i] ?? "")].filter((c) => c !== "_"));
    for (const ch of new Set(w)) if (!shown.has(ch)) guesses.push(`${i}${ch}`);
  });
  example("strikeout slow", p, guesses.map((_, k) => ({ answer: guesses.slice(0, k + 1).join(","), atMs: Math.round(((k + 1) / guesses.length) * 80_000) })), true, 167);
  // Half: words 0 and 1 solved with Solve at 10 and 20 s (2 × 28 = 56, early 2 × 0.9 + 2 × 0.8 = 3.4, early solves 2 × 4
  // = 8), then word 2's first hidden letter guessed (2 per tile it shows).
  const w2 = words[2]!;
  const firstHidden = [...w2].find((_, i) => (givens[2]?.[i] ?? "_") === "_")!;
  const tiles = [...w2].filter((ch, i) => ch === firstHidden && (givens[2]?.[i] ?? "_") === "_").length;
  eq("strikeout half: tiles of the guessed letter (seed 6100)", tiles, 1);
  // 56 + 3.4 + 8 + 2 × 1 = 69.4 → 69.
  example("strikeout half", p, steps([solves[0]!, solves[1]!, `2${firstHidden}`], [10, 20, 30]), false, 69);
  const g = grade(p, steps(solves, [6, 12, 18, 24, 30]), true);
  ok("strikeout: no old pace / early-share facts", g.extra?.["paceBonus"] === undefined && g.extra?.["earlyShare"] === undefined);
}

/* ------------------------------------------------------------------------------------------------ Cryptogrid */
{
  const p = roomPuzzle("codeword", 6100) as Extract<PuzzleData, { type: "codeword" }>;
  const sol = p.solution ?? "";
  const given = new Set(p.givens.map((g) => g.n));
  const hidden = Array.from({ length: p.numbers }, (_, i) => i + 1).filter((n) => !given.has(n));
  const acts = hidden.map((n) => `${n}${sol[n - 1]}`);
  if (PRINT) console.log(`cryptogrid: ${hidden.length} hidden numbers`);
  eq("cryptogrid: 9 hidden numbers on seed 6100", hidden.length, 9);
  const at = (k: number, from: number, to: number) => Array.from({ length: k }, (_, i) => from + ((to - from) * i) / Math.max(1, k - 1));
  // Fast and clean: every number right by 30 s: 150 + 40 speed + 10 clean = 200.
  example("cryptogrid fast", p, steps(acts, at(acts.length, 5, 30)), true, 200);
  // Slow, one wrong letter entered and fixed: done at 100 s (20 s left of the 60 s after 60 s): 40 × 20 ÷ 60 = 13.3 → 13;
  // clean 0: 163.
  // A letter in no word of the grid (so entering it never moves a right letter off its number).
  const wrongLetter = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((ch) => !sol.includes(ch))!;
  const fixed = [`${hidden[0]}${wrongLetter}`, ...acts];
  example("cryptogrid slow, fixed mistake", p, steps(fixed, at(fixed.length, 10, 100)), true, 163);
  // The same clean finish at 100 s keeps the 10: 173. Without the timeline the history is unknown: no clean bonus, 163.
  example("cryptogrid slow, clean", p, steps(acts, at(acts.length, 10, 100)), true, 173);
  example("cryptogrid slow, no timeline", p, steps(acts, at(acts.length, 10, 100)), true, 163, false);
  // Half: 6 of 9 right at 10 … 60 s and one wrong letter standing: 120 × 6 ÷ 9 = 80, early (10 ÷ 9) × (11/12 + 10/12
  // + … + 6/12 = 4.25) = 4.72, wrong −5: 79.72 → 80.
  const half = [...acts.slice(0, 6), `${hidden[8]}${wrongLetter}`];
  example("cryptogrid half", p, steps(half, [10, 20, 30, 40, 50, 60, 65]), false, 80);
}

/* ------------------------------------------------------------------------------------------------ Swapword */
{
  const p = roomPuzzle("swapword", 6100) as Extract<PuzzleData, { type: "swapword" }>;
  const sol = p.solution ?? "";
  // A shortest solving line: each swap puts a tile in place, two at once where it can.
  const board = [...p.start];
  const line: SwSwap[] = [];
  for (;;) {
    const wrong = board.map((ch, i) => (ch !== sol[i] ? i : -1)).filter((i) => i >= 0);
    if (!wrong.length) break;
    let pick: SwSwap | null = null;
    for (const a of wrong) for (const b of wrong) if (!pick && a < b && board[a] === sol[b] && board[b] === sol[a]) pick = [a, b];
    if (!pick) {
      const a = wrong[0]!;
      const b = wrong.find((j) => board[j] === sol[a])!;
      pick = [a, b];
    }
    [board[pick[0]], board[pick[1]]] = [board[pick[1]]!, board[pick[0]]!];
    line.push(pick);
  }
  if (PRINT) console.log(`swapword: line ${line.length}, par ${p.minSwaps}`);
  eq("swapword: the line is par on seed 6100", line.length, p.minSwaps);
  const n = line.length;
  const enc = (k: number) => encodeSwapword(line.slice(0, k));
  const drafts = (ks: number[], ts: number[]): Draft[] => ks.map((k, i) => ({ answer: enc(k), atMs: ts[i]! * 1000 }));
  const times = Array.from({ length: n }, (_, i) => 5 + i * 4);
  // Fast: par swaps by 5 + 4(n − 1) s (≤ 60 s): 150 + 20 speed + 30 par = 200.
  example("swapword fast", p, drafts(times.map((_, i) => i + 1), times), true, 200);
  // Slow: a swap and its undo first (2 more than par), done at 100 s: speed 20 × 20 ÷ 60 = 6.67 → 7; par
  // 30 × (2n − (n + 2)) ÷ n.
  const [a0, b0] = line[0]!;
  const slow = encodeSwapword([[a0, b0], [a0, b0], ...line]);
  const parSlow = Math.round((30 * (n - 2)) / n);
  eq("swapword slow: par points by hand (par 11 on seed 6100)", [n, parSlow], [11, 25]);
  // 30 × (22 − 13) ÷ 11 = 24.5 → 25; 150 + 7 + 25 = 182.
  example("swapword slow", p, [{ answer: slow, atMs: 100_000 }], true, 182);
  // Half: 5 of the 11 swaps at 10 … 50 s; the line swaps pairs first, so the swaps place 2, 2, 2, 2, 1 tiles.
  const placedAfter = (k: number) => {
    const b = [...p.start];
    for (const [x, y] of line.slice(0, k)) [b[x], b[y]] = [b[y]!, b[x]!];
    return b.filter((ch, i) => ch === sol[i] && p.start[i] !== sol[i]).length;
  };
  const toPlace = [...p.start].filter((ch, i) => ch !== sol[i]).length;
  eq("swapword half: tiles placed per swap / to place (seed 6100)", [[1, 2, 3, 4, 5].map(placedAfter), toPlace], [[2, 4, 6, 8, 9], 18]);
  // 120 × 9 ÷ 18 = 60; early (10 ÷ 18) × (2 × 110 + 2 × 100 + 2 × 90 + 2 × 80 + 70) ÷ 120 = 3.84: 63.84 → 64.
  example("swapword half", p, drafts([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]), false, 64);
  // Random swaps: nearly every one leaves both tiles out of place (blind): no credit.
  const rng = makeRng(7);
  const random: SwSwap[] = Array.from({ length: p.maxSwaps }, () => [rng.below(21), rng.below(21)] as SwSwap).filter(([x, y]) => x !== y);
  const r = gradeAnswer(p, encodeSwapword(random), 0);
  ok("swapword: random swaps near 0", r.score <= 5, `${r.score}`);
}

/* ------------------------------------------------------------------------------------------------ texts and rules */
{
  // The help and intro state the standard (filled with the 200 maximum); a check pinning the standard off reads the old.
  for (const type of GAMES) {
    const help = PUZZLE_INSTRUCTIONS[type].score;
    eq(`${type}: help is the standard's`, help, WORD_STANDARD_HELP[type as keyof typeof WORD_STANDARD_HELP].split("{max}").join("200"));
    ok(`${type}: help says 150 and 130`, help.includes("150") && help.includes("130"), help);
    ok(`${type}: intro names 150`, INTRO_SCORE[type].includes("150"), INTRO_SCORE[type]);
  }
  const before = pinPreStandard(true);
  try {
    for (const type of GAMES) ok(`${type}: pinned help is the old one`, PUZZLE_INSTRUCTIONS[type].score !== WORD_STANDARD_HELP[type as keyof typeof WORD_STANDARD_HELP].split("{max}").join("200"));
  } finally {
    pinPreStandard(before);
  }
  // The stale budget line is fixed: rev 6 and the standard deal par + 12.
  ok("swapword: help states the budget of 12 more than par", PUZZLE_INSTRUCTIONS.swapword.how.some((h) => h.detail.includes("12 more than par")));
  // Strikeout's early solves: 4 per word solved with 3+ letters hidden, at most 20.
  eq("strikeout early solves", [strikeoutEarlySolvePoints([5, 2, 3, 0, 9]), strikeoutEarlySolvePoints([3, 3, 3, 3, 3, 3])], [12, 20]);
  // Swapword's blind swaps on the leaderboard: the figure is the credit's own count and names the cost.
  const p = roomPuzzle("swapword", 6100) as Extract<PuzzleData, { type: "swapword" }>;
  const sol = p.solution ?? "";
  const wrongTiles = [...p.start].map((ch, i) => (ch !== sol[i] ? i : -1)).filter((i) => i >= 0);
  // Swapping two out-of-place tiles of one letter-pair that fit neither spot is blind.
  let blindPair: SwSwap | null = null;
  for (const a of wrongTiles) for (const b of wrongTiles) if (!blindPair && a < b && p.start[a] !== sol[b] && p.start[b] !== sol[a]) blindPair = [a, b];
  eq("swapword: a blind swap counts", swapwordBlindSwaps(p.start, [blindPair!], 1, sol), 1);
  const fig = solutionProgress(p, encodeSwapword([blindPair!]), null);
  eq("swapword: the figure names the blind swap", fig, { text: `0/${wrongTiles.length} tiles placed`, cost: "1 blind swap" });
}

/* ------------------------------------------------------------------------------------------------ kit play */
{
  const seeds = Array.from({ length: 8 }, (_, i) => 6100 + i * 7);
  for (const type of GAMES) {
    const kit = KITS[type]!;
    const levels: Record<string, number[]> = { nothing: [], spam: [] };
    let minFinish = Infinity;
    let maxUnfinished = -Infinity;
    for (const seed of seeds) {
      const puzzle = roomPuzzle(type, seed);
      const limit = puzzleTimeLimitMs(puzzle);
      levels["nothing"]!.push(gradeAnswer(puzzle, kit.nothing(puzzle), 0).score);
      for (const sp of kit.spam(puzzle, makeRng(hashText(`std:${type}:spam:${seed}`)), limit)) {
        const g = gradeAnswer(puzzle, sp.answer, 0);
        levels["spam"]!.push(g.score);
        if (!g.isCorrect) maxUnfinished = Math.max(maxUnfinished, g.score);
      }
      for (const level of LEVELS) {
        const play = kit.play(puzzle, makeRng(hashText(`std:${type}:${seed}:${level}`)), SKILLS[level], limit);
        const run = gradeSteps(puzzle, play.steps, play.timed);
        (levels[level] ??= []).push(run.score);
        if (run.isCorrect) minFinish = Math.min(minFinish, run.score);
        else maxUnfinished = Math.max(maxUnfinished, run.score);
      }
    }
    const m = Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, median(v)]));
    if (PRINT) console.log(type, JSON.stringify(m));
    ok(`${type}: nothing 0`, m["nothing"] === 0, JSON.stringify(m));
    ok(`${type}: spam near 0`, m["spam"]! <= 10, JSON.stringify(m));
    const order = ["spam", ...LEVELS];
    for (let i = 1; i < order.length; i++) {
      const lo = m[order[i - 1]!]!;
      const hi = m[order[i]!]!;
      ok(`${type}: ${order[i - 1]} < ${order[i]}`, lo < hi || (lo === 200 && hi === 200), JSON.stringify(m));
    }
    ok(`${type}: every finish beats every unfinished run`, minFinish > maxUnfinished, `${minFinish} vs ${maxUnfinished}`);
  }
}

if (fail) {
  console.log(`FAIL: ${fail} of ${checks} standard Word checks`);
  process.exit(1);
}
console.log(`Standard Word: ${checks} checks passed`);
