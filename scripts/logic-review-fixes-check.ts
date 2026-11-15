/**
 * logic-review-fixes-check (15 Nov 2026, the Logic game reviews, docs/design/game-reviews/logic.md): the fixes that
 * needed no design decision, each with the assertion that would have caught it.
 *
 *   1. Notes never count as mistakes (notesRev 1, src/lib/duel/notesFree.ts): Mosaic, Tents and Trees, Lamplighter,
 *      Loopline and Island Link deal notesRev 1 (pinPreNotesFree deals without it); on it a wrong scored mark the very
 *      next move cycles on (to a note, or Island Link's double to none) costs nothing, a wrong mark left still costs;
 *      on the older stamp the same answers grade exactly as before (the pass-through costs 2.5).
 *   2. Box Six: the filled count is the player's own cells; the reveal draws an empty blank empty.
 *   3. Hanoi: every post, an empty one too, spans the same fixed box (it was a stub in the reveal).
 *   4. Colour Flood: the help's "out of moves scores 0" is what the grade does (no change needed).
 *   5. Minefield: the HUD counts safe squares beyond the opening and mines less flags; flag taps never chord.
 *   6. Help texts: Tents' "?" signs, Shikaku's tap to remove, Island Link's "drag towards an island".
 *   7. Shikaku: touching rectangles never share a fill.
 *   8. Lamplighter: a 0 wall ticks only once every open square beside it is lit or dotted.
 *   9. Trail: the intro example is a board the bank never deals, with exactly one path.
 *  10. Loopline: clearing plays fences.clear, a paint that changes nothing plays nothing; Safe Cracker's click is capped.
 *
 *   bun scripts/logic-review-fixes-check.ts
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPreNotesFree, usesNotesFree, NOTES_FREE_DEALT, NOTES_FREE_TYPES } from "../src/lib/duel/notesFree";
import { usesStandard } from "../src/lib/duel/standard/stamps";
import { encodeNonoCells, type NonoMarks } from "../src/lib/duel/nonogram";
import { encodeTents } from "../src/lib/duel/tents";
import { encodeBulbs } from "../src/lib/duel/lightUp";
import { FENCES_CROSS, FENCES_EMPTY, FENCES_LINE, encodeFences, fencesEdgeCount } from "../src/lib/duel/fences";
import { bridgePairs, encodeBridges } from "../src/lib/duel/bridges";
import { encodeFloodMoves, floodApply, floodSolved } from "../src/lib/duel/flood";
import { floodMoveLimit } from "../src/lib/duel/moveLimits";
import { trCountSolutions, trAdjacent } from "../src/lib/duel/trail";
import { TRAIL_BANK } from "../src/lib/duel/trailBank.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import { minesweeperGameFor, MINES_FLAG, MINES_HIDDEN, MINES_INPUT_TAP, MINES_MODE_FLAG, MINES_MODE_REVEAL, MINES_OPEN, minesCountFor, type MinesState } from "../src/lib/arcade/minesweeper";
import { FLOOD_COLOURS, type PuzzleData } from "../src/lib/duel/types";
import { sentAnswer } from "./standard-lib";

const failures: string[] = [];
let passes = 0;
const ok = (cond: unknown, label: string) => {
  if (cond) passes++;
  else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};

type Of<T extends PuzzleData["type"]> = Extract<PuzzleData, { type: T }>;
const dealRaw = <T extends PuzzleData["type"]>(type: T, seed: number, pinned = false): Of<T> => {
  const before = pinPreNotesFree(pinned);
  try {
    return withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed })) as Of<T>;
  } finally {
    pinPreNotesFree(before);
  }
};
/** The puzzle notesRev 1 deals: the live deal, or (Mosaic, Tents, Lamplighter, not dealt it until Joe decides) the same deal stamped. */
const deal = <T extends PuzzleData["type"]>(type: T, seed: number, pinned = false): Of<T> => {
  const p = dealRaw(type, seed, pinned);
  if (pinned || (NOTES_FREE_DEALT as readonly string[]).includes(type)) return p;
  return { ...p, notesRev: 1 } as Of<T>;
};
/** Grades drafts one a second from 1 s as the phone sends them, finished 10 s into the round (full speed). */
const play = (p: PuzzleData, drafts: string[]) => {
  const timed = drafts.map((answer, i) => ({ answer, atMs: 1000 + i * 100 }));
  return gradeAnswer(p, sentAnswer(p, timed), puzzleTimeLimitMs(p) - 10_000);
};
const prefixes = <T>(items: readonly T[], encode: (items: T[]) => string) => items.map((_, i) => encode(items.slice(0, i + 1)));

