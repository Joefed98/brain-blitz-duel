/**
 * Don't Break the Chain rules. A three-item shape-and-colour cycle repeats; each
 * correct tap must match it on the current board, inside the momentum window.
 * The first wrong tap or lapse breaks the chain. The phone and the server walk
 * the same timed tap list through replayChain.
 */

import { speedBonusCurve } from "./speedPar";
import {
  CHAIN_BLOCK,
  CHAIN_CYCLE,
  CHAIN_LENGTH,
  CHAIN_LINK_POINTS,
  CHAIN_FINISH_BONUS,
  CHAIN_RULES_VERSION,
  CHAIN_FASTER_AT,
  CHAIN_MOMENTUM_MS,
  CHAIN_TIME_MS,
  type ChainBreak,
  type ChainPuzzleData,
  type ChainRuleItem,
} from "./types";

/** What the next tap has to be, after `links` correct taps. */
export function chainRequired(cycle: ChainRuleItem[], links: number): ChainRuleItem | undefined {
  return cycle[links % CHAIN_CYCLE];
}

/** Stored per-board rule, with the original rule retained for older rounds. */
export function chainCycleAt(puzzle: ChainPuzzleData, links: number): ChainRuleItem[] {
  return puzzle.cycles?.[chainBoardIndex(links, puzzle)] ?? puzzle.cycle;
}

/** Each new board starts its new cycle at the first symbol. */
export function chainRuleStep(puzzle: ChainPuzzleData, links: number): number {
  return puzzle.cycles ? links % CHAIN_BLOCK : links;
}

export function chainRequiredAt(puzzle: ChainPuzzleData, links: number): ChainRuleItem | undefined {
  return chainRequired(chainCycleAt(puzzle, links), chainRuleStep(puzzle, links));
}

/** Resolve old rounds from their stored board count, never today's constants. */
export function chainRules(puzzle?: ChainPuzzleData) {
  const legacyLength = puzzle && puzzle.rulesVersion !== CHAIN_RULES_VERSION
    ? puzzle.boards.length * CHAIN_BLOCK : 0;
  if (legacyLength === 25 || legacyLength === 30) {
    return {
      length: legacyLength,
      points: legacyLength === 25 ? 6 : 5,
      bonus: 0,
      bands: [{ upTo: 10, ms: 3000 }, { upTo: 18, ms: 2500 }, { upTo: legacyLength, ms: 2000 }],
      fasterAt: [10, 18, 26] as readonly number[],
    };
  }
  return { length: CHAIN_LENGTH, points: CHAIN_LINK_POINTS, bonus: CHAIN_FINISH_BONUS,
    bands: CHAIN_MOMENTUM_MS, fasterAt: CHAIN_FASTER_AT as readonly number[] };
}

/** Momentum window for the next 1-based link; the first tap is untimed. */
export function chainWindowMs(link: number, puzzle?: ChainPuzzleData): number {
  const bands = chainRules(puzzle).bands;
  for (const band of bands) if (link <= band.upTo) return band.ms;
  return bands.at(-1)?.ms ?? 2000;
}

/** The board shown after `links` correct taps. */
export function chainBoardIndex(links: number, puzzle?: ChainPuzzleData): number {
  return Math.min(Math.floor(links / CHAIN_BLOCK), Math.floor((chainRules(puzzle).length - 1) / CHAIN_BLOCK));
}

/** Shared server-scoring rule, with the original rule for stored rounds. */
export function chainScore(links: number, msRemaining = 0, puzzle?: ChainPuzzleData): number {
  const rules = chainRules(puzzle);
  const count = Math.max(0, Math.min(rules.length, Math.floor(links)));
  const bonus = count === rules.length
    ? speedBonusCurve(rules.bonus, msRemaining, CHAIN_TIME_MS) : 0;
  return Math.min(150, Math.floor(rules.points * count) + bonus);
}

/** Old recordings use the old timing bands and must be recorded again. */
export function chainDemoCompatible(puzzle: ChainPuzzleData): boolean {
  return puzzle.rulesVersion === CHAIN_RULES_VERSION && puzzle.boards.length === CHAIN_LENGTH / CHAIN_BLOCK;
}

const EPSILON = 0.0001;

/** Any positioned point — One-Stroke dots use the segment test below. */
type Point = { x: number; y: number };

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Point, b: Point, point: Point): boolean {
  return (
    point.x >= Math.min(a.x, b.x) - EPSILON &&
    point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON &&
    point.y <= Math.max(a.y, b.y) + EPSILON
  );
}

