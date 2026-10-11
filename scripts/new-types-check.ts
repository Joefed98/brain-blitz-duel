/**
 * Source-level checks for Colour Connect, Ice Slide and Push.
 *
 *   bun scripts/new-types-check.ts
 */

import { flowNeighbours, verifyFlow } from "../src/lib/duel/flow";
import { countFlowSolutions, flowBends, generateFlow } from "../src/lib/duel/flow.server";
import { decodeSlideMoves, replaySlide, slideBoard, slideDistance } from "../src/lib/duel/slide";
import { generateIceSlide, routeUsesFeatures } from "../src/lib/duel/slide.server";
import { PUSH_BANK } from "../src/lib/duel/pushBank.server";
import { decodePushSolution, pushStep, replayPush } from "../src/lib/duel/push";
import {
  FLOW_CELLS,
  FLOW_MAX_PAIRS,
  FLOW_MAX_WALLS,
  FLOW_MIN_PAIRS,
  FLOW_MIN_PATH,
  FLOW_MIN_WALLS,
  PUSH_BANK_SIZE,
  PUSH_MAX_CRATES,
  PUSH_MAX_PUSHES,
  PUSH_MIN_CRATES,
  PUSH_MIN_MOVES_PER_CRATE,
  PUSH_MIN_PUSHES,
  SLIDE_EASY_MOVES,
  SLIDE_MAX_ARROWS,
  SLIDE_MAX_HOLES,
  SLIDE_MAX_MOVES,
  SLIDE_MIN_ARROWS,
  SLIDE_MIN_HOLES,
  SLIDE_MIN_MOVES,
  SLIDE_MAX_PORTALS,
  SLIDE_MAX_THIN,
  SLIDE_MIN_PORTALS,
  SLIDE_MIN_THIN,
} from "../src/lib/duel/types";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

/* ----------------------------- Colour Connect ---------------------------- */

// Each board is proved unique by the generator (~2 s apiece), so 30 boards
// keeps this check well inside the 300 s runner limit.
const FLOW_BOARDS = 30;
let shortest = FLOW_CELLS;
for (let i = 0; i < FLOW_BOARDS; i++) {
  const puzzle = generateFlow();
  const paths = puzzle.solution ?? [];
  const walls = puzzle.walls ?? [];
  const count = puzzle.pairs.length;
  if (count < FLOW_MIN_PAIRS || count > FLOW_MAX_PAIRS) fail(`Colour Connect pair count ${count}`);
  if (walls.length < FLOW_MIN_WALLS || walls.length > FLOW_MAX_WALLS) fail(`Colour Connect wall count ${walls.length}`);
  if (paths.length !== count) fail("Colour Connect stored a path count that differs from the pairs");
  if (new Set(puzzle.pairs.map((pair) => pair.colour)).size !== count)
    fail("Colour Connect reused a colour");
  if (!verifyFlow(puzzle.pairs, paths, walls).solved)
    fail("Colour Connect stored paths do not solve the board");
  if (countFlowSolutions(puzzle.pairs, walls) !== 1) fail("Colour Connect board has more than one solution");
  for (const [index, path] of paths.entries()) {
    if (path.length < FLOW_MIN_PATH) fail(`Colour Connect path shorter than ${FLOW_MIN_PATH}`);
    shortest = Math.min(shortest, path.length);
    if (flowBends(path) < 1) fail("Colour Connect produced a straight path");
    const pair = puzzle.pairs[index]!;
    if (flowNeighbours(pair.a).includes(pair.b)) fail("Colour Connect produced an adjacent pair");
  }
  const covered = new Set(paths.flat());
  if (covered.size !== FLOW_CELLS - walls.length) fail("Colour Connect does not fill every open cell");
}
console.log(`Colour Connect: ${FLOW_BOARDS} boards OK · shortest path ${shortest} cells`);

/* -------------------------------- Ice Slide ------------------------------- */

