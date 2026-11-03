/**
 * Bastion (bastionRev 2): a gunner holding the wall against five waves of tanks.
 *
 * The planner is the oracle's (scripts/bastion-oracle.ts): every time the gun is ready the player picks the tank
 * nearest the wall that still needs a shell, leads it by the flight time and lifts. The human's errors:
 *   - reaction: a tank is only noticed a reaction time after it rolls out of the haze, and a short think between shots;
 *   - lead: from the tank's screen motion now (a speed change still to come is not foreseen), misjudged by the level's
 *     judgement;
 *   - aim: the level's pointing error, widened 1.4× for a drag-then-lift aim;
 *   - the fast reload: timed on the sweeping needle with the level's timing error (the zone is 200 ms wide).
 * What they try grows with skill: weak and average players aim at the hull's middle most of the time, reload only when
 * empty and sometimes forget the tap; good players go for the weak spot half the time; great and better aim for the
 * weak spot and reload early when the field is quiet. The perfect level is the oracle.
 *
 * bastionRev 3 (Iron Wall): the drones. Each level tries a drone `droneTries` times (weak once, near-perfect and up three
 * times), leading it from its motion with the level's judgement and aim; on rev 2 there are none.
 */
import { bastionPlay, FLAWLESS, type BastionStyle } from "../../bastion-oracle";
import { BASTION_REV_TANK, BT2_INPUT_AIM, BT2_INPUT_FIRE, BT2_INPUT_RANGES, BT2_INPUT_RELOAD, BT2_INPUT_TAP, BT2_RUN_TICKS } from "../../../src/lib/arcade/bastionTank";
import { recordInput, type ArcadeInputEvent } from "../../../src/lib/arcade/engine";
import type { SkillBot } from "../bot";
import type { SkillLevel } from "../human";

const STYLES: Record<SkillLevel, BastionStyle> = {
  weak: { weakAim: 0.15, earlyReload: false, tapChance: 0.45, minWeakH: 2, droneTries: 1 },
  average: { weakAim: 0.3, earlyReload: false, tapChance: 0.75, minWeakH: 3, droneTries: 1 },
  good: { weakAim: 0.4, earlyReload: false, tapChance: 0.9, minWeakH: 4, droneTries: 2 },
  great: { weakAim: 0.9, earlyReload: true, tapChance: 1, minWeakH: 3, droneTries: 2 },
  near: { weakAim: 0.95, earlyReload: true, tapChance: 1, minWeakH: 3, droneTries: 3 },
  elite: { weakAim: 1, earlyReload: true, tapChance: 1, minWeakH: 3, droneTries: 3 },
  perfect: FLAWLESS,
};

export const bot: SkillBot = ({ seed, human, rev }) => {
  const r = rev ?? BASTION_REV_TANK;
  if (human.level === "perfect") return { events: bastionPlay(seed, undefined, FLAWLESS, r).events };
  return { events: bastionPlay(seed, human, STYLES[human.level], r).events };
};

/** Fires, reloads and taps at random moments and places (no aim). */
export const randomBot: SkillBot = ({ human }) => {
  const events: ArcadeInputEvent[] = [];
  for (let t = 20; t < BT2_RUN_TICKS; t += human.int(8, 40)) {
    const r = human.u();
    const k = r < 0.6 ? BT2_INPUT_FIRE : r < 0.75 ? BT2_INPUT_TAP : r < 0.85 ? BT2_INPUT_RELOAD : BT2_INPUT_AIM;
    recordInput(events, { t, k, a: human.int(0, 390), b: human.int(250, 620), c: 0, d: 0 }, BT2_INPUT_RANGES);
  }
  return { events };
};
