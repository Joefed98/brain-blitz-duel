import * as S from "../src/lib/duel/scoring";
import { scoreShikaku } from "../src/lib/duel/shikaku";
import { scoreLightUp } from "../src/lib/duel/lightUp";
import { scoreTents } from "../src/lib/duel/tents";
import { scoreSymbolScanStages, scoreCountUpStages, scanStageResult } from "../src/lib/duel/stagedRounds";
import { replayIntruder } from "../src/lib/duel/intruder";
let fail = 0;
const L = 100_000, H = 50_000;
const ex = (n: string, got: number, want: number | number[]) => {
  const ok = Array.isArray(want) ? want.includes(got) : got === want;
  if (!ok) { fail++; console.log("FAIL", n, got, "want", want); }
};
// A games complete at half time = 140
ex("Spot", S.scoreSpotDifference(6, H, L), 140);
ex("Maze", S.scoreMaze(true, 1, H, L), 140);
ex("Intruder", S.scoreIntruder(120, true, H, L), 140);
ex("Pair", S.scorePairMatch(true, 15, H, L), 140);
ex("Block", S.scoreBlockParty(true, H, 9, L), 140);
ex("Pipes", S.scorePipes(true, 49, H, L), 140);
ex("Sudoku", S.scoreSudoku(true, 10, 10, H, L), 140);
ex("Flow", S.scoreFlow(true, 12, H, 12, L), 140);
ex("Bomb", S.scoreBomb(true, H, 4, L), 140);
ex("Nono", S.scoreNonogram(true, 1, 1, 0, H, L), 140);
ex("Tents", scoreTents(true, H, L, 12, 0, 12), 140);
ex("Shikaku", scoreShikaku(true, H, L, 100), 140);
ex("LightUp", scoreLightUp(true, H, L, 50, 50, 0), 140);
ex("Laser 1st", S.scoreLaser(true, 6, 1, H, L), 140);
ex("Safe 1st", S.scoreSafe(1, H, 4, L), 140);
// B games at min and half time = 137/138
for (const [n, v] of [
  ["Unblock", S.scoreUnblock(true, H, 10, 10, 0, false, L)], ["Ice", S.scoreIceSlide(true, 8, 8, H, 0, L)],
  ["Gravity", S.scoreGravity(true, 6, 6, H, 0, L)], ["Tiles", S.scoreTiles(true, 20, 20, 8, H, L)],
  ["Rings", S.scoreRings(true, 7, 7, 8, H, L)], ["Lights", S.scoreLightsOut(true, 5, 5, H, 0, 0, L)],
  ["Push", S.scorePush(true, 20, 20, H, 4, 4, L)], ["Tower", S.scoreTower(true, 30, 30, H, L, 9, 9)],
  ["Tubes", S.scoreTubes(true, 20, 20, H, 6, L)],
] as const) ex(n, v, [137, 138]);
ex("B at 2× min, no time", S.scoreSolvedMoves(20, 10, 0, L), 100);
ex("Flood par half", S.scoreFlood(true, 12, 12, 196, H, L), 145);
ex("Word Slide par half", S.scoreWordSlide(5, 5, H, L, 6, 6), 135);
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
ex("Laser 3rd half", S.scoreLaser(true, 6, 3, H, L), 110);
ex("Safe 2nd half", S.scoreSafe(2, H, 4, L), 125);
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
const iv = replayIntruder([[1], [2], [3], [4], [5, 6]].map((cells) => ({ cells })) as never, [[1], [2], [3], [4], [5]] as never);
ex("Intruder 4 + half", S.scoreIntruder(iv.points, false, 0, L), 108);
// staged
const scan = [0, 1, 2].map((i) => scanStageResult(i, [1, 2], [1, 2]));
ex("Symbol Scan perfect half", scoreSymbolScanStages(scan, H, L), 140);
ex("Symbol Scan perfect zero", scoreSymbolScanStages(scan, 0, L), 130);
ex("Count Up exact zero", scoreCountUpStages([5, 5, 5], [5, 5, 5], 0, L), 130);
ex("Count Up off-by-1 on stage 3", scoreCountUpStages([5, 5, 6], [5, 5, 5], H, L), 108);
ex("Tubes 6 unfinished capped", S.scoreTubes(false, 0, 20, 0, 6, L), 110);
ex("Tents 14 unfinished capped", scoreTents(false, 0, L, 14, 1, 15), 110);
ex("Tents finished at zero beats cap", scoreTents(true, 0, L, 15, 0, 15), 130);
if (fail) { console.log(`${fail} failures`); process.exit(1); } else console.log("caps: pass");