for (let i = 0; i < 40; i++) {
  const puzzle = generateIceSlide();
  const holes = puzzle.holes ?? [];
  const arrows = puzzle.arrows ?? [];
  const min = puzzle.minMoves ?? 0;
  if (min < SLIDE_MIN_MOVES || min > SLIDE_MAX_MOVES)
    fail(`Ice Slide minimum out of range: ${min}`);
  if (holes.length < SLIDE_MIN_HOLES || holes.length > SLIDE_MAX_HOLES) {
    fail(`Ice Slide hole count ${holes.length}`);
  }
  if (arrows.length < SLIDE_MIN_ARROWS || arrows.length > SLIDE_MAX_ARROWS) {
    fail(`Ice Slide arrow count ${arrows.length}`);
  }
  const portals = puzzle.portals ?? [];
  const thin = puzzle.thin ?? [];
  if (portals.length < SLIDE_MIN_PORTALS || portals.length > SLIDE_MAX_PORTALS) {
    fail(`Ice Slide portal pair count ${portals.length}`);
  }
  if (thin.length < SLIDE_MIN_THIN || thin.length > SLIDE_MAX_THIN) {
    fail(`Ice Slide thin-ice count ${thin.length}`);
  }
  const board = slideBoard(puzzle);
  const distance = slideDistance(board, { cell: puzzle.start, mask: 0 });
  if (distance === null) fail("Ice Slide shipped an unreachable exit");
  if (distance !== min) fail(`Ice Slide minimum ${min} disagrees with the search (${distance})`);
  const stats = puzzle.stats;
  if (!stats) fail("Ice Slide shipped no generator stats");
  if (stats.minMoves !== min) fail("Ice Slide stats minimum disagrees with the puzzle");
  if (stats.easyExit) fail("Ice Slide exit is reachable too easily");
  const moves = decodeSlideMoves(puzzle.solution ?? "");
  const replay = replaySlide(board, moves);
  if (!replay.solved || replay.moves !== min)
    fail("Ice Slide stored route does not reach the exit");
  if (replay.falls) fail("Ice Slide stored route falls into a hole");
  const uses = routeUsesFeatures(puzzle, moves);
  if (!uses.portal || !uses.cracked) fail("Ice Slide stored route skips the portal or thin ice");
}
console.log(
  `Ice Slide: 40 layouts OK · holes and arrows handled by the search · every minimum is ${SLIDE_MIN_MOVES}-${SLIDE_MAX_MOVES} slides · exit never within ${SLIDE_EASY_MOVES} slides`,
);

/* ----------------------------------- Push -------------------------------- */

if (PUSH_BANK.length !== PUSH_BANK_SIZE) {
  fail(`Push bank has ${PUSH_BANK.length} entries, expected ${PUSH_BANK_SIZE}`);
}
for (const entry of PUSH_BANK) {
  if (entry.crates.length !== entry.targets.length) fail("Push entry crate/target mismatch");
  if (entry.crates.length < PUSH_MIN_CRATES || entry.crates.length > PUSH_MAX_CRATES) {
    fail(`Push entry has ${entry.crates.length} crates`);
  }
  if (entry.minPushes < PUSH_MIN_PUSHES || entry.minPushes > PUSH_MAX_PUSHES) {
    fail(`Push minimum ${entry.minPushes} out of range`);
  }
  const solution = decodePushSolution(entry.solution);
  if (solution.length !== entry.minPushes) fail("Push solution length disagrees with the minimum");
  // Replay the stored pushes as crate moves and confirm every crate lands home.
  let crates = [...entry.crates];
  const counts = new Array<number>(crates.length).fill(0);
  for (const move of solution) {
    const index = crates.indexOf(move.cell);
    const to = pushStep(move.cell, move.dir);
    if (index === -1 || to === null || entry.walls.includes(to) || crates.includes(to)) {
      fail("Push stored solution contains an illegal push");
    }
    crates = [...crates];
    crates[index] = to;
    counts[index] = (counts[index] ?? 0) + 1;
  }
  if (counts.some((count) => count < PUSH_MIN_MOVES_PER_CRATE)) {
    fail("Push entry has a crate that barely moves");
  }
  if (!crates.every((cell) => entry.targets.includes(cell))) {
    fail("Push stored solution does not finish the warehouse");
  }
  // A fresh layout starts unsolved.
  const start = replayPush(entry.walls, entry.targets, entry.pusher, entry.crates, []);
  if (start.solved) fail("Push entry starts solved");
}
const mins = PUSH_BANK.map((entry) => entry.minPushes);
console.log(
  `Push: ${PUSH_BANK.length} bank layouts OK · minimum ${Math.min(...mins)}–${Math.max(...mins)} pushes · every crate moves twice`,
);

console.log("All checks passed");
