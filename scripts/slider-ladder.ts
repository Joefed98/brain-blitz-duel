/**
 * Slider's ladder measured (D1, 21 Nov 2026; Joe's decision of 21 Nov): the size-aware person-like solvers
 * (scripts/slider-human.ts, strong and elite; they never read the words) and the puzzle-fairness kits, on real deals at
 * each level (level-tune's dealAt), every run graded by the server. A tool, not a check.
 *
 *   bun scripts/slider-ladder.ts [--level=easy|normal|hard|expert] [--boards=24] [--part=k/n] [--json=out.json]
 *   bun scripts/slider-ladder.ts --merge=a.json,b.json,…      the table from parts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { LEVELS, type Level } from "../src/lib/levels/levels";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { WordSlidePuzzleData } from "../src/lib/duel/types";
import { dealAt } from "./level-tune";
import { sliderHumanScore, SLIDER_HUMANS } from "./slider-human";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import { KIT_ELITE, limitSteps } from "./word-human";

export interface LadderRun {
  level: Level;
  n: number;
  who: string;
  score: number;
  finished: boolean;
}

export function ladderRuns(level: Level, ns: readonly number[]): LadderRun[] {
  const out: LadderRun[] = [];
  for (const n of ns) {
    const p = dealAt("wordslide", level, n) as WordSlidePuzzleData;
    for (const who of ["strong", "elite"] as const) {
      const r = sliderHumanScore(p, SLIDER_HUMANS[who], 1);
      out.push({ level, n, who, score: r.score, finished: r.finished });
    }
    const limit = puzzleTimeLimitMs(p);
    for (const k of ["average", "good", "near", "elite"] as const) {
      const play = KITS.wordslide!.play(p, makeRng(hashText(`level-tune:wordslide:${level}:${n}:${k}`)), k === "elite" ? KIT_ELITE : SKILLS[k], limit);
      const steps = k === "elite" ? limitSteps(play.steps, () => 1) : play.steps;
      const g = gradeSteps(p, asPhoneSends(p, steps), play.timed);
      out.push({ level, n, who: `kit-${k}`, score: g.score, finished: g.isCorrect });
    }
  }
  return out;
}

export function ladderTable(runs: readonly LadderRun[]): string {
  const who = ["strong", "elite", "kit-average", "kit-good", "kit-near", "kit-elite"];
  const lines = ["| Level | " + who.join(" | ") + " |", "|---|" + who.map(() => "---|").join("")];
  for (const level of LEVELS) {
    const cells = who.map((w) => {
      const rs = runs.filter((r) => r.level === level && r.who === w);
      if (!rs.length) return "–";
      const mean = rs.reduce((s, r) => s + r.score, 0) / rs.length;
      return `${mean.toFixed(1)} (${rs.filter((r) => r.finished).length}/${rs.length})`;
    });
    lines.push(`| ${level} | ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const merge = opt("merge");
  if (merge) {
    const runs = merge.split(",").flatMap((path) => JSON.parse(readFileSync(path, "utf8")) as LadderRun[]);
    console.log(ladderTable(runs));
    process.exit(0);
  }
  const levels = (opt("level") ? [opt("level")] : LEVELS) as Level[];
  const boards = Number(opt("boards") ?? 24);
  const [k, parts] = (opt("part") ?? "1/1").split("/").map(Number) as [number, number];
  const ns = Array.from({ length: boards }, (_, i) => i).filter((i) => i % parts === k - 1);
  const runs = levels.flatMap((level) => ladderRuns(level, ns));
  const json = opt("json");
  if (json) writeFileSync(json, JSON.stringify(runs));
  console.log(ladderTable(runs));
}
