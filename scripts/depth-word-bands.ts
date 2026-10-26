/**
 * Word depth bands (25 Oct 2026, depth session d1; docs/depth/d1-word.md). A report, not a check.
 *
 * Plays the puzzle-fairness kit players (scripts/puzzle-fairness/kits-word.ts) on room seeds through the real
 * server grader, once on the stamps rooms dealt before the depth change (pinPreDepth) and once on the depth
 * stamps, and prints each skill level's median, top 10 % and best, old beside new. Levels: the kit's average,
 * good, great and near-perfect players plus an "elite" player (twice a good player's pace, no mistakes).
 *
 *   bun scripts/depth-word-bands.ts                       # all nine games, 30 seeds
 *   bun scripts/depth-word-bands.ts --game=tilegrid,codeword --seeds=60
 *   bun scripts/depth-word-bands.ts --json=<path>         # the rows as JSON too
 *
 * Script-only: floats and Math are fine.
 */
import { writeFileSync } from "node:fs";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPreDepth, WORD_DEPTH_GAMES } from "../src/lib/duel/wordDepth";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { SKILLS, hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 30);
const GAMES = (opt("game")?.split(",").filter(Boolean) as PuzzleType[] | undefined) ?? [...WORD_DEPTH_GAMES];
const JSON_OUT = opt("json");

/** The elite player: twice a good player's speed, no mistakes. */
export const ELITE: Skill = { level: "near", pace: 0.35, err: 0, reactionMs: 140, reactionSd: 15 };
export const DEPTH_LEVELS: { id: string; label: string; skill: Skill }[] = [
  { id: "average", label: "Average", skill: SKILLS.average },
  { id: "good", label: "Good", skill: SKILLS.good },
  { id: "great", label: "Great", skill: SKILLS.great },
  { id: "near", label: "Near-perfect", skill: SKILLS.near },
  { id: "elite", label: "Elite", skill: ELITE },
];

/** One kit play graded as runPlay does: submitted the moment it finishes, else the last draft at the buzzer. */
export function playScore(type: PuzzleType, puzzle: PuzzleData, seed: number, levelId: string, skill: Skill): number {
  const kit = KITS[type];
  if (!kit) throw new Error(`no kit for ${type}`);
  const limit = puzzleTimeLimitMs(puzzle);
  const rng = makeRng(hashText(`${type}:play:${seed}:${levelId}`));
  const play = kit.play(puzzle, rng, skill, limit);
  const inTime = play.steps.filter((s) => s.atMs <= limit);
  if (inTime.length === 0) return gradeAnswer(puzzle, kit.nothing(puzzle), 0).score;
  if (play.timed) {
    const last = inTime[inTime.length - 1]!;
    const done = gradeAnswer(puzzle, last.answer, Math.max(0, limit - last.atMs));
    return done.isCorrect ? done.score : gradeAnswer(puzzle, last.answer, 0).score;
  }
  for (const step of inTime) {
    const g = gradeAnswer(puzzle, step.answer, Math.max(0, limit - step.atMs));
    if (g.isCorrect) return g.score;
  }
  return gradeAnswer(puzzle, inTime[inTime.length - 1]!.answer, 0).score;
}

export interface Dist {
  median: number;
  top10: number;
  best: number;
  mean: number;
}

export function dist(scores: number[]): Dist {
  const s = [...scores].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))] ?? 0;
  return { median: at(0.5), top10: at(0.9), best: s[s.length - 1] ?? 0, mean: Math.round(s.reduce((a, b) => a + b, 0) / Math.max(1, s.length)) };
}

export interface GameBands {
  type: PuzzleType;
  levels: { id: string; label: string; old: Dist; now: Dist }[];
  all: { old: Dist; now: Dist };
}

export function measureGame(type: PuzzleType, seeds: number): GameBands {
  const levels = DEPTH_LEVELS.map((l) => ({ ...l, old: [] as number[], now: [] as number[] }));
  for (let s = 1; s <= seeds; s++) {
    const seed = 7100 + s;
    pinPreDepth(true);
    let old: PuzzleData;
    try {
      old = roomPuzzle(type, seed);
    } finally {
      pinPreDepth(false);
    }
    const now = roomPuzzle(type, seed);
    for (const l of levels) {
      l.old.push(playScore(type, old, seed, l.id, l.skill));
      l.now.push(playScore(type, now, seed, l.id, l.skill));
    }
  }
  return {
    type,
    levels: levels.map((l) => ({ id: l.id, label: l.label, old: dist(l.old), now: dist(l.now) })),
    all: { old: dist(levels.flatMap((l) => l.old)), now: dist(levels.flatMap((l) => l.now)) },
  };
}

export function bandsTable(g: GameBands): string {
  const cell = (d: Dist) => `${d.median} / ${d.top10} / ${d.best}`;
  const rows = g.levels.map((l) => `| ${l.label} | ${cell(l.old)} | ${cell(l.now)} | ${signed(l.now.median - l.old.median)} (${pct(l.now.median, l.old.median)}) |`);
  return [
    `**${gameDisplayName(g.type)}** (median / top 10 % / best)`,
    "",
    "| Player | Before (max 150) | Now (max 200) | Median change |",
    "| --- | --- | --- | --- |",
    ...rows,
    `| All levels | ${cell(g.all.old)} | ${cell(g.all.now)} | ${signed(g.all.now.median - g.all.old.median)} |`,
  ].join("\n");
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function pct(now: number, old: number): string {
  if (old <= 0) return now > 0 ? "new" : "0 %";
  const p = Math.round(((now - old) / old) * 100);
  return `${p > 0 ? "+" : ""}${p} %`;
}

if (import.meta.main) {
  const out: GameBands[] = [];
  for (const type of GAMES) {
    const t0 = Date.now();
    const g = measureGame(type, SEEDS);
    out.push(g);
    console.log(`${bandsTable(g)}\n\n(${SEEDS} seeds, ${Math.round((Date.now() - t0) / 1000)} s)\n`);
  }
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
}
