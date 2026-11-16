/**
 * Lightbender's Expert boards for Joe to play (the Pattern overhaul, levels, 16 Nov 2026). Not a check. Deals Expert
 * at room seeds 1–N exactly as a room does (`generatePuzzle("laser", { bankSeed, level: "expert" })` under the seed),
 * and writes each board as a drawing with its numbers: the par, bombs, the person-like solver's tries and the
 * Near-perfect kit's finish. Practice deals a fresh Expert board each time (no bank), every one under the same proofs.
 *
 *   bun scripts/laser-expert-boards.ts [N=12] > docs/design/pages-review/pattern/levels/laser-expert-boards.md
 */
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { solveLaserLikeAPerson } from "../src/lib/duel/laserSolve.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { LaserPuzzleData } from "../src/lib/duel/types";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps } from "./standard-lib";

const N = Number(process.argv[2] ?? 12);
const ARROW: Record<string, string> = { U: "^", D: "v", L: "<", R: ">" };
const out: string[] = [
  "# Lightbender Expert boards",
  "",
  "Dealt at room seeds 1–" + N + " exactly as a room deals Expert (`bun scripts/laser-expert-boards.ts`). Practice deals a",
  "fresh Expert board each time: Games → Lightbender → Expert. Key: `E` the emitter (its arrow the way it fires), `G` a",
  "gem (`<`/`>`/`^`/`v` beside it: lit only travelling that way), `B` a bomb, `#` a wall, `.` empty. The solution's",
  "pieces are listed under each board (`/`, `\\`, `S|` / `S-` the splitter); cover them up to play.",
  "",
];
for (let seed = 1; seed <= N; seed++) {
  const p = withSeededRandom(seed, () => generatePuzzle("laser", { bankSeed: seed, level: "expert" })) as LaserPuzzleData;
  const human = solveLaserLikeAPerson(p);
  const play = KITS.laser!.play(p, makeRng(hashText(`laser-expert-boards:${seed}`)), SKILLS.near, puzzleTimeLimitMs(p));
  const run = gradeSteps(p, asPhoneSends(p, play.steps), play.timed);
  const dg = new Map((p.directionalGems ?? []).map((g) => [g.cell, g.from]));
  const rows: string[] = [];
  for (let r = 0; r < 10; r++) {
    let line = "";
    for (let c = 0; c < 10; c++) {
      const cell = r * 10 + c;
      if (cell === p.source) line += "E" + ARROW[p.dir];
      else if (p.gems.includes(cell)) line += "G" + (dg.has(cell) ? ARROW[dg.get(cell)!] : " ");
      else if (p.bombs.includes(cell)) line += "B ";
      else if (p.blocks.includes(cell)) line += "# ";
      else line += ". ";
    }
    rows.push(line.trimEnd());
  }
  out.push(`## Room seed ${seed}`, "");
  out.push(`Par ${p.par} mirrors (tray ${p.mirrors}), ${p.bombs.length} bombs, ${p.shots} shots, ${puzzleTimeLimitMs(p) / 1000} s. Person-like solver: ${human.turns} tries. Near-perfect kit: ${run.score}${run.isCorrect ? ` in ${run.seconds.toFixed(0)} s` : " (unfinished)"}.`, "");
  out.push("```", ...rows, "```", "");
  out.push(`Solution: ${(p.solution ?? []).map((m) => `${String.fromCharCode(65 + (m.cell % 10))}${Math.floor(m.cell / 10) + 1} ${m.kind}`).join(", ")} (column letter A–J, row 1–10)`, "");
}
console.log(out.join("\n"));