/* ------------------------------------------------------------------ 1. Notes never count as mistakes */

// Mosaic, Tents and Lamplighter are not dealt notesRev 1 yet (standard-logic-check's live assertion is Joe's call).
for (const type of NOTES_FREE_TYPES) {
  const dealt = (NOTES_FREE_DEALT as readonly string[]).includes(type);
  const raw = dealRaw(type, 6100);
  ok(dealt === ("notesRev" in raw), `${type}: the live deal ${dealt ? "carries" : "does not carry"} notesRev (NOTES_FREE_DEALT)`);
}
for (const type of ["nonogram", "tents", "lightup"]) ok(!(NOTES_FREE_DEALT as readonly string[]).includes(type), `${type} waits for Joe's decision`);
for (const type of NOTES_FREE_TYPES) {
  const live = deal(type, 6100);
  const old = deal(type, 6100, true);
  ok((live as { notesRev?: number }).notesRev === 1 && usesNotesFree(live) && usesStandard(live), `${type}: the live deal carries notesRev 1`);
  ok(!("notesRev" in old) && !usesNotesFree(old), `${type}: pinPreNotesFree deals without notesRev`);
  const { notesRev: _n, ...rest } = live as Record<string, unknown>;
  ok(JSON.stringify(rest) === JSON.stringify(old), `${type}: notesRev is the only difference from the older deal`);
}

/** Each game's drafts: the clean solve, a wrong mark passed through to its note first, and a wrong mark left a move. */
interface Case {
  solve: string[];
  passThrough: string[];
  left: string[];
  /** Mistakes the pass-through example counts on the older stamp. */
  oldMistakes: number;
}

function cellCase(sol: number[], wrong: number, enc: (cells: number[]) => string): Case {
  const solve = prefixes(sol, enc);
  return {
    solve,
    // A tap puts a wrong mark down, the next tap turns it into its note (the scored mark gone, nothing else changed).
    passThrough: [enc([wrong]), enc([]), ...solve],
    // A wrong mark, then a right one elsewhere, then the wrong one taken away: it stood while the player did something else.
    left: [enc([wrong]), enc([wrong, sol[0]!]), enc([sol[0]!]), ...solve.slice(1)],
    oldMistakes: 1,
  };
}

const CASES: Record<string, (p: PuzzleData) => Case> = {
  nonogram: (p) => {
    const q = p as Of<"nonogram">;
    const n = q.rows.length ** 2;
    const pattern = q.pattern ?? [];
    const cells = [...Array(n).keys()].filter((c) => pattern[c]);
    const wrong = [...Array(n).keys()].find((c) => !pattern[c])!;
    const enc = (filled: number[]) => {
      const marks = new Array(n).fill(0) as NonoMarks;
      for (const c of filled) marks[c] = 1;
      return encodeNonoCells(marks);
    };
    return cellCase(cells, wrong, enc);
  },
  tents: (p) => {
    const q = p as Of<"tents">;
    const sol = q.solution ?? [];
    const trees = new Set(q.trees);
    const wrong = [...Array(q.size * (q.height ?? q.size)).keys()].find((c) => !trees.has(c) && !sol.includes(c))!;
    return cellCase(sol, wrong, encodeTents);
  },
  lightup: (p) => {
    const q = p as Of<"lightup">;
    const sol = q.solution ?? [];
    const walls = new Set(q.walls);
    const wrong = [...Array(q.size * (q.height ?? q.size)).keys()].find((c) => !walls.has(c) && !sol.includes(c))!;
    return cellCase(sol, wrong, encodeBulbs);
  },
  fences: (p) => {
    const q = p as Of<"fences">;
    const sol = q.solution ?? [];
    const n = fencesEdgeCount(q.size);
    const wrong = [...Array(n).keys()].find((e) => !sol.includes(e))!;
    const enc = (lines: number[], crosses: number[] = []) => {
      const st = new Array<number>(n).fill(FENCES_EMPTY);
      for (const e of crosses) st[e] = FENCES_CROSS;
      for (const e of lines) st[e] = FENCES_LINE;
      return encodeFences(st);
    };
    const solve = prefixes(sol, (l) => enc(l, [wrong]));
    return {
      solve,
      // Tap: line, then ✕ (the note), kept as a note through the solve.
      passThrough: [enc([wrong]), enc([], [wrong]), ...solve],
      // A wrong line erased by a drag (line → empty, not the ✕): taken back, but not cycled to the note.
      left: [enc([wrong]), enc([]), ...prefixes(sol, (l) => enc(l))],
      oldMistakes: 1,
    };
  },
  bridges: (p) => {
    const q = p as Of<"bridges">;
    const pairs = bridgePairs(q.islands, q.size);
    const sol = q.solution ?? [];
    const single = sol.findIndex((k) => k === 1);
    const counts = new Array<number>(pairs.length).fill(0);
    const solve: string[] = [];
    sol.forEach((k, i) => {
      for (let j = 1; j <= k; j++) {
        counts[i] = j;
        solve.push(encodeBridges(counts));
      }
    });
    const at = (k: number) => {
      const c = new Array<number>(pairs.length).fill(0);
      c[single] = k;
      return encodeBridges(c);
    };
    return {
      solve,
      // Removing a right single bridge by drag cycles 1 → 2 → none: the double passed through.
      passThrough: [at(1), at(2), at(0), ...solve],
      // A double held while the player builds elsewhere, then removed.
      left: [at(1), at(2), (() => { const c = new Array<number>(pairs.length).fill(0); c[single] = 2; const other = sol.findIndex((k, i) => i !== single && k > 0); c[other] = 1; return encodeBridges(c); })(), ...solve.filter((_, i) => i > 0)],
      oldMistakes: 1,
    };
  },
};

