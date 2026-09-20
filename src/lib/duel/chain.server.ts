/**
 * Server-only generation for Don't Break the Chain.
 *
 * Nodes are scattered across the whole play area by Poisson-disc sampling, so
 * the board is never a ring around the edge. A depth-first search then counts
 * the non-crossing twelve-node routes: a layout is only used when it has
 * between one and eight of them and at least two early dead-end traps.
 */

import { shuffled } from "./random";
import { chainRequired, chainWouldCross } from "./chain";
import {
  CHAIN_CYCLE,
  CHAIN_LENGTH,
  CHAIN_MAX_HULL_RATIO,
  CHAIN_MIN_CENTRAL,
  CHAIN_MIN_INVALID,
  CHAIN_MIN_SPACING,
  CHAIN_NODES,
  CHAIN_NODE_WIDTH_PCT,
  CHAIN_SHAPES,
  type ChainNode,
  type ChainPuzzleData,
  type ChainShape,
} from "./types";

const CHAIN_SOLUTION_CAP = 200;
/** The most routes an accepted board may have, and the least. */
const CHAIN_MAX_ROUTES = 8;
const CHAIN_MIN_ROUTES = 1;
/** Padding kept clear at the edges so glyphs are never clipped. */
const EDGE_PADDING = 7;
/** Minimum distance between two node centres, in percentage points. */
const MIN_DISTANCE = CHAIN_MIN_SPACING * CHAIN_NODE_WIDTH_PCT;
/** The central third of each axis. */
const CENTRE_FROM = 100 / 3;
const CENTRE_TO = 200 / 3;

function validChoices(nodes: ChainNode[], cycle: ChainShape[], chain: number[]): number[] {
  const needed = chainRequired(cycle, chain.length);
  return nodes
    .map((_node, index) => index)
    .filter(
      (index) =>
        !chain.includes(index) &&
        nodes[index]?.shape === needed &&
        !chainWouldCross(nodes, chain, index),
    );
}

/** Counts complete chains, stopping at the cap so generation stays bounded. */
export function countChainSolutions(
  nodes: ChainNode[],
  cycle: ChainShape[],
  prefix: number[] = [],
  cap = CHAIN_SOLUTION_CAP,
): number {
  let count = 0;
  const search = (chain: number[]) => {
    if (count >= cap) return;
    if (chain.length >= CHAIN_LENGTH) {
      count++;
      return;
    }
    for (const choice of validChoices(nodes, cycle, chain)) search([...chain, choice]);
  };
  search(prefix);
  return count;
}

function collectChainSolutions(
  nodes: ChainNode[],
  cycle: ChainShape[],
  cap = CHAIN_SOLUTION_CAP,
): number[][] {
  const solutions: number[][] = [];
  const search = (chain: number[]) => {
    if (solutions.length >= cap) return;
    if (chain.length >= CHAIN_LENGTH) {
      solutions.push(chain);
      return;
    }
    for (const choice of validChoices(nodes, cycle, chain)) search([...chain, choice]);
  };
  search([]);
  return solutions;
}

/** Early shape-valid choices which cannot be extended to twelve links. */
export function chainTrapNodes(nodes: ChainNode[], cycle: ChainShape[]): number[] {
  const traps = new Set<number>();
  const searchPrefixes = (chain: number[]) => {
    if (chain.length >= 5 || traps.size >= 2) return;
    for (const choice of validChoices(nodes, cycle, chain)) {
      const next = [...chain, choice];
      if (countChainSolutions(nodes, cycle, next, 1) === 0) traps.add(choice);
      else searchPrefixes(next);
      if (traps.size >= 2) return;
    }
  };
  searchPrefixes([]);
  return [...traps];
}

function stepHasRequiredChoices(nodes: ChainNode[], cycle: ChainShape[], chain: number[]): boolean {
  const needed = chainRequired(cycle, chain.length);
  const unused = nodes.map((_node, index) => index).filter((index) => !chain.includes(index));
  const invalid = unused.filter((index) => nodes[index]?.shape !== needed).length;
  if (invalid < CHAIN_MIN_INVALID) return false;
  // Crossing cannot exist until there are two prior segments; from then on the
  // step must offer a shape-valid node whose line would cross, when one exists.
  if (chain.length < 3) return true;
  const crossing = unused.filter(
    (index) => nodes[index]?.shape === needed && chainWouldCross(nodes, chain, index),
  ).length;
  const sameShape = unused.filter((index) => nodes[index]?.shape === needed).length;
  return crossing > 0 || sameShape === validChoices(nodes, cycle, chain).length;
}

