/**
 * Server-only generation for Don't Break the Chain.
 *
 * A new seeded shape-and-colour cycle for each of eight boards of 20 nodes (one per
 * block of five links). Every board holds exactly the nodes its five links need,
 * plus near-miss decoys: for each rule item, nodes sharing its shape but not its
 * colour and its colour but not its shape. Positions are Poisson-disc scattered.
 */

import { randInt } from "./random";
import { chainRequired } from "./chain";
import { CHAIN_DEPTH_REV } from "./depth/chain";
import {
  CHAIN_BLOCK,
  CHAIN_RULES_VERSION,
  CHAIN_TIME_REV,
  CHAIN_BOARDS,
  CHAIN_BOARD_H_PX,
  CHAIN_BOARD_W_PX,
  CHAIN_COLOURS,
  CHAIN_CYCLE,
  CHAIN_CYCLE_LONG,
  CHAIN_CYCLE_REV,
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

function pick<T>(list: readonly T[], random: () => number): T {
  const item = list[Math.floor(random() * list.length)];
  if (item === undefined) throw new Error("Empty Chain choices");
  return item;
}

function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) throw new Error("Missing Chain choice");
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * chainCycleRev 1: the 20 faces for a five-symbol board: each rule charm once,
 * then for each one a near miss sharing its shape and one sharing its colour
 * (never a rule charm), then more near misses to 20; shuffled.
 */
export function chainLongBoardFaces(cycle: ChainRuleItem[], random: () => number): ChainRuleItem[] {
  const faces: ChainRuleItem[] = cycle.map((item) => ({ ...item }));
  const isRule = (face: ChainRuleItem) => cycle.some((item) => sameItem(item, face));
  for (const item of cycle) {
    let face: ChainRuleItem;
    do face = { shape: item.shape, colour: pick(CHAIN_COLOURS.filter((c) => c !== item.colour), random) };
    while (isRule(face));
    faces.push(face);
    do face = { shape: pick(CHAIN_SHAPES.filter((s) => s !== item.shape), random) as ChainShape, colour: item.colour };
    while (isRule(face));
    faces.push(face);
  }
  while (faces.length < CHAIN_NODES) {
    const item = pick(cycle, random);
    const face = random() < 0.5
      ? { shape: item.shape, colour: pick(CHAIN_COLOURS, random) as ChainColour }
      : { shape: pick(CHAIN_SHAPES, random), colour: item.colour };
    if (!isRule(face)) faces.push(face);
  }
  return shuffle(faces, random);
}

/**
 * chainCycleRev 1: five different charms; no shape or colour used more than
 * twice, and neighbours (the last and first too) share neither shape nor colour.
 */
function longCycle(random: () => number, previous: ChainRuleItem[] | undefined): ChainRuleItem[] {
  for (;;) {
    const cycle: ChainRuleItem[] = [];
    for (let tries = 0; tries < 200 && cycle.length < CHAIN_CYCLE_LONG; tries++) {
      const face = { shape: pick(CHAIN_SHAPES, random), colour: pick(CHAIN_COLOURS, random) } as ChainRuleItem;
      const last = cycle.at(-1);
      if (cycle.some((item) => sameItem(item, face))) continue;
      if (cycle.filter((item) => item.shape === face.shape).length >= 2) continue;
      if (cycle.filter((item) => item.colour === face.colour).length >= 2) continue;
      if (last && (last.shape === face.shape || last.colour === face.colour)) continue;
      if (cycle.length === CHAIN_CYCLE_LONG - 1 && (cycle[0]!.shape === face.shape || cycle[0]!.colour === face.colour)) continue;
      cycle.push(face);
    }
    if (cycle.length < CHAIN_CYCLE_LONG) continue;
    // The board must change at every reshuffle: a different first charm and a different set.
    if (previous && (sameItem(previous[0]!, cycle[0]!) || cycle.every((item) => previous.some((old) => sameItem(item, old))))) continue;
    return cycle;
  }
}

