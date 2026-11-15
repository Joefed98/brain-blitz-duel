/**
 * Home Run's innings (homerunRev 5) by level and skill: the rev-5 bot (scripts/arcade-skill-bands/bots/homerun.ts
 * botV5) at every skill level on every difficulty level, scored through the server replay. A measuring tool, not a
 * check: `bun scripts/homerun-innings-bands.ts [--seeds=40] [--from=10000] [--levels=normal,hard]`.
 */
import { homerunGameFor, HOMERUN_REV_5 } from "../src/lib/arcade/homerun";
import { storedScoreV5 } from "./homerun-innings-deal";
import { Human, ALL_LEVELS, LEVEL_LABEL } from "./arcade-skill-bands/human";
import { botV5, randomBotV5 } from "./arcade-skill-bands/bots/homerun";
import { homerunDealSeedV5 } from "../src/lib/duel/homerunDealV5.server";
import { HR_LEVELS, hrLevelOf } from "../src/lib/arcade/homerunInnings";

const opt = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const N = Number(opt("seeds") ?? 40);
const FROM = Number(opt("from") ?? 0);
const levels = (opt("levels")?.split(",") ?? HR_LEVELS).map(hrLevelOf);
const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};
for (const level of levels) {
  const game = homerunGameFor(HOMERUN_REV_5, level);
  const row: string[] = [];
  for (const skill of [...ALL_LEVELS, "random" as const]) {
    const scores: number[] = [];
    for (let n = 0; n < N; n++) {
      const seed = homerunDealSeedV5(FROM + n, level);
      const human = new Human("homerun", seed, skill === "random" ? "average" : skill);
      const { events } = (skill === "random" ? randomBotV5 : botV5)({ game, seed, rev: HOMERUN_REV_5, human });
      scores.push(storedScoreV5(seed, events, level));
    }
    row.push(`${skill === "random" ? "Random" : LEVEL_LABEL[skill]} ${med(scores)} (avg ${Math.round(scores.reduce((a, b) => a + b, 0) / N)})`);
  }
  console.log(`${level.padEnd(7)} ${row.join(" · ")}`);
}
