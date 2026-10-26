/**
 * Puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md): one report for every puzzle the 200-point depth
 * batches raised, measured with each batch's own simulated players (so the figures are the batch reports'), on
 * the batch's tuning seeds and on fresh seeds the tuning never saw. A report, not a check.
 *
 *   bun scripts/depth-topup-bands.ts [types…] [--fresh=40] [--tuning] [--json=<file>] [--old]
 *
 * --old deals the puzzle each game dealt before the top-up (`pinPreTopup`), for the before → after table.
 * Per level (average, good, great, near-perfect, elite): median and top 10 %; zero-score counts for average and
 * good; random play (each kit's spam answers) median and top 10 %. Script-only: floats are fine.
 */
import { writeFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { pinPreTopup } from "../src/lib/duel/depthTopup";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { SKILLS, hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { DEPTH_LEVELS as SPEED_LEVELS, playAnswer } from "./depth-speed-lib";
import { TABLE_SKILLS } from "./depth-attention-lib";
import { playToAnswer } from "./depth-attention-record";
import { ELITE as CHAIN_ELITE, gradePlay } from "./depth/chain-pair-bots";
import { ELITE as ENGINE_ELITE } from "./depth-engine-bands";
import { DEPTH_LEVELS as WORD_LEVELS, playScore as wordPlayScore } from "./depth-word-bands";
import { ELITE as LOGIC_ELITE } from "./depth-d6-bands";
import { runLevel, type D4Level } from "./depth4/players";

export const LEVEL_IDS = ["average", "good", "great", "near", "elite"] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

type Group = "speed" | "chain" | "attention" | "stroop" | "clay" | "word" | "logic" | "d4";

export const TOPUP_GAMES: Record<string, Group> = {
  reaction: "speed",
  chain: "chain",
  stroop: "stroop",
  symscan: "attention",
  countup: "attention",
  stopwatch: "speed",
  clayshoot: "clay",
  wordsmith: "word",
  tilegrid: "word",
  wordslide: "word",
  wordhunt: "word",
  wordsearch: "word",
  strikeout: "word",
  codeword: "word",
  swapword: "word",
  letterwheel: "word",
  safe: "logic",
  sudoku: "logic",
  flood: "logic",
  shikaku: "logic",
  blockparty: "d4",
  flow: "d4",
  pipes: "d4",
  laser: "d4",
  rings: "d4",
  push: "d4",
};

/** Stretch-only games (the bar's near-perfect band 150–165); every other game is a feature game (165–175). */
export const STRETCH_ONLY = new Set<string>(["tilegrid", "codeword", "symscan", "countup", "sudoku", "bomb", "flood", "nonogram", "tents", "shikaku", "lightup", "blockparty", "flow", "balance", "equation", "pyramid", "trail"]);

/** Each batch's own tuning seeds (as its report or check used them). */
export function tuningSeeds(type: PuzzleType): number[] {
  switch (TOPUP_GAMES[type]) {
    case "speed":
      return Array.from({ length: 80 }, (_, n) => 7301 + n * 13);
    case "chain":
      return Array.from({ length: 40 }, (_, s) => 11_000 + s);
    case "attention":
      return Array.from({ length: 40 }, (_, i) => 71_000 + i * 31);
    case "stroop":
      return Array.from({ length: 60 }, (_, n) => 5000 + n * 17);
    case "clay":
      return Array.from({ length: 40 }, (_, k) => 0x7a11 + k * 104729);
    case "word":
      return Array.from({ length: 40 }, (_, s) => 7101 + s);
    case "logic":
      return Array.from({ length: 12 }, (_, s) => 50_007 + s * 7);
    default:
      return Array.from({ length: 40 }, (_, s) => 7013 + s * 13);
  }
}

/** Seeds no batch tuned on. */
export function freshSeeds(n: number): number[] {
  return Array.from({ length: n }, (_, k) => 913_337 + k * 7919);
}

function engineSkill(level: LevelId): Skill {
  return level === "elite" ? ENGINE_ELITE : SKILLS[level];
}

function deal(type: PuzzleType, seed: number, old: boolean): PuzzleData {
  const prev = pinPreTopup(old);
  try {
    const group = TOPUP_GAMES[type];
    if (group === "clay") {
      // Pull! is an engine game: its puzzle is the seed and the dealt revision (as depth-engine-bands builds it).
      const p = roomPuzzle(type, 1) as unknown as { clayRev: number };
      return { type, seed, clayRev: p.clayRev } as unknown as PuzzleData;
    }
    if (group === "logic" || group === "d4") return withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed }));
    return roomPuzzle(type, seed);
  } finally {
    pinPreTopup(prev);
  }
}

