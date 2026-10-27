/**
 * Scrumper snipRev 11 tuning aid (the 200-point expansion; not a check): plays the skill-band bots on the
 * new stamp and stores each run's final counters, so the skill pay and base curve can be refitted offline
 * without replaying (the bots' play does not depend on the pay).
 *
 *   bun scripts/snip-x200-bands.ts --tier=elite --from=0 --seeds=60 --out=<file>
 *   bun scripts/snip-x200-bands.ts --report <file>…    medians, top 10 % and zeros per tier from the counters
 *
 * The scores it reports are the sim's own (snipCourseParts → bandTotal), so they equal the server replay's
 * for these logs; arcade-skill-bands.ts snip --rev=x measures the same through the encode + replay.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { bandTotal } from "../src/lib/arcade/scoreBands";
import { snipCourseParts, snipCourseUnits, snipFeatureBonus, snipGameFor, SNIP_COURSES, SNIP_REV_EXPAND, SNIP_X_MAX, type SnipState } from "../src/lib/arcade/snip";
import { Human, type SkillLevel as SkillTier } from "./arcade-skill-bands/human";
import { bot, randomBot } from "./arcade-skill-bands/bots/snip";
import { roomSeed } from "./arcade-skill-bands/games";

const args = process.argv.slice(2);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

export interface Counters {
  tier: string;
  n: number;
  score: number;
  units: number;
  base: number;
  skill: number;
  finishTick: number;
  cleared: number;
  golden: number;
  parLevels: number;
  stars2: number;
  perfect: number;
  quickTicks: number;
  quickLevels: number;
  eaten: number;
  fruits: number;
}

export function counters(tier: string, n: number, s: SnipState): Counters {
  const parts = snipCourseParts(s);
  return {
    tier,
    n,
    score: bandTotal(parts, Boolean(s.acted), SNIP_X_MAX),
    units: snipCourseUnits(s),
    base: parts.points + parts.bonus - snipFeatureBonus(s),
    skill: snipFeatureBonus(s),
    finishTick: s.finishTick,
    cleared: s.cleared ?? 0,
    golden: s.golden ?? 0,
    parLevels: s.parLevels ?? 0,
    stars2: s.stars2 ?? 0,
    perfect: s.perfect ?? 0,
    quickTicks: s.quickTicks ?? 0,
    quickLevels: s.quickLevels ?? 0,
    eaten: s.eaten,
    fruits: s.fruitsDealt ?? 0,
  };
}

const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};
const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

if (args[0] === "--report") {
  const rows: Counters[] = args.slice(1).flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
  const tiers = [...new Set(rows.map((r) => r.tier))];
  for (const t of tiers) {
    const r = rows.filter((x) => x.tier === t);
    const sc = r.map((x) => x.score);
    console.log(`${t.padEnd(8)} n=${r.length} median ${med(sc)} p90 ${q(sc, 0.9)} max ${Math.max(...sc)} zeros ${sc.filter((x) => x === 0).length} | base ${med(r.map((x) => x.base))} skill ${med(r.map((x) => x.skill))} quick ${med(r.map((x) => x.quickTicks))} golden ${med(r.map((x) => x.golden))} par ${med(r.map((x) => x.parLevels))} stars2 ${med(r.map((x) => x.stars2))}`);
  }
} else {
  const tier = (opt("tier") ?? "good") as SkillTier | "random";
  const from = Number(opt("from") ?? 0);
  const seeds = Number(opt("seeds") ?? 60);
  const game = snipGameFor(SNIP_REV_EXPAND);
  const out: Counters[] = [];
  for (let n = from; n < from + seeds; n++) {
    const seed = roomSeed(n);
    const human = new Human("snip", seed, tier === "random" ? "weak" : tier);
    const run = (tier === "random" ? randomBot : bot)({ game, seed, human } as never);
    // Each level's deal and how it ended (offline refits of the par time).
    const levels: { t: number; deal: string; gold: number; end: number; clean: boolean }[] = [];
    {
      const ev = new Map(run.events.map((e) => [e.t, e]));
      let s = game.init(seed);
      while (!game.isOver(s)) {
        const prev = s;
        s = game.step(s, ev.get(s.tick + 1) ?? null);
        if (s.level !== prev.level) {
          const course = SNIP_COURSES[prev.template]!;
          const wind = course.winds.findIndex(([a, p, ph]) => a === (prev.windA ?? 0) && p === (prev.windP ?? 0) && ph === (prev.windPh ?? 0));
          levels.push({ t: prev.template, deal: `${prev.wob ?? 0}:${Math.max(0, wind)}`, gold: (prev.fruits ?? []).findIndex((f) => f.gold > 0), end: prev.levelTick + 1, clean: (s.parLevels ?? 0) > (prev.parLevels ?? 0) });
        }
      }
    }
    out.push({ ...counters(tier, n, run.state as SnipState), levels } as Counters);
  }
  const file = opt("out");
  if (file) writeFileSync(file, JSON.stringify(out));
  else console.log(JSON.stringify(out));
}
