/**
 * Source-level checks for Laser and Mirrors, Tower and Maze Dash.
 *
 *   bun scripts/laser-tower-maze-check.ts
 */

import {
  encodeLaserAnswer,
  decodeLaserAnswer,
  traceBeam,
  verifyLaser,
} from "../src/lib/duel/laser";
import { generateLaser } from "../src/lib/duel/laser.server";
import { generateTower } from "../src/lib/duel/tower.server";
import {
  decodeTowerMoves,
  replayTower,
  towerShortest,
  towerStacksLegal,
  towerPegsFrom,
} from "../src/lib/duel/tower";
import { generateMaze, generateMazeClassic } from "../src/lib/duel/maze.server";
import { mazeColsOf } from "../src/lib/duel/maze";
import { mazeRoute, mazeTurns, verifyMazePath } from "../src/lib/duel/maze";
import { mazeExitInSight, mazeFalseTrailLengths, mazeJunctions } from "../src/lib/duel/maze.server";
import {
  LASER_MAX_BLOCKS,
  LASER_MAX_MIRRORS,
  LASER_MIN_BENDS,
  LASER_MAX_BENDS,
  LASER_MIN_BLOCKS,
  LASER_GEMS,
  LASER_MAX_BOMBS,
  LASER_MIN_BOMBS,
  LASER_MIN_CENTRAL_BLOCKS,
  MAZE_DEAD_END_LENGTH,
  MAZE_LONG_DEAD_END_LENGTH,
  MAZE_MIN_DEAD_ENDS,
  MAZE_MIN_JUNCTIONS,
  MAZE_MIN_LONG_DEAD_ENDS,
  MAZE_MIN_PATH,
  MAZE_MIN_TURNS,
  TOWER_DISCS,
  TOWER_MIN_MINIMUM,
  TOWER_PEGS,
  TOWER_TIME_MS,
} from "../src/lib/duel/types";
import { directionalChevronPoints } from "../src/puzzles/laser";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

/* ------------------------------- Laser ---------------------------------- */

for (const dir of ["U", "D", "L", "R"] as const) {
  const points = directionalChevronPoints(dir).split(" ").flatMap((point) => point.split(",").map(Number));
  if (points.some((value) => !Number.isFinite(value) || value < 0 || value > 24)) fail(`directional gem ${dir} chevron leaves its cell`);
}

// Laser's current exact-piece and timing proof is shared with the focused runner.
import "./laser-check";

/* -------------------------------- Tower ---------------------------------- */

const pegCounts: Record<number, number> = {};
for (let index = 0; index < 12; index++) {
  const puzzle = generateTower();
  if (puzzle.discs !== TOWER_DISCS) fail(`disc count ${puzzle.discs}`);
  if (puzzle.timeLimitMs !== TOWER_TIME_MS) fail(`tower clock is ${puzzle.timeLimitMs}`);
  const start = puzzle.start ?? [];
  if (start.length !== 3 && start.length !== TOWER_PEGS) fail("start must use 3 or 4 pegs");
  if (!towerStacksLegal(towerPegsFrom(start))) fail("start spread is not legal");
  if (start.flat().length !== TOWER_DISCS) fail("start does not hold every disc");
  if (start.filter((peg) => peg.length).length < 2) fail("start uses only one peg");
  if (start.some((peg) => peg.length === TOWER_DISCS)) fail("start is already one sorted stack");
  if ((puzzle.minMoves ?? 0) < TOWER_MIN_MINIMUM || (puzzle.minMoves ?? 0) > 40) fail(`minimum ${puzzle.minMoves} is out of the 20–40 band`);
  pegCounts[start.length] = (pegCounts[start.length] ?? 0) + 1;

  const search = towerShortest(start, puzzle.targetPeg, puzzle.discs);
  if (!search || search.minMoves !== puzzle.minMoves) fail("stored minimum disagrees with the BFS");

  const replay = replayTower(
    start,
    puzzle.targetPeg,
    puzzle.discs,
    decodeTowerMoves(puzzle.solution ?? ""),
  );
  if (!replay.solved) fail("stored solution does not finish the tower");
  if (replay.illegal) fail("stored solution contains an illegal move");
  if (replay.moves !== puzzle.minMoves) fail("stored solution is not the minimum");
}
console.log(
  `Tower: 12 puzzles — nine discs, pegs ${JSON.stringify(pegCounts)}, legal spreads, independent BFS minimum 20–40, 90s clock`,
);

/* ------------------------------ Maze Dash -------------------------------- */

// The dealt maze (mazeRev 1, 19 × 23) and the 19 × 19 one before it pass the same tests.
for (let index = 0; index < 40; index++) {
  const puzzle = index % 2 ? generateMazeClassic() : generateMaze();
  const cols = mazeColsOf(puzzle);
  const route = puzzle.solution ?? [];
  if (route.length < MAZE_MIN_PATH) fail(`route length ${route.length}`);
  if (mazeTurns(route) < MAZE_MIN_TURNS) fail(`route turns ${mazeTurns(route)}`);
  const junctions = mazeJunctions(puzzle.cells, route, cols);
  if (junctions < MAZE_MIN_JUNCTIONS) fail(`only ${junctions} junctions on or beside the route`);
  const trails = mazeFalseTrailLengths(puzzle.cells, route, cols);
  const long = trails.filter((length) => length >= MAZE_LONG_DEAD_END_LENGTH).length;
  const enough = trails.filter((length) => length >= MAZE_DEAD_END_LENGTH).length;
  if (enough < MAZE_MIN_DEAD_ENDS) fail(`only ${enough} false trails`);
  if (long < MAZE_MIN_LONG_DEAD_ENDS) fail(`only ${long} long false trails`);
  if (mazeExitInSight(puzzle.cells, route, puzzle.exit, cols))
    fail("the exit is visible down a corridor");
  if (route[0] !== puzzle.start || route[route.length - 1] !== puzzle.exit)
    fail("route ends wrong");
  // A perfect maze: the route found from the cells is the stored one.
  if (mazeRoute(puzzle.cells, puzzle.start, puzzle.exit, cols).join(",") !== route.join(",")) {
    fail("stored route is not the maze's own route");
  }
  const verdict = verifyMazePath(puzzle.cells, puzzle.start, puzzle.exit, route, route, cols);
  if (!verdict.solved || verdict.progress !== 1) fail("server rejects the stored route");
  const halfway = route.slice(0, Math.ceil(route.length / 2));
  const partial = verifyMazePath(puzzle.cells, puzzle.start, puzzle.exit, route, halfway, cols);
  if (partial.solved || partial.progress > 0.75) fail("half a route scored as solved");
}
console.log("Maze Dash: 40 mazes — long, twisty, junction-rich, with blind tails and hidden exits");

// Tower must never count a rule-breaking move list as solved.
{
  const start = [[4, 3, 2, 1], [], [], []];
  const twice = replayTower(start, 1, 4, [
    { from: 0, to: 1 },
    { from: 0, to: 1 },
  ]);
  if (twice.moves !== 1 || !twice.illegal) throw new Error("Tower allowed disc 2 onto disc 1");
  if (twice.solved) throw new Error("Tower counted an illegal move list as solved");
  console.log("Tower: illegal move lists are rejected by the replay both sides use");
}

console.log("All checks passed.");
