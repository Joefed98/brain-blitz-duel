/**
 * Hover hoverRev 12's legacy fixture (D5, 23 Nov 2026; recorded on today's code before hoverRev 12 was built): runs on the
 * stamps rooms dealt before it, each graded by the server's own code, so hover-ladder-check can prove they replay and
 * score exactly as recorded once hoverRev 12 is in.
 *
 *  - hoverRev 11 (HOVER_REV_SHIELD) at every level (Easy, Normal, Hard, Expert, retroLevels.ts's table of 16 Nov 2026):
 *    the skill-band bots at Weak, Average and Elite under HUMAN_LIMITS on six real deals a level (level-tune's `dealAt`),
 *    and the flawless player on one deal a level;
 *  - hoverRev 10 (Normal): the Average and Elite bots on three room seeds.
 *
 * Each entry keeps the dealt puzzle, the encoded log the phone sends and the server's whole grade (score, verdict and
 * extra, the replay's wall-clock fields aside; d5-levels-legacy-record's `stableExtra`).
 *
 *   bun scripts/hover-rev12-legacy-record.ts     (writes scripts/fixtures/hover-rev12-legacy.json.gz)
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { HOVER_REV_SHIELD, HOVER_REV_STANDARD } from "../src/lib/arcade/hover";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { roomSeed } from "./arcade-skill-bands/games";
import { HUMAN_LIMITS, type SkillLevel } from "./arcade-skill-bands/human";
import { ALL_LEVELS, playDealt } from "./d5-ladder-lib";
import { stableExtra, type D5LegacyCase } from "./d5-levels-legacy-record";
import { dealAt } from "./level-tune";

export const HOVER_REV12_LEGACY = "scripts/fixtures/hover-rev12-legacy.json.gz";

if (import.meta.main) {
  const cases: D5LegacyCase[] = [];
  const add = async (level: string, who: SkillLevel, puzzle: PuzzleData) => {
    const run = await playDealt("hover", puzzle, who, HUMAN_LIMITS);
    const g = gradeAnswer(puzzle, run.raw, 0);
    cases.push({ game: "hover", level, who, puzzle, answer: run.raw, score: g.score, isCorrect: g.isCorrect, extra: stableExtra(g.extra) });
  };
  for (const level of ALL_LEVELS) {
    for (let n = 0; n < 6; n++) {
      const puzzle = dealAt("hover", level, 8_000 + n);
      const rev = (puzzle as unknown as { hoverRev?: number }).hoverRev;
      if (rev !== HOVER_REV_SHIELD) throw new Error(`deal ${level} #${n} is hoverRev ${rev}, not ${HOVER_REV_SHIELD}: record this before hoverRev 12 is dealt`);
      for (const who of ["weak", "average", "elite"] as SkillLevel[]) await add(level, who, puzzle);
      if (n === 0) await add(level, "perfect", puzzle);
    }
    console.log(`hoverRev 11 ${level}: ${cases.filter((c) => c.level === level).map((c) => c.score).join(" ")}`);
  }
  for (let n = 0; n < 3; n++) {
    const puzzle = { type: "hover", seed: roomSeed(n), hoverRev: HOVER_REV_STANDARD } as unknown as PuzzleData;
    for (const who of ["average", "elite"] as SkillLevel[]) await add("normal (hoverRev 10)", who, puzzle);
  }
  writeFileSync(HOVER_REV12_LEGACY, gzipSync(JSON.stringify({ recorded: "hover-rev12-legacy-record (before hoverRev 12, 23 Nov 2026)", cases })));
  console.log(`wrote ${HOVER_REV12_LEGACY}: ${cases.length} runs (scores ${Math.min(...cases.map((r) => r.score))}–${Math.max(...cases.map((r) => r.score))})`);
}