/** True when two closed line segments touch or cross. */
export function chainSegmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (
    ((abC > EPSILON && abD < -EPSILON) || (abC < -EPSILON && abD > EPSILON)) &&
    ((cdA > EPSILON && cdB < -EPSILON) || (cdA < -EPSILON && cdB > EPSILON))
  ) {
    return true;
  }
  return (
    (Math.abs(abC) <= EPSILON && onSegment(a, b, c)) ||
    (Math.abs(abD) <= EPSILON && onSegment(a, b, d)) ||
    (Math.abs(cdA) <= EPSILON && onSegment(c, d, a)) ||
    (Math.abs(cdB) <= EPSILON && onSegment(c, d, b))
  );
}

/** One tap: node index on the board showing at the time, ms since the round began. */
export interface ChainTap {
  node: number;
  t: number;
}

export interface ChainAnswer {
  taps: ChainTap[];
  /** The phone's stated reason; the server re-derives what it can. */
  reason: ChainBreak;
}

const REASONS: ChainBreak[] = ["wrong", "momentum", "timer", "complete"];

/** "node@ms,node@ms|reason" */
export function encodeChainAnswer(answer: ChainAnswer): string {
  return `${answer.taps.map((tap) => `${tap.node}@${Math.round(tap.t)}`).join(",")}|${answer.reason}`;
}

export function decodeChainAnswer(raw: string): ChainAnswer {
  const [list = "", reasonRaw = "timer"] = String(raw ?? "").split("|");
  const taps: ChainTap[] = [];
  for (const part of list.split(",")) {
    const [nodeRaw, timeRaw] = part.split("@");
    const node = Number.parseInt(nodeRaw ?? "", 10);
    const t = Number.parseInt(timeRaw ?? "", 10);
    if (!Number.isInteger(node) || !Number.isInteger(t) || node < 0 || t < 0) continue;
    taps.push({ node, t });
    if (taps.length >= CHAIN_LENGTH + 1) break;
  }
  const reason = REASONS.includes(reasonRaw as ChainBreak) ? (reasonRaw as ChainBreak) : "timer";
  return { taps, reason };
}

export interface ChainReplay {
  /** Correct links made before the chain ended. */
  links: number;
  /** Why the chain ended (or "timer" while it is still live). */
  reason: ChainBreak;
  /** Node indices used on each board, in order. */
  used: number[][];
  /** Time (ms) of the last correct tap, or null before the first. */
  lastT: number | null;
  /** True once the chain is over (broken or complete). */
  over: boolean;
}

/** Validates one tap against a live replay; does not mutate. */
export function chainTapVerdict(
  puzzle: ChainPuzzleData,
  replay: ChainReplay,
  tap: ChainTap,
): "ok" | "wrong" | "momentum" {
  if (replay.lastT !== null && tap.t - replay.lastT > chainWindowMs(replay.links + 1, puzzle)) {
    return "momentum";
  }
  const board = chainBoardIndex(replay.links, puzzle);
  const node = puzzle.boards[board]?.[tap.node];
  const need = chainRequiredAt(puzzle, replay.links);
  if (!node || !need) return "wrong";
  if (replay.used[board]?.includes(tap.node)) return "wrong";
  return node.shape === need.shape && node.colour === need.colour ? "ok" : "wrong";
}

/** The one place a timed tap list becomes a chain — used on the phone and the server. */
export function replayChain(puzzle: ChainPuzzleData, answer: ChainAnswer): ChainReplay {
  const replay: ChainReplay = { links: 0, reason: "timer", used: [], lastT: null, over: false };
  let previousT = -1;
  for (const tap of answer.taps) {
    if (replay.over) break;
    // Times must run forwards and stay inside the round.
    if (tap.t < previousT || tap.t > CHAIN_TIME_MS) break;
    previousT = tap.t;
    const verdict = chainTapVerdict(puzzle, replay, tap);
    if (verdict !== "ok") {
      replay.reason = verdict;
      replay.over = true;
      break;
    }
    const board = chainBoardIndex(replay.links, puzzle);
    (replay.used[board] ??= []).push(tap.node);
    replay.links += 1;
    replay.lastT = tap.t;
    if (replay.links >= chainRules(puzzle).length) {
      replay.reason = "complete";
      replay.over = true;
    }
  }
  // A lapse after the last tap leaves no tap to prove it; trust only a momentum claim.
  if (!replay.over && answer.reason === "momentum" && replay.links > 0) {
    replay.reason = "momentum";
    replay.over = true;
  }
  return replay;
}
