import { scoreLetterWheel } from "../src/lib/duel/letterWheel";
import { scoreWordSearch } from "../src/lib/duel/wordSearch";
import { scoreWordHunt, scoreWordSlide, scoreWordsmith, wordSpeedBonus } from "../src/lib/duel/scoring";
import { scoreTileGrid } from "../src/lib/duel/tileGrid";

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
expect("Tile Grid complete", scoreTileGrid(true, 15, 15, wordSpeedBonus(50_000, 100_000)), 140);
expect("Tile Grid 14 word tiles", scoreTileGrid(false, 15, 14, 20), 112);
expect("Word Slide complete at par, full time", scoreWordSlide(5, 5, 100_000, 100_000, 6, 6), 150);
expect("Word Slide four rows", scoreWordSlide(4, 5, 100_000, 100_000), 88);

console.log("word-game tuning: all scoring boundaries pass");
