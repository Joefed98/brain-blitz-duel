/**
 * Gemstone matchupRev 13 (two-hit ice and levels, docs/arcade-standard/matchup.md "matchupRev 13"): the skill-band bots
 * on every level, every run scored by the server's replay (`replayMatchupRun` with the level, what `gradeAnswer` calls),
 * reporting each skill's average and median, the parts' medians, and the share of runs at 175+ (a star) and at 200.
 * A tool, not a check.
 *
 *   bun scripts/gemstone-levels-bands.ts [--seeds=60] [--from=0] [--levels=easy,normal,hard,expert] [--skills=…]
 *                                        [--limits] [--json]
 *
 * --limits plays the elite level under Joe's human limits (15 Nov 2026: about 0.25 s to react, 0.15 s to move): the
 * shared elite profile with its reaction mean raised to 250 ms (the bot's swipe is already 140 ms). Seeds are the
 * skill-band tool's room seeds (`roomSeed(n)`), so the numbers reproduce.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/matchup";
import { replayMatchupRun } from "../src/lib/duel/matchup";
import { matchupGameFor, matchupGoalsMet, matchupStdParts, MATCHUP_REV_ICE2, type MatchupState } from "../src/lib/arcade/matchup";

export const GEMSTONE_LEVELS = ["easy", "normal", "hard", "expert"] as const;
export type GemLevel = (typeof GEMSTONE_LEVELS)[number];

/** The elite level under Joe's human limits: reactions about 0.25 s (the swipe stays 140 ms, under 0.15 s). */
export function limitHuman(human: Human): Human {
  const h = human as any;
  h.p = { ...h.p, reactionMs: [250, 25] };
  return human;
}

export interface GemRun {
  seed: number;
  score: number;
  flagged: boolean;
  parts: ReturnType<typeof matchupStdParts>;
  gems: number;
  treasures: number;
  goals: number;
  ice: number;
  big: number;
  raw: string;
}

/** One bot run at a level, encoded as the phone sends it and scored by the server's replay. */
export function playLevel(level: GemLevel, skill: SkillLevel, seed: number, limits = false): GemRun {
  const spec: any = GAME_BY_TYPE.get("matchup" as never)!;
  const game = matchupGameFor(MATCHUP_REV_ICE2, level);
  const human = new Human("matchup", seed, skill);
  if (limits && skill === "elite") limitHuman(human);
  const res = bot({ game, seed, rev: MATCHUP_REV_ICE2, human, fixes: true });
  let state = game.init(seed) as MatchupState;
  const checkpoints: unknown[] = [];
  const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null) as MatchupState;
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints }, MATCHUP_REV_ICE2, seed);
  const run = replayMatchupRun(seed, raw, MATCHUP_REV_ICE2, level);
  const s = run.state;
  return {
    seed,
    score: run.score,
    flagged: run.flagged || run.score !== claimed,
    parts: matchupStdParts(s),
    gems: s.gemsCleared ?? 0,
    treasures: s.treasures ?? 0,
    goals: matchupGoalsMet(s),
    ice: s.iceBroken ?? 0,
    big: s.bigLines ?? 0,
    raw,
  };
}

export const median = (xs: readonly number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)]!;
};
export const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const seeds = Number(opt("seeds") ?? 60);
  const from = Number(opt("from") ?? 0);
  const levels = (opt("levels")?.split(",") ?? GEMSTONE_LEVELS) as GemLevel[];
  const skills = (opt("skills")?.split(",") ?? ["weak", "average", "good", "great", "near", "elite", "perfect"]) as SkillLevel[];
  const limits = args.includes("--limits");
  const spec: any = GAME_BY_TYPE.get("matchup" as never)!;
  const out: Record<string, unknown>[] = [];
  const dumped: Record<string, unknown>[] = [];
  for (const level of levels)
    for (const skill of skills) {
      const runs = Array.from({ length: seeds }, (_, i) => playLevel(level, skill, spec.seedFor(from + i), limits));
      for (const r of runs) dumped.push({ level, skill, seed: r.seed, score: r.score, gems: r.gems, treasures: r.treasures, goals: r.goals, ice: r.ice, big: r.big });
      const sc = runs.map((r) => r.score);
      const row = {
        level,
        skill: skill + (limits && skill === "elite" ? " (limits)" : ""),
        avg: Math.round(mean(sc) * 10) / 10,
        median: median(sc),
        min: Math.min(...sc),
        star: runs.filter((r) => r.score >= 175).length / runs.length,
        full: runs.filter((r) => r.score >= 200).length,
        flagged: runs.filter((r) => r.flagged).length,
        gems: median(runs.map((r) => r.gems)),
        treasures: median(runs.map((r) => r.treasures)),
        goals: median(runs.map((r) => r.goals)),
        ice: median(runs.map((r) => r.ice)),
        big: median(runs.map((r) => r.big)),
        best: [...runs].sort((a, b) => b.score - a.score).slice(0, 5).map((r) => `${r.seed}:${r.score}`).join(" "),
      };
      out.push(row);
      if (!args.includes("--json"))
        console.log(
          `${level.padEnd(7)} ${row.skill.padEnd(16)} avg ${row.avg.toFixed(1).padStart(6)} med ${String(row.median).padStart(3)} min ${String(row.min).padStart(3)} star ${(row.star * 100).toFixed(0).padStart(3)}% 200×${row.full} | gems ${row.gems} treasure ${row.treasures} goals ${row.goals} ice ${row.ice} big ${row.big}${row.flagged ? ` FLAGGED ${row.flagged}` : ""} | best ${row.best}`,
        );
    }
  if (args.includes("--json")) console.log(JSON.stringify(out));
  // --dump=<file>: every run's counts (no logs), for sweeping the full-at figures offline.
  const dump = opt("dump");
  if (dump) (await import("node:fs")).writeFileSync(dump, JSON.stringify(dumped));
}
