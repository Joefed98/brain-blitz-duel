/**
 * Server-only generation for One-Stroke. Dots are placed on a coarse grid, then
 * edges are added at random and rejected whenever they would cross an existing
 * edge. A figure is only kept when it is connected, has exactly two odd dots (so
 * a complete stroke exists but starting on the wrong dot fails), and has at
 * least one busy dot of degree four. One valid route is stored privately.
 */

import { chainSegmentsIntersect } from "./chain";
import { pick, randInt, randomBelow, shuffled } from "./random";
import {
  findEulerPath,
  oddDots,
  strokeConnected,
  strokeDegrees,
  strokeNeighbours,
  strokeTrapDots,
  type StrokeEdge,
} from "./stroke";
import {
  STROKE_ATTEMPTS,
  STROKE_MAX_DOTS,
  STROKE_MAX_EDGES,
  STROKE_MIN_DOTS,
  STROKE_MIN_EDGES,
  type StrokeDot,
  type StrokePuzzleData,
} from "./types";

/** Lattice positions, in percent, dots are drawn from. */
const LATTICE: StrokeDot[] = [
  { x: 16, y: 14 },
  { x: 50, y: 10 },
  { x: 84, y: 14 },
  { x: 14, y: 42 },
  { x: 50, y: 38 },
  { x: 86, y: 42 },
  { x: 18, y: 70 },
  { x: 50, y: 66 },
  { x: 82, y: 70 },
  { x: 32, y: 92 },
  { x: 68, y: 92 },
];

function crosses(dots: StrokeDot[], edges: StrokeEdge[], a: number, b: number): boolean {
  const from = dots[a]!;
  const to = dots[b]!;
  for (const [c, d] of edges) {
    if (c === a || c === b || d === a || d === b) continue;
    if (chainSegmentsIntersect(from, to, dots[c]!, dots[d]!)) return true;
  }
  // A third dot sitting on the line would look like a mis-drawn edge.
  return dots.some((dot, index) => {
    if (index === a || index === b) return false;
    const cross =
      (dot.x - from.x) * (to.y - from.y) - (dot.y - from.y) * (to.x - from.x);
    if (Math.abs(cross) > 1.5) return false;
    return (
      dot.x >= Math.min(from.x, to.x) - 0.5 &&
      dot.x <= Math.max(from.x, to.x) + 0.5 &&
      dot.y >= Math.min(from.y, to.y) - 0.5 &&
      dot.y <= Math.max(from.y, to.y) + 0.5
    );
  });
}

function candidatePairs(count: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let a = 0; a < count; a += 1) {
    for (let b = a + 1; b < count; b += 1) pairs.push([a, b]);
  }
  return shuffled(pairs);
}

function buildFigure(): StrokePuzzleData | null {
  const dotCount = randInt(STROKE_MIN_DOTS, STROKE_MAX_DOTS);
  const dots = shuffled(LATTICE).slice(0, dotCount);
  const target = randInt(STROKE_MIN_EDGES, STROKE_MAX_EDGES);
  const edges: StrokeEdge[] = [];

  for (const [a, b] of candidatePairs(dotCount)) {
    if (edges.length >= target) break;
    if (crosses(dots, edges, a, b)) continue;
    edges.push([a, b]);
  }

  if (edges.length < STROKE_MIN_EDGES) return null;
  if (!strokeConnected(dots, edges)) return null;

  // Exactly two odd dots: a complete stroke exists, and every even dot traps.
  const odd = oddDots(dots, edges);
  if (odd.length !== 2) return null;
  if (!strokeDegrees(dots, edges).some((degree) => degree >= 4)) return null;

  const start = pick(odd);
  const solution = findEulerPath(dots, edges, start);
  if (!solution) return null;
  if (strokeTrapDots(dots, edges).length === 0) return null;
  // Every dot must lead somewhere, so nothing on screen is decoration.
  if (dots.some((_dot, index) => strokeNeighbours(edges, index).length === 0)) return null;

  return { type: "stroke", dots, edges, solution };
}

export function generateStroke(): StrokePuzzleData {
  for (let attempt = 0; attempt < STROKE_ATTEMPTS; attempt += 1) {
    const figure = buildFigure();
    if (figure) return figure;
  }
  // Fallback: a fixed house figure with two odd dots and a degree-four centre.
  const dots: StrokeDot[] = [
    { x: 18, y: 78 },
    { x: 82, y: 78 },
    { x: 82, y: 42 },
    { x: 18, y: 42 },
    { x: 50, y: 14 },
    { x: 50, y: 60 },
  ];
  const edges: StrokeEdge[] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [3, 4],
    [4, 2],
    [0, 5],
    [1, 5],
    [2, 5],
    [3, 5],
  ];
  const start = oddDots(dots, edges)[0] ?? randomBelow(dots.length);
  return {
    type: "stroke",
    dots,
    edges,
    ...(findEulerPath(dots, edges, start) ? { solution: findEulerPath(dots, edges, start)! } : {}),
  };
}
