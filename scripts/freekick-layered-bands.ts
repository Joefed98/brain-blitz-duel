/**
 * Top Bins' layered kicks (freekickRev 5) by level and skill: the rev-5 bot (scripts/arcade-skill-bands/bots/freekick.ts
 * botV5) at every skill level on every difficulty level, scored through the server replay. A measuring tool, not a
 * check: `bun scripts/freekick-layered-bands.ts [--seeds=30] [--from=0] [--levels=normal,hard] [--rev=5] [--human-limits]`
 * (the dealt stamp, freekickRev 6, on its own deal unless --rev=5; --human-limits: every bot under human limits).
 */
import { freekickGameFor, FK_LEVELS, fkLevelOf, FREEKICK_REV_5, FREEKICK_REV_DEALT } from "../src/lib/arcade/freekick";
import { Human, ALL_LEVELS, HUMAN_LIMITS, LEVEL_LABEL } from "./arcade-skill-bands/human";
import { botV5, randomBotV5 } from "./arcade-skill-bands/bots/freekick";
import { freekickDealSeedV5 } from "../src/lib/duel/freekickDealV5.server";
import { freekickDealSeedV6 } from "../src/lib/duel/freekickDealV6.server";
import { storedScoreFkV5 } from "./freekick-layered-deal";

const opt = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const N = Number(opt("seeds") ?? 30);
const FROM = Number(opt("from") ?? 0);
const REV = opt("rev") === "5" ? FREEKICK_REV_5 : FREEKICK_REV_DEALT;
const LIMITS = process.argv.includes("--human-limits") ? HUMAN_LIMITS : null;
const levels = (opt("levels")?.split(",") ?? FK_LEVELS).map(fkLevelOf);
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
for (const level of levels) {
  const game = freekickGameFor(REV, level);
  const row: string[] = [];
  for (const skill of [...ALL_LEVELS, "random" as const]) {
    const scores: number[] = [];
    for (let n = 0; n < N; n++) {
      const seed = REV === FREEKICK_REV_5 ? freekickDealSeedV5(FROM + n, level) : freekickDealSeedV6(FROM + n, level);
      const human = new Human("freekick", seed, skill === "random" ? "average" : skill, LIMITS);
      const { events } = (skill === "random" ? randomBotV5 : botV5)({ game, seed, rev: REV, human });
      scores.push(storedScoreFkV5(seed, events, level, REV));
    }
    row.push(`${skill === "random" ? "Random" : LEVEL_LABEL[skill]} ${med(scores)} (avg ${Math.round(scores.reduce((a, b) => a + b, 0) / N)})`);
  }
  console.log(`${level.padEnd(7)} ${row.join(" · ")}`);
}