for (const type of NOTES_FREE_TYPES) {
  for (const seed of [6100, 77]) {
    const live = deal(type, seed);
    const old = deal(type, seed, true);
    const c = CASES[type]!(live);
    const clean = play(live, c.solve);
    ok(clean.isCorrect && clean.score === 200, `${type} seed ${seed}: a clean fast solve scores 200 on notesRev 1 (got ${clean.score})`);
    ok(play(old, c.solve).score === 200, `${type} seed ${seed}: a clean fast solve scores 200 on the older stamp`);
    // The older stamp: the pass-through counts as a mistake, exactly as before (150 + 40 + 7.5 → 198).
    const oldPass = play(old, c.passThrough);
    ok(oldPass.isCorrect && oldPass.score === 198 && oldPass.extra?.["mistakes"] === c.oldMistakes, `${type} seed ${seed}: older stamp, a mark passed through to its note still costs (${oldPass.score}, ${String(oldPass.extra?.["mistakes"])} mistakes)`);
    // notesRev 1: it costs nothing.
    const newPass = play(live, c.passThrough);
    ok(newPass.isCorrect && newPass.score === 200 && newPass.extra?.["mistakes"] === 0, `${type} seed ${seed}: notesRev 1, a mark passed through to its note costs nothing (${newPass.score}, ${String(newPass.extra?.["mistakes"])} mistakes)`);
    // A wrong mark left costs on both.
    const newLeft = play(live, c.left);
    const oldLeft = play(old, c.left);
    ok(newLeft.isCorrect && newLeft.score === 198 && newLeft.extra?.["mistakes"] === 1, `${type} seed ${seed}: notesRev 1, a wrong mark left still costs (${newLeft.score}, ${String(newLeft.extra?.["mistakes"])} mistakes)`);
    ok(oldLeft.isCorrect && oldLeft.score === 198, `${type} seed ${seed}: older stamp, a wrong mark left costs (${oldLeft.score})`);
    // No timeline: no clean bonus on either stamp, as before.
    const final = c.solve[c.solve.length - 1]!;
    ok(gradeAnswer(live, final, puzzleTimeLimitMs(live) - 10_000).score === 190 && gradeAnswer(old, final, puzzleTimeLimitMs(old) - 10_000).score === 190, `${type} seed ${seed}: no timeline earns no clean bonus on either stamp`);
  }
}
// Island Link: building a wrong bridge and cycling it away (1 → 2 → none) is one mistake on notesRev 1 (the single left
// while the double passed through), two on the older stamp.
{
  const live = deal("bridges", 6100);
  const old = deal("bridges", 6100, true);
  const pairs = bridgePairs(live.islands, live.size);
  const sol = live.solution ?? [];
  const off = sol.findIndex((k) => k === 0);
  const c = CASES.bridges!(live);
  const at = (k: number) => {
    const counts = new Array<number>(pairs.length).fill(0);
    counts[off] = k;
    return encodeBridges(counts);
  };
  const drafts = [at(1), at(2), at(0), ...c.solve];
  ok(play(live, drafts).extra?.["mistakes"] === 1, "bridges: a wrong bridge cycled away counts once on notesRev 1 (the double passed through)");
  ok(play(old, drafts).extra?.["mistakes"] === 2, "bridges: the same counts twice on the older stamp, as before");
}

