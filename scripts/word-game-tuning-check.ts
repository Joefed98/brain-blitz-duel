import { scoreLetterWheel } from "../src/lib/duel/letterWheel";
import { scoreWordSearch } from "../src/lib/duel/wordSearch";
import { scoreWordsmith } from "../src/lib/duel/scoring";

function expect(label: string, actual: number, expected: number) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

expect("Wordsmith floors halves", scoreWordsmith(1), 2);
expect("Wordsmith ordinary score", scoreWordsmith(41), 102);
expect("Wordsmith cap", scoreWordsmith(100), 150);

expect("Word Search wrong picks ignored", scoreWordSearch(2, 6, 99, 0, 90_000), 40);
expect("Word Search complete at zero", scoreWordSearch(6, 6, 0, 0, 90_000), 120);
expect("Word Search complete halfway", scoreWordSearch(6, 6, 0, 45_000, 90_000), 135);
expect("Word Search complete full time", scoreWordSearch(6, 6, 0, 90_000, 90_000), 150);

expect("Letter Wheel incomplete", scoreLetterWheel(3, 7, 2, 120_000, 120_000), 37);
expect("Letter Wheel complete at zero", scoreLetterWheel(7, 7, 0, 0, 120_000), 77);
expect("Letter Wheel complete halfway", scoreLetterWheel(7, 7, 2, 60_000, 120_000), 106);
expect("Letter Wheel cap", scoreLetterWheel(9, 9, 20, 120_000, 120_000), 150);

console.log("word-game tuning: all scoring boundaries pass");