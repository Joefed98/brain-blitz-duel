/**
 * Scrumper's room proof module (snipRev 11, the 200-point expansion; scripts/x200/room.ts): the n-th room
 * deal is the server generator's puzzle (generateSnip: its stamp) on room seed n (arcadeSeed is random, so
 * the seed is the skill-band tool's reproducible roomSeed(n)). Everything a level offers comes from the
 * stored seed and the course bank: the six courses, each level's pin shift, wind preset and golden fruit,
 * its leaves, pegs, rings, par cuts and par time. None of it reads the player's play.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateSnip } from "../../src/lib/duel/arcade.server";
import { snipGameFor, SNIP_COURSES, SNIP_X_GOLD_LEVELS, SNIP_X_LEVELS, type SnipState } from "../../src/lib/arcade/snip";
import { Human } from "../arcade-skill-bands/human";
import { bot, randomBot } from "../arcade-skill-bands/bots/snip";
import { roomSeed } from "../arcade-skill-bands/games";
import type { RoomDeal, RoomStyle, X200Room } from "./room";

export const x200Room: X200Room = {
  type: "snip",
  rev: generateSnip().snipRev ?? 0,
  deals: 6,
  deal(n: number): RoomDeal {
    const p = generateSnip();
    return { seed: roomSeed(n), game: snipGameFor(p.snipRev) };
  },
  play(deal: RoomDeal, style: RoomStyle) {
    if (style === "idle") return { events: [] };
    const human = new Human("snip", deal.seed, style === "random" ? "weak" : style);
    const run = (style === "random" ? randomBot : bot)({ game: deal.game, seed: deal.seed, human } as any);
    return { events: run.events };
  },
  schedule(state: SnipState): Record<string, unknown> {
    const out: Record<string, unknown> = { order: state.order };
    if (state.level >= SNIP_X_LEVELS || !state.fruits) return out;
    const course = SNIP_COURSES[state.template]!;
    out[`level${state.level}`] = {
      course: state.template,
      wob: state.wob,
      wind: [state.windA, state.windP, state.windPh],
      // The golden fruit (gold 1, then 2 once it ripens; 0 for the others): which one, never whether it was fed.
      gold: state.fruits.findIndex((f) => f.gold > 0),
      fruits: state.fruits.length,
      leaves: state.starX.map((x, i) => [x, state.starY[i]]),
      pegs: course.hooks ?? [],
      rings: course.rings ?? [],
      parCuts: course.par,
      parTime: course.parT,
      basket: course.mouth,
    };
    return out;
  },
  opportunities(state: SnipState): Record<string, number> {
    const courses = state.order.slice(0, SNIP_X_LEVELS).map((t) => SNIP_COURSES[t]!);
    return {
      levels: courses.length,
      fruits: courses.reduce((n, c) => n + c.fruits.length, 0),
      goldenApples: SNIP_X_GOLD_LEVELS.length,
      leaves: courses.reduce((n, c) => n + c.stars.length, 0),
      rings: courses.reduce((n, c) => n + (c.rings?.length ?? 0), 0),
      parCutLevels: courses.length,
      parTimeLevels: courses.filter((c) => c.parT > 0).length,
    };
  },
};
