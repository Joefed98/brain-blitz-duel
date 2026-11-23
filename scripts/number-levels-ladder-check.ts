/**
 * number-levels-ladder-check (D2, 22 Nov 2026): the Number games' level ladder stays in order. For each of the eight
 * Number games it deals every level as a room deals it (scripts/level-tune.ts dealAt) on the table's own boards (seeds
 * 0–95, the PR's measured table), and plays two of scripts/number-human.ts's people on each, every action held to
 * HUMAN_LIMITS (0.25 s to react, 0.15 s to move) and graded by the server: the average player and the elite. It fails
 * unless, for every game:
 *
 *   1. every board at a level is dealt at that level (no level falls back to Normal);
 *   2. the average player's mean steps down clearly level by level: Easy > Normal > Hard > Expert, each step at least
 *      MIN_AVERAGE_STEP points;
 *   3. the elite reaches 200 on at least as many Easy boards as Normal ones (Exact's and Checkout's are both every
 *      board: Joe, 22 Nov 2026, "fine"), on Normal sometimes and on more boards than on Hard, on Hard on more boards
 *      than on Expert, and on Expert on at least a fifth of boards (EXPERT_MIN_REACH).
 *
 * Everything is seeded (the deal by its seed, each person by `<level>:<seed>`), so a run gives the same table every
 * time; a retune that breaks the order fails here. In thirds by game for CI (`--part=k/3`: Kakuro, the slowest, alone).
 *
 *   bun scripts/number-levels-ladder-check.ts [--part=k/3] [games…]
 */
import { dealAt } from "./level-tune";
import "./number-human-players";
import { NUMBER_GAMES, personRun, type NumberGame } from "./number-human";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";

const LEVELS: readonly Level[] = ["easy", "normal", "hard", "expert"];
/** The table's boards: seeds 0–95. */
const SEEDS = 96;
/** The smallest step the average player's mean must fall by from one level to the next. */
const MIN_AVERAGE_STEP = 5;
/** The elite's share of Expert boards at 200, at least. */
const EXPERT_MIN_REACH = 0.2;
/** The parts for CI, by game (Kakuro takes about half the time alone). */
const PARTS: readonly (readonly NumberGame[])[] = [
  ["kakuro"],
  ["target", "numline", "measure", "equation"],
  ["balance", "numpyramid", "checkout"],
];

let passed = 0;
let failed = 0;
function check(ok: boolean, label: string) {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

const args = process.argv.slice(2);
const partArg = args.find((a) => a.startsWith("--part="))?.slice(7);
const named = args.filter((a) => !a.startsWith("--")) as NumberGame[];
let games: readonly NumberGame[] = named.length ? named : NUMBER_GAMES;
if (partArg) {
  const [k, n] = partArg.split("/").map(Number);
  if (n !== PARTS.length || !(k! >= 1 && k! <= n!)) throw new Error(`--part must be k/${PARTS.length}`);
  games = games.filter((g) => PARTS[k! - 1]!.includes(g));
}
// Every game is in exactly one part, so the parts together check what one whole run does.
check(
  NUMBER_GAMES.every((g) => PARTS.filter((p) => p.includes(g)).length === 1) && PARTS.flat().length === NUMBER_GAMES.length,
  "every Number game is in exactly one part",
);

interface LevelRow {
  level: Level;
  dealtRight: number;
  averageMean: number;
  eliteReach: number;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

for (const game of games) {
  const t0 = performance.now();
  const rows: LevelRow[] = LEVELS.map((level) => {
    let dealtRight = 0;
    let average = 0;
    let elite200 = 0;
    for (let n = 0; n < SEEDS; n++) {
      const puzzle = dealAt(game, level, n);
      if (puzzleLevel(puzzle) === level) dealtRight++;
      average += personRun(puzzle, "average", `${level}:${n}`).score;
      if (personRun(puzzle, "elite", `${level}:${n}`).score >= 200) elite200++;
    }
    return { level, dealtRight, averageMean: Math.round((average / SEEDS) * 10) / 10, eliteReach: elite200 / SEEDS };
  });
  console.log(
    `${game} (${((performance.now() - t0) / 1000).toFixed(1)} s): average ${rows.map((r) => r.averageMean.toFixed(1)).join(" / ")}; ` +
      `elite reaches 200 ${rows.map((r) => pct(r.eliteReach)).join(" / ")} (Easy / Normal / Hard / Expert, ${SEEDS} boards a level)`,
  );
  const [easy, normal, hard, expert] = rows as [LevelRow, LevelRow, LevelRow, LevelRow];

  for (const r of rows) check(r.dealtRight === SEEDS, `${game} ${r.level}: every board dealt at ${r.level} (${r.dealtRight} of ${SEEDS})`);

  for (const [hi, lo] of [
    [easy, normal],
    [normal, hard],
    [hard, expert],
  ] as const)
    check(
      hi.averageMean - lo.averageMean >= MIN_AVERAGE_STEP,
      `${game}: the average player's mean steps down from ${hi.level} to ${lo.level} by ${MIN_AVERAGE_STEP} or more (${hi.averageMean} → ${lo.averageMean})`,
    );

  check(easy.eliteReach >= normal.eliteReach, `${game}: the elite reaches 200 on Easy at least as often as on Normal (${pct(easy.eliteReach)} ≥ ${pct(normal.eliteReach)})`);
  check(normal.eliteReach > hard.eliteReach, `${game}: the elite reaches 200 less often on Hard than on Normal (${pct(normal.eliteReach)} > ${pct(hard.eliteReach)})`);
  check(hard.eliteReach > expert.eliteReach, `${game}: the elite reaches 200 less often on Expert than on Hard (${pct(hard.eliteReach)} > ${pct(expert.eliteReach)})`);
  check(expert.eliteReach >= EXPERT_MIN_REACH, `${game}: the elite reaches 200 on at least a fifth of Expert boards (${pct(expert.eliteReach)})`);
}

console.log(`\n${failed ? "FAIL" : "PASS"} number-levels-ladder-check: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