/* ------------------------------------------------------------------ 2. Box Six */

{
  const { sudokuEntryCount, sudokuRevealCells } = await import("../src/puzzles/miniSudoku");
  const p = deal("sudoku", 6100);
  const blanks = p.givens.filter((g) => !g).length;
  const grid = [...p.givens];
  const firstBlank = grid.findIndex((g) => !g);
  ok(sudokuEntryCount(p.givens, grid).done === 0 && sudokuEntryCount(p.givens, grid).total === blanks, `sudoku: the filled count starts at 0 of the ${blanks} blanks (not at the givens)`);
  grid[firstBlank] = 1;
  ok(sudokuEntryCount(p.givens, grid).done === 1, "sudoku: one digit typed is 1 filled");
  const sol = p.solution ?? [];
  const mine = [...p.givens];
  const wrongCell = p.givens.findIndex((g, i) => !g && i !== firstBlank);
  mine[wrongCell] = (sol[wrongCell]! % 6) + 1;
  const r = sudokuRevealCells(p.givens, sol, mine);
  ok(r.values[firstBlank] === 0 && r.tones[firstBlank] !== "given", "sudoku reveal: a blank left empty is drawn empty, not in the givens' colour");
  ok(r.tones[wrongCell] === "wrong" && r.values[wrongCell] === mine[wrongCell], "sudoku reveal: a wrong digit is drawn as the player's, in red");
  ok(p.givens.every((g, i) => !g || (r.tones[i] === "given" && r.values[i] === g)), "sudoku reveal: givens drawn as givens");
}

/* ------------------------------------------------------------------ 3. Hanoi */

{
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { Pegs } = await import("../src/puzzles/tower");
  const html = renderToStaticMarkup(createElement(Pegs, { pegs: [[8, 7, 6, 5], [], [4, 3, 2, 1, 0], []], discs: 9, targetPeg: 0, compact: true }));
  const posts = html.match(/data-hanoi-post=""[^>]*/g) ?? [];
  ok(posts.length === 4, `hanoi: one post a peg, an empty peg included (${posts.length})`);
  ok(posts.every((p) => /top:calc\(var\(--hanoi-ring\) \+ 6px\)/.test(p) && /height:auto/.test(p)), "hanoi: every post spans the fixed box below the lift row (never sized by its stack)");
  // The post is the fixed box's first child, before the lift row: not inside the stack column.
  const fixedBoxes = html.match(/<div class="relative flex w-full flex-col items-center justify-end"[^>]*><div aria-hidden="true" data-hanoi-post=""/g) ?? [];
  ok(fixedBoxes.length === 4, `hanoi: each post sits in its peg's fixed box (${fixedBoxes.length})`);
}

/* ------------------------------------------------------------------ 4. Colour Flood */

{
  const p = deal("flood", 6100);
  const limit = floodMoveLimit(p) ?? 0;
  // Out of moves without flooding the board: the help says it scores 0.
  let grid = [...p.grid];
  const moves: string[] = [];
  for (let i = 0; moves.length < limit && i < 400; i++) {
    const colour = i % FLOOD_COLOURS;
    if (colour === grid[0]) continue;
    const next = floodApply(grid, colour);
    if (floodSolved(next)) continue;
    grid = next;
    moves.push(colour);
  }
  const out = gradeAnswer(p, encodeFloodMoves(moves as never), 0);
  const help = JSON.stringify(PUZZLE_INSTRUCTIONS.flood);
  ok(moves.length === limit && out.score === 0 && /Out of moves, the board ends and scores 0/.test(help), `flood: out of moves scores 0, as the help says (${out.score})`);
}

/* ------------------------------------------------------------------ 5. Minefield */

