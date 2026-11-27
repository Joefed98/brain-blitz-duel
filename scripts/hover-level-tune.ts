/**
 * Hover's D5 tuning tool (23 Nov 2026; a tool, not a check): plays the ladder players on hoverRev 12 games and keeps each
 * run's raw counts (barriers, the star chains' points, gold stars, tight gates, the centre line's credit), so the parts'
 * full lines can be set offline (scoring does not change how a player flies).
 *
 *   bun scripts/hover-level-tune.ts record <level> [--from=0] [--n=40] [--bots=average,elite,proof] [--lv=<json>] [--out=<file>]
 *       plays roomSeed(n) for n in [from, from + n) at the level (HOVER_LEVELS_V12's row, or `--lv` a whole row as JSON;
 *       `normal` is hoverRev 12's Normal), one JSON line a run.
 *   bun scripts/hover-level-tune.ts score <file…> --lines=<level>:<json> …
 *       re-scores the recorded runs on candidate lines and prints each level's average, elite, the elite's share at
 *       200 and the proof's share at 200 (on every run, and on the seeds the proof takes to 200).
 */
import { appendFileSync, readFileSync } from "node:fs";
import {
  HOVER_STD_CENTRE_SPAN,
  HOVER_V12_FIT,
  hoverCheckpoint,
  hoverFeatureTotals,
  hoverFitGame,
  hoverFitGameOf,
  hoverStandardParts,
  HOVER_CHECKPOINT_INTERVAL,
  HOVER_REV_FIT,
  type HoverFitLines,
  type HoverState,
} from "../src/lib/arcade/hover";
import { HOVER_LEVELS_V12, type HoverLvV12 } from "../src/lib/arcade/retroLevels";
import type { ArcadeGame } from "../src/lib/arcade/engine";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, HUMAN_LIMITS, type SkillLevel } from "./arcade-skill-bands/human";
import { loadBot } from "./d5-ladder-lib";
import { hoverProofTaps } from "./hover-proof-player";

export interface HoverRaw {
  level: string;
  bot: string;
  n: number;
  seed: number;
  gates: number;
  totalGates: number;
  chainsRaw: number;
  stars: number;
  totalStars: number;
  tight: number;
  tightTotal: number;
  ctrFine: number;
  acted: number;
  crashed: boolean;
  breaks: number;
  score: number;
}

/** The raw counts of a final state. */
export function rawOf(level: string, bot: string, n: number, seed: number, s: HoverState, score: number): HoverRaw {
  const rev10 = hoverStandardParts({ ...s, fit: undefined });
  return {
    level,
    bot,
    n,
    seed,
    gates: s.gates,
    totalGates: s.totalGates,
    chainsRaw: rev10.chains,
    stars: s.stars ?? 0,
    totalStars: s.totalStars ?? 0,
    tight: s.tight ?? 0,
    tightTotal: hoverFeatureTotals(s).tight,
    ctrFine: s.ctrFine ?? 0,
    acted: s.acted ? 1 : 0,
    crashed: s.crashed,
    breaks: s.shieldBreaks ?? 0,
    score,
  };
}

/** A run's score on candidate lines (hoverRev 12's rule, hoverStandardParts with a `fit`). */
export function scoreOn(r: HoverRaw, f: HoverFitLines): number {
  const line = (max: number, got: number, of: number) => (of <= 0 ? 0 : Math.floor((max * Math.max(0, Math.min(Math.trunc(got), of))) / of));
  const core = line(120, r.gates, Math.min(r.totalGates, f.coreAt));
  const chains = line(30, r.chainsRaw, f.chainsAt);
  const gold = line(20, r.stars, Math.min(r.totalStars, f.goldAt));
  const tight = line(20, r.tight, Math.min(r.tightTotal, f.tightAt));
  const centre = r.tightTotal ? line(10, r.ctrFine, Math.max(1, Math.floor((HOVER_STD_CENTRE_SPAN * r.tightTotal * f.centreAt) / 1000))) : 0;
  const sum = Math.min(200, core + chains + gold + tight + centre);
  return r.acted ? Math.max(1, sum) : 0;
}

