/**
 * Ball Tracker's level bands (Strategy overhaul stage 3, 15 Nov 2026; docs/arcade-standard/balltrack.md "Levels"): the
 * skill-band bot (scripts/arcade-skill-bands/bots/balltrack.ts, the fixed bots) at every level from weak to flawless on
 * each level's dealt courses, every run graded through the server's encode + replay on btRev 8. A tool, not a check.
 *
 *   bun scripts/balltrack-level-bands.ts [normal|easy|hard|expert …] [--seeds=30] [--limits] [--candidates]
 *
 * --limits plays under Joe's human limits (about 0.25 s to react, 0.15 s to move: BT_HUMAN_LIMITS in the bot);
 * --candidates plays fresh unproved candidates from the level's settings (for tuning before a list is built).
 * Normal plays btRev 8's deal (bank courses through btV8DealIndex, as the skill-band tool).
 */
import { BT_REV_STD, makeBallTrackGame, type BtCourse } from "../src/lib/arcade/ballTrack";
import { BALL_TRACK_BANK_V7 } from "../src/lib/duel/ballTrackBankV7.server";
import { btV8DealIndex } from "../src/lib/duel/ballTrackDealV8.server";
import { btLevelDeal } from "../src/lib/duel/ballTrackLevels.server";
import { ALL_LEVELS, Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot, BT_HUMAN_LIMITS } from "./arcade-skill-bands/bots/balltrack";
import { replayedBtStd } from "./arcade-standard/balltrack";
import { btLevelSettings, courseShapeOk, makeLevelCourse, type BtLevel } from "./balltrack-level-deal";

type Lv = "normal" | BtLevel;

export interface BandRow {
  skill: SkillLevel;
  scores: number[];
  median: number;
  average: number;
  p10: number;
  p90: number;
  reached200: number;
  star: number;
}

const pct = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor((s.length - 1) * q)))]!;
};

/** The courses a level deals for samples 0…n−1 (Normal: btRev 8's deal; a level: its list, in order). */
export function levelCourses(level: Lv, n: number, from = 0, candidates = false): BtCourse[] {
  if (level === "normal") return Array.from({ length: n }, (_, i) => BALL_TRACK_BANK_V7[btV8DealIndex(10_000 + from + i)]!.course);
  if (!candidates) {
    const list = btLevelDeal(level);
    return Array.from({ length: Math.min(n, list.length) }, (_, i) => list[(from + i) % list.length]!);
  }
  let seed = 0x5eed + from;
  const rnd = (k: number) => {
    seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    return ((seed ^ (seed >>> 13)) >>> 0) % k;
  };
  const shuffle = <T,>(l: T[]) => {
    for (let i = l.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [l[i], l[j]] = [l[j]!, l[i]!];
    }
    return l;
  };
  const s = btLevelSettings(level);
  const out: BtCourse[] = [];
  while (out.length < n) {
    const c = makeLevelCourse({ rnd, shuffle }, s);
    if (courseShapeOk(c, s)) out.push(c);
  }
  return out;
}

/** One bot run on a course at a skill level, graded through the server replay. */
export function botScore(course: BtCourse, seed: number, skill: SkillLevel): number {
  const game = makeBallTrackGame(course, BT_REV_STD);
  const out = bot({ game, seed, rev: BT_REV_STD, human: new Human("balltrack", seed, skill), fixes: true });
  return replayedBtStd(course, seed, out.events ?? []).score;
}

export function levelBands(level: Lv, n: number, skills: readonly SkillLevel[] = ALL_LEVELS, opts: { limits?: boolean; candidates?: boolean; from?: number } = {}): BandRow[] {
  const courses = levelCourses(level, n, opts.from ?? 0, opts.candidates);
  const before = BT_HUMAN_LIMITS.on;
  BT_HUMAN_LIMITS.on = Boolean(opts.limits);
  try {
    return skills.map((skill) => {
      const scores = courses.map((c, i) => botScore(c, 10_000 + (opts.from ?? 0) + i, skill));
      return {
        skill,
        scores,
        median: pct(scores, 0.5),
        average: Math.round((scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length)) * 10) / 10,
        p10: pct(scores, 0.1),
        p90: pct(scores, 0.9),
        reached200: scores.filter((s) => s >= 200).length,
        star: scores.filter((s) => s >= 175).length,
      };
    });
  } finally {
    BT_HUMAN_LIMITS.on = before;
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const asked = args.filter((a) => !a.startsWith("--")) as Lv[];
  const levels: Lv[] = asked.length ? asked : ["easy", "normal", "hard", "expert"];
  const seeds = Number(opt("seeds") ?? 30);
  const limits = args.includes("--limits");
  const skills = (opt("skills")?.split(",") as SkillLevel[] | undefined) ?? ALL_LEVELS;
  for (const level of levels) {
    console.log(`balltrack ${level}${limits ? " (human limits)" : ""}, ${seeds} courses:`);
    for (const r of levelBands(level, seeds, skills, { limits, candidates: args.includes("--candidates"), from: Number(opt("from") ?? 0) }))
      console.log(`  ${r.skill.padEnd(8)} median ${String(r.median).padStart(3)}  avg ${r.average.toFixed(1).padStart(5)}  p10–p90 ${r.p10}–${r.p90}  200s ${r.reached200}/${r.scores.length}  175+ ${r.star}/${r.scores.length}`);
  }
}
