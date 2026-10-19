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
  tilesLayout,
  TILES_RESET,
  TILES_REV_EXTRA,
  TILES_UNDO,
} from "../src/lib/duel/tiles";
import { generateClassicTiles, generateTiles, tilesMinMoves } from "../src/lib/duel/tiles.server";
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
  TILES_EXTRA_MAX_MOVES,
  TILES_EXTRA_MIN_MOVES,
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
// Stored rounds' classic 3×3 frame and the extra-cell board (tilesRev 1, 14 Oct 2026).
for (const kind of ["classic", "extra"] as const) {
  for (let round = 0; round < ROUNDS; round += 1) {
    const puzzle = kind === "classic" ? generateClassicTiles() : generateTiles();
    const { frame, minMoves, solution } = puzzle;
    const layout = tilesLayout(puzzle);
    const cells = kind === "classic" ? 9 : 10;
    const count = cells - 1;
    const tag = `tiles ${kind} ${round}`;
    // New rounds are tilesRev 2 since 20 Oct 2026: the same extra-cell board on a 90 s clock (jumbled-clock-check).
    check(`${tag}: stamp`, kind === "classic" ? puzzle.tilesRev === undefined : (puzzle.tilesRev ?? 0) >= TILES_REV_EXTRA && !!puzzle.extra);
    check(`${tag}: ${cells} cells with a gap`, frame.length === cells && frame.includes(0) && layout.cells.length === cells);
    check(`${tag}: every tile once`, new Set(frame).size === cells && frame.every((v) => v >= 0 && v <= count));
    if (kind === "extra") {
      // One row or column of the 3×3 has four cells: the extra cell touches exactly one grid cell.
      const extra = layout.cells[9]!;
      const touching = layout.cells.slice(0, 9).filter((c) => Math.abs(c.r - extra.r) + Math.abs(c.c - extra.c) === 1);
      check(`${tag}: extra cell beside one grid cell`, touching.length === 1);
      const line = layout.cells.filter((c) => c.r === extra.r).length === 4 || layout.cells.filter((c) => c.c === extra.c).length === 4;
      check(`${tag}: one line of four`, line);
      check(`${tag}: goal is 1–9 in reading order, gap last`, [...layout.cells.keys()].sort((x, y) => layout.cells[x]!.r - layout.cells[y]!.r || layout.cells[x]!.c - layout.cells[y]!.c).map((i) => layout.goal[i]).join(",") === "1,2,3,4,5,6,7,8,9,0");
    } else {
      check(`${tag}: classic goal unchanged`, solvedFrame().join(",") === "1,2,3,4,5,6,7,8,0");
    }
    const [lo, hi] = kind === "classic" ? [TILES_MIN_MOVES, TILES_MAX_MOVES] : [TILES_EXTRA_MIN_MOVES, TILES_EXTRA_MAX_MOVES];
    check(`${tag}: minimum in band`, (minMoves ?? 0) >= lo && (minMoves ?? 0) <= hi);
    const replay = replayTiles(frame, solution ?? [], layout);
    check(`${tag}: solution solves`, replay.solved);
    check(`${tag}: solution is minimal`, replay.moves === minMoves);
    const proved = tilesMinMoves(frame, layout);
    check(`${tag}: minimum is exact`, proved?.min === minMoves);
    check(`${tag}: in place counted`, tilesInPlace(solvedFrame(layout), layout) === count);
    // Solvable by construction: scrambled from the finished board, so the IDA* search always ends.
    check(`${tag}: solvable`, proved !== null);

    // Undo and Reset rewind the frame without ever inventing a win. Since the
    // Sep 26 rule, `moves` counts every slide made (undone ones included), so
    // Undo/Reset cannot lower the move count used for scoring.
    const threeIn = replayTiles(frame, (solution ?? []).slice(0, 3), layout);
    const undone = replayTiles(frame, [...(solution ?? []).slice(0, 4), TILES_UNDO], layout);
    check(`${tag}: undo steps back`, !undone.solved && undone.moves === 4 && undone.frame.every((v, i) => v === threeIn.frame[i]));
    const reset = replayTiles(frame, [...(solution ?? []).slice(0, 5), TILES_RESET], layout);
    check(`${tag}: reset clears`, !reset.solved && reset.moves === 5 && reset.frame.every((v, i) => v === frame[i]));
    const decoded = decodeTileMoves(encodeTileMoves(solution ?? []), layout.count);
    check(`${tag}: round-trips`, replayTiles(frame, decoded, layout).solved);
  }
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