/** The 20 node faces for one block, in shuffled order. */
export function chainBoardFaces(cycle: ChainRuleItem[], block: number, random = seededRandom(randInt(0, 0x7fffffff))): ChainRuleItem[] {
  const faces: ChainRuleItem[] = [];
  for (let step = 0; step < CHAIN_BLOCK; step++) {
    const required = chainRequired(cycle, block * CHAIN_BLOCK + step);
    if (!required) throw new Error("Missing Chain rule");
    faces.push({ ...required });
  }
  const isRule = (face: ChainRuleItem) => cycle.some((item) => sameItem(item, face));
  for (const item of cycle) {
    const otherColours = CHAIN_COLOURS.filter((colour) => colour !== item.colour);
    const otherShapes = CHAIN_SHAPES.filter((shape) => shape !== item.shape);
    for (let i = 0; i < DECOYS_PER_KIND; i++) {
      // Decoys must never be a valid face for any step of the cycle.
      let face: ChainRuleItem;
      do face = { shape: item.shape, colour: pick(otherColours, random) };
      while (isRule(face));
      faces.push(face);
      do face = { shape: pick(otherShapes, random) as ChainShape, colour: item.colour };
      while (isRule(face));
      faces.push(face);
    }
  }
  while (faces.length < CHAIN_NODES) {
    const item = pick(cycle, random);
    const face = random() < 0.5
      ? { shape: item.shape, colour: pick(CHAIN_COLOURS, random) as ChainColour }
      : { shape: pick(CHAIN_SHAPES, random), colour: item.colour };
    if (!isRule(face)) faces.push(face);
  }
  return shuffle(faces, random);
}

/** chainCycleRev 1: eight boards, each with its own five-symbol cycle. */
function generateLongChain(seed: number): ChainPuzzleData {
  const random = seededRandom(seed);
  const cycles: ChainRuleItem[][] = [];
  const boards: ChainNode[][] = Array.from({ length: CHAIN_BOARDS }, () => {
    const cycle = longCycle(random, cycles.at(-1));
    cycles.push(cycle);
    let points = samplePoints(random);
    while (!points) points = samplePoints(random);
    const faces = chainLongBoardFaces(cycle, random);
    return points.map((point, index) => ({ ...point, ...faces[index]! }));
  });
  return {
    type: "chain",
    rulesVersion: CHAIN_RULES_VERSION,
    chainTimeRev: CHAIN_TIME_REV,
    chainCycleRev: CHAIN_CYCLE_REV,
    // Depth to 200 (25 Oct 2026): milestones and the stretched finish (depth/chain.ts); the board is unchanged.
    chainDepthRev: CHAIN_DEPTH_REV,
    seed,
    cycle: cycles[0] ?? [],
    cycles,
    boards,
  };
}

export function generateChain(seed = randInt(0, 0x7fffffff)): ChainPuzzleData {
  return generateLongChain(seed);
}

/** The three-symbol generator rooms used before chainCycleRev 1 (kept for checks and fixtures). */
export function generateChainV2(seed = randInt(0, 0x7fffffff)): ChainPuzzleData {
  const random = seededRandom(seed);
  const cycles: ChainRuleItem[][] = [];
  const boards: ChainNode[][] = Array.from({ length: CHAIN_BOARDS }, () => {
    const previous = cycles.at(-1);
    let cycle: ChainRuleItem[];
    do {
      const shapes = shuffle(CHAIN_SHAPES, random).slice(0, CHAIN_CYCLE);
      const colours = shuffle(CHAIN_COLOURS, random).slice(0, CHAIN_CYCLE);
      cycle = shapes.map((shape, index) => {
        const colour = colours[index];
        if (!colour) throw new Error("Missing Chain colour");
        return { shape, colour };
      });
      // Both the symbol set and shape order must change at every reshuffle.
    } while (previous && (
      cycle.every((item) => previous.some((old) => sameItem(item, old))) ||
      cycle.every((item, index) => item.shape === previous[index]?.shape)
    ));
    cycles.push(cycle);
    let points = samplePoints(random);
    while (!points) points = samplePoints(random);
    const faces = chainBoardFaces(cycle, 0, random);
    return points.map((point, index) => {
      const face = faces[index];
      if (!face) throw new Error("Missing Chain face");
      return { ...point, ...face };
    });
  });
  return { type: "chain", rulesVersion: CHAIN_RULES_VERSION, chainTimeRev: CHAIN_TIME_REV, seed, cycle: cycles[0] ?? [], cycles, boards };
}
