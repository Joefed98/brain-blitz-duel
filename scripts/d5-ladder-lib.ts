/**
 * D5's ladder players (the polish plan's difficulty session D5, 22 Nov 2026; docs/polish-plan-final/difficulty-spec.md
 * "Retro and Action"): the two players Joe judges the Retro and Action ladders by, on real deals at every level, graded
 * by the server's own code. A script library, not a check (the levels checks pin what it measures).
 *
 *  - average: the game's skill-band bot at the Average level (scripts/arcade-skill-bands/bots), under Joe's human limits
 *    (HUMAN_LIMITS: about 0.25 s to react, 0.15 s to move; an average player is slower than both anyway).
 *  - elite: the same bot at the Elite level (a top-1 % human, never superhuman) under the same limits, with the bots'
 *    competence fixes on (`fixes: true`, as scripts/level-tune.ts plays them). It slips and misjudges like a person, so a
 *    run at 200 is a realistic elite's, not a typed-out perfect run; the share of runs at 200 is what the ladder test reads.
 *
 * Each sample is a real deal (level-tune's `dealAt`: `generatePuzzle(game, { bankSeed, level })` under a seeded
 * Math.random) and only the server's grade counts (`gradeAnswer` on the dealt puzzle replays the bot's encoded log).
 * Every random choice is seeded per (game, seed, level, player), so a measurement reproduces exactly.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync } from "node:fs";

import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, HUMAN_LIMITS, type HumanLimits, type SkillLevel } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { UNITS } from "./arcade-skill-bands/units";
import { dealAt } from "./level-tune";

export const RETRO_GAMES = ["hover", "breaker", "pinball", "blockfall", "rally", "beat", "snake", "cross", "wavefront", "burst"] as const satisfies readonly PuzzleType[];
export const ACTION_GAMES = ["skyline", "ricochet", "bastion", "flip", "orbit", "swing"] as const satisfies readonly PuzzleType[];
export const D5_GAMES = [...RETRO_GAMES, ...ACTION_GAMES] as const;
export type D5Game = (typeof D5_GAMES)[number];
export const ALL_LEVELS = ["easy", "normal", "hard", "expert"] as const satisfies readonly Level[];

/** `proof`: the flawless level (no error, no slip) held to the human limits: a person exactly at 0.25 s and 0.15 s. */
export type D5Bot = "average" | "elite" | "proof";
const SKILL: Record<D5Bot, SkillLevel> = { average: "average", elite: "elite", proof: "perfect" };

export interface RunResult {
  n: number;
  seed: number;
  score: number;
  finished: boolean;
  /** The run's scored parts as the reveal states them (points and maximum each), when they can be read. */
  parts?: RunPart[] | null;
}
export interface RunPart {
  label: string;
  points: number;
  max: number;
}

/** The maxima of the parts the compact reveals (one core line, one "A n · B m" line) do not state. */
const COMPACT_MAX: Record<string, { core: number; parts: Record<string, number> }> = {
  hover: { core: 120, parts: { "Star chains": 30, "gold stars": 20, "tight gates": 20, "centre line": 10 } },
  breaker: { core: 140, parts: { "Wall cleared": 10, speed: 20, gold: 30 } },
  snake: { core: 120, parts: { Gold: 40, combos: 20, lanes: 10, warps: 10 } },
  cross: { core: 150, parts: { "no-stop streak": 40, "close calls": 10 } },
  wavefront: { core: 150, parts: { "Boss destroyed": 10, "Boss speed": 10, Saucers: 20, "Cannons and weak points": 10 } },
  burst: { core: 140, parts: { "Wave clears": 35, "golden atoms": 25 } },
};

/** A run's parts from its stored reveal lines (std "Label: detail → P of M", or a game's compact two lines). */
export function partsOfReveal(type: string, lines: readonly string[] | undefined): RunPart[] | null {
  if (!lines?.length) return null;
  const std = lines.map((l) => /^(.+?): .* → (\d+) of (\d+)$/.exec(l)).filter((m): m is RegExpExecArray => !!m);
  if (std.length) return std.map((m) => ({ label: m[1]!, points: Number(m[2]), max: Number(m[3]) }));
  const table = COMPACT_MAX[type];
  if (!table) return null;
  const core = /→ (\d+)$/.exec(lines[0]!);
  if (!core) return null;
  const parts: RunPart[] = [{ label: "core", points: Number(core[1]), max: table.core }];
  const feat = lines.length > 2 ? lines[1]! : "";
  for (const [label, max] of Object.entries(table.parts)) {
    // The token for this part: "Label … n" or "n label" or "Label n/m"; the points are its last number before " ·" or " +".
    const tok = feat.split(" · ").find((t) => t.toLowerCase().includes(label.toLowerCase()));
    if (!tok) {
      parts.push({ label, points: 0, max });
      continue;
    }
    const clean = tok.replace(/\s\+\d+$/, "");
    const slash = /(\d+)\/(\d+)$/.exec(clean);
    const nums = clean.match(/\d+/g) ?? [];
    const pts = slash ? Number(slash[1]) : label === "close calls" ? Number(nums[nums.length - 1] ?? 0) : Number(nums[nums.length - 1] ?? 0);
    parts.push({ label, points: Math.min(max, pts), max });
  }
  return parts;
}