/** One player's score: the batch's own player model at `level` on `puzzle`. */
export function levelScore(type: PuzzleType, puzzle: PuzzleData, seed: number, level: LevelId): number {
  const kit = KITS[type]!;
  const limit = puzzleTimeLimitMs(puzzle);
  switch (TOPUP_GAMES[type]) {
    case "speed":
      return gradeAnswer(puzzle, playAnswer(type, puzzle, level, seed), 0).score;
    case "chain": {
      const skill = level === "elite" ? CHAIN_ELITE : SKILLS[level];
      return gradePlay(puzzle, kit.play(puzzle, makeRng(hashText(`depth:${type}:${seed}:${level === "near" ? "near-perfect" : level}`)), skill, limit)).score;
    }
    case "attention": {
      const skill = TABLE_SKILLS.find((s) => s.label === level)!.skill;
      const a = playToAnswer(type, puzzle, seed, `table:${level}`, skill);
      return gradeAnswer(puzzle, a.answer, a.ms).score;
    }
    case "stroop": {
      const skill = level === "elite" ? { level: "near" as Skill["level"], pace: 0.3, err: 0.003, reactionMs: 140, reactionSd: 15 } : SKILLS[level];
      return quiet(() => gradeAnswer(puzzle, kit.play(puzzle, makeRng(hashText(`depth-ms:${seed}:${level}`)), skill, limit).steps.at(-1)!.answer, 0)).score;
    }
    case "clay": {
      const play = kit.play(puzzle, makeRng(hashText(`${type}:depth:${seed}:${level}`)), engineSkill(level), 60_000);
      return quiet(() => gradeAnswer(puzzle, play.steps.at(-1)!.answer, 0)).score;
    }
    case "word":
      return wordPlayScore(type, puzzle, seed, level, WORD_LEVELS.find((l) => l.id === level)!.skill);
    case "logic": {
      const skill = level === "elite" ? LOGIC_ELITE : SKILLS[level];
      const play = kit.play(puzzle, makeRng(hashText(`${type}:${seed}:${level}`)), skill, limit);
      const inTime = play.steps.filter((s) => s.atMs <= limit);
      if (!inTime.length) return gradeAnswer(puzzle, kit.nothing(puzzle), 0).score;
      for (const step of inTime) {
        const g = gradeAnswer(puzzle, step.answer, Math.max(0, limit - step.atMs));
        if (g.isCorrect) return g.score;
      }
      return gradeAnswer(puzzle, inTime[inTime.length - 1]!.answer, 0).score;
    }
    default:
      return runLevel(type, puzzle, seed, level as D4Level).score;
  }
}

function quiet<T>(f: () => T): T {
  const e = console.error;
  const w = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    return f();
  } finally {
    console.error = e;
    console.warn = w;
  }
}

export const q = (xs: number[], f: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(f * s.length))] ?? 0;
};

export interface LevelDist {
  median: number;
  top10: number;
  zeros: number;
  n: number;
}

export interface GameMeasure {
  type: PuzzleType;
  levels: Record<LevelId, LevelDist>;
  random: { median: number; top10: number };
}