{
  const { minesHudFigures } = await import("../src/lib/arcade/minesweeper.renderer");
  const { minesSendsTap } = await import("../src/puzzles/minesweeper");
  const game = minesweeperGameFor(2);
  let s = game.init(424242) as MinesState;
  const f0 = minesHudFigures(s);
  ok(f0.safe.startsWith("0/") && f0.safe === `0/${140 - s.opening}`, `minefield HUD: Safe starts at 0 beyond the opening (${f0.safe}), as the reveal counts`);
  ok(f0.minesLeft === minesCountFor(2), "minefield HUD: Mines starts at the mine count");
  const mine = s.mines.findIndex((m) => m);
  s = game.step(s, { t: s.tick + 1, k: MINES_INPUT_TAP, a: mine, b: MINES_MODE_REVEAL, c: 0, d: 0 } as never) as MinesState;
  ok(s.hits === 1 && minesHudFigures(s).minesLeft === minesCountFor(2), "minefield HUD: a mine hit leaves the Mines count alone");
  const hidden = s.open.findIndex((v, i) => v === MINES_HIDDEN && !s.mines[i]);
  s = game.step(s, { t: s.tick + 1, k: MINES_INPUT_TAP, a: hidden, b: MINES_MODE_FLAG, c: 0, d: 0 } as never) as MinesState;
  ok(s.open[hidden] === MINES_FLAG && minesHudFigures(s).minesLeft === minesCountFor(2) - 1, "minefield HUD: Mines is the mines less the flags placed");
  const open = s.open.findIndex((v) => v === MINES_OPEN);
  ok(!minesSendsTap(s.open, open, MINES_MODE_FLAG), "minefield: a flag tap on an open number sends nothing (no chord)");
  ok(minesSendsTap(s.open, open, MINES_MODE_REVEAL), "minefield: a reveal tap on an open number still chords");
  ok(minesSendsTap(s.open, hidden, MINES_MODE_FLAG) && minesSendsTap(s.open, s.open.findIndex((v) => v === MINES_HIDDEN), MINES_MODE_FLAG), "minefield: a flag tap on a hidden or flagged square sends");
}

/* ------------------------------------------------------------------ 6. Help texts */

{
  const how = (type: keyof typeof PUZZLE_INSTRUCTIONS) => (PUZZLE_INSTRUCTIONS[type].how ?? []).map((h) => `${h.action} ${h.detail}`).join(" | ");
  ok(/\?/.test(how("tents")) && /count/.test(how("tents")), "tents help: explains the ? signs");
  ok(/Tap a rectangle to remove it/.test(how("shikaku")), "shikaku help: a tap removes a rectangle");
  ok(/Drag towards an island/.test(how("bridges")) && !/island to island/.test(how("bridges")), "bridges help: drag towards an island (a bridge builds at halfway)");
}

/* ------------------------------------------------------------------ 7. Shikaku fills */

{
  const { shikakuFills, shikakuRectsTouch } = await import("../src/puzzles/shikaku");
  let boards = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 6100, 77]) {
    const p = deal("shikaku", seed);
    const rects = p.solution ?? [];
    const fills = shikakuFills(rects);
    let clash = 0;
    rects.forEach((a, i) => rects.forEach((b, j) => {
      if (i < j && shikakuRectsTouch(a, b) && fills[i] === fills[j]) clash++;
    }));
    ok(clash === 0 && fills.every((f) => f >= 0 && f < 4), `shikaku seed ${seed}: touching rectangles never share a fill (${clash} clash)`);
    // Every board on the way (rectangles placed one at a time) is coloured without a clash too.
    let midClash = 0;
    for (let k = 1; k < rects.length; k++) {
      const part = rects.slice(0, k);
      const f = shikakuFills(part);
      part.forEach((a, i) => part.forEach((b, j) => {
        if (i < j && shikakuRectsTouch(a, b) && f[i] === f[j]) midClash++;
      }));
    }
    ok(midClash === 0, `shikaku seed ${seed}: every partly placed board has no clash`);
    boards++;
  }
  // Two side by side, two only touching at a corner.
  ok(shikakuRectsTouch({ r0: 0, c0: 0, r1: 1, c1: 1 }, { r0: 1, c0: 2, r1: 3, c1: 2 }) && !shikakuRectsTouch({ r0: 0, c0: 0, r1: 0, c1: 0 }, { r0: 1, c0: 1, r1: 1, c1: 1 }), "shikaku: side by side touches, a corner doesn't");
  ok(boards === 12, "shikaku: twelve boards checked");
}

/* ------------------------------------------------------------------ 8. Lamplighter */

