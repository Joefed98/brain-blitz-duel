/**
 * One-Stroke rules. A figure is a set of dots joined by straight edges; an
 * attempt is the order of dots the finger passed through. The server replays the
 * attempt list through exactly this code, so a client can never report a win.
 */

import type { StrokeDot } from "./types";

export type StrokeEdge = [number, number];

export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function strokeDegrees(dots: StrokeDot[], edges: StrokeEdge[]): number[] {
  const degrees = dots.map(() => 0);
  for (const [a, b] of edges) {
    if (degrees[a] !== undefined) degrees[a] += 1;
    if (degrees[b] !== undefined) degrees[b] += 1;
  }
  return degrees;
}

export function oddDots(dots: StrokeDot[], edges: StrokeEdge[]): number[] {
  return strokeDegrees(dots, edges)
    .map((degree, index) => (degree % 2 === 1 ? index : -1))
    .filter((index) => index >= 0);
}

/** Every dot joined to `dot` by an edge, with the edge's index. */
export function strokeNeighbours(edges: StrokeEdge[], dot: number): { to: number; edge: number }[] {
  const out: { to: number; edge: number }[] = [];
  edges.forEach(([a, b], edge) => {
    if (a === dot) out.push({ to: b, edge });
    else if (b === dot) out.push({ to: a, edge });
  });
  return out;
}

export function strokeConnected(dots: StrokeDot[], edges: StrokeEdge[]): boolean {
  if (dots.length === 0) return false;
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length) {
    const dot = stack.pop()!;
    for (const { to } of strokeNeighbours(edges, dot)) {
      if (seen.has(to)) continue;
      seen.add(to);
      stack.push(to);
    }
  }
  return seen.size === dots.length;
}

/**
 * One continuous route over every edge exactly once, starting at `start`, or
 * null when none exists from there. Plain depth-first search: the figures are
 * tiny (at most fourteen edges), so backtracking is instant and exact.
 */
export function findEulerPath(
  dots: StrokeDot[],
  edges: StrokeEdge[],
  start: number,
): number[] | null {
  if (edges.length === 0) return null;
  const used = edges.map(() => false);
  const path = [start];

  const walk = (dot: number, left: number): boolean => {
    if (left === 0) return true;
    for (const { to, edge } of strokeNeighbours(edges, dot)) {
      if (used[edge]) continue;
      used[edge] = true;
      path.push(to);
      if (walk(to, left - 1)) return true;
      path.pop();
      used[edge] = false;
    }
    return false;
  };

  return walk(start, edges.length) ? path : null;
}

/** Dots that cannot start a complete stroke — the "traps". */
export function strokeTrapDots(dots: StrokeDot[], edges: StrokeEdge[]): number[] {
  return dots
    .map((_dot, index) => (findEulerPath(dots, edges, index) ? -1 : index))
    .filter((index) => index >= 0);
}

/** Attempts are dot lists, each attempt separated by ";". */
export function encodeStrokeAttempts(attempts: number[][]): string {
  return attempts.map((attempt) => attempt.join(",")).join(";");
}

export function decodeStrokeAttempts(raw: string): number[][] {
  return String(raw ?? "")
    .split(";")
    .map((part) =>
      part
        .split(",")
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value >= 0),
    )
    .filter((attempt) => attempt.length > 0);
}

export interface StrokeAttemptReplay {
  /** Indices of the edges legally traced, in order. */
  traced: number[];
  complete: boolean;
}

/** Walks one attempt: a step only counts along an untraced, existing edge. */
export function replayStrokeAttempt(edges: StrokeEdge[], attempt: number[]): StrokeAttemptReplay {
  const used = new Set<number>();
  const traced: number[] = [];
  let at = attempt[0];
  for (const next of attempt.slice(1)) {
    if (at === undefined) break;
    const step = strokeNeighbours(edges, at).find(({ to, edge }) => to === next && !used.has(edge));
    if (!step) continue;
    used.add(step.edge);
    traced.push(step.edge);
    at = next;
  }
  return { traced, complete: traced.length === edges.length && edges.length > 0 };
}

export interface StrokeReplay {
  attempts: number;
  /** The most edges traced in any single attempt. */
  best: number;
  solved: boolean;
  /** 1-based attempt number the figure was completed on, or 0. */
  solvedOn: number;
  total: number;
}

export function replayStroke(edges: StrokeEdge[], attempts: number[][]): StrokeReplay {
  let best = 0;
  let solvedOn = 0;
  attempts.forEach((attempt, index) => {
    const replay = replayStrokeAttempt(edges, attempt);
    if (replay.traced.length > best) best = replay.traced.length;
    if (replay.complete && solvedOn === 0) solvedOn = index + 1;
  });
  return {
    attempts: attempts.length,
    best,
    solved: solvedOn > 0,
    solvedOn,
    total: edges.length,
  };
}