/** Plays one bot on a game from a seed; the final state and the taps. */
export async function playHover(game: ArcadeGame<HoverState>, seed: number, bot: string): Promise<{ state: HoverState; taps: number[] }> {
  const init = game.init(seed) as HoverState;
  if (bot === "proof") return hoverProofTaps(game, init);
  const skill = bot as SkillLevel;
  const fn = await loadBot("hover");
  const out = fn({ game, seed, rev: HOVER_REV_FIT, human: new Human("hover", seed, skill, HUMAN_LIMITS), fixes: true } as never);
  const taps = new Set(out.taps ?? []);
  let s = init;
  while (!game.isOver(s) && s.tick < game.runTicks) s = game.step(s, taps.has(s.tick + 1)) as HoverState;
  return { state: s, taps: [...taps] };
}

void hoverCheckpoint;
void HOVER_CHECKPOINT_INTERVAL;

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (args[0] === "record") {
    const level = args[1] ?? "normal";
    const from = Number(opt("from") ?? 0);
    const count = Number(opt("n") ?? 40);
    const bots = (opt("bots") ?? "average,elite,proof").split(",");
    const lv = opt("lv") ? (JSON.parse(opt("lv")!) as HoverLvV12) : level === "normal" ? null : HOVER_LEVELS_V12[level as "easy"];
    const game = lv ? hoverFitGameOf(lv) : hoverFitGame;
    const fit = lv ?? HOVER_V12_FIT;
    const out = opt("out") ?? `.shots/hover-tune-${level}.jsonl`;
    for (let n = from; n < from + count; n++) {
      const seed = roomSeed(n);
      for (const bot of bots) {
        const { state } = await playHover(game, seed, bot);
        const raw = rawOf(level, bot, n, seed, state, 0);
        raw.score = scoreOn(raw, fit);
        appendFileSync(out, JSON.stringify(raw) + "\n");
      }
      if ((n - from) % 10 === 9) console.log(`${level}: ${n - from + 1} seeds`);
    }
    console.log(`→ ${out}`);
  } else if (args[0] === "score") {
    const files = args.slice(1).filter((a) => !a.startsWith("--"));
    const runs = files.flatMap((f) => readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l) as HoverRaw));
    const lines = new Map<string, HoverFitLines>();
    for (const a of args.filter((x) => x.startsWith("--lines="))) {
      const [lv, json] = [a.slice(8, a.indexOf(":")), a.slice(a.indexOf(":") + 1)];
      lines.set(lv, { ...HOVER_V12_FIT, ...(JSON.parse(json) as Partial<HoverFitLines>) });
    }
    for (const level of ["easy", "normal", "hard", "expert"]) {
      const at = runs.filter((r) => r.level === level);
      if (!at.length) continue;
      const f = lines.get(level) ?? (level === "normal" ? HOVER_V12_FIT : HOVER_LEVELS_V12[level as "easy"]);
      const proofOk = new Set(at.filter((r) => r.bot === "proof" && scoreOn(r, f) === 200).map((r) => r.seed));
      const proofSeeds = new Set(at.filter((r) => r.bot === "proof").map((r) => r.seed));
      const stat = (bot: string, only: Set<number> | null) => {
        const xs = at.filter((r) => r.bot === bot && (!only || only.has(r.seed))).map((r) => scoreOn(r, f));
        const avg = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
        return `${bot} ${avg.toFixed(1)} at200 ${((100 * xs.filter((x) => x >= 200).length) / Math.max(1, xs.length)).toFixed(0)}% (${xs.length})`;
      };
      console.log(`${level.padEnd(7)} ${JSON.stringify(f)}  proof 200 on ${proofOk.size}/${proofSeeds.size}`);
      console.log(`   all seeds:    ${stat("average", null)}   ${stat("elite", null)}`);
      console.log(`   proved seeds: ${stat("average", proofOk)}   ${stat("elite", proofOk)}`);
    }
  }
}
