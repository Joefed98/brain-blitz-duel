/**
 * Rainbow Bridge's levels (the Strategy overhaul's stage 3): the skill-band bot at every skill on each level's world,
 * every run scored through the server replay of that level (a tool, not a check; docs/arcade-standard/inkbridge.md
 * "Levels (stage 3)").
 *
 *   bun scripts/ink-levels-bands.ts [normal,easy,hard,expert] [--seeds=20] [--skills=weak,average,good,great,near,elite]
 *                                    [--candidates] [--human]
 *
 * Seeds are each level's dealt list (Normal: INK_HILLS_DEAL), or with --candidates the first N of ink-big-deal.ts's
 * candidate sequence. --human adds "elite (human limits)": the elite profile with reactions held at 250 ms (± 25) and the
 * finger's move to the screen at least 150 ms, the floor Joe set for a human (15 Nov 2026).
 * Per skill: the average, the median, the share at 175+ (a Classic star) and the runs at 200.
 */
import { readFileSync } from "node:fs";
import { inkBridgeGameFor, inkCheckpoint, INK_CHECKPOINT_INTERVAL, INK_REV_HILLS, type InkDiff, type InkState } from "../src/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { INK_HILLS_DEAL } from "../src/lib/duel/inkHillsDeal.server";
import { bot } from "./arcade-skill-bands/bots/inkbridge";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { inkBigCandidate } from "./ink-big-deal";

type Lv = "normal" | InkDiff;

/** A level's dealt seeds (read from its deal file, so the tool never imports a server module it doesn't need). */
export function inkLevelDeal(level: Lv): number[] {
  if (level === "normal") return [...INK_HILLS_DEAL];
  const cap = level[0]!.toUpperCase() + level.slice(1);
  const text = readFileSync(new URL(`../src/lib/duel/inkHillsDeal${cap}.server.ts`, import.meta.url), "utf8");
  const body = text.slice(text.indexOf("= [") + 2);
  return JSON.parse(body.slice(0, body.indexOf("]") + 1)) as number[];
}

/** One bot run at a level, scored by the server replay of the level. */
export function inkLevelRun(level: Lv, seed: number, skill: SkillLevel, humanLimits = false): { score: number; levels: number } {
  const diff = level === "normal" ? null : level;
  const game = inkBridgeGameFor(INK_REV_HILLS, diff);
  const human = new Human("inkbridge", seed, skill);
  if (humanLimits) Object.defineProperty(human, "p", { value: { ...human.p, reactionMs: [250, 25], trackLagMs: Math.max(150, human.p.trackLagMs) } });
  const out = bot({ game, seed, rev: INK_REV_HILLS, human, fixes: true });
  const byT = new Map((out.events ?? []).map((e) => [e.t, e]));
  let s = game.init(seed) as InkState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byT.get(s.tick + 1) ?? null) as InkState;
    if (s.tick % INK_CHECKPOINT_INTERVAL === 0) checkpoints.push(inkCheckpoint(s));
  }
  const raw = encodeInkBridgeRun({ seed, claimedScore: game.score(s), events: out.events ?? [], inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const r = replayInkBridgeRun(seed, raw, INK_REV_HILLS, diff);
  return { score: r.score, levels: r.levels };
}

export interface BandRow { level: Lv; skill: string; runs: number; average: number; median: number; star: number; at200: number; scores: number[] }

export function inkLevelBands(level: Lv, seeds: readonly number[], skills: readonly SkillLevel[], human = false): BandRow[] {
  const rows: BandRow[] = [];
  const kinds: [string, SkillLevel, boolean][] = skills.map((k) => [k, k, false]);
  if (human) kinds.push(["elite (human limits)", "elite", true]);
  for (const [name, skill, limits] of kinds) {
    const scores = seeds.map((seed) => inkLevelRun(level, seed, skill, limits).score);
    const sorted = [...scores].sort((a, b) => a - b);
    rows.push({ level, skill: name, runs: scores.length, average: Math.round((scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)) * 10) / 10, median: sorted[Math.floor((sorted.length - 1) / 2)] ?? 0, star: scores.filter((x) => x >= 175).length, at200: scores.filter((x) => x >= 200).length, scores });
  }
  return rows;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const levels = (args.find((a) => !a.startsWith("--")) ?? "normal,easy,hard,expert").split(",") as Lv[];
  const n = Number(opt("seeds") ?? 20);
  const skills = (opt("skills") ?? "weak,average,good,great,near,elite").split(",") as SkillLevel[];
  for (const level of levels) {
    const seeds = args.includes("--candidates") ? Array.from({ length: n }, (_, i) => inkBigCandidate(i)) : inkLevelDeal(level).slice(0, n);
    for (const r of inkLevelBands(level, seeds, skills, args.includes("--human"))) console.log(`${r.level.padEnd(7)} ${r.skill.padEnd(21)} avg ${r.average.toFixed(1).padStart(6)}  median ${String(r.median).padStart(3)}  175+ ${r.star}/${r.runs}  200 ${r.at200}/${r.runs}  [${r.scores.join(" ")}]`);
  }
}
