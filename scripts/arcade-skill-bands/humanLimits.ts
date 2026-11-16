/**
 * The human-limited elite player the difficulty levels are tuned on (15 Nov 2026; docs/design/difficulty/README.md,
 * docs/arcade-standard/flip.md and skyline.md "Levels"). Joe's brief: tune each level so an elite player *under human
 * limits* averages about 198 on Normal, 160 on Hard and 140 on Expert: about 0.25 s to react to something new, about
 * 0.15 s to move a finger (the tracking lag), and no superhuman accuracy.
 *
 * The skill-band tool's own elite (human.ts PROFILES.elite) reacts in 145 ± 15 ms with 9 ms timing and 45 ms tracking
 * lag, faster than that brief. This profile is the elite's steadiness (lapses, slips, judgement, think speed) with the
 * brief's limits: reactions 250 ± 30 ms, tracking lag 150 ms, timing sd 15 ms (between near-perfect's 12 and great's 20:
 * a top player's rhythm on a phone, never a frame-perfect one) and aim sd 2.5 px (near-perfect's). Measurement only:
 * no check or band table reads it.
 */
import { Human, PROFILES, type SkillProfile } from "./human";

export const HUMAN_LIMITED_ELITE: SkillProfile = {
  ...PROFILES.elite,
  reactionMs: [250, 30],
  trackLagMs: 150,
  timingSdMs: 15,
  aimSdPx: 2.5,
};

/** An elite Human whose profile is held to the human limits above (its random stream is the elite's). */
export function limitedElite(game: string, seed: number): Human {
  const human = new Human(game, seed, "elite");
  (human as unknown as { p: SkillProfile }).p = HUMAN_LIMITED_ELITE;
  return human;
}
