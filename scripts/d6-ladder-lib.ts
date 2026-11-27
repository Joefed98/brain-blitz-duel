/**
 * D6's ladder players (the polish plan's difficulty session D6, 22 Nov 2026; docs/polish-plan-final/difficulty-spec.md
 * "Strategy, Sports and Cards & Board"): the two players Joe judges these sixteen ladders by, on real deals at every
 * level, graded by the server's own code (the dealt puzzle, the bot's encoded run, `gradeAnswer`). A script library,
 * not a check (d6-ladder-check.ts pins what it measures).
 *
 *   average  the skill-band bot's Average player (scripts/arcade-skill-bands/human.ts PROFILES.average), held to
 *            HUMAN_LIMITS (it is slower than them already; the limits only floor its move time).
 *   elite    the realistic elite: the skill-band bot's Elite player held to HUMAN_LIMITS (0.25 s to react, 0.15 s to
 *            move; reaction spread, lapses, slips, aim and timing error kept). Never a typed-out perfect run.
 *
 * Joe's ladder test (22 Nov 2026), applied by d6-ladder-check.ts to every game whose levels D6 built:
 *   - the average player steps down clearly every level (Easy > Normal > Hard > Expert), and no level is a cliff
 *     (its average is not near 0);
 *   - the elite reaches 200 strictly less often each level up, and on Expert on at least a fifth of runs.
 *
 * Deals are the room path's (`dealAt` in scripts/level-tune.ts: `generatePuzzle(type, { bankSeed, level })` under a
 * seeded Math.random), so a level the game doesn't offer is dealt as Normal and reported so.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync } from "node:fs";

import { gradeAnswer } from "../src/lib/duel/generate.server";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { GAME_BY_TYPE, type GameSpec } from "./arcade-skill-bands/games";
import { Human, HUMAN_LIMITS, type HumanLimits, type SkillLevel } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { dealAt } from "./level-tune";

/** The sixteen games D6 owns, in the spec's family order. */
export const D6_GAMES = [
  "tilt", "matchup", "bubble", "inkbridge", "balltrack",
  "homerun", "freekick", "racing", "minigolf", "pool", "curling",
  "freecell", "mahjong", "tripeaks", "fivehands", "pyramid",
] as const satisfies readonly PuzzleType[];
export type D6Game = (typeof D6_GAMES)[number];

export const LADDER_LEVELS: readonly Level[] = ["easy", "normal", "hard", "expert"];

export type LadderBot = "average" | "elite";
const SKILL: Record<LadderBot, SkillLevel> = { average: "average", elite: "elite" };

export interface LadderRun {
  n: number;
  seed: number;
  score: number;
  isCorrect: boolean;
  /** The reveal's parts as the server stored them ("Label: … → points of max"). */
  parts: RunPart[];
}

export interface RunPart {
  label: string;
  points: number;
  max: number;
  /** The line's first figure after the label (its measure: gems, seconds, takeouts…), or null. */
  raw: number | null;
}

/** The stored reveal's part lines ("Gems cleared: 381 gems → 108 of 108"), the total and penalties left out. */
export function revealParts(extra: unknown): RunPart[] {
  const lines = (extra as { reveal?: { lines?: unknown } } | null)?.reveal?.lines;
  if (!Array.isArray(lines)) return [];
  const out: RunPart[] = [];
  for (const line of lines) {
    if (typeof line !== "string") continue;
    const m = /^([^:]+):.*→\s*(-?\d+(?:\.\d+)?) of (\d+(?:\.\d+)?)\s*$/.exec(line);
    if (!m || /^total/i.test(m[1]!.trim())) continue;
    const first = /:\s*[^0-9-]*(-?\d+(?:\.\d+)?)/.exec(line);
    out.push({ label: m[1]!.trim(), points: Number(m[2]), max: Number(m[3]), raw: first ? Number(first[1]) : null });
  }
  return out;
}

export interface LadderCell {
  game: string;
  level: Level;
  /** The level the deal carried (a level the game lacks is dealt Normal). */
  dealt: Level;
  bot: LadderBot;
  runs: LadderRun[];
  average: number;
  median: number;
  /** Share of runs the server scored exactly 200. */
  at200: number;
}

const botCache = new Map<string, SkillBot>();
async function loadBot(type: string): Promise<SkillBot> {
  const hit = botCache.get(type);
  if (hit) return hit;
  const path = new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url);
  if (!existsSync(path)) throw new Error(`${type}: no skill-band bot (scripts/arcade-skill-bands/bots/${type}.ts)`);
  const bot = ((await import(path.href)) as { bot: SkillBot }).bot;
  botCache.set(type, bot);
  return bot;
}

function specOf(type: string): GameSpec {
  const spec = GAME_BY_TYPE.get(type);
  if (!spec) throw new Error(`${type}: no skill-band spec (scripts/arcade-skill-bands/games.ts)`);
  return spec;
}

/**
 * One run of `bot` on a dealt puzzle, graded by the server: the bot's log replayed through the level's game, encoded
 * as the phone sends it and graded by `gradeAnswer` on the dealt puzzle.
 */
