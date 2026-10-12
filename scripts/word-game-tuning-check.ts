import { scoreLetterWheel } from "../src/lib/duel/letterWheel";
import { scoreWordSearch } from "../src/lib/duel/wordSearch";
import { scoreWordHunt, scoreWordSlide, scoreWordsmith, wordSpeedBonus } from "../src/lib/duel/scoring";
import { scoreTileGrid } from "../src/lib/duel/tileGrid";
import { scoreStrikeout } from "../src/lib/duel/strikeout";
import { scoreCodeword } from "../src/lib/duel/codeword";
import { scoreSwapword } from "../src/lib/duel/swapword";

function expect(label: string, actual: number, expected: number) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

expect("Wordsmith floors halves", scoreWordsmith(1), 2);
expect("Wordsmith ordinary score", scoreWordsmith(41), 102);
expect("Wordsmith cap", scoreWordsmith(100), 150);

expect("Word Search wrong picks ignored", scoreWordSearch(2, 6, 99, 0, 120_000), 40);
expect("Word Search complete at zero", scoreWordSearch(6, 6, 0, 0, 120_000), 130);
expect("Word Search complete halfway", scoreWordSearch(6, 6, 0, 60_000, 120_000), 150);
expect("Word Search complete full time", scoreWordSearch(6, 6, 0, 120_000, 120_000), 150);

expect("Letter Wheel 8-word incomplete", scoreLetterWheel(3, 8, 100_000, 100_000), 45);
expect("Letter Wheel 8-word complete at zero", scoreLetterWheel(8, 8, 0, 100_000), 130);
expect("Letter Wheel 8-word complete halfway", scoreLetterWheel(8, 8, 50_000, 100_000), 150);
expect("Letter Wheel 9-word incomplete", scoreLetterWheel(8, 9, 100_000, 100_000), 104);
expect("Letter Wheel 9-word cap", scoreLetterWheel(9, 9, 100_000, 100_000), 150);

expect("Word Hunt doubles", scoreWordHunt(41), 82);
expect("Word Hunt cap", scoreWordHunt(100), 150);
expect("Tile Grid complete", scoreTileGrid(true, 15, 15, wordSpeedBonus(50_000, 100_000)), 150);
expect("Tile Grid 14 word tiles", scoreTileGrid(false, 15, 14, 20), 112);
expect("Word Slide complete at par, full time", scoreWordSlide(5, 5, 100_000, 100_000, 6, 6), 150);
expect("Word Slide four rows", scoreWordSlide(4, 5, 100_000, 100_000), 88);

const so = (solvedRows: number, partialTiles: number, strikes: number, done: boolean) => ({ solvedRows, partialTiles, strikes, done });
expect("Strikeout nothing", scoreStrikeout(so(0, 0, 0, false), 100_000, 100_000), 0);
expect("Strikeout 2 words + 3 tiles", scoreStrikeout(so(2, 3, 5, false), 100_000, 100_000), 46);
expect("Strikeout best unfinished", scoreStrikeout(so(4, 4, 5, false), 100_000, 100_000), 88);
expect("Strikeout finish, 4 strikes, buzzer", scoreStrikeout(so(5, 0, 4, true), 0, 100_000), 124);
expect("Strikeout finish, 2 strikes, quarter time", scoreStrikeout(so(5, 0, 2, true), 25_000, 100_000), 137);
expect("Strikeout perfect", scoreStrikeout(so(5, 0, 0, true), 50_000, 100_000), 150);
const cw = (correct: number, hidden: number, solved: boolean) => ({ correct, hidden, complete: solved, solved });
expect("Cryptogrid nothing", scoreCodeword(cw(0, 12, false), 120_000, 120_000), 0);
expect("Cryptogrid 6 of 12", scoreCodeword(cw(6, 12, false), 120_000, 120_000), 55);
expect("Cryptogrid 13 of 14", scoreCodeword(cw(13, 14, false), 120_000, 120_000), 102);
expect("Cryptogrid cracked at the buzzer", scoreCodeword(cw(12, 12, true), 0, 120_000), 130);
expect("Cryptogrid cracked halfway", scoreCodeword(cw(12, 12, true), 60_000, 120_000), 150);
expect("Swapword nothing", scoreSwapword(false, 0, 10, 0, 120_000, 120_000), 0);
expect("Swapword 12 placed", scoreSwapword(false, 15, 10, 12, 120_000, 120_000), 60);
expect("Swapword unfinished cap", scoreSwapword(false, 15, 10, 25, 120_000, 120_000), 100);
expect("Swapword minimum, halfway", scoreSwapword(true, 10, 10, 0, 60_000, 120_000), 150);
expect("Swapword budget used, buzzer (min 9)", scoreSwapword(true, 14, 9, 0, 0, 120_000), 111);
expect("Swapword budget used, buzzer (min 12)", scoreSwapword(true, 17, 12, 0, 0, 120_000), 115);

console.log("word-game tuning: all scoring boundaries pass");
