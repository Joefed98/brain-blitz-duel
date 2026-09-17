/**
 * Source-level checks for Laser and Mirrors, Tower and Maze Dash.
 *
 *   bun scripts/laser-tower-maze-check.ts
 */

import { encodeMirrors, decodeMirrors, traceBeam, verifyLaser } from "../src/lib/duel/laser";
import { generateLaser } from "../src/lib/duel/laser.server";
import { generateTower } from "../src/lib/duel/tower.server";
import { decodeTowerMoves, replayTower, towerMinMoves } from "../src/lib/duel/tower";
import { generateMaze } from "../src/lib/duel/maze.server";
import { mazeRoute, mazeTurns, verifyMazePath } from "../src/lib/duel/maze";
import {
  LASER_MAX_MIRRORS,
  LASER_MIN_MIRRORS,
  MAZE_MIN_PATH,
  MAZE_MIN_TURNS,
  TOWER_LONG_TIME_MS,
  TOWER_TIME_MS,
} from "../src/lib/duel/types";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

/* ------------------------------- Laser ---------------------------------- */

for (let index = 0; index < 300; index++) {
  const puzzle = generateLaser();
  const solution = puzzle.solution ?? [];
  if (solution.length < LASER_MIN_MIRRORS || solution.length > LASER_MAX_MIRRORS) {
    fail(`laser mirror count ${solution.length}`);
  }
  if (solution.length !== puzzle.mirrors) fail("tray does not match the solution");

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
}
console.log("Laser: 300 layouts — stored placement always hits, empty grid never does");

/* -------------------------------- Tower ---------------------------------- */

let five = 0;
for (let index = 0; index < 400; index++) {
  const puzzle = generateTower();
  if (puzzle.discs !== 4 && puzzle.discs !== 5) fail(`disc count ${puzzle.discs}`);
  if (puzzle.targetPeg !== 1 && puzzle.targetPeg !== 2) fail("target peg must be middle or right");
  if (puzzle.minMoves !== towerMinMoves(puzzle.discs)) fail("minimum is wrong");
  const expected = puzzle.discs === 5 ? TOWER_LONG_TIME_MS : TOWER_TIME_MS;
  if (puzzle.timeLimitMs !== expected) fail(`five-disc clock is ${puzzle.timeLimitMs}`);
  if (puzzle.discs === 5) five += 1;

  const replay = replayTower(
    puzzle.discs,
    puzzle.targetPeg,
    decodeTowerMoves(puzzle.solution ?? ""),
  );
  if (!replay.solved) fail("stored solution does not finish the tower");
  if (replay.moves !== puzzle.minMoves) fail("stored solution is not the minimum");
}
if (five === 0) fail("no five-disc towers were generated");
console.log(
  `Tower: 400 puzzles — ${five} five-disc (90s clock), every stored solution finishes in the minimum`,
);

/* ------------------------------ Maze Dash -------------------------------- */

for (let index = 0; index < 200; index++) {
  const puzzle = generateMaze();
  const route = puzzle.solution ?? [];
  if (route.length < MAZE_MIN_PATH) fail(`route length ${route.length}`);
  if (mazeTurns(route) < MAZE_MIN_TURNS) fail(`route turns ${mazeTurns(route)}`);
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
console.log("Maze Dash: 200 mazes — every route long enough, twisty enough and server-checked");

console.log("All checks passed.");