export function measure(type: PuzzleType, seeds: number[], old = false): GameMeasure {
  const scores: Record<LevelId, number[]> = { average: [], good: [], great: [], near: [], elite: [] };
  const spam: number[] = [];
  for (const seed of seeds) {
    const puzzle = deal(type, seed, old);
    for (const level of LEVEL_IDS) scores[level].push(levelScore(type, puzzle, seed, level));
    const kit = KITS[type]!;
    for (const s of kit.spam(puzzle, makeRng(hashText(`${type}:topup-spam:${seed}`)), puzzleTimeLimitMs(puzzle))) spam.push(quiet(() => gradeAnswer(puzzle, s.answer, 0)).score);
  }
  const levels = Object.fromEntries(LEVEL_IDS.map((l) => [l, { median: q(scores[l], 0.5), top10: q(scores[l], 0.9), zeros: scores[l].filter((x) => x === 0).length, n: scores[l].length }])) as Record<LevelId, LevelDist>;
  return { type, levels, random: { median: q(spam, 0.5), top10: q(spam, 0.9) } };
}

/** The bar (the top-up brief): which parts a measure misses. */
export function barMisses(m: GameMeasure, before?: GameMeasure): string[] {
  const out: string[] = [];
  const near = m.levels.near;
  const elite = m.levels.elite;
  const [lo, hi] = STRETCH_ONLY.has(m.type) ? [150, 165] : [165, 175];
  if (near.median < lo - 1 || near.median > hi + 1) out.push(`near median ${near.median} outside ${lo}–${hi}`);
  if (near.top10 > 187) out.push(`near top 10 % ${near.top10} > 185`);
  if (elite.median < 172) out.push(`elite median ${elite.median} < 175`);
  if (elite.top10 < 188) out.push(`elite top 10 % ${elite.top10} < 190`);
  if (m.levels.average.zeros + m.levels.good.zeros > 0) out.push(`zeros: average ${m.levels.average.zeros}, good ${m.levels.good.zeros}`);
  if (before) {
    const g0 = before.levels.good.median;
    const g1 = m.levels.good.median;
    if (Math.abs(g1 - g0) > Math.max(3, 0.1 * g0)) out.push(`good median ${g0} → ${g1} (over 10 %)`);
  }
  return out;
}

export function row(m: GameMeasure): string {
  const l = m.levels;
  const c = (d: LevelDist) => `${d.median} / ${d.top10}`;
  return `| ${gameDisplayName(m.type)} | ${c(l.average)} | ${c(l.good)} | ${c(l.great)} | ${c(l.near)} | ${c(l.elite)} | ${l.average.zeros} / ${l.good.zeros} | ${m.random.median} / ${m.random.top10} |`;
}

export const HEADER = "| Game | Average | Good | Great | Near-perfect | Elite | Zeros (avg / good) | Random |\n| --- | --- | --- | --- | --- | --- | --- | --- |";

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const only = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
  const types = (only.length ? only : (Object.keys(TOPUP_GAMES) as PuzzleType[])).filter((t) => TOPUP_GAMES[t]);
  const fresh = freshSeeds(Number(opt("fresh") ?? 40));
  const old = args.includes("--old");
  const out: Record<string, { tuning?: GameMeasure; fresh: GameMeasure }> = {};
  console.log(HEADER);
  for (const type of types) {
    const t0 = Date.now();
    const f = measure(type, fresh, old);
    const t = args.includes("--tuning") ? measure(type, tuningSeeds(type), old) : undefined;
    out[type] = { fresh: f, ...(t ? { tuning: t } : {}) };
    if (t) console.log(row(t).replace("| ", "| (tuning) "));
    console.log(`${row(f)}  ${barMisses(f).join("; ") || "PASSES"} (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  const json = opt("json");
  if (json) writeFileSync(json, JSON.stringify(out, null, 1));
}
