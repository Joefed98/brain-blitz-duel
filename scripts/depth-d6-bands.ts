/**
 * Logic depth to 200 (25 Oct 2026, docs/depth/d6-logic.md): old versus new score distributions for the eleven
 * Logic games, and the fit of each stretch game's `elite` share (logicDepth.ts).
 *
 * Plays the puzzle-fairness kits (scripts/puzzle-fairness/kits-logic.ts) on room seeds through the real server
 * grader, twice per player: on the board rooms dealt before (the depth stamp off; the old board for the four
 * bigger-board games) and on the board rooms deal now (depthRev 1). Players:
 *   - the kit levels (average, good, great, near-perfect) and an "elite" level (pace 0.35, no mistakes);
 *   - a population of 40 players per seed (pace log-normal around a good player's, mistakes rising with pace),
 *     reported as median, top 10 % and best.
 *
 *   bun scripts/depth-d6-bands.ts [games…] [--seeds=12] [--json=<file>] [--markdown]
 *
 * A report, not a check (depth-d6-check proves the rules). Script-only: floats are fine.
 */
import { writeFileSync } from "node:fs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { DEPTH_TYPES } from "../src/lib/duel/logicDepth";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { legacyDepthPuzzle } from "./depth-d6-legacy";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { SKILLS, hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 12);
const POP = Number(opt("pop") ?? 40);
const games = (args.filter((a) => !a.startsWith("--")) as PuzzleType[]).filter((g) => DEPTH_TYPES.includes(g));
const GAMES = games.length ? games : DEPTH_TYPES;

export const ELITE: Skill = { level: "near", pace: 0.35, err: 0, reactionMs: 150, reactionSd: 15 };

function playScore(puzzle: PuzzleData, type: PuzzleType, key: string, skill: Skill): number {
  const kit = KITS[type]!;
  const limit = puzzleTimeLimitMs(puzzle);
  const rng = makeRng(hashText(key));
  const play = kit.play(puzzle, rng, skill, limit);
  const inTime = play.steps.filter((s) => s.atMs <= limit);
  if (!inTime.length) return gradeAnswer(puzzle, kit.nothing(puzzle), 0).score;
  for (const step of inTime) {
    const g = gradeAnswer(puzzle, step.answer, Math.max(0, limit - step.atMs));
    if (g.isCorrect) return g.score;
  }
  return gradeAnswer(puzzle, inTime[inTime.length - 1]!.answer, 0).score;
}

function populationSkill(rng: ReturnType<typeof makeRng>): Skill {
  const pace = Math.min(2.6, Math.max(0.33, Math.exp(rng.normal(0, 0.38))));
  const err = Math.min(0.3, Math.max(0, 0.1 * Math.pow(pace, 1.4) + rng.normal(0, 0.015)));
  return { level: "good", pace, err, reactionMs: 230, reactionSd: 40 };
}

const pct = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]! : 0;
};
const median = (xs: number[]) => pct(xs, 0.5);

export interface GameBands {
  type: PuzzleType;
  levels: Record<string, { old: number; now: number }>;
  population: { old: { median: number; top10: number; best: number }; now: { median: number; top10: number; best: number } };
  /** Old score 150 runs (today's top): their new scores. */
  was150: { n: number; median: number; max: number };
  /** Good-level runs: new ÷ old median. */
  solidRatio: number;
}