export async function playDealt(type: string, puzzle: PuzzleData, bot: LadderBot, limits: HumanLimits | null = HUMAN_LIMITS): Promise<{ score: number; isCorrect: boolean; state: any; parts: RunPart[] }> {
  const spec = specOf(type);
  const play = await loadBot(type);
  const field = LIVE_BANDS[type as keyof typeof LIVE_BANDS]?.field;
  const loose = puzzle as unknown as Record<string, unknown>;
  const seed = Number(loose["seed"] ?? 0);
  const rev = field && typeof loose[field] === "number" ? (loose[field] as number) : null;
  const game = spec.gameForPuzzle ? spec.gameForPuzzle(puzzle) : spec.gameFor(rev, seed);
  const out = play({ game, seed, rev, human: new Human(type, seed, SKILL[bot], limits), fixes: true });
  const events = out.events ?? [];
  const taps = out.taps ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  const tapSet = new Set(taps);
  let state = game.init(seed);
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
  return { score: graded.score, isCorrect: graded.isCorrect, state, parts: revealParts(graded.extra) };
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: readonly number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};

/** Both ladder players on `count` deals of a game at a level, from sample `from`. */
export async function ladderCells(type: string, level: Level, count: number, from = 0, bots: readonly LadderBot[] = ["average", "elite"]): Promise<LadderCell[]> {
  const runs: Record<LadderBot, LadderRun[]> = { average: [], elite: [] };
  let dealt: Level = "normal";
  for (let n = from; n < from + count; n++) {
    const puzzle = dealAt(type as PuzzleType, level, n);
    dealt = puzzleLevel(puzzle);
    const seed = Number((puzzle as any).seed ?? 0);
    for (const b of bots) {
      const r = await playDealt(type, puzzle, b);
      runs[b].push({ n, seed, score: r.score, isCorrect: r.isCorrect, parts: r.parts });
    }
  }
  return bots.map((bot) => {
    const scores = runs[bot].map((r) => r.score);
    return {
      game: type,
      level,
      dealt,
      bot,
      runs: runs[bot],
      average: Math.round(mean(scores) * 10) / 10,
      median: median(scores),
      at200: runs[bot].length ? runs[bot].filter((r) => r.score >= 200).length / runs[bot].length : 0,
    };
  });
}

export interface LadderVerdict {
  ok: boolean;
  problems: string[];
}

/** An average this close to 0 is a cliff, not a level (Joe, 22 Nov 2026). */
export const CLIFF_AVERAGE = 15;
/** "Steps down clearly": each level's average at least this far under the one before. */
export const AVERAGE_STEP = 8;
/** On Expert the elite reaches 200 on at least a fifth of runs. */
export const EXPERT_AT200 = 0.2;

/** Joe's ladder test on one game's cells (easy, normal, hard, expert; every level present). */
export function ladderVerdict(cells: readonly LadderCell[]): LadderVerdict {
  const problems: string[] = [];
  const get = (level: Level, bot: LadderBot) => cells.find((c) => c.level === level && c.bot === bot);
  for (let i = 1; i < LADDER_LEVELS.length; i++) {
    const lo = LADDER_LEVELS[i - 1]!;
    const hi = LADDER_LEVELS[i]!;
    const a0 = get(lo, "average");
    const a1 = get(hi, "average");
    const e0 = get(lo, "elite");
    const e1 = get(hi, "elite");
    if (!a0 || !a1 || !e0 || !e1) {
      problems.push(`${lo} → ${hi}: a cell is missing`);
      continue;
    }
    if (a1.average > a0.average - AVERAGE_STEP) problems.push(`average ${lo} ${a0.average} → ${hi} ${a1.average}: not ${AVERAGE_STEP} lower`);
    if (!(e1.at200 < e0.at200)) problems.push(`elite at 200 ${lo} ${(e0.at200 * 100).toFixed(0)} % → ${hi} ${(e1.at200 * 100).toFixed(0)} %: not strictly fewer`);
  }
  for (const level of LADDER_LEVELS) {
    const a = get(level, "average");
    if (a && a.average < CLIFF_AVERAGE) problems.push(`average ${level} ${a.average}: a cliff (under ${CLIFF_AVERAGE})`);
  }
  const ex = get("expert", "elite");
  if (ex && ex.at200 < EXPERT_AT200) problems.push(`elite at 200 on Expert ${(ex.at200 * 100).toFixed(0)} %: under ${EXPERT_AT200 * 100} %`);
  return { ok: problems.length === 0, problems };
}

/** Each part's average share of its maximum and how often it was full, over a cell's runs. */
export function partsLine(c: LadderCell): string {
  const by = new Map<string, { max: number; sum: number; full: number; n: number }>();
  for (const r of c.runs)
    for (const p of r.parts) {
      const e = by.get(p.label) ?? { max: p.max, sum: 0, full: 0, n: 0 };
      e.sum += p.points;
      e.full += p.points >= p.max ? 1 : 0;
      e.n += 1;
      by.set(p.label, e);
    }
  return [...by].map(([label, e]) => `${label} ${(e.sum / e.n).toFixed(0)}/${e.max} full ${Math.round((100 * e.full) / e.n)}%`).join(" · ");
}

export function cellLine(c: LadderCell): string {
  const fell = c.dealt !== c.level ? ` (dealt ${c.dealt})` : "";
  return `${c.game.padEnd(10)} ${c.level.padEnd(7)} ${c.bot.padEnd(8)} avg ${c.average.toFixed(1).padStart(6)}  median ${String(c.median).padStart(3)}  at 200 ${(c.at200 * 100).toFixed(0).padStart(3)} %  (${c.runs.length} runs)${fell}`;
}
