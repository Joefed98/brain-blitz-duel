import { BALL_TRACK_BANK } from "../src/lib/duel/ballTrackBank.server";
import { WORD_SEARCH_BANK } from "../src/lib/duel/wordSearchBank.server";
import { gradeSubmission } from "../src/lib/duel/grade";
import { checkWordSearchPath, wsEncode } from "../src/lib/duel/wordSearch";
import { btRun, scoreBallTrack } from "../src/lib/duel/ballTrack";
import type { PuzzleData } from "../src/lib/duel/types";

let ok = 0, proof = 0, partial = 0;
const matchings: string[] = [];
function match(prefix: string) {
  if (prefix.length === 8) { matchings.push(prefix); return; }
  match(prefix + "0");
  if (prefix.length < 7) match(prefix + "12");
}
match("");
const cost = (a: string, b: string) => [...a].reduce((sum, digit, i) => sum + (Number(b[i]) - Number(digit) + 3) % 3, 0);
for (const e of BALL_TRACK_BANK) {
  const p = { type: "balltrack", cols: 8, rows: 6, tiles: e.tiles, buckets: e.buckets, minRotations: e.min, solution: e.solution } as PuzzleData;
  const rotations: string[] = [];
  for (let cell = 0; cell < 48; cell++) {
    const n = (Number(e.solution[cell]) - Number(e.tiles[cell]) + 3) % 3;
    for (let i = 0; i < n; i++) rotations.push(`r${cell}`);
  }
  const ans = [...rotations, ...Array.from({ length: 8 }, (_, ball) => `d${ball}`)].join(",");
  const g = gradeSubmission(p, ans, 45_000);
  if (g.isCorrect && g.score === 135 && rotations.length === e.min) ok++;
  const bound = Array.from({ length: 6 }, (_, row) => {
    const start = e.tiles.slice(row * 8, row * 8 + 8);
    return Math.min(...matchings.map((matching) => cost(start, matching)));
  }).reduce((a, b) => a + b, 0);
  if (bound === e.min && e.buckets.every((b, c) => b !== c) && e.buckets.every((_, c) => btRun(p, e.solution, c).home)) proof++;
  if (scoreBallTrack(6, 0, 90_000, 200, e.min) === 53) partial++;
}
console.log(`ball track: ${ok}/${BALL_TRACK_BANK.length} solution scores 135 at 45s left · ${proof} minimum proofs · ${partial} partial scores`);
if (ok !== 400 || proof !== 400 || partial !== 400) throw Error("Ball Track bank validation failed");

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
