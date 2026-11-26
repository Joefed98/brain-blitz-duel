/**
 * Spacewalk crossRev 14's legacy fixture (D5, 23 Nov 2026; recorded on today's code before crossRev 14 was built): runs
 * on the stamps rooms dealt before it, each graded by the server's own code, so cross-ladder-check can prove they replay
 * and score exactly as recorded once crossRev 14 deals the levels.
 *
 *  - crossRev 13 (CROSS_REV_LIGHT) at every level (Easy, Normal, Hard, Expert, retroLevels.ts's table of 16 Nov 2026):
 *    the skill-band bots at Weak, Average and Elite under HUMAN_LIMITS on six real deals a level (level-tune's `dealAt`),
 *    and the flawless player on one deal a level;
 *  - crossRev 12 (Normal): the Average and Elite bots on three room seeds.
 *
 * Each entry keeps the dealt puzzle, the encoded log the phone sends and the server's whole grade (score, verdict and
 * extra, the replay's wall-clock fields aside; d5-levels-legacy-record's `stableExtra`).
 *
 *   bun scripts/cross-rev14-legacy-record.ts     (writes scripts/fixtures/cross-rev14-legacy.json.gz)
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { CROSS_REV_KEEP, CROSS_REV_LIGHT } from "../src/lib/arcade/cross";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { roomSeed } from "./arcade-skill-bands/games";
import { HUMAN_LIMITS, type SkillLevel } from "./arcade-skill-bands/human";
import { ALL_LEVELS, playDealt } from "./d5-ladder-lib";
import { stableExtra, type D5LegacyCase } from "./d5-levels-legacy-record";
import { dealAt } from "./level-tune";

export const CROSS_REV14_LEGACY = "scripts/fixtures/cross-rev14-legacy.json.gz";

if (import.meta.main) {
  const cases: D5LegacyCase[] = [];
  const add = async (level: string, who: SkillLevel, puzzle: PuzzleData) => {
    const run = await playDealt("cross", puzzle, who, HUMAN_LIMITS);
    const g = gradeAnswer(puzzle, run.raw, 0);
    cases.push({ game: "cross", level, who, puzzle, answer: run.raw, score: g.score, isCorrect: g.isCorrect, extra: stableExtra(g.extra) });
  };
  for (const level of ALL_LEVELS) {
    for (let n = 0; n < 6; n++) {
      const puzzle = dealAt("cross", level, 8_000 + n);
      const rev = (puzzle as unknown as { crossRev?: number }).crossRev;
      if (rev !== CROSS_REV_LIGHT) throw new Error(`deal ${level} #${n} is crossRev ${rev}, not ${CROSS_REV_LIGHT}: record this before crossRev 14 is dealt`);
      for (const who of ["weak", "average", "elite"] as SkillLevel[]) await add(level, who, puzzle);
      if (n === 0) await add(level, "perfect", puzzle);
    }
    console.log(`crossRev 13 ${level}: ${cases.filter((c) => c.level === level).map((c) => c.score).join(" ")}`);
  }
  for (let n = 0; n < 3; n++) {
    const puzzle = { type: "cross", seed: roomSeed(n), crossRev: CROSS_REV_KEEP } as unknown as PuzzleData;
    for (const who of ["average", "elite"] as SkillLevel[]) await add("normal (crossRev 12)", who, puzzle);
  }
  writeFileSync(CROSS_REV14_LEGACY, gzipSync(JSON.stringify({ recorded: "cross-rev14-legacy-record (before crossRev 14, 23 Nov 2026)", cases })));
  console.log(`wrote ${CROSS_REV14_LEGACY}: ${cases.length} runs (scores ${Math.min(...cases.map((r) => r.score))}–${Math.max(...cases.map((r) => r.score))})`);
}
