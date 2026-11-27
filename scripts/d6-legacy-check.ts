/**
 * D6's legacy check (the polish plan's difficulty session D6, 22 Nov 2026): every round dealt before D6's stamps keeps
 * its world, its score and its breakdown. scripts/fixtures/d6-levels-legacy.json.gz (recorded by
 * scripts/d6-legacy-record.ts on main 7e25a4d0 before any D6 change) holds, for each of D6's sixteen games, real deals at
 * Easy, Normal, Hard and Expert on the stamps rooms dealt then, each played by the skill-band bots (weak, average and
 * elite under HUMAN_LIMITS), with the stored puzzle, the encoded run and the server's grade. Each case is regraded here
 * through `gradeAnswer` on its stored puzzle and must give the same score, the same verdict and the same stored extra
 * (a digest of it), so Five Hands' fiveHandsRev 3, Cue Ball's poolRev 4, Tilt's tiltRev 12 and every level round dealt
 * before D6's level stamps grade exactly as before.
 *
 *   bun scripts/d6-legacy-check.ts [games…]
 */
import { gradeAnswer } from "../src/lib/duel/generate.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { extraDigest, readLegacy } from "./d6-legacy-record";
import { D6_GAMES, LADDER_LEVELS } from "./d6-ladder-lib";

console.error = () => {};
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const { recorded, cases } = readLegacy();
const failures: string[] = [];
let n = 0;
const games = new Set<string>();
for (const c of cases) {
  if (only.length && !only.includes(c.type)) continue;
  n++;
  games.add(c.type);
  const g = gradeAnswer(c.puzzle as PuzzleData, c.raw, 0);
  const extra = extraDigest(g.extra);
  if (g.score !== c.score || g.isCorrect !== c.isCorrect || extra !== c.extra)
    failures.push(`${c.type} ${c.level} sample ${c.n} ${c.bot}: graded ${g.score}${g.isCorrect ? " correct" : ""} (extra ${extra}), recorded ${c.score}${c.isCorrect ? " correct" : ""} (extra ${c.extra})`);
}
// The fixture covers every game at every level (the recording's own guarantee, so a game can't drop out unnoticed).
for (const type of only.length ? only : D6_GAMES)
  for (const level of LADDER_LEVELS) if (!cases.some((c) => c.type === type && c.level === level)) failures.push(`${type} ${level}: no recorded case`);
if (n === 0) failures.push("no cases checked");
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  console.log(`FAIL d6-legacy-check: ${failures.length} of ${n} cases differ from the recording (${recorded})`);
  process.exit(1);
}
console.log(`PASS d6-legacy-check: ${n} cases over ${games.size} games regrade exactly as recorded (${recorded})`);
