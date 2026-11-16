/**
 * Writes Joe's list of Pipeline Expert boards (16 Nov 2026): docs/design/pages-review/pattern/levels/pipes-expert-boards.md.
 * Each board is dealt at room seeds 1–N exactly as a room deals Expert (`generatePuzzle("pipes", { bankSeed, level:
 * "expert" })` under the seed), drawn as dealt (scrambled) and solved, with its par, the searching solver's layout
 * count, and the person-like player's time and graded score (scripts/pipes-human.ts, near-perfect pace).
 *
 *   bun scripts/pipes-expert-boards.ts [--n=12] [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { encodePipesTurnAnswer, pipesAfterTurns } from "../src/lib/duel/depth4/pipesTaps";
import { tileOpenings } from "../src/lib/duel/logic";
import { countPipesSolutions } from "../src/lib/duel/pipesSolve.server";
import { SKILLS } from "./puzzle-fairness/kit";
import { pipesHumanPlay } from "./pipes-human";
import type { PuzzleData } from "../src/lib/duel/types";

type Pipes = Extract<PuzzleData, { type: "pipes" }>;
const OUT = "docs/design/pages-review/pattern/levels/pipes-expert-boards.md";
const N = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 12);

// N 1, E 2, S 4, W 8 → box-drawing pipes.
const GLYPH: Record<number, string> = {
  0: " ", 1: "╹", 2: "╺", 4: "╻", 8: "╸", 3: "┗", 6: "┏", 12: "┓", 9: "┛", 5: "┃", 10: "━", 7: "┣", 14: "┳", 13: "┫", 11: "┻", 15: "╋",
};
const draw = (masks: number[], cols: number, source: number) =>
  Array.from({ length: masks.length / cols }, (_, r) =>
    masks.slice(r * cols, r * cols + cols).map((m, c) => (r * cols + c === source ? `${GLYPH[m & 15]}*` : `${GLYPH[m & 15]} `)).join(""),
  ).join("\n");

const lines: string[] = [
  "# Pipeline Expert boards",
  "",
  `Dealt at room seeds 1–${N} exactly as a room deals Expert (\`bun scripts/pipes-expert-boards.ts\`): 8 across × 11 down,`,
  "at least 95 % of the tiles turned, no spills shown during play, a 120 s clock, full speed points by 90 s. Practice deals",
  "a fresh Expert board each time (Games → Pipeline → Expert); these are the boards a room on that seed would deal. The",
  "source is marked `*`. Each board has exactly one solution (the searching solver finds 1 layout, stopping at 2).",
  "",
  "Person-like player: `scripts/pipes-human.ts` at the near-perfect pace (reasons from the tiles alone: matching sides,",
  "no loops, no sealed-off group, no guessing; 1.6 s × 0.5 a tile fixed, 3.2 s × 0.5 a loop or seal step, 250 ms a",
  "turn), its finish played through the real grader.",
  "",
];
for (let seed = 1; seed <= N; seed++) {
  const p = withSeededRandom(seed, () => generatePuzzle("pipes", { bankSeed: seed, level: "expert" as never })) as Pipes;
  const cols = p.cols!;
  const run = pipesHumanPlay(p, SKILLS.near.pace);
  const limit = puzzleTimeLimitMs(p);
  const inTime = run.solved && run.ms <= limit;
  const log = inTime ? run.turns : run.turns.filter((_, i) => run.at[i]! <= limit);
  const gr = gradeAnswer(p, encodePipesTurnAnswer(pipesAfterTurns(p.tiles, log), log), inTime ? limit - run.ms : 0);
  const layouts = countPipesSolutions(p.tiles.map(tileOpenings), cols, p.rows!, 2);
  lines.push(
    `## Room seed ${seed}`,
    "",
    `Par ${p.par} turns. Layouts: ${layouts}. Person-like player: ${inTime ? `finished in ${(run.ms / 1000).toFixed(1)} s` : "out of time"} (${run.local} tile steps, ${run.global} loop / seal steps), ${gr.score} points.`,
    "",
    "Dealt | Solved",
    "",
    "```",
    ...draw(p.tiles.map(tileOpenings), cols, p.source).split("\n").map((row, r) => `${row}   ${draw(p.solution!, cols, p.source).split("\n")[r]}`),
    "```",
    "",
  );
}
const text = `${lines.join("\n").trimEnd()}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(OUT, "utf8") !== text) {
    console.log(`FAIL ${OUT} is out of date (bun scripts/pipes-expert-boards.ts)`);
    process.exit(1);
  }
  console.log(`${OUT} up to date`);
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${N} boards to ${OUT}`);
}
