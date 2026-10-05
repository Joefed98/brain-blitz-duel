/**
 * Server-only generation for Don't Break the Chain.
 *
 * One seeded shape-and-colour cycle and five seeded boards of 20 nodes (one per
 * block of five links). Every board holds exactly the nodes its five links need,
 * plus near-miss decoys: for each rule item, nodes sharing its shape but not its
 * colour and its colour but not its shape. Positions are Poisson-disc scattered.
 */

import { randInt, shuffled } from "./random";
import { chainRequired } from "./chain";
import {
  CHAIN_BLOCK,
  CHAIN_BOARDS,
  CHAIN_BOARD_H_PX,
  CHAIN_BOARD_W_PX,
  CHAIN_COLOURS,
  CHAIN_CYCLE,
  CHAIN_MIN_CENTRAL,
  CHAIN_NODES,
  CHAIN_NODE_GAP_PX,
  CHAIN_NODE_PX,
  CHAIN_SHAPES,
  type ChainColour,
  type ChainNode,
  type ChainPuzzleData,
  type ChainRuleItem,
  type ChainShape,
} from "./types";

const EDGE_PADDING = 7;
const MIN_DISTANCE_PX = CHAIN_NODE_PX + CHAIN_NODE_GAP_PX;
const CENTRE_FROM = 100 / 3;
const CENTRE_TO = 200 / 3;
/** Near-miss decoys per rule item and kind (same shape / same colour). */
const DECOYS_PER_KIND = 2;

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
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function samplePoints(random: () => number): Point[] | null {
  const points: Point[] = [];
  const span = 100 - EDGE_PADDING * 2;
  const round = (value: number) => Math.round(value * 10) / 10;
  const fits = (candidate: Point) =>
    points.every((point) => distancePx(point, candidate) >= MIN_DISTANCE_PX);

  for (let throws = 0; throws < 20_000 && points.length < CHAIN_MIN_CENTRAL; throws++) {
    const middle = CENTRE_TO - CENTRE_FROM;
    const candidate = {
      x: round(CENTRE_FROM + random() * middle),
      y: round(CENTRE_FROM + random() * middle),
    };
    if (fits(candidate)) points.push(candidate);
  }
  if (points.length < CHAIN_MIN_CENTRAL) return null;

  for (let throws = 0; throws < 60_000 && points.length < CHAIN_NODES; throws++) {
    const candidate = {
      x: round(EDGE_PADDING + random() * span),
      y: round(EDGE_PADDING + random() * span),
    };
    if (fits(candidate)) points.push(candidate);
  }
  return points.length === CHAIN_NODES ? points : null;
}

function sameItem(a: ChainRuleItem, b: ChainRuleItem): boolean {
  return a.shape === b.shape && a.colour === b.colour;
}

function pick<T>(list: readonly T[]): T {
  return list[randInt(0, list.length - 1)]!;
}

/** The 20 node faces for one block, in shuffled order. */
export function chainBoardFaces(cycle: ChainRuleItem[], block: number): ChainRuleItem[] {
  const faces: ChainRuleItem[] = [];
  for (let step = 0; step < CHAIN_BLOCK; step++) {
    faces.push({ ...chainRequired(cycle, block * CHAIN_BLOCK + step)! });
  }
  const isRule = (face: ChainRuleItem) => cycle.some((item) => sameItem(item, face));
  for (const item of cycle) {
    const otherColours = CHAIN_COLOURS.filter((colour) => colour !== item.colour);
    const otherShapes = CHAIN_SHAPES.filter((shape) => shape !== item.shape);
    for (let i = 0; i < DECOYS_PER_KIND; i++) {
      // Decoys must never be a valid face for any step of the cycle.
      let face: ChainRuleItem;
      do face = { shape: item.shape, colour: pick(otherColours) };
      while (isRule(face));
      faces.push(face);
      do face = { shape: pick(otherShapes) as ChainShape, colour: item.colour };
      while (isRule(face));
      faces.push(face);
    }
  }
  while (faces.length < CHAIN_NODES) {
    const face = { shape: pick(CHAIN_SHAPES), colour: pick(CHAIN_COLOURS) as ChainColour };
    if (!isRule(face)) faces.push(face);
  }
  return shuffled(faces);
}

export function generateChain(): ChainPuzzleData {
  const shapes = shuffled([...CHAIN_SHAPES]).slice(0, CHAIN_CYCLE);
  const colours = shuffled([...CHAIN_COLOURS]).slice(0, CHAIN_CYCLE);
  const cycle: ChainRuleItem[] = shapes.map((shape, index) => ({ shape, colour: colours[index]! }));
  const boards: ChainNode[][] = Array.from({ length: CHAIN_BOARDS }, (_unused, block) => {
    const random = seededRandom(randInt(0, 0x7fffffff));
    let points = samplePoints(random);
    while (!points) points = samplePoints(random);
    const faces = chainBoardFaces(cycle, block);
    return points.map((point, index) => ({ ...point, ...faces[index]! }));
  });
  return { type: "chain", cycle, boards };
}
