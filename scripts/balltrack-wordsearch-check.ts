import { BALL_TRACK_BANK } from "../src/lib/duel/ballTrackBank.server";
import { WORD_SEARCH_BANK } from "../src/lib/duel/wordSearchBank.server";
import { gradeSubmission } from "../src/lib/duel/grade";
import { checkWordSearchPath, wsEncode } from "../src/lib/duel/wordSearch";
import type { PuzzleData } from "../src/lib/duel/types";

let ok = 0, noGo = 0, partial = 0;
for (const e of BALL_TRACK_BANK) {
  const p = { type: "balltrack", cols: 7, rows: 11, tiles: e.tiles, start: e.start, exit: e.exit, minRemovals: e.min, solution: e.solution } as PuzzleData;
  const ans = [...e.solution.map((c) => `r${c}`), "g"].join(",");
  const g = gradeSubmission(p, ans, 30_000);
  if (g.isCorrect && g.score === 100 + 25 + 20) ok++;
  if (!gradeSubmission(p, "g", 30_000).isCorrect) noGo++;
  // Interleaved: one removal, GO, rest, GO — must still exit.
  const inter = [`r${e.solution[0]}`, "g", ...e.solution.slice(1).map((c) => `r${c}`), "g"].join(",");
  if (gradeSubmission(p, inter, 0).isCorrect) partial++;
}
console.log(`ball track: ${ok}/${BALL_TRACK_BANK.length} solution scores 145 at 30s left · ${noGo} need removals · ${partial} interleaved GO also exit`);

let full = 0, rev = 0, live = 0, lowScore = "";
for (const e of WORD_SEARCH_BANK) {
  const p = { type: "wordsearch", size: 10, grid: e.grid, category: e.category, wordCount: 6, placements: e.placements } as PuzzleData;
  if (gradeSubmission(p, wsEncode(e.placements.map((x) => x.cells)), 45_000).score === 135) full++;
  if (gradeSubmission(p, wsEncode(e.placements.map((x) => [...x.cells].reverse())), 0).isCorrect) rev++;
  if (e.placements.every((x) => checkWordSearchPath(e.placements, 10, x.cells, []).valid)) live++;
}
const e0 = WORD_SEARCH_BANK[0]!;
const p0 = { type: "wordsearch", size: 10, grid: e0.grid, category: e0.category, wordCount: 6, placements: e0.placements } as PuzzleData;
const twoPlusWrong = wsEncode([e0.placements[0]!.cells, e0.placements[1]!.cells, [0, 1], [0, 11]]);
lowScore = `2 found + 2 wrong = ${gradeSubmission(p0, twoPlusWrong, 10_000).score}; 1 found + 4 wrong = ${gradeSubmission(p0, wsEncode([e0.placements[0]!.cells, [0, 1], [0, 11], [0, 10], [5, 6]]), 0).score}`;
console.log(`word search: ${full}/${WORD_SEARCH_BANK.length} full = 135 at 45s left · ${rev} backwards selections accepted · ${live} live checks pass · ${lowScore}`);
