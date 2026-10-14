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
  STROKE_MAX_DOTS,
  STROKE_MAX_EDGES,
  STROKE_MIN_DOTS,
  STROKE_MIN_EDGES,
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
// Stored rounds' classic 3×3 frame and the extra-cell board (tilesRev 1, 14 Oct 2026).
for (const kind of ["classic", "extra"] as const) {
  for (let round = 0; round < ROUNDS; round += 1) {
    const puzzle = kind === "classic" ? generateClassicTiles() : generateTiles();
    const { frame, minMoves, solution } = puzzle;
    const layout = tilesLayout(puzzle);
    const cells = kind === "classic" ? 9 : 10;
    const count = cells - 1;
    const tag = `tiles ${kind} ${round}`;
    check(`${tag}: stamp`, kind === "classic" ? puzzle.tilesRev === undefined : puzzle.tilesRev === TILES_REV_EXTRA && !!puzzle.extra);
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
  `All One-Stroke, Sliding Tiles and Rotating Rings checks passed (${ROUNDS} rounds each).`,
);
