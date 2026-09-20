/**
 * Server-only generation for Don't Break the Chain.
 *
 * A depth-first search counts non-crossing twelve-node paths, capped at 200.
 * Accepted layouts have 1–8 routes, at least two early dead-end traps, and a
 * shape-valid crossing choice wherever crossing is geometrically possible.
 */

import { random, shuffled } from "./random";
import { chainRequired, chainWouldCross } from "./chain";
import {
  CHAIN_CYCLE,
  CHAIN_LENGTH,
  CHAIN_MIN_INVALID,
  CHAIN_NODES,
  CHAIN_SHAPES,
  type ChainNode,
  type ChainPuzzleData,
  type ChainShape,
} from "./types";

const CHAIN_SOLUTION_CAP = 200;

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
  // Crossing cannot exist until there are two prior segments. The generator's
  // searched template supplies crossing decoys throughout the established path.
  if (chain.length < 3) return true;
  if (chain.length < 4) {
    return unused.some(
      (index) => nodes[index]?.shape === needed && chainWouldCross(nodes, chain, index),
    );
  }
  return true;
}

/** Depth-first search for one valid non-crossing twelve-node chain. */
export function findChainSolution(nodes: ChainNode[], cycle: ChainShape[]): number[] | null {
  const search = (chain: number[]): number[] | null => {
    if (chain.length >= CHAIN_LENGTH) return chain;
    if (!stepHasRequiredChoices(nodes, cycle, chain)) return null;
    const needed = chainRequired(cycle, chain.length);
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

export function generateChain(): ChainPuzzleData {
  // Start from a searched sparse-route template, then rotate/reflect it so
  // rooms do not present the same visual orientation. The route count and
  // crossing topology are invariant under these transforms.
  const template: ChainNode[] = [
    [77.4, 19.2, "circle"],
    [76, 26, "circle"],
    [64.8, 14.2, "circle"],
    [13.9, 40.1, "circle"],
    [15.3, 72.8, "circle"],
    [13.5, 65.7, "square"],
    [89.1, 47, "square"],
    [14.9, 47.2, "square"],
    [90.6, 63.2, "square"],
    [82.4, 71.2, "square"],
    [37.7, 14.4, "triangle"],
    [58.2, 85.8, "triangle"],
    [93.1, 38.3, "triangle"],
    [28.3, 11.9, "triangle"],
    [45.6, 8.3, "triangle"],
    [25.4, 83.4, "triangle"],
    [40, 93.5, "triangle"],
    [17.6, 23, "triangle"],
    [68.5, 82.5, "triangle"],
    [53.4, 92.8, "triangle"],
  ].map(([x, y, shape]) => ({ x: x as number, y: y as number, shape: shape as ChainShape }));
  const turns = Math.floor(random() * 4);
  const reflected = random() < 0.5;
  const transform = (node: ChainNode): ChainNode => {
    let x = reflected ? 100 - node.x : node.x;
    let y = node.y;
    for (let turn = 0; turn < turns; turn++) [x, y] = [100 - y, x];
    return { ...node, x, y };
  };
  const shapeOrder = shuffled([...CHAIN_SHAPES]);
  const shapeMap = new Map(CHAIN_SHAPES.map((shape, index) => [shape, shapeOrder[index]!]));
  const nodes = template
    .map(transform)
    .map((node) => ({ ...node, shape: shapeMap.get(node.shape)! }));
  const cycle = [shapeMap.get("circle")!, shapeMap.get("square")!, shapeMap.get("triangle")!];
  const solutions = collectChainSolutions(nodes, cycle, 8);
  const solution = solutions.find((candidate) => chainSolutionIsFair(nodes, cycle, candidate));
  if (!solution || chainTrapNodes(nodes, cycle).length < 2) {
    throw new Error("Don't Break the Chain template failed validation");
  }
  return { type: "chain", nodes, cycle, solution, solutionCount: solutions.length };
}
