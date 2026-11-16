/**
 * Shared by the Word level checks (the Word overhaul, stage 3, 15 Nov 2026: scripts/<game>-levels-check.ts): deals at a
 * level the way rooms do, the plain-deal identity, and the kit's play graded by the server as a phone sends it.
 * Script-only.
 */
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { levelProof, levelsOf } from "../src/lib/levels/gameLevels";
import { MAX_ROUND_CLOCK_MS, puzzleLevel, type Level } from "../src/lib/levels/levels";
import { WORD_LEVEL_ABOUT } from "../src/lib/levels/word";
import { SKILLS, hashText, makeRng, type Level as KitLevel } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { asPhoneSends, gradeSteps } from "./standard-lib";

export const BEYOND = ["easy", "hard", "expert"] as const;

let checks = 0;
export function ok(cond: unknown, message: string): void {
  if (!cond) throw new Error(`FAIL: ${message}`);
  checks++;
}
export const checkCount = () => checks;

/** A room's deal of `type` at `level` from `seed` (the room path: the seed also seeds the deal's randomness). */
export function roomDeal(type: PuzzleType, seed: number, level?: Level): PuzzleData {
  return withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed, ...(level ? { level } : {}) }));
}

/** The kit's play at a skill on one deal, graded by the server's own code as a phone sends it. */
export function kitScore(type: PuzzleType, puzzle: PuzzleData, bot: KitLevel, tag: string): { score: number; finished: boolean } {
  const play = KITS[type]!.play(puzzle, makeRng(hashText(`${type}-levels:${tag}:${bot}`)), SKILLS[bot], puzzleTimeLimitMs(puzzle));
  const run = gradeSteps(puzzle, asPhoneSends(puzzle, play.steps), play.timed);
  return { score: run.score, finished: run.isCorrect };
}

/** The checks every Word game's levels share: registry, ABOUT lines, clocks, Normal identity, the same deal for all. */
export function commonLevelChecks(type: PuzzleType, proof: "scripts/swapword-levels-check.ts" | "open", seeds: readonly number[], clockOf: (level: Exclude<Level, "normal">) => number): Map<string, PuzzleData[]> {
  ok(JSON.stringify(levelsOf(type)) === JSON.stringify(["easy", "normal", "hard", "expert"]), `${type}: offers Easy, Normal, Hard and Expert`);
  const deals = new Map<string, PuzzleData[]>();
  for (const level of BEYOND) {
    const p = levelProof(type, level);
    ok(p !== null, `${type} ${level}: names how its boards are proven`);
    if (proof === "open") ok(p && "open" in p && p.open.length > 20, `${type} ${level}: open by design, with its reason`);
    else ok(p && "proof" in p && p.proof === proof, `${type} ${level}: the proof is ${proof}`);
    const about = WORD_LEVEL_ABOUT[type]?.[level] ?? "";
    ok(about.length > 10 && about.length <= 100 && /\.$/.test(about), `${type} ${level}: one plain line says what changes`);
    ok(!/\b(core|units|full at|par)\b/i.test(about), `${type} ${level}: no jargon in the level line`);
    const secs = clockOf(level) / 1000;
    if (secs !== puzzleTimeLimitMs({ type } as PuzzleData) / 1000) ok(about.includes(`${secs} seconds`), `${type} ${level}: the line names its ${secs}-second clock`);
    const list: PuzzleData[] = [];
    for (const seed of seeds) {
      const d = roomDeal(type, seed, level);
      ok(puzzleLevel(d) === level && (d as { level?: string }).level === level, `${type} ${level} seed ${seed}: the deal carries its level`);
      ok(puzzleTimeLimitMs(d) <= MAX_ROUND_CLOCK_MS && puzzleTimeLimitMs(d) === clockOf(level), `${type} ${level} seed ${seed}: the clock is the level's ${clockOf(level) / 1000} s (at most 120 s)`);
      ok(JSON.stringify(roomDeal(type, seed, level)) === JSON.stringify(d), `${type} ${level} seed ${seed}: every player in the room gets the same deal`);
      ok(JSON.stringify(d) !== JSON.stringify(roomDeal(type, seed)), `${type} ${level} seed ${seed}: not Normal's board`);
      list.push(d);
    }
    deals.set(level, list);
  }
  for (const seed of seeds) {
    const plain = roomDeal(type, seed);
    ok(!("level" in (plain as object)), `${type} seed ${seed}: a Normal deal carries no level`);
    ok(JSON.stringify(roomDeal(type, seed, "normal")) === JSON.stringify(plain), `${type} seed ${seed}: a Normal deal is byte for byte the plain deal`);
  }
  return deals;
}
