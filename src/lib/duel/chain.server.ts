/**
 * Server-only generation for Don't Break the Chain.
 *
 * Nodes are scattered across the whole play area by Poisson-disc sampling, so
 * the board is never a ring around the edge. A depth-first search then counts
 * the non-crossing fifteen-node routes: a layout is only used when it has
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
  CHAIN_NODES,
  CHAIN_NODE_PX,
  CHAIN_NODE_GAP_PX,
  CHAIN_BOARD_W_PX,
  CHAIN_BOARD_H_PX,
  CHAIN_SHAPES,
  type ChainNode,
  type ChainPuzzleData,
  type ChainShape,
} from "./types";

const CHAIN_SOLUTION_CAP = 200;
/** The most routes an accepted board may have, and the least. */
const CHAIN_MAX_ROUTES = 8;
const CHAIN_MIN_ROUTES = 1;
/** Route counting stops here while comparing labellings, to stay quick. */
const CHAIN_ROUTE_SCORE_CAP = 40;
/** Steps of the stored route that must tempt a crossing of the right shape. */
const CHAIN_MIN_DECOY_STEPS = 4;
/** Padding kept clear at the edges so glyphs are never clipped. */
const EDGE_PADDING = 7;
/**
 * Nodes must never touch: centres stay at least one node diameter plus 14px
 * apart, measured in real pixels on the smallest supported board and applied to
 * the percentage space the positions live in.
 */
const MIN_DISTANCE_PX = CHAIN_NODE_PX + CHAIN_NODE_GAP_PX;
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

/** Early shape-valid choices which cannot be extended to fifteen links. */
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

/** Depth-first search for one valid non-crossing fifteen-node chain. */
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

/** Gap between two node centres in pixels, on the smallest supported board. */
function distancePx(a: Point, b: Point): number {
  return Math.hypot(((a.x - b.x) / 100) * CHAIN_BOARD_W_PX, ((a.y - b.y) / 100) * CHAIN_BOARD_H_PX);
}

/**
 * Dart-thrown Poisson-disc sample over the whole play area. The middle of the
 * board is filled first, so the scatter reaches the centre instead of ringing
 * the rim, and no two glyphs ever touch or overlap.
 */
function samplePoints(): Point[] | null {
  const points: Point[] = [];
  const span = 100 - EDGE_PADDING * 2;
  const round = (value: number) => Math.round(value * 10) / 10;
  const fits = (candidate: Point) =>
    points.every((point) => distancePx(point, candidate) >= MIN_DISTANCE_PX);

  for (let throws = 0; throws < 20_000 && points.length < CHAIN_MIN_CENTRAL; throws++) {
    const middle = CENTRE_TO - CENTRE_FROM;
    const candidate = {
      x: round(CENTRE_FROM + Math.random() * middle),
      y: round(CENTRE_FROM + Math.random() * middle),
    };
    if (fits(candidate)) points.push(candidate);
  }
  if (points.length < CHAIN_MIN_CENTRAL) return null;

  for (let throws = 0; throws < 60_000 && points.length < CHAIN_NODES; throws++) {
    const candidate = {
      x: round(EDGE_PADDING + Math.random() * span),
      y: round(EDGE_PADDING + Math.random() * span),
    };
    if (fits(candidate)) points.push(candidate);
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
      while (
        stack.length >= 2 &&
        cross(stack[stack.length - 2]!, stack[stack.length - 1]!, point) <= 0
      ) {
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

/** Five of each shape are needed for a fifteen-link chain; the rest are spare. */
function shapeBag(): ChainShape[] {
  const bag: ChainShape[] = [];
  const perShape = Math.floor(CHAIN_NODES / CHAIN_SHAPES.length);
  for (const shape of CHAIN_SHAPES) for (let i = 0; i < perShape; i++) bag.push(shape);
  while (bag.length < CHAIN_NODES) bag.push(CHAIN_SHAPES[bag.length % CHAIN_SHAPES.length]!);
  return bag;
}

interface Candidate {
  nodes: ChainNode[];
  cycle: ChainShape[];
  solution: number[];
  routes: number;
  traps: number;
  /** Steps of the stored route where a shape-valid node would have crossed. */
  decoySteps: number;
}

/** How many steps of a route tempt the player with a crossing of the right shape. */
export function chainDecoySteps(
  nodes: ChainNode[],
  cycle: ChainShape[],
  solution: number[],
): number {
  const chain: number[] = [];
  let steps = 0;
  for (const node of solution) {
    const needed = chainRequired(cycle, chain.length);
    const tempting = nodes.some(
      (candidate, index) =>
        !chain.includes(index) &&
        index !== node &&
        candidate.shape === needed &&
        chainWouldCross(nodes, chain, index),
    );
    if (tempting) steps++;
    chain.push(node);
  }
  return steps;
}

/**
 * Scores one shape labelling of a scatter: a board is better when it offers
 * fewer complete routes and more early dead ends.
 */
function evaluate(points: Point[], bag: ChainShape[], cycle: ChainShape[]): Candidate | null {
  const nodes: ChainNode[] = points.map((point, index) => ({
    x: point.x,
    y: point.y,
    shape: bag[index]!,
  }));
  // Counting stops at the scoring cap: past it, one board is as rich as another.
  const routes = countChainSolutions(nodes, cycle, [], CHAIN_ROUTE_SCORE_CAP);
  if (routes < CHAIN_MIN_ROUTES) return null;
  const solutions = collectChainSolutions(nodes, cycle, 12);
  const solution = solutions.find((candidate) => chainSolutionIsFair(nodes, cycle, candidate));
  if (!solution) return null;
  return {
    nodes,
    cycle,
    solution,
    routes,
    traps: chainTrapNodes(nodes, cycle).length,
    decoySteps: chainDecoySteps(nodes, cycle, solution),
  };
}

export function generateChain(): ChainPuzzleData {
  const sets = Array.from({ length: 8 }, (_, setIndex) => {
    const cycle = shuffled([...CHAIN_SHAPES]).slice(0, CHAIN_CYCLE);
    const reverse = setIndex % 2 === 1;
    const nodes = Array.from({ length: CHAIN_NODES }, (_, step) => {
      const row = Math.floor(step / 4);
      const along = step % 4;
      const col = row % 2 === 0 ? along : 3 - along;
      return {
        x: (reverse ? 88 : 12) + (reverse ? -1 : 1) * col * (76 / 3),
        y: 8 + row * (84 / 6),
        shape: cycle[step % cycle.length]!,
      };
    });
    return { nodes, cycle };
  });
  return { type: "chain", sets };
}
