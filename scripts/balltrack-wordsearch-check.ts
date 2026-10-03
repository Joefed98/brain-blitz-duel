import { BALL_TRACK_BANK } from "../src/lib/duel/ballTrackBank.server";
import { WORD_SEARCH_BANK } from "../src/lib/duel/wordSearchBank.server";
import { gradeSubmission } from "../src/lib/duel/grade";
import { checkWordSearchPath, wsEncode } from "../src/lib/duel/wordSearch";
import { btDecode, btReplay, scoreBallTrack } from "../src/lib/duel/ballTrack";
import type { PuzzleData } from "../src/lib/duel/types";

let ok = 0, proof = 0, partial = 0;
for (const e of BALL_TRACK_BANK) {
  const p = { type: "balltrack", cols: 8, rows: 8, tiles: e.tiles, buckets: e.buckets, bombs: e.bombs, pairs: e.pairs, gates: e.gates, minRotations: e.min, solution: e.solution, solutionEvents: e.solutionEvents } as PuzzleData;
  const g = gradeSubmission(p, e.solutionEvents, 45_000);
  const replay = btReplay(p, btDecode(e.solutionEvents));
  if (g.isCorrect && g.score === 135 && replay.rotations === e.min) ok++;
  const blockOk = e.bombs.length === 4 && new Set(e.bombs.map(b => b.cell)).size === 4 && e.bombs.every(b => {
    const row = Math.floor(b.cell / 8), col = b.cell % 8;
    const neighbourDistance = Math.abs(Math.floor(b.neighbour / 8) - row) + Math.abs(b.neighbour % 8 - col);
    return row >= 2 && row <= 5 && col >= 1 && col <= 6 && neighbourDistance === 1 && !e.gates.some(g => g.cell === b.cell || g.cell === b.neighbour) && !e.bombs.some(other => other !== b && Math.abs(Math.floor(other.cell / 8) - row) + Math.abs(other.cell % 8 - col) <= 1);
  });
  const spans = e.pairs.map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as const);
  const crossing = spans[0] && spans[1] && ((spans[0][0] < spans[1][0] && spans[1][0] < spans[0][1] && spans[0][1] < spans[1][1]) || (spans[1][0] < spans[0][0] && spans[0][0] < spans[1][1] && spans[1][1] < spans[0][1]));
  const pairOk = e.pairs.length === 2 && new Set(e.pairs.flat()).size === 4 && !crossing;
  const gateOk = e.gates.length === 2 && e.gates.every(gate => gate.cell >= 16 && gate.cell < 48 && !e.bombs.some(b => b.cell === gate.cell));
  const fixedTopOk = e.tiles.slice(0, 8) === "0".repeat(8) && e.solution.slice(0, 8) === "0".repeat(8) && /^[012]{64}$/.test(e.tiles) && e.min >= 12 && e.min <= 20;
  const untouchedOk = replay.destroyed.length === 0 && replay.exploded.length === 0 && replay.runs.every(run => run.path.length === 8);
  if (blockOk && pairOk && gateOk && fixedTopOk && untouchedOk && replay.home === 8 && replay.dropped.length === 8) proof++;
  if (scoreBallTrack(6, 0, 90_000, 200, e.min) === 53) partial++;
}
console.log(`ball track: ${ok}/${BALL_TRACK_BANK.length} solution scores 135 at 45s left · ${proof} constraint proofs · ${partial} partial scores`);
if (ok !== 400 || proof !== 400 || partial !== 400) throw Error("Ball Track bank validation failed");

let full = 0, rev = 0, live = 0, lowScore = "";
for (const e of WORD_SEARCH_BANK) {
  const p = { type: "wordsearch", size: 10, grid: e.grid, category: e.category, wordCount: 6, placements: e.placements } as PuzzleData;
  if (gradeSubmission(p, wsEncode(e.placements.map((x) => x.cells)), 45_000).score === 131) full++;
  if (gradeSubmission(p, wsEncode(e.placements.map((x) => [...x.cells].reverse())), 0).isCorrect) rev++;
  if (e.placements.every((x) => checkWordSearchPath(e.placements, 10, x.cells, []).valid)) live++;
}
const e0 = WORD_SEARCH_BANK[0]!;
const p0 = { type: "wordsearch", size: 10, grid: e0.grid, category: e0.category, wordCount: 6, placements: e0.placements } as PuzzleData;
const twoPlusWrong = wsEncode([e0.placements[0]!.cells, e0.placements[1]!.cells, [0, 1], [0, 11]]);
lowScore = `2 found + 2 wrong = ${gradeSubmission(p0, twoPlusWrong, 10_000).score}; 1 found + 4 wrong = ${gradeSubmission(p0, wsEncode([e0.placements[0]!.cells, [0, 1], [0, 11], [0, 10], [5, 6]]), 0).score}`;
console.log(`word search: ${full}/${WORD_SEARCH_BANK.length} full = 131 at 45s left · ${rev} backwards selections accepted · ${live} live checks pass · ${lowScore}`);
