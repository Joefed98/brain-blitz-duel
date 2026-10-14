/**
 * Proof checks for Sliding Tiles and Rotating Rings (One-Stroke's part went
 * with the game on 14 Oct 2026).
 * Run with: bun scripts/tiles-rings-check.ts
 */

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
  encodeRingTap,
  encodeRingTaps,
  freshOffsets,
  replayRings,
  ringPattern,
  ringsMinMoves,
} from "../src/lib/duel/rings";
import { generateRings } from "../src/lib/duel/rings.server";
import {
  RINGS_COLOURS,
  RINGS_COUNT,
  RINGS_MAX_TURNS,
  RINGS_MIN_TURNS,
  RINGS_SEGMENTS,
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

  // Undo and Reset rewind the frame without ever inventing a win. Since the
  // Sep 26 rule, `moves` counts every slide made (undone ones included), so
  // Undo/Reset cannot lower the move count used for scoring.
  const threeIn = replayTiles(frame, (solution ?? []).slice(0, 3));
  const undone = replayTiles(frame, [...(solution ?? []).slice(0, 4), TILES_UNDO]);
  check(
    `tiles ${round}: undo steps back`,
    !undone.solved && undone.moves === 4 && undone.frame.every((v, i) => v === threeIn.frame[i]),
  );
  const reset = replayTiles(frame, [...(solution ?? []).slice(0, 5), TILES_RESET]);
  check(
    `tiles ${round}: reset clears`,
    !reset.solved && reset.moves === 5 && reset.frame.every((v, i) => v === frame[i]),
  );
  const decoded = decodeTileMoves(encodeTileMoves(solution ?? []));
  check(`tiles ${round}: round-trips`, replayTiles(frame, decoded).solved);
}

// ---------------------------- Rotating Rings ----------------------------
for (let round = 0; round < ROUNDS; round += 1) {
  const puzzle = generateRings();
  const { segments, minMoves, solution } = puzzle;
  const pattern = puzzle.pattern ?? 0;
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
  const replay = replayRings(segments, pattern, solution ?? []);
  check(`rings ${round}: solution solves`, replay.solved);
  check(`rings ${round}: solution is minimal`, replay.moves === minMoves);
  const proved = ringsMinMoves(segments, pattern);
  check(`rings ${round}: minimum is exact`, proved?.min === minMoves);

  // Each puzzle carries one link pattern: a clockwise turn moves the ring one
  // step (offset 7) and each linked ring the same (7) or opposite (1) way.
  // Rings with no outgoing link turn alone.
  for (let ring = 0; ring < RINGS_COUNT; ring++) {
    const expected = freshOffsets();
    expected[ring] = RINGS_SEGMENTS - 1;
    for (const link of ringPattern(pattern).links) {
      if (link.from === ring) expected[link.to] = link.sign === 1 ? RINGS_SEGMENTS - 1 : 1;
    }
    const turned = replayRings(segments, pattern, [encodeRingTap(ring, true)]);
    check(
      `rings ${round}: ring ${ring + 1} follows pattern ${pattern}`,
      turned.offsets.every((offset, i) => offset === expected[i]),
    );
  }
  const anticlockwise = replayRings(segments, pattern, [encodeRingTap(0, false)]);
  check(`rings ${round}: anticlockwise direction`, anticlockwise.offsets[0] === 1);
  const decoded = decodeRingTaps(encodeRingTaps(solution ?? []));
  check(`rings ${round}: round-trips`, replayRings(segments, pattern, decoded).solved);
  const partial = replayRings(segments, pattern, (solution ?? []).slice(0, 2));
  check(`rings ${round}: partial not solved`, !partial.solved);
}

if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log(
  `All Sliding Tiles and Rotating Rings checks passed (${ROUNDS} rounds each).`,
);
