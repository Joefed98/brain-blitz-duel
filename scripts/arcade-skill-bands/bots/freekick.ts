/**
 * Free Kick: a player drawing a stroke through the ball, ten times.
 *
 * Experience stands in for the shot: for each kick the bot knows two shots from the search in
 * scripts/freekick-oracle.ts (`fkPlanKick`): the "full" shot (curled round the wall into the far-from-keeper corner,
 * through the target when the kick has one) and a "safe" goal (the goal whose neighbouring strokes most often score
 * too). Better players go for the full shot more often. The human then adds, in the stroke's own terms:
 *   - aim error: the stroke's direction off by the level's pointing error (a 1-px sideways slip over a ~120-px stroke
 *     is about 3 mrad of yaw on the phone's mapping),
 *   - power error: the stroke's speed off by the level's power error (power sets how high the ball arrives),
 *   - curl error: the stroke's bow off by a share of the pointing error,
 *   - wind misread (freekickRev 1 only; rev 2 has no wind): the allowance for the wind off by a relative error,
 *   - slips: a botched stroke (a big error on one of the three).
 * The kick is taken after a think time (shorter for better players), never after the kick's deadline. The perfect
 * level plays the oracle's run. The bot never looks at the score.
 */
import { FK_AIM, FREEKICK_AIM_MAX, FREEKICK_CURL_MAX, FREEKICK_POWER_MAX, FREEKICK_REV_STD, fkSeedPlan, type FreekickState } from "../../../src/lib/arcade/freekick";
import { fkPlanKick, oracleShots, playShots, type FkPlans, type FkShot } from "../../freekick-oracle";
import type { SkillLevel } from "../human";
import type { SkillBot } from "../bot";

/** Chance of going for the full shot (round the wall, the target), by level. */
const GO_FULL: Record<SkillLevel, number> = { weak: 0.05, average: 0.2, good: 0.45, great: 0.7, near: 0.9, elite: 0.97, perfect: 1 };
/** Relative error reading the wind's push. */
const WIND_READ: Record<SkillLevel, number> = { weak: 0.6, average: 0.4, good: 0.25, great: 0.15, near: 0.08, elite: 0.05, perfect: 0 };
/** Yaw (mrad) the wind's push needs per wind point (about 0.1 m at 22 m). */
const WIND_MRAD = 5;

const planCache = new Map<string, FkPlans[]>();
/** Both plans for every kick of a seed on a revision (cached: the levels share them). */
export function freekickPlans(seed: number, rev: number = FREEKICK_REV_STD): FkPlans[] {
  const key = `${rev}:${seed}`;
  let plans = planCache.get(key);
  if (!plans) {
    plans = fkSeedPlan(seed, rev).kicks.map((k) => fkPlanKick(k, false));
    if (planCache.size > 200) planCache.clear();
    planCache.set(key, plans);
  }
  return plans;
}

export const bot: SkillBot = (ctx) => {
  const h = ctx.human;
  const rev = ctx.rev ?? FREEKICK_REV_STD;
  if (h.level === "perfect") return { events: playShots(ctx.seed, oracleShots(ctx.seed, rev), [], rev).events };
  const plans = freekickPlans(ctx.seed, rev);
  const kicks = fkSeedPlan(ctx.seed, rev).kicks;
  const shots: (FkShot | null)[] = [];
  const delays: number[] = [];
  kicks.forEach((k, i) => {
    const p = plans[i]!;
    const goFull = p.full && h.chance(GO_FULL[h.level]);
    const base = (goFull ? p.full : p.goal ?? p.full ?? p.best)?.shot ?? { a: 0, b: 0, c: 500 };
    let a = base.a + h.aim(3) + k.wind * WIND_MRAD * WIND_READ[h.level] * h.normal();
    let b = base.b + h.aim(1.2);
    let c = base.c + (h.power() - 1) * 1000;
    if (h.slip()) {
      const which = h.int(0, 2);
      if (which === 0) a += (h.chance(0.5) ? 1 : -1) * (40 + 60 * h.u());
      else if (which === 1) c += (h.chance(0.5) ? 1 : -1) * (100 + 150 * h.u());
      else b += (h.chance(0.5) ? 1 : -1) * (40 + 40 * h.u());
    }
    shots.push({
      a: Math.round(Math.max(-FREEKICK_AIM_MAX, Math.min(FREEKICK_AIM_MAX, a))),
      b: Math.round(Math.max(-FREEKICK_CURL_MAX, Math.min(FREEKICK_CURL_MAX, b))),
      c: Math.round(Math.max(0, Math.min(FREEKICK_POWER_MAX, c))),
    });
    delays.push(Math.min(200, h.thinkTicks(1800)));
  });
  const run = playShots(ctx.seed, shots, delays, rev);
  return { events: run.events };
};

/** Random strokes through the ball (a check on the floor). */
export const randomBot: SkillBot = (ctx) => {
  const h = ctx.human;
  const rev = ctx.rev ?? FREEKICK_REV_STD;
  const shots = fkSeedPlan(ctx.seed, rev).kicks.map(() => ({ a: h.int(-200, 200), b: h.int(-100, 100), c: h.int(0, 1000) }));
  return { events: playShots(ctx.seed, shots, [], rev).events };
};

export type { FreekickState };
void FK_AIM;