export function measureGame(type: PuzzleType, seeds = SEEDS, pop = POP): GameBands {
  const levels: Record<string, { old: number[]; now: number[] }> = {};
  const popOld: number[] = [];
  const popNow: number[] = [];
  const was150: number[] = [];
  const skills: [string, Skill][] = [["average", SKILLS.average], ["good", SKILLS.good], ["great", SKILLS.great], ["near", SKILLS.near], ["elite", ELITE]];
  for (let s = 1; s <= seeds; s++) {
    const seed = 50_000 + s * 7;
    const now = withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed }));
    const old = legacyDepthPuzzle(type, seed);
    for (const [name, skill] of skills) {
      const l = (levels[name] ??= { old: [], now: [] });
      l.old.push(playScore(old, type, `${type}:${seed}:${name}`, skill));
      l.now.push(playScore(now, type, `${type}:${seed}:${name}`, skill));
    }
    const rng = makeRng(hashText(`${type}:pop:${seed}`));
    for (let i = 0; i < pop; i++) {
      const skill = populationSkill(rng);
      const a = playScore(old, type, `${type}:${seed}:p${i}`, skill);
      const b = playScore(now, type, `${type}:${seed}:p${i}`, skill);
      popOld.push(a);
      popNow.push(b);
      if (a >= 150) was150.push(b);
    }
  }
  const sum = (xs: number[]) => ({ median: median(xs), top10: pct(xs, 0.9), best: Math.max(...xs) });
  const lv = Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, { old: median(v.old), now: median(v.now) }]));
  return {
    type,
    levels: lv,
    population: { old: sum(popOld), now: sum(popNow) },
    was150: { n: was150.length, median: median(was150), max: was150.length ? Math.max(...was150) : 0 },
    solidRatio: lv["good"]!.old > 0 ? lv["good"]!.now / lv["good"]!.old : 1,
  };
}

/** Time left shares (0–1) of the clean finishes a level makes (the stretch fit). */
function leftShares(type: PuzzleType, skill: Skill, name: string, seeds: number): number[] {
  const out: number[] = [];
  for (let s = 1; s <= seeds; s++) {
    const seed = 50_000 + s * 7;
    const puzzle = args.includes("--legacy") ? legacyDepthPuzzle(type, seed) : withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed }));
    const kit = KITS[type]!;
    const limit = puzzleTimeLimitMs(puzzle);
    for (let k = 0; k < 4; k++) {
      const play = kit.play(puzzle, makeRng(hashText(`${type}:${seed}:${name}:${k}`)), skill, limit);
      for (const step of play.steps.filter((x) => x.atMs <= limit)) {
        const g = gradeAnswer(puzzle, step.answer, Math.max(0, limit - step.atMs));
        if (g.isCorrect) {
          if (((g.extra?.["efficiency"] as number | undefined) ?? 1) >= 0.999) out.push(1 - step.atMs / limit);
          break;
        }
      }
    }
  }
  return out;
}

if (import.meta.main && args.includes("--fit")) {
  for (const type of GAMES) {
    const near = leftShares(type, SKILLS.near, "near", SEEDS);
    const elite = leftShares(type, ELITE, "elite", SEEDS);
    console.log(`${type}: near clean left median ${median(near).toFixed(3)} p25 ${pct(near, 0.25).toFixed(3)} p75 ${pct(near, 0.75).toFixed(3)} (${near.length}) | elite median ${median(elite).toFixed(3)} p25 ${pct(elite, 0.25).toFixed(3)} (${elite.length})`);
  }
  process.exit(0);
}

if (import.meta.main) {
  const out: GameBands[] = [];
  const rows: string[] = [
    "| Game | Good old → new | Great | Near-perfect | Elite | Population median | Top 10 % | Best | Old 150s now (median, max) |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const type of GAMES) {
    const b = measureGame(type);
    out.push(b);
    const f = (k: string) => `${b.levels[k]!.old} → ${b.levels[k]!.now}`;
    const p = b.population;
    rows.push(
      `| ${gameDisplayName(type)} | ${f("good")} | ${f("great")} | ${f("near")} | ${f("elite")} | ${p.old.median} → ${p.now.median} | ${p.old.top10} → ${p.now.top10} | ${p.old.best} → ${p.now.best} | ${b.was150.n ? `${b.was150.median}, ${b.was150.max} (${b.was150.n})` : "none"} |`,
    );
    console.log(rows[rows.length - 1]);
  }
  if (args.includes("--markdown")) console.log(`\n${rows.join("\n")}`);
  const json = opt("json");
  if (json) writeFileSync(json, `${JSON.stringify(out, null, 2)}\n`);
}
