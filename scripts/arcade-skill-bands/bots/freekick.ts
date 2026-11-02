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
 *
 * freekickRev 3 (the prepared shot; botV3): the same two plans, searched as prepared shots (fkPlanKickV3: a target on
 * the goal plane and a curl), then the three steps with their own errors:
 *   - the tap: the target off by the level's pointing error at the goal's on-screen scale (cm a phone px) plus a read
 *     of where to put it (AIM_READ: how far from the keeper is far enough, how tight to the post),
 *   - the drag: the curl off by the pointing error (0.9 units a px) plus a read of how much bend clears the wall
 *     (CURL_READ; the preview shows the first part of the bend),
 *   - the meter: the strike's tick off the sweet zone's centre by the level's timing error (an anticipated moment),
 *   - slips: one step botched (a mis-tap, an over-drag, a release a few ticks out).
 */
import { FK_AIM, FREEKICK_AIM_MAX, FREEKICK_CURL_MAX, FREEKICK_POWER_MAX, FREEKICK_REV_STD, fkSeedPlan, type FreekickState } from "../../../src/lib/arcade/freekick";
import { FK_M, FREEKICK_FOCAL, FREEKICK_CAM_BACK, FREEKICK_REV_3 } from "../../../src/lib/arcade/freekick";
import { fkPlanKick, fkPlanKickV3, FK_V3_CLEAN_TICKS, oracleRun, oracleShots, playShots, playShotsV3, type FkPlans, type FkPlans3, type FkShot, type FkShot3, type FkTiming3 } from "../../freekick-oracle";
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

/** freekickRev 3: the read of where to aim (cm) and how much to bend it (curl units), by level (sd). */
const AIM_READ: Record<SkillLevel, number> = { weak: 30, average: 22, good: 14, great: 9, near: 6, elite: 3, perfect: 0 };
const CURL_READ: Record<SkillLevel, number> = { weak: 24, average: 17, good: 12, great: 8, near: 4, elite: 3, perfect: 0 };

const plan3Cache = new Map<number, FkPlans3[]>();
/** Both prepared-shot plans for every kick of a freekickRev 3 seed (cached). */
export function freekickPlansV3(seed: number): FkPlans3[] {
  let plans = plan3Cache.get(seed);
  if (!plans) {
    plans = fkSeedPlan(seed, FREEKICK_REV_3).kicks.map((k) => fkPlanKickV3(k, false));
    if (plan3Cache.size > 200) plan3Cache.clear();
    plan3Cache.set(seed, plans);
  }
  return plans;
}

const botV3: SkillBot = (ctx) => {
  const h = ctx.human;
  if (h.level === "perfect") return { events: oracleRun(ctx.seed, FREEKICK_REV_3) };
  const plans = freekickPlansV3(ctx.seed);
  const kicks = fkSeedPlan(ctx.seed, FREEKICK_REV_3).kicks;
  const shots: (FkShot3 | null)[] = [];
  const timing: FkTiming3[] = [];
  kicks.forEach((k, i) => {
    const p = plans[i]!;
    const goFull = p.full && h.chance(GO_FULL[h.level]);
    const base = (goFull ? p.full : p.goal ?? p.full ?? p.best)?.shot ?? { x: 0, y: 120, b: 0 };
    // The goal's on-screen scale: cm a world px (about a phone px) at the camera's distance to the goal.
    const cmPerPx = (100 * (Math.hypot(k.bx, k.bz) / FK_M + FREEKICK_CAM_BACK)) / FREEKICK_FOCAL;
    let x = base.x + 0.6 * h.aim(cmPerPx) + AIM_READ[h.level] * h.normal();
    const y = base.y + 0.6 * h.aim(cmPerPx) + AIM_READ[h.level] * 0.6 * h.normal();
    let b = base.b + h.aim(0.9) + CURL_READ[h.level] * h.normal();
    let strike = FK_V3_CLEAN_TICKS + h.timingTicks();
    if (h.slip()) {
      const which = h.int(0, 2);
      if (which === 0) x += (h.chance(0.5) ? 1 : -1) * (60 + 80 * h.u());
      else if (which === 1) b += (h.chance(0.5) ? 1 : -1) * (30 + 40 * h.u());
      else strike += (h.chance(0.5) ? 1 : -1) * (3 + h.int(0, 4));
    }
    shots.push({ x: Math.round(x), y: Math.round(y), b: Math.round(Math.max(-FREEKICK_CURL_MAX, Math.min(FREEKICK_CURL_MAX, b))) });
    timing.push({ think: Math.min(150, h.thinkTicks(1500)), curlGap: Math.min(90, h.thinkTicks(900)), powerGap: Math.min(60, h.thinkTicks(600)), strike: Math.max(1, strike) });
  });
  return { events: playShotsV3(ctx.seed, shots, timing).events };
};

export const bot: SkillBot = (ctx) => {
  const h = ctx.human;
  const rev = ctx.rev ?? FREEKICK_REV_STD;
  if (rev >= FREEKICK_REV_3) return botV3(ctx);
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
  if (rev >= FREEKICK_REV_3) {
    const n = fkSeedPlan(ctx.seed, rev).kicks.length;
    const shots = Array.from({ length: n }, () => ({ x: h.int(-372, 372), y: h.int(11, 250), b: h.int(-100, 100) }));
    const timing = shots.map(() => ({ strike: h.int(1, 96) }));
    return { events: playShotsV3(ctx.seed, shots, timing).events };
  }
  const shots = fkSeedPlan(ctx.seed, rev).kicks.map(() => ({ a: h.int(-200, 200), b: h.int(-100, 100), c: h.int(0, 1000) }));
  return { events: playShots(ctx.seed, shots, [], rev).events };
};

export type { FreekickState };
void FK_AIM;
