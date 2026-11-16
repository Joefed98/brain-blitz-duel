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
import type { Human, SkillLevel, SkillProfile } from "../human";

const STYLES: Record<SkillLevel, BastionStyle> = {
  weak: { weakAim: 0.15, earlyReload: false, tapChance: 0.45, minWeakH: 2, droneTries: 1 },
  average: { weakAim: 0.3, earlyReload: false, tapChance: 0.75, minWeakH: 3, droneTries: 1 },
  good: { weakAim: 0.4, earlyReload: false, tapChance: 0.9, minWeakH: 4, droneTries: 2 },
  great: { weakAim: 0.9, earlyReload: true, tapChance: 1, minWeakH: 3, droneTries: 2 },
  near: { weakAim: 0.95, earlyReload: true, tapChance: 1, minWeakH: 3, droneTries: 3 },
  elite: { weakAim: 1, earlyReload: true, tapChance: 1, minWeakH: 3, droneTries: 3 },
  perfect: FLAWLESS,
};

/**
 * Human limits (bastionRev 4's levels, 15 Nov 2026; docs/arcade-standard/bastion.md "bastionRev 4: levels"): a real
 * gunner on a phone notices a new tank no sooner than about 0.25 s after it appears, needs about 0.15 s to move the
 * crosshair onto the next target and lift, points no closer than 5 px sd (the crosshair floats above the thumb), misjudges
 * a moving target's lead by 25 % sd and times the reload needle no better than 30 ms sd. A tank within 300 ticks of the
 * wall whose weak spot can't be hit now takes a hull shot instead of a wait (`adaptive`), and even a top player aims at
 * the hull now and then (weak-spot aim at most 95 %). With `fixes` (the band tool, scripts/level-tune.ts and the Action
 * intro demos) every level's profile is held to these floors; the checks that run this bot without `fixes` keep the
 * bots they were proved with.
 */
export const BASTION_HUMAN_LIMITS = { reactionMs: 250, moveMs: 150, aimSdPx: 5, timingSdMs: 30, judgement: 0.25, adaptiveTicks: 300, weakAimMax: 0.95 } as const;
/** The shot-to-shot think's base time (bastion-oracle.ts `thinkTicks(260, …)`). */
const THINK_BASE_MS = 260;

export function limitedProfile(p: SkillProfile): SkillProfile {
  const L = BASTION_HUMAN_LIMITS;
  return {
    ...p,
    reactionMs: [Math.max(p.reactionMs[0], L.reactionMs), p.reactionMs[1]],
    aimSdPx: Math.max(p.aimSdPx, L.aimSdPx),
    timingSdMs: Math.max(p.timingSdMs, L.timingSdMs),
    thinkScale: Math.max(p.thinkScale, L.moveMs / THINK_BASE_MS),
    judgement: Math.max(p.judgement, L.judgement),
  };
}

/** The human with BASTION_HUMAN_LIMITS applied (the same seeded stream). */
export function limitedHuman(human: Human): Human {
  (human as { p: SkillProfile }).p = limitedProfile(human.p);
  return human;
}

export const bot: SkillBot = ({ game, seed, human, rev, fixes }) => {
  const r = rev ?? BASTION_REV_TANK;
  if (human.level === "perfect") return { events: bastionPlay(seed, undefined, FLAWLESS, r, game).events };
  if (!fixes) return { events: bastionPlay(seed, human, STYLES[human.level], r, game).events };
  return { events: bastionPlay(seed, limitedHuman(human), { ...STYLES[human.level], weakAim: Math.min(STYLES[human.level].weakAim, BASTION_HUMAN_LIMITS.weakAimMax), adaptive: BASTION_HUMAN_LIMITS.adaptiveTicks }, r, game).events };
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
