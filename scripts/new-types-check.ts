/**
 * Source-level checks for Flow, Ice Slide and Push.
 *
 *   bun scripts/new-types-check.ts
 */

import { flowNeighbours, verifyFlow } from "../src/lib/duel/flow";
import { generateFlow } from "../src/lib/duel/flow.server";
import {
  decodeSlideMoves,
  replaySlide,
  slideDistance,
  slideRouteAvoidsHoles,
} from "../src/lib/duel/slide";
import { generateIceSlide } from "../src/lib/duel/slide.server";
import { PUSH_BANK } from "../src/lib/duel/pushBank.server";
import { decodePushSolution, pushStep, replayPush } from "../src/lib/duel/push";
import {
  FLOW_CELLS,
  FLOW_COLS,
  FLOW_MIN_PATH,
  FLOW_PAIRS,
  PUSH_BANK_SIZE,
  PUSH_MAX_CRATES,
  PUSH_MAX_PUSHES,
  PUSH_MIN_CRATES,
  PUSH_MIN_MOVES_PER_CRATE,
  PUSH_MIN_PUSHES,
  SLIDE_MAX_HOLES,
  SLIDE_MAX_MOVES,
  SLIDE_MIN_HOLES,
  SLIDE_MIN_MOVES,
} from "../src/lib/duel/types";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

/* ---------------------------------- Flow --------------------------------- */

let shortest = FLOW_CELLS;
for (let i = 0; i < 200; i++) {
  const puzzle = generateFlow();
  const paths = puzzle.solution ?? [];
  if (paths.length !== FLOW_PAIRS) fail("Flow did not produce five paths");
  if (!verifyFlow(puzzle.pairs, paths).solved) fail("Flow stored paths do not solve the board");
  for (const [index, path] of paths.entries()) {
    if (path.length < FLOW_MIN_PATH) fail(`Flow path shorter than ${FLOW_MIN_PATH}`);
    shortest = Math.min(shortest, path.length);
    const rows = new Set(path.map((cell) => Math.floor(cell / FLOW_COLS)));
    const cols = new Set(path.map((cell) => cell % FLOW_COLS));

    if (rows.size === 1 || cols.size === 1) fail("Flow produced a straight path");
    const pair = puzzle.pairs[index]!;
    if (flowNeighbours(pair.a).includes(pair.b)) fail("Flow produced an adjacent pair");
  }
  const covered = new Set(paths.flat());
  if (covered.size !== FLOW_CELLS) fail("Flow does not fill every cell");
}
console.log(`Flow: 200 boards OK · shortest path ${shortest} cells`);

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
  const distance = slideDistance(
    puzzle.walls,
    holes,
    puzzle.start,
    puzzle.exit,
    puzzle.start,
    arrows,
  );
  if (distance === null) fail("Ice Slide shipped an unreachable exit");
  if (distance !== min) fail(`Ice Slide minimum ${min} disagrees with the search (${distance})`);
  const stats = puzzle.stats;
  if (!stats) fail("Ice Slide shipped no generator stats");
  if (stats.minMoves !== min) fail("Ice Slide stats minimum disagrees with the puzzle");
  if (stats.easyExit) fail("Ice Slide exit is reachable too easily");
  if (stats.stoppers < SLIDE_MIN_STOPPERS) fail(`Ice Slide only has ${stats.stoppers} stoppers`);
  const moves = decodeSlideMoves(puzzle.solution ?? "");
  const replay = replaySlide(puzzle.walls, holes, puzzle.start, puzzle.exit, moves, arrows);
  if (!replay.solved || replay.moves !== min)
    fail("Ice Slide stored route does not reach the exit");
  if (replay.falls) fail("Ice Slide stored route falls into a hole");
  if (!slideRouteAvoidsHoles(puzzle.walls, holes, puzzle.start, puzzle.exit, moves, arrows)) {
    fail("Ice Slide stored route slides over a hole");
  }
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
