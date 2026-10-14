/**
 * Proof run for Gravity Maze (Topsy-Turvy). Interloper's part went with the
 * game on 14 Oct 2026.
 * Run with: bun scripts/gravity-maze-check.ts
 */

import { generateGravity, lockInteractions } from "../src/lib/duel/gravity.server";
import { decodeGravityTilts, replayGravity, tilt, GRAVITY_DIRS } from "../src/lib/duel/gravity";
import { GRAV_BALLS, GRAV_MIN_TILTS, GRAV_MAX_TILTS } from "../src/lib/duel/types";

const ROUNDS = 40;
let failures = 0;

function check(label: string, ok: boolean) {
  if (!ok) {
    failures++;
    console.log(`FAIL ${label}`);
  }
}

for (let round = 0; round < ROUNDS; round++) {
  const puzzle = generateGravity();
  const solution = decodeGravityTilts(puzzle.solution ?? "");
  const walls = new Set(puzzle.walls);
  const replay = replayGravity(walls, puzzle.starts, puzzle.targets, solution);
  check("gravity ball count", puzzle.starts.length === GRAV_BALLS && puzzle.targets.length === GRAV_BALLS);
  check("gravity minimum stored", (puzzle.minMoves ?? 0) >= GRAV_MIN_TILTS);
  check("gravity minimum in band", (puzzle.minMoves ?? 0) <= GRAV_MAX_TILTS);
  check("gravity solution solves the board", replay.solved);
  check("gravity solution length equals the minimum", replay.tilts === puzzle.minMoves);
  check(
    "gravity no ball locks on the first tilt",
    GRAVITY_DIRS.every((dir) => tilt(walls, puzzle.starts, puzzle.targets, dir).locked.length === 0),
  );
  check("gravity shortest route has lock interactions", lockInteractions(walls, puzzle.starts, puzzle.targets, solution) >= 2);
}

console.log(failures === 0 ? `All checks passed (${ROUNDS} rounds)` : `${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