/** Depth-first search for one valid non-crossing twelve-node chain. */
export function findChainSolution(nodes: ChainNode[], cycle: ChainShape[]): number[] | null {
  const search = (chain: number[]): number[] | null => {
    if (chain.length >= CHAIN_LENGTH) return chain;
    if (!stepHasRequiredChoices(nodes, cycle, chain)) return null;
    const choices = shuffled(validChoices(nodes, cycle, chain));
    for (const choice of choices) {
      const solved = search([...chain, choice]);
      if (solved) return solved;
    }
    return null;
  };
  return search([]);
}

export function chainSolutionIsFair(
  nodes: ChainNode[],
  cycle: ChainShape[],
  solution: number[],
): boolean {
  if (solution.length !== CHAIN_LENGTH) return false;
  const chain: number[] = [];
  for (const node of solution) {
    if (!stepHasRequiredChoices(nodes, cycle, chain)) return false;
    if (
      chain.includes(node) ||
      nodes[node]?.shape !== chainRequired(cycle, chain.length) ||
      chainWouldCross(nodes, chain, node)
    ) {
      return false;
    }
    chain.push(node);
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/*  Layout                                                                    */
/* -------------------------------------------------------------------------- */

interface Point {
  x: number;
  y: number;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Dart-thrown Poisson-disc sample: points spread over the whole play area. */
function samplePoints(): Point[] | null {
  const points: Point[] = [];
  const span = 100 - EDGE_PADDING * 2;
  for (let throws = 0; throws < 6_000 && points.length < CHAIN_NODES; throws++) {
    const candidate = {
      x: Math.round((EDGE_PADDING + Math.random() * span) * 10) / 10,
      y: Math.round((EDGE_PADDING + Math.random() * span) * 10) / 10,
    };
    if (points.every((point) => distance(point, candidate) >= MIN_DISTANCE)) {
      points.push(candidate);
    }
  }
  return points.length === CHAIN_NODES ? points : null;
}

function inCentralThird(point: Point): boolean {
  return (
    point.x >= CENTRE_FROM && point.x <= CENTRE_TO && point.y >= CENTRE_FROM && point.y <= CENTRE_TO
  );
}

/** Andrew's monotone chain: the points on the outer boundary of the scatter. */
export function convexHullSize(points: Point[]): number {
  if (points.length < 3) return points.length;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => {
    const stack: Point[] = [];
    for (const point of list) {
      while (stack.length >= 2 && cross(stack[stack.length - 2]!, stack[stack.length - 1]!, point) <= 0) {
        stack.pop();
      }
      stack.push(point);
    }
    return stack;
  };
  const lower = half(sorted);
  const upper = half([...sorted].reverse());
  return lower.length + upper.length - 2;
}

/** The scatter must reach the middle of the board and not hug its rim. */
export function layoutIsSpread(points: Point[]): boolean {
  if (points.filter(inCentralThird).length < CHAIN_MIN_CENTRAL) return false;
  return convexHullSize(points) <= Math.floor(points.length * CHAIN_MAX_HULL_RATIO);
}

/** Four of each shape are needed for a twelve-link chain; the rest are spare. */
function shapeBag(): ChainShape[] {
  const bag: ChainShape[] = [];
  const perShape = Math.floor(CHAIN_NODES / CHAIN_SHAPES.length);
  for (const shape of CHAIN_SHAPES) for (let i = 0; i < perShape; i++) bag.push(shape);
  while (bag.length < CHAIN_NODES) bag.push(CHAIN_SHAPES[bag.length % CHAIN_SHAPES.length]!);
  return bag;
}

export function generateChain(): ChainPuzzleData {
  for (let attempt = 0; attempt < 400; attempt++) {
    const points = samplePoints();
    if (!points || !layoutIsSpread(points)) continue;

    // Keep the scatter and try shape labellings on it: the routes a board
    // offers depend far more on which node is which shape than on the spread.
    for (let labelling = 0; labelling < 40; labelling++) {
      const bag = shuffled(shapeBag());
      const nodes: ChainNode[] = points.map((point, index) => ({
        x: point.x,
        y: point.y,
        shape: bag[index]!,
      }));
      const cycle = shuffled([...CHAIN_SHAPES]).slice(0, CHAIN_CYCLE);

      // Counting stops one past the limit, so an over-rich board is cheap to reject.
      const routes = countChainSolutions(nodes, cycle, [], CHAIN_MAX_ROUTES + 1);
      if (routes < CHAIN_MIN_ROUTES || routes > CHAIN_MAX_ROUTES) continue;

      const solutions = collectChainSolutions(nodes, cycle, CHAIN_MAX_ROUTES);
      const solution = solutions.find((candidate) => chainSolutionIsFair(nodes, cycle, candidate));
      if (!solution) continue;
      if (chainTrapNodes(nodes, cycle).length < 2) continue;

      return { type: "chain", nodes, cycle, solution, solutionCount: routes };
    }
  }
  throw new Error("Don't Break the Chain generator could not build a spread layout");
}