{
  const { lightUpWallTicked } = await import("../src/puzzles/lightUp");
  const p = deal("lightup", 6100);
  const size = p.size;
  const height = p.height ?? size;
  const walls = new Set(p.walls);
  const orth = (cell: number) => {
    const r = Math.floor(cell / size);
    const c = cell % size;
    return [r > 0 ? cell - size : -1, r < height - 1 ? cell + size : -1, c > 0 ? cell - 1 : -1, c < size - 1 ? cell + 1 : -1].filter((x) => x >= 0);
  };
  const zeros = p.walls.filter((_, i) => p.wallNumbers[i] === 0);
  const empty = new Array<number>(size * height).fill(0);
  ok(zeros.length > 0 && zeros.every((w) => !lightUpWallTicked(0, orth(w), new Set(), new Set(), empty, walls) || orth(w).every((x) => walls.has(x))), `lightup: no 0 wall with an open neighbour ticks on an empty board (${zeros.length} zeros)`);
  const w = zeros.find((z) => orth(z).some((x) => !walls.has(x)))!;
  const dotted = [...empty];
  for (const x of orth(w)) dotted[x] = 2;
  ok(lightUpWallTicked(0, orth(w), new Set(), new Set(), dotted, walls), "lightup: a 0 wall ticks once every neighbour is dotted");
  const numbered = p.walls.findIndex((_, i) => (p.wallNumbers[i] ?? -1) > 0);
  const nw = p.walls[numbered]!;
  const n = p.wallNumbers[numbered]!;
  const near = orth(nw).filter((x) => !walls.has(x)).slice(0, n);
  ok(near.length < n || lightUpWallTicked(n, orth(nw), new Set(near), new Set(), empty, walls), "lightup: a numbered wall with its bulbs ticks as before");
}

/* ------------------------------------------------------------------ 9. Trail's intro example */

{
  const { EX_GIVENS, EX_PATH } = await import("../src/puzzles/trail");
  const key = (g: readonly (number | null)[]) => JSON.stringify(g);
  ok(!TRAIL_BANK.some((e) => key(e.givens) === key(EX_GIVENS) || e.solution.join() === EX_PATH.join()), "trail: the intro example is no board the bank deals (givens or path)");
  ok(EX_GIVENS.filter((g) => g !== null).length === 10 && trCountSolutions(EX_GIVENS, 2) === 1, "trail: the intro example has ten fixed numbers and exactly one path");
  ok(EX_PATH.length === 36 && new Set(EX_PATH).size === 36 && EX_PATH.every((c, i) => i === 0 || trAdjacent(EX_PATH[i - 1]!, c)) && EX_GIVENS.every((g, cell) => g === null || EX_PATH[g - 1] === cell), "trail: the intro path is a king-move path through the fixed numbers");
}

/* ------------------------------------------------------------------ 10. Loopline and Safe Cracker sounds */

{
  const { fencesEdgeCue, fencesPaintCue } = await import("../src/puzzles/fences");
  ok(fencesEdgeCue(FENCES_EMPTY) === "fences.clear" && fencesEdgeCue(FENCES_CROSS) === "fences.cross" && fencesEdgeCue(FENCES_LINE) === "fences.draw", "fences: clearing a ✕ plays fences.clear, not fences.cross");
  const st = [FENCES_LINE, FENCES_EMPTY, FENCES_LINE];
  ok(fencesPaintCue(st, [0, 2], FENCES_LINE) === null, "fences: a drag paint that changes nothing plays nothing");
  ok(fencesPaintCue(st, [0, 1], FENCES_EMPTY) === "fences.clear", "fences: a drag erase plays fences.clear");
  ok(fencesPaintCue(st, [1], FENCES_LINE) === "fences.draw", "fences: a drag draw plays fences.draw");
  const clear = SOUND_MANIFEST["fences.clear"];
  ok(clear?.url === SOUND_MANIFEST["tents.clear"]?.url && typeof clear?.url === "string", "fences.clear plays the library's existing clear recording");
  const click = SOUND_MANIFEST["safe.click"];
  ok(typeof click?.gapMs === "number" && click.gapMs >= 50 && click.gapMs < (click.ms ?? 0), `safe.click has a gap cap (${String(click?.gapMs)} ms) so held arrows don't layer it`);
}

if (failures.length) {
  console.log(`FAIL logic-review-fixes-check: ${failures.length} of ${passes + failures.length} failed`);
  process.exit(1);
}
console.log(`PASS logic-review-fixes-check: ${passes} checks`);
