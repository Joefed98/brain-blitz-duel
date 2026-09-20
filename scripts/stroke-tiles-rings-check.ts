/**
 * Proof checks for One-Stroke, Sliding Tiles and Rotating Rings.
 * Run with: bun scripts/stroke-tiles-rings-check.ts
 */

import {
  decodeStrokeAttempts,
  encodeStrokeAttempts,
  findEulerPath,
  oddDots,
  replayStroke,
  replayStrokeAttempt,
  strokeConnected,
  strokeDegrees,
  strokeTrapDots,
} from "../src/lib/duel/stroke";
import { generateStroke } from "../src/lib/duel/stroke.server";
import { chainSegmentsIntersect } from "../src/lib/duel/chain";
import {
  decodeTileMoves,
  encodeTileMoves,
  replayTiles,
  solvedFrame,
  tilesInPlace,
  TILES_RESET,
  TILES_UNDO,
} from "../src/lib/duel/tiles";
import { generateTiles, tilesMinMoves } from "../src/lib/duel/tiles.server";
import {
  alignedSpokes,
  decodeRingTaps,
  encodeRingTaps,
  freshOffsets,
  replayRings,
  ringsMinMoves,
} from "../src/lib/duel/rings";
import { generateRings } from "../src/lib/duel/rings.server";
import {
  RINGS_COLOURS,
  RINGS_COUNT,
  RINGS_MAX_TURNS,
  RINGS_MIN_TURNS,
  RINGS_SEGMENTS,
  STROKE_MAX_DOTS,
  STROKE_MAX_EDGES,
  STROKE_MIN_DOTS,
  STROKE_MIN_EDGES,
  TILES_COUNT,
  TILES_MAX_MOVES,
  TILES_MIN_MOVES,
} from "../src/lib/duel/types";

const ROUNDS = 40;
let failures = 0;

function check(label: string, ok: boolean): void {
  if (ok) return;
  failures += 1;
  console.error(`FAIL ${label}`);
}

// ------------------------------ One-Stroke ------------------------------
for (let round = 0; round < ROUNDS; round += 1) {
  const puzzle = generateStroke();
  const { dots, edges, solution } = puzzle;
  check(
    `stroke ${round}: dot count`,
    dots.length >= STROKE_MIN_DOTS && dots.length <= STROKE_MAX_DOTS,
  );
  check(
    `stroke ${round}: edge count`,
    edges.length >= STROKE_MIN_EDGES && edges.length <= STROKE_MAX_EDGES,
  );
  check(`stroke ${round}: connected`, strokeConnected(dots, edges));
  check(`stroke ${round}: euler parity`, [0, 2].includes(oddDots(dots, edges).length));
  check(
    `stroke ${round}: a busy dot`,
    strokeDegrees(dots, edges).some((d) => d >= 4),
  );
  check(`stroke ${round}: has a trap dot`, strokeTrapDots(dots, edges).length > 0);

  // No two edges cross, except where they share a dot.
  let crossing = false;
  edges.forEach(([a, b], i) => {
    edges.slice(i + 1).forEach(([c, d]) => {
      if (a === c || a === d || b === c || b === d) return;
      if (chainSegmentsIntersect(dots[a]!, dots[b]!, dots[c]!, dots[d]!)) crossing = true;
    });
  });
  check(`stroke ${round}: no crossing edges`, !crossing);

  // The stored route traces every edge exactly once, and replays as solved.
  check(`stroke ${round}: solution stored`, Array.isArray(solution) && solution.length > 0);
  const replayed = replayStrokeAttempt(edges, solution ?? []);
  check(`stroke ${round}: solution complete`, replayed.complete);
  const full = replayStroke(edges, decodeStrokeAttempts(encodeStrokeAttempts([solution ?? []])));
  check(`stroke ${round}: solved first try`, full.solved && full.solvedOn === 1);

  // A trap start really is impossible.
  const trap = strokeTrapDots(dots, edges)[0]!;
  check(`stroke ${round}: trap cannot finish`, findEulerPath(dots, edges, trap) === null);

  // A partial attempt scores partially, never as solved.
  const partial = replayStroke(edges, [(solution ?? []).slice(0, 3)]);
  check(`stroke ${round}: partial not solved`, !partial.solved && partial.best <= edges.length);
}

