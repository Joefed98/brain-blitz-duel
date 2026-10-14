import * as S from "../src/lib/duel/scoring";
import { scoreShikaku } from "../src/lib/duel/shikaku";
import { scoreLightUp } from "../src/lib/duel/lightUp";
import { scoreTents } from "../src/lib/duel/tents";
import { scoreSymbolScanStages, scoreCountUpStages, scoreEquationStages, scanStageResult } from "../src/lib/duel/stagedRounds";
import { withPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";
let fail = 0;
const L = 100_000, H = 50_000;
const ex = (n: string, got: number, want: number | number[]) => {
  const ok = Array.isArray(want) ? want.includes(got) : got === want;
  if (!ok) { fail++; console.log("FAIL", n, got, "want", want); }
};
// A games complete at half time = 150 (speed par: full bonus with half the time left)
ex("Spot", S.scoreSpotDifference(6, H, L), 150);
ex("Maze", S.scoreMaze(true, 1, H, L), 150);
ex("Pair", S.scorePairMatch(true, 15, H, L), 150);
ex("Block", S.scoreBlockParty(true, H, 9, L), 150);
ex("Pipes", S.scorePipes(true, 49, H, L), 150);
ex("Sudoku", S.scoreSudoku(true, 10, 10, H, L), 150);
ex("Flow", S.scoreFlow(true, 12, H, 12, L), 150);
ex("Bomb", S.scoreBomb(true, H, 4, L), 150);
ex("Nono", S.scoreNonogram(true, 1, 1, 0, H, L), 150);
ex("Tents", scoreTents(true, H, L, 12, 0, 12), 150);
ex("Shikaku", scoreShikaku(true, H, L, 100), 150);
ex("LightUp", scoreLightUp(true, H, L, 50, 50, 0), 150);
ex("Laser 1st", S.scoreLaser(true, 6, 1, H, L), 150);
ex("Safe 1st", S.scoreSafe(1, H, 4, L), 150);
// B games at min and half time = 150 (speed par)
for (const [n, v] of [
  ["Unblock", S.scoreUnblock(true, H, 10, 10, 0, false, L)], ["Ice", S.scoreIceSlide(true, 8, 8, H, 0, L)],
  ["Gravity", S.scoreGravity(true, 6, 6, H, 0, L)], ["Tiles", S.scoreTiles(true, 20, 20, 8, H, L)],
  ["Rings", S.scoreRings(true, 7, 7, 8, H, L)], ["Lights", S.scoreLightsOut(true, 5, 5, H, 0, 0, L)],
  ["Push", S.scorePush(true, 20, 20, H, 4, 4, L)], ["Tower", S.scoreTower(true, 30, 30, H, L, 9, 9)],
  ["Tubes", S.scoreTubes(true, 20, 20, H, 6, L)],
] as const) ex(n, v, 150);
ex("B at 2× min, no time", S.scoreSolvedMoves(20, 10, 0, L), 100);
ex("Flood par half", S.scoreFlood(true, 12, 12, 196, H, L), 150);
ex("Word Slide par half", S.scoreWordSlide(5, 5, H, L, 6, 6), 150);
// partials
ex("Connect 11/12", S.scoreFlow(false, 11, 0, 12, L), 110);
ex("Tower 8/9", S.scoreTower(false, 0, 30, 0, L, 8, 9), 98);
ex("Pair 14/15", S.scorePairMatch(false, 14, 0, L), 112);
ex("Spot 5/6", S.scoreSpotDifference(5, 0, L), 100);
ex("Maze 0.9", S.scoreMaze(false, 0.9, 0, L), 99);
ex("Block 8 pieces", S.scoreBlockParty(false, 0, 8, L), 96);
ex("Ice 0.9", S.scoreIceSlide(false, 0, 8, 0, 0.9, L), 81);
ex("Gravity 3 locked", S.scoreGravity(false, 0, 6, 0, 3, L), 90);
ex("Tiles 6", S.scoreTiles(false, 0, 20, 6, 0, L), 84);
ex("Rings 7", S.scoreRings(false, 0, 7, 7, 0, L), 84);
ex("Laser 5 lit", S.scoreLaser(false, 5, 3, 0, L), 75);
ex("Laser unfired", S.scoreLaser(false, 0, 0, 0, L), 0);
ex("Laser 3rd half", S.scoreLaser(true, 6, 3, H, L), 120);
ex("Safe 2nd half", S.scoreSafe(2, H, 4, L), 135);
ex("Push 4/5", S.scorePush(false, 0, 20, 0, 4, 5, L), 88);
ex("Tubes 4", S.scoreTubes(false, 0, 20, 0, 4, L), 88);
ex("Bomb 3 steps", S.scoreBomb(false, 0, 3, L), 75);
ex("Bomb 4 steps capped", S.scoreBomb(false, 0, 4, L), 75);
ex("Nono 90% 1 wrong", S.scoreNonogram(false, 9, 10, 1, 0, L), 94);
ex("Sudoku 9/10", S.scoreSudoku(false, 9, 10, 0, L), 99);
ex("Flood 180", S.scoreFlood(false, 0, 12, 180, 0, L), 101);
ex("Tents 11", scoreTents(false, 0, L, 11, 2, 12), 110);
ex("Shikaku 90", scoreShikaku(false, 0, L, 90), 99);
ex("LightUp 45/50 1 clash", scoreLightUp(false, 0, L, 45, 50, 1), 94);
ex("Word Slide 4", S.scoreWordSlide(4, 5, 0, L), 88);
// staged
const scan = [0, 1, 2].map((i) => scanStageResult(i, [1, 2], [1, 2]));
ex("Symbol Scan perfect half", scoreSymbolScanStages(scan, H, L), 150);
ex("Symbol Scan perfect zero", scoreSymbolScanStages(scan, 0, L), 130);
ex("Count Up exact zero", scoreCountUpStages([5, 5, 5], [5, 5, 5], 0, L), 130);
ex("Count Up off-by-1 on stage 3", scoreCountUpStages([5, 5, 6], [5, 5, 5], H, L), 108);
ex("Tubes 6 unfinished capped", S.scoreTubes(false, 0, 20, 0, 6, L), 110);
ex("Tents 14 unfinished capped", scoreTents(false, 0, L, 14, 1, 15), 110);
ex("Tents finished at zero beats cap", scoreTents(true, 0, L, 15, 0, 15), 130);

// Oct 2026 puzzle score shape (puzzleScoreRev 1, new rounds). Everything above is the stored-round shape and
// stays as it was; puzzle-score-rev-check proves stored answers grade unchanged.
withPuzzleScoreRev(1, () => {
  // Standard: 120 + PAR(30); full speed with half the time left, none at the buzzer.
  for (const [n, half, zero] of [
    ["Spot", S.scoreSpotDifference(6, H, L), S.scoreSpotDifference(6, 0, L)],
    ["Maze", S.scoreMaze(true, 1, H, L), S.scoreMaze(true, 1, 0, L)],
    ["Pair", S.scorePairMatch(true, 15, H, L), S.scorePairMatch(true, 15, 0, L)],
    ["Block", S.scoreBlockParty(true, H, 9, L), S.scoreBlockParty(true, 0, 9, L)],
    ["Pipes", S.scorePipes(true, 49, H, L), S.scorePipes(true, 49, 0, L)],
    ["Sudoku", S.scoreSudoku(true, 10, 10, H, L), S.scoreSudoku(true, 10, 10, 0, L)],
    ["Flow", S.scoreFlow(true, 12, H, 12, L), S.scoreFlow(true, 12, 0, 12, L)],
    ["Bomb", S.scoreBomb(true, H, 6, L, 6), S.scoreBomb(true, 0, 6, L, 6)],
    ["Nono", S.scoreNonogram(true, 1, 1, 0, H, L), S.scoreNonogram(true, 1, 1, 0, 0, L)],
    ["Tents", scoreTents(true, H, L, 12, 0, 12), scoreTents(true, 0, L, 12, 0, 12)],
    ["Shikaku", scoreShikaku(true, H, L, 100), scoreShikaku(true, 0, L, 100)],
    ["LightUp", scoreLightUp(true, H, L, 50, 50, 0), scoreLightUp(true, 0, L, 50, 50, 0)],
    ["Target", S.scoreTargetNumber(0, H, L), S.scoreTargetNumber(0, 0, L)],
  ] as const) { ex(`rev1 ${n} half`, half, 150); ex(`rev1 ${n} buzzer`, zero, 120); }
  ex("rev1 quarter time left = 120 + 15", S.standardComplete(L / 4, L), 135);
  // Moves: 120 + MOVES(15) + PAR(15); the slowest, longest solve is still 120.
  for (const [n, best, worst] of [
    ["Unblock", S.scoreUnblock(true, H, 10, 10, 0, false, L), S.scoreUnblock(true, 0, 30, 10, 0, false, L)],
    ["Ice", S.scoreIceSlide(true, 8, 8, H, 0, L), S.scoreIceSlide(true, 30, 8, 0, 0, L)],
    ["Gravity", S.scoreGravity(true, 6, 6, H, 0, L), S.scoreGravity(true, 20, 6, 0, 0, L)],
    ["Tiles", S.scoreTiles(true, 20, 20, 8, H, L), S.scoreTiles(true, 60, 20, 8, 0, L)],
    ["Rings", S.scoreRings(true, 7, 7, 8, H, L), S.scoreRings(true, 20, 7, 8, 0, L)],
    ["Lights", S.scoreLightsOut(true, 5, 5, H, 0, 0, L), S.scoreLightsOut(true, 15, 5, 0, 0, 0, L)],
    ["Push", S.scorePush(true, 20, 20, H, 4, 4, L), S.scorePush(true, 50, 20, 0, 4, 4, L)],
    ["Tower", S.scoreTower(true, 30, 30, H, L, 9, 9), S.scoreTower(true, 90, 30, 0, L, 9, 9)],
    ["Tubes", S.scoreTubes(true, 20, 20, H, 6, L), S.scoreTubes(true, 60, 20, 0, 6, L)],
    ["Flood", S.scoreFlood(true, 12, 12, 196, H, L), S.scoreFlood(true, 40, 12, 196, 0, L)],
    ["Word Slide", S.scoreWordSlide(5, 5, H, L, 6, 6), S.scoreWordSlide(5, 5, 0, L, 20, 6)],
  ] as const) { ex(`rev1 ${n} best`, best, 150); ex(`rev1 ${n} worst finish`, worst, 120); }
  ex("rev1 moves 1.5× min, quarter left", S.scoreSolvedMoves(15, 10, L / 4, L), 120 + 8 + 8);
  // Tries: 15 / 8 / 0.
  ex("rev1 Safe 1st half", S.scoreSafe(1, H, 4, L), 150);
  ex("rev1 Safe 2nd half", S.scoreSafe(2, H, 4, L), 143);
  ex("rev1 Safe 3rd buzzer", S.scoreSafe(3, 0, 4, L), 120);
  ex("rev1 Laser 1st half", S.scoreLaser(true, 6, 1, H, L), 150);
  ex("rev1 Laser 2nd half", S.scoreLaser(true, 6, 2, H, L), 143);
  ex("rev1 Laser 3rd buzzer", S.scoreLaser(true, 6, 3, 0, L), 120);
  // Unfinished tops at 110 and counts only the player's own progress.
  ex("rev1 Spot 5 found", S.scoreSpotDifference(5, 0, L), 110);
  ex("rev1 Spot 6 found, 6 wrong is not a finish", S.scoreSpotDifference(6, H, L, 6), 102);
  ex("rev1 Spot 6 found, 5 wrong finishes", S.scoreSpotDifference(6, H, L, 5), 150);
  ex("rev1 Maze start = 0", S.scoreMaze(false, 0, 0, L), 0);
  ex("rev1 Maze one step short", S.scoreMaze(false, 1, 0, L), 110);
  ex("rev1 Pair 14 found, 25 misses", S.scorePairMatch(false, 14, 0, L, 39), 110);
  ex("rev1 Pair 14 found, 35 misses", S.scorePairMatch(false, 14, 0, L, 49), 100);
  ex("rev1 Flow 11/12", S.scoreFlow(false, 11, 0, 12, L), 101);
  ex("rev1 Flow 12/12 cells empty", S.scoreFlow(false, 12, 0, 12, L), 110);
  ex("rev1 Tiles 6 placed of 7, no waste", S.scoreTiles(false, 10, 20, 6, 0, L, 1), 110);
  ex("rev1 Tiles 6 placed at 4× min", S.scoreTiles(false, 80, 20, 6, 0, L, 1), 0);
  ex("rev1 Tower start home earns 0", S.scoreTower(false, 0, 30, 0, L, 4, 9, 4), 0);
  ex("rev1 Pipes start state", S.scorePipes(false, 20, 0, L, 20), 0);
  ex("rev1 Flood start region", S.scoreFlood(false, 0, 12, 10, 0, L, 10), 0);
  ex("rev1 Sudoku 9/10, 1 wrong", S.scoreSudoku(false, 9, 10, 0, L, 1), 94);
  ex("rev1 Sudoku random digits", S.scoreSudoku(false, 3, 18, 0, L, 15), 0);
  ex("rev1 Tents 11 right 1 wrong", scoreTents(false, 0, L, 11, 1, 12), 100);
  ex("rev1 Bomb 5 of 6", S.scoreBomb(false, 0, 5, L, 6), 110);
  ex("rev1 Bomb 3 of 6", S.scoreBomb(false, 0, 3, L, 6), 66);
  ex("rev1 Target off by 1", S.scoreTargetNumber(1, 0, L), 110);
  ex("rev1 Target no step", S.scoreTargetNumber(Number.POSITIVE_INFINITY, 0, L), 0);
  ex("rev1 Target 104 away", S.scoreTargetNumber(104, 0, L), 0);
  ex("rev1 Target 20 away", S.scoreTargetNumber(20, 0, L), 50);
  ex("rev1 Ascend finished, 2 wrong, half", S.scoreNumberHunt(true, H, 2, 24, 24, L), 140);
  ex("rev1 Ascend finished, 10 wrong", S.scoreNumberHunt(true, 0, 10, 24, 24, L), 120);
  ex("rev1 Ascend 23 reached", S.scoreNumberHunt(false, 0, 0, 23, 24, L), 110);
  ex("rev1 Bang On all misses", S.scoreStopWatch(500), 0);
  ex("rev1 Bang On top unchanged", S.scoreStopWatch(120), S.scoreStopWatch(120));
  ex("rev1 Bang On 300 ms knee", S.scoreStopWatch(300), 74);
  // Staged: stage credit at most 110 unfinished; all = 120 + 30.
  const scanR = [0, 1, 2].map((i) => scanStageResult(i, [1, 2], [1, 2]));
  ex("rev1 Eagle Eye perfect half", scoreSymbolScanStages(scanR, H, L), 150);
  ex("rev1 Eagle Eye perfect buzzer", scoreSymbolScanStages(scanR, 0, L), 120);
  ex("rev1 Tally exact buzzer", scoreCountUpStages([5, 5, 5], [5, 5, 5], 0, L), 120);
  ex("rev1 Tally off by 1 on tray 3", scoreCountUpStages([5, 5, 6], [5, 5, 5], H, L), 92);
  ex("rev1 Operator best three", scoreEquationStages([false, true, true, true], 0), 110);
  ex("rev1 Operator all four half", scoreEquationStages([true, true, true, true], 45_000), 150);
});
// Outside a grade the default is the stored shape, so direct calls above are unaffected.
ex("default shape is legacy", S.standardComplete(H, L), 150);
ex("default shape is legacy (buzzer)", S.standardComplete(0, L), 130);

if (fail) { console.log(`${fail} failures`); process.exit(1); } else console.log("caps: pass");
