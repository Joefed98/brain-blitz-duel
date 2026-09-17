/**
 * Source-level checks for Laser and Mirrors, Tower and Maze Dash.
 *
 *   bun scripts/laser-tower-maze-check.ts
 */

import { encodeMirrors, decodeMirrors, traceBeam, verifyLaser } from "../src/lib/duel/laser";
import { generateLaser } from "../src/lib/duel/laser.server";
import { generateTower } from "../src/lib/duel/tower.server";
import {
  decodeTowerMoves,
  replayTower,
  towerShortest,
  towerStacksLegal,
  towerPegsFrom,
} from "../src/lib/duel/tower";
import { generateMaze } from "../src/lib/duel/maze.server";
import { mazeRoute, mazeTurns, verifyMazePath } from "../src/lib/duel/maze";
import {
  mazeExitInSight,
  mazeFalseTrailLengths,
  mazeJunctions,
} from "../src/lib/duel/maze.server";
import {
  LASER_MAX_MIRRORS,
  LASER_MIN_MIRRORS,
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


function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

/* ------------------------------- Laser ---------------------------------- */

for (let index = 0; index < 60; index++) {
  const puzzle = generateLaser();
  const solution = puzzle.solution ?? [];
  if (solution.length < LASER_MIN_MIRRORS || solution.length > LASER_MAX_MIRRORS) {
    fail(`laser mirror count ${solution.length}`);
  }
  if (solution.length !== puzzle.mirrors) fail("tray does not match the solution");
  if (solution.length !== 4) fail(`laser tray is not exactly four mirrors: ${solution.length}`);

  const solved = traceBeam(puzzle.source, puzzle.dir, solution, puzzle.blocks, puzzle.target);
  if (!solved.hitTarget) fail("stored placement does not hit the target");

  const empty = traceBeam(puzzle.source, puzzle.dir, [], puzzle.blocks, puzzle.target);
  if (empty.hitTarget) fail("empty grid already hits the target");

  // The server's own verification agrees, through the wire format.
  const round = decodeMirrors(encodeMirrors(solution), puzzle.mirrors);
  if (!verifyLaser(puzzle, round).solved) fail("verifyLaser rejects its own solution");
  if (verifyLaser(puzzle, []).solved) fail("verifyLaser accepts an empty tray");

  for (const mirror of solution) {
    if (puzzle.blocks.includes(mirror.cell)) fail("a mirror sits on a block");
    if (mirror.cell === puzzle.source || mirror.cell === puzzle.target)
      fail("mirror on an endpoint");
  }

  // Every mirror must be needed: drop any one and the beam misses.
  for (let drop = 0; drop < solution.length; drop++) {
    const fewer = solution.filter((_, index) => index !== drop);
    if (traceBeam(puzzle.source, puzzle.dir, fewer, puzzle.blocks, puzzle.target).hitTarget) {
      fail("the target is reachable with three of the four mirrors");
    }
  }
  const orientations = new Set(solution.map((mirror) => mirror.kind));
  if (orientations.size !== 2) fail("the solution uses only one mirror orientation");

}
console.log(
  "Laser: 60 layouts — four mirrors, all four necessary, both orientations, empty grid never hits",
);

/* -------------------------------- Tower ---------------------------------- */

for (let index = 0; index < 300; index++) {
  const puzzle = generateTower();
  if (puzzle.discs !== TOWER_DISCS) fail(`disc count ${puzzle.discs}`);
  if (puzzle.timeLimitMs !== TOWER_TIME_MS) fail(`tower clock is ${puzzle.timeLimitMs}`);
  const start = puzzle.start ?? [];
  if (start.length !== TOWER_PEGS) fail("start does not cover all four pegs");
  if (!towerStacksLegal(towerPegsFrom(start))) fail("start spread is not legal");
  if (start.flat().length !== TOWER_DISCS) fail("start does not hold every disc");
  if (start.filter((peg) => peg.length).length < 2) fail("start uses only one peg");
  if (start.some((peg) => peg.length === TOWER_DISCS)) fail("start is already one sorted stack");
  if ((puzzle.minMoves ?? 0) < TOWER_MIN_MINIMUM) fail(`minimum ${puzzle.minMoves} is too small`);

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
  "Tower: 300 puzzles — six discs, four pegs, legal spreads, BFS minimum ≥ 12, 90s clock",
);

/* ------------------------------ Maze Dash -------------------------------- */

for (let index = 0; index < 40; index++) {
  const puzzle = generateMaze();
  const route = puzzle.solution ?? [];
  if (route.length < MAZE_MIN_PATH) fail(`route length ${route.length}`);
  if (mazeTurns(route) < MAZE_MIN_TURNS) fail(`route turns ${mazeTurns(route)}`);
  const junctions = mazeJunctions(puzzle.cells, route);
  if (junctions < MAZE_MIN_JUNCTIONS) fail(`only ${junctions} junctions on or beside the route`);
  const trails = mazeFalseTrailLengths(puzzle.cells, route);
  const long = trails.filter((length) => length >= MAZE_LONG_DEAD_END_LENGTH).length;
  const enough = trails.filter((length) => length >= MAZE_DEAD_END_LENGTH).length;
  if (enough < MAZE_MIN_DEAD_ENDS) fail(`only ${enough} false trails`);
  if (long < MAZE_MIN_LONG_DEAD_ENDS) fail(`only ${long} long false trails`);
  if (mazeExitInSight(puzzle.cells, route, puzzle.exit)) fail("the exit is visible down a corridor");
  if (route[0] !== puzzle.start || route[route.length - 1] !== puzzle.exit)
    fail("route ends wrong");
  // A perfect maze: the route found from the cells is the stored one.
  if (mazeRoute(puzzle.cells, puzzle.start, puzzle.exit).join(",") !== route.join(",")) {
    fail("stored route is not the maze's own route");
  }
  const verdict = verifyMazePath(puzzle.cells, puzzle.start, puzzle.exit, route, route);
  if (!verdict.solved || verdict.progress !== 1) fail("server rejects the stored route");
  const halfway = route.slice(0, Math.ceil(route.length / 2));
  const partial = verifyMazePath(puzzle.cells, puzzle.start, puzzle.exit, route, halfway);
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