export interface LadderRow {
  game: string;
  level: Level;
  /** The level the deal carried (a game without the level is dealt as Normal). */
  dealt: Level;
  bot: D5Bot;
  runs: number;
  average: number;
  median: number;
  /** The best tenth's lowest score. */
  top10: number;
  best: number;
  /** Share (0–1) of runs that scored 200. */
  at200: number;
  finishRate: number;
}

const bots = new Map<string, SkillBot>();
export async function loadBot(type: string): Promise<SkillBot> {
  const have = bots.get(type);
  if (have) return have;
  const path = new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url);
  if (!existsSync(path)) throw new Error(`${type}: no skill-band bot (scripts/arcade-skill-bands/bots/${type}.ts)`);
  const bot = ((await import(path.href)) as { bot: SkillBot }).bot;
  bots.set(type, bot);
  return bot;
}

/** The stamp a dealt arcade puzzle carries (LIVE_BANDS' field), or null. */
export function revOf(type: string, puzzle: PuzzleData): number | null {
  const field = LIVE_BANDS[type as keyof typeof LIVE_BANDS]?.field;
  const loose = puzzle as unknown as Record<string, unknown>;
  return field && typeof loose[field] === "number" ? (loose[field] as number) : null;
}

/**
 * One bot's run on a dealt puzzle, graded by the server: the score and the run's own finish. `limits` defaults to
 * Joe's human limits.
 */
export async function playDealt(type: PuzzleType, puzzle: PuzzleData, skill: SkillLevel, limits: HumanLimits | null = HUMAN_LIMITS): Promise<{ score: number; finished: boolean; raw: string; extra: Record<string, unknown> }> {
  const spec = GAME_BY_TYPE.get(type);
  if (!spec) throw new Error(`${type}: no skill-band spec (scripts/arcade-skill-bands/games.ts)`);
  const bot = await loadBot(type);
  const loose = puzzle as unknown as Record<string, unknown>;
  const seed = Number(loose["seed"] ?? 0);
  const rev = revOf(type, puzzle);
  const game = spec.gameForPuzzle ? spec.gameForPuzzle(puzzle) : spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human(type, seed, skill, limits), fixes: true });
  let state = game.init(seed);
  const events = out.events ?? [];
  const taps = out.taps ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  const tapSet = new Set(taps);
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? tapSet.has(t) : (byTick.get(t) ?? null));
    if (state.tick % (spec.checkpointEvery ?? 300) === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const body = { seed, claimedScore: claimed, events, inputs: taps, taps: [], endTick: state.tick, checkpoints };
  const raw = appendClientCounters(spec.encode(body, rev, seed), arcadeCounters(type, state, claimed));
  const graded = gradeAnswer(puzzle, raw, 0);
  const finished = UNITS[type]?.(state).finished ?? graded.isCorrect;
  return { score: graded.score, finished, raw, extra: (graded.extra ?? {}) as Record<string, unknown> };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function summarise(game: string, level: Level, dealt: Level, bot: D5Bot, runs: readonly RunResult[]): LadderRow {
  const scores = runs.map((r) => r.score);
  const sorted = [...scores].sort((a, b) => a - b);
  const n = scores.length || 1;
  return {
    game,
    level,
    dealt,
    bot,
    runs: scores.length,
    average: round1(scores.reduce((a, b) => a + b, 0) / n),
    median: sorted[Math.floor((sorted.length - 1) / 2)] ?? 0,
    top10: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] ?? 0,
    best: sorted[sorted.length - 1] ?? 0,
    at200: scores.filter((s) => s >= 200).length / n,
    finishRate: runs.filter((r) => r.finished).length / n,
  };
}

/** One player on `deals` deals of a game at a level (deals `from` … `from + deals − 1`, level-tune's room seeds). */
export async function measure(game: PuzzleType, level: Level, bot: D5Bot, deals = 24, from = 0): Promise<{ row: LadderRow; runs: RunResult[] }> {
  const runs: RunResult[] = [];
  let dealt: Level = "normal";
  for (let n = from; n < from + deals; n++) {
    const puzzle = dealAt(game, level, n);
    dealt = puzzleLevel(puzzle);
    const r = await playDealt(game, puzzle, SKILL[bot]);
    const lines = (r.extra["reveal"] as { lines?: string[] } | undefined)?.lines;
    runs.push({ n, seed: Number((puzzle as unknown as { seed?: number }).seed ?? 0), score: r.score, finished: r.finished, parts: partsOfReveal(game, lines) });
  }
  return { row: summarise(game, level, dealt, bot, runs), runs };
}

export function ladderLine(r: LadderRow): string {
  const fell = r.dealt !== r.level ? ` (dealt ${r.dealt})` : "";
  return `${r.game.padEnd(10)} ${r.level.padEnd(7)} ${r.bot.padEnd(8)} avg ${r.average.toFixed(1).padStart(6)}  med ${String(r.median).padStart(3)}  top10 ${String(r.top10).padStart(3)}  best ${String(r.best).padStart(3)}  at200 ${(r.at200 * 100).toFixed(0).padStart(3)}%  fin ${(r.finishRate * 100).toFixed(0).padStart(3)}%  (${r.runs})${fell}`;
}