// ----------------------------- Sliding Tiles -----------------------------
for (let round = 0; round < ROUNDS; round += 1) {
  const puzzle = generateTiles();
  const { frame, minMoves, solution } = puzzle;
  check(`tiles ${round}: nine cells with a gap`, frame.length === 9 && frame.includes(0));
  check(
    `tiles ${round}: every tile once`,
    new Set(frame).size === 9 && frame.every((v) => v >= 0 && v <= TILES_COUNT),
  );
  check(
    `tiles ${round}: minimum in band`,
    (minMoves ?? 0) >= TILES_MIN_MOVES && (minMoves ?? 0) <= TILES_MAX_MOVES,
  );
  const replay = replayTiles(frame, solution ?? []);
  check(`tiles ${round}: solution solves`, replay.solved);
  check(`tiles ${round}: solution is minimal`, replay.moves === minMoves);
  const proved = tilesMinMoves(frame);
  check(`tiles ${round}: minimum is exact`, proved?.min === minMoves);
  check(`tiles ${round}: in place counted`, tilesInPlace(solvedFrame()) === TILES_COUNT);

  // Undo and Reset rewind the frame without ever inventing a win.
  const undone = replayTiles(frame, [...(solution ?? []).slice(0, 4), TILES_UNDO]);
  check(`tiles ${round}: undo steps back`, undone.moves === 3 && !undone.solved);
  const reset = replayTiles(frame, [...(solution ?? []).slice(0, 5), TILES_RESET]);
  check(
    `tiles ${round}: reset clears`,
    reset.moves === 0 && reset.frame.every((v, i) => v === frame[i]),
  );
  const decoded = decodeTileMoves(encodeTileMoves(solution ?? []));
  check(`tiles ${round}: round-trips`, replayTiles(frame, decoded).solved);
}

// ---------------------------- Rotating Rings ----------------------------
for (let round = 0; round < ROUNDS; round += 1) {
  const puzzle = generateRings();
  const { segments, minMoves, solution } = puzzle;
  check(`rings ${round}: four rings of eight`, segments.length === RINGS_COUNT);
  check(
    `rings ${round}: two of each colour per ring`,
    segments.every((ring) => {
      if (ring.length !== RINGS_SEGMENTS) return false;
      const counts = new Map<number, number>();
      for (const colour of ring) counts.set(colour, (counts.get(colour) ?? 0) + 1);
      return counts.size === RINGS_COLOURS && [...counts.values()].every((n) => n === 2);
    }),
  );
  check(
    `rings ${round}: starts unsolved`,
    alignedSpokes(segments, freshOffsets()).length < RINGS_SEGMENTS,
  );
  check(
    `rings ${round}: minimum in band`,
    (minMoves ?? 0) >= RINGS_MIN_TURNS && (minMoves ?? 0) <= RINGS_MAX_TURNS,
  );
  const replay = replayRings(segments, solution ?? []);
  check(`rings ${round}: solution solves`, replay.solved);
  check(`rings ${round}: solution is minimal`, replay.moves === minMoves);
  const proved = ringsMinMoves(segments);
  check(`rings ${round}: minimum is exact`, proved?.min === minMoves);

  // Rings two and three drag the next ring out; inner and outer turn alone.
  const ringTwo = replayRings(segments, [2]);
  check(
    `rings ${round}: ring two is linked`,
    ringTwo.offsets[0] === 0 &&
      ringTwo.offsets[1] === 1 &&
      ringTwo.offsets[2] === 1 &&
      ringTwo.offsets[3] === 0,
  );
  const ringThree = replayRings(segments, [4]);
  check(
    `rings ${round}: ring three is linked`,
    ringThree.offsets[0] === 0 &&
      ringThree.offsets[1] === 0 &&
      ringThree.offsets[2] === 1 &&
      ringThree.offsets[3] === 1,
  );
  const inner = replayRings(segments, [0]);
  check(`rings ${round}: inner turns alone`, inner.offsets.filter(Boolean).length === 1);
  const outer = replayRings(segments, [6]);
  check(`rings ${round}: outer turns alone`, outer.offsets.filter(Boolean).length === 1);
  const decoded = decodeRingTaps(encodeRingTaps(solution ?? []));
  check(`rings ${round}: round-trips`, replayRings(segments, decoded).solved);
  const partial = replayRings(segments, (solution ?? []).slice(0, 2));
  check(`rings ${round}: partial not solved`, !partial.solved);
}

if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log(
  `All One-Stroke, Sliding Tiles and Rotating Rings checks passed (${ROUNDS} rounds each).`,
);
