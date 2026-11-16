/**
 * Chroma Lines' levels (16 Nov 2026; settings in src/lib/levels/pattern/flow.levels.ts). Server-only.
 *
 * Each level beyond Normal deals from its own seeded bank (flowEasyBank / flowHardBank / flowExpertBank .server.ts),
 * built by `bun scripts/flow-bank.ts --level=<level>` and proved byte for byte with `--check`. Entry i is the level's
 * generator (flow.server.ts `generateFlow` with the level's rules) under `flowLevelSeed(level, i, retry)`, kept only
 * when it passes `verifyFlowLevelPuzzle`: the level's rules, the exhaustive solver's proof of exactly one solution, and
 * the human-style solver (flowHuman.server.ts) finishing it with at least the level's "what if" floor.
 *
 * Normal is never dealt here: it keeps today's bank and deal exactly.
 */
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { Level } from "@/lib/levels/levels";
import type { FlowLevelSettings } from "@/lib/levels/pattern/flow.levels";

import { flowGrid } from "./flow";
import { generateFlow, verifyFlowPuzzle, type FlowRules } from "./flow.server";
import { FLOW_EASY_BANK } from "./flowEasyBank.server";
import { FLOW_EXPERT_BANK } from "./flowExpertBank.server";
import { FLOW_HARD_BANK } from "./flowHardBank.server";
import { solveFlowLikeAPerson } from "./flowHuman.server";
import { withSeededRandom } from "./random";
import { FLOW_TIME_MS, type FlowPuzzleData } from "./types";

export type FlowLevel = Exclude<Level, "normal">;
export const FLOW_LEVELS: readonly FlowLevel[] = ["easy", "hard", "expert"];

/** The attempt cap for one seed of a level's bank build (and the live fallback). */
export const FLOW_LEVEL_MAX_ATTEMPTS = 2000;

export function flowLevelSettings(level: FlowLevel): FlowLevelSettings {
  const settings = gameLevelSettings<FlowLevelSettings>("flow", level);
  if (!settings) throw new Error(`flow has no ${level} level`);
  return settings;
}

/** A level's settings as the generator's rules. */
export function flowLevelRules(level: FlowLevel): FlowRules {
  const s = flowLevelSettings(level);
  return {
    cols: s.cols,
    rows: s.rows,
    minPairs: s.minPairs,
    maxPairs: s.maxPairs,
    minWalls: s.minWalls,
    maxWalls: s.maxWalls,
    maxPath: s.maxPath,
    minPath: s.minPath,
    minAvgPath: s.minAvgPath,
    budget: s.budget,
    stuckLimit: s.stuckLimit,
    anyCount: true,
  };
}

/** Whether a person finishes the board by reasoning, with at least the level's "what if" floor (its difficulty). */
export function flowHumanPasses(puzzle: FlowPuzzleData, level: FlowLevel): boolean {
  const r = solveFlowLikeAPerson(puzzle.pairs, puzzle.walls ?? [], flowGrid(puzzle));
  return r.solved && r.whatIfs >= flowLevelSettings(level).minWhatIfs;
}

/** Null when the board passes every rule of its level, the uniqueness proof and the human-style solver. */
export function verifyFlowLevelPuzzle(puzzle: FlowPuzzleData, level: FlowLevel): string | null {
  const own = verifyFlowPuzzle(puzzle, flowLevelRules(level));
  if (own) return own;
  if (!flowHumanPasses(puzzle, level)) return "not finished by the human-style solver";
  return null;
}

/** The level's generator, capped, with the human-style test first (it turns most boards away cheaply). */
export function generateFlowLevel(level: FlowLevel, maxAttempts = FLOW_LEVEL_MAX_ATTEMPTS): FlowPuzzleData {
  return generateFlow(undefined, maxAttempts, flowLevelRules(level), (p) => flowHumanPasses(p, level));
}

function fmix32(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function salt(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** The fixed generator seed of a level bank's entry `index`, retry `retry`. */
export function flowLevelSeed(level: FlowLevel, index: number, retry: number): number {
  let h = fmix32(salt(`flow:${level}`));
  h = fmix32(h ^ Math.imul(index + 1, 0x9e3779b1));
  return fmix32(h ^ Math.imul(retry + 1, 0x27d4eb2f));
}

/** One bank entry: the level's generator under a fixed seed, verified; null when the seed gives none. */
export function buildFlowLevelEntry(level: FlowLevel, seed: number): FlowPuzzleData | null {
  let puzzle: FlowPuzzleData;
  try {
    puzzle = withSeededRandom(seed, () => generateFlowLevel(level));
  } catch {
    return null;
  }
  return verifyFlowLevelPuzzle(puzzle, level) === null ? puzzle : null;
}

export function flowLevelBank(level: FlowLevel): readonly FlowPuzzleData[] {
  return level === "easy" ? FLOW_EASY_BANK : level === "hard" ? FLOW_HARD_BANK : FLOW_EXPERT_BANK;
}

/** Public identity of a board, the same form puzzleBank.server.ts `bankKey` gives (so a host's recent boards match). */
export function flowLevelKey(puzzle: FlowPuzzleData, _level?: FlowLevel): string {
  return `flow:${puzzle.pairs.map((x) => `${x.a}-${x.b}`).join(",")}|${(puzzle.walls ?? []).join(",")}`;
}

/** The level's clock stamp: only where it isn't the game's own 75 s (Expert's 90 s). */
function withClock(puzzle: FlowPuzzleData, level: FlowLevel): FlowPuzzleData {
  const ms = flowLevelSettings(level).timeLimitMs;
  return ms === FLOW_TIME_MS ? puzzle : { ...puzzle, timeLimitMs: ms };
}

/**
 * A level's board for this seed (rooms and practice: the room seed; checks without a seed: live generation). Boards
 * whose identity is in `avoid` are skipped by stepping on through the bank, as Normal's draw does.
 */
export function drawFlowLevel(level: FlowLevel, seed: number | undefined, avoid?: ReadonlySet<string>): FlowPuzzleData {
  const bank = flowLevelBank(level);
  if (seed === undefined || bank.length === 0) return withClock(generateFlowLevel(level), level);
  const start = fmix32((seed >>> 0) ^ salt(`flow:${level}`)) % bank.length;
  let chosen = bank[start]!;
  if (avoid && avoid.size > 0) {
    for (let step = 0; step < bank.length; step++) {
      const entry = bank[(start + step) % bank.length]!;
      if (!avoid.has(flowLevelKey(entry, level))) {
        chosen = entry;
        break;
      }
    }
  }
  return withClock(JSON.parse(JSON.stringify(chosen)) as FlowPuzzleData, level);
}
