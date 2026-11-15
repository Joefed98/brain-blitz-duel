/**
 * Top Bins' layered kicks (freekickRev 5) by level and skill: the rev-5 bot (scripts/arcade-skill-bands/bots/freekick.ts
 * botV5) at every skill level on every difficulty level, scored through the server replay. A measuring tool, not a
 * check: `bun scripts/freekick-layered-bands.ts [--seeds=30] [--from=0] [--levels=normal,hard]`.
 */
import { freekickGameFor, FK_LEVELS, fkLevelOf, FREEKICK_REV_5 } from "../src/lib/arcade/freekick";
import { Human, ALL_LEVELS, LEVEL_LABEL } from "./arcade-skill-bands/human";
import { botV5, randomBotV5 } from "./arcade-skill-bands/bots/freekick";
import { freekickDealSeedV5 } from "../src/lib/duel/freekickDealV5.server";
import { storedScoreFkV5 } from "./freekick-layered-deal";

const opt = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const N = Number(opt("seeds") ?? 30);
const FROM = Number(opt("from") ?? 0);
const levels = (opt("levels")?.split(",") ?? FK_LEVELS).map(fkLevelOf);
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
for (const level of levels) {
  const game = freekickGameFor(FREEKICK_REV_5, level);
  const row: string[] = [];
  for (const skill of [...ALL_LEVELS, "random" as const]) {
    const scores: number[] = [];
    for (let n = 0; n < N; n++) {
      const seed = freekickDealSeedV5(FROM + n, level);
      const human = new Human("freekick", seed, skill === "random" ? "average" : skill);
      const { events } = (skill === "random" ? randomBotV5 : botV5)({ game, seed, rev: FREEKICK_REV_5, human });
      scores.push(storedScoreFkV5(seed, events, level));
    }
    row.push(`${skill === "random" ? "Random" : LEVEL_LABEL[skill]} ${med(scores)} (avg ${Math.round(scores.reduce((a, b) => a + b, 0) / N)})`);
  }
  console.log(`${level.padEnd(7)} ${row.join(" · ")}`);
}
