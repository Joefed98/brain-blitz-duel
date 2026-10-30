/**
 * Speed Pool: a player clearing the table.
 *
 * For each shot the player looks over the pots on offer (ghost-ball aims with clear lines, scripts/pool-oracle.ts)
 * and picks one: weaker players by how easy it looks (cut and distance, blurred by judgement), better ones also by
 * where the cue ball will stop (the leave). The shot that would pot it cleanly (aim, power, spin) comes from the sim
 * and stands in for experience; the human then adds, in the gesture's own terms:
 *   - think time before each shot (and the pull on the power panel),
 *   - pointing error lining the shot up (aim sd in phone px, as an angle over AIM_REACH_PX: players drag well past
 *     the ghost ball and line the drawn object-ball line up with the pocket),
 *   - power error on the pull,
 *   - slips: a botched pick or a mis-hit.
 * Flawless ("perfect") plays the search's best shot with no error. The bot never looks at the score.
 */
import { POOL_AIM, POOL_CUE, type PoolState } from "../../../src/lib/arcade/pool";
import { candidates, goodShots, powerFor, shotFor, type Shot } from "../../pool-oracle";
import { driveEvents, Plan, type SkillBot } from "../bot";

/** Base think time before a shot (an average player), ms; the panel pull adds PULL_MS. */
const THINK_MS = 2600;
const PULL_MS = 650;
/** How far out the finger lines the aim up (phone px): the pointing error becomes an angle over this. */
const AIM_REACH_PX = 300;

export const bot: SkillBot = ({ game, seed, human }) => {
  const plan = new Plan();
  let planned = -1;
  const decide = (s: PoolState): Shot | null => {
    const perfect = human.level === "perfect";
    const goods = goodShots(s.balls, { limit: perfect ? 6 : 5 });
    if (goods.length) {
      let choice = goods[0]!;
      if (!perfect) {
        // Weaker players judge by the pot's ease alone; better ones weigh the leave too.
        const leaveWeight = human.level === "weak" || human.level === "average" ? 0 : human.level === "good" ? 0.4 : 1;
        const values = goods.map((g) => -(g.cand.ease + leaveWeight * Math.min(60, g.leave)));
        choice = goods[Math.max(0, human.pick(values))]!;
      }
      if (perfect) return choice.shot;
      const angle = Math.atan2(choice.shot.b, choice.shot.a) + human.aim(1) / AIM_REACH_PX;
      const power = Math.round((Math.floor(choice.shot.c / 25) * human.power()) as number);
      const spin = choice.shot.c % 25;
      if (human.slip()) return shotFor(angle + human.normal() * 0.05, Math.max(60, Math.round(power * (0.7 + 0.6 * human.u()))), spin);
      return shotFor(angle, Math.max(40, Math.min(1000, power)), spin);
    }
    // Nothing pots cleanly: the easiest-looking pot anyway (or a soft roll at the nearest target ball).
    const c = candidates(s.balls, 85)[0];
    if (c) return shotFor(c.angle + human.aim(1) / AIM_REACH_PX, Math.round(powerFor(c.cueDist, c.objDist, c.cut) * human.power()), 12);
    const cue = s.balls.find((b) => b.id === POOL_CUE)!;
    const t = s.balls.find((b) => !b.down && b.id !== POOL_CUE)!;
    return shotFor(Math.atan2(t.y - cue.y, t.x - cue.x), 300, 12);
  };
  return driveEvents(
    game,
    (s: PoolState, t) => {
      if (s.phase !== POOL_AIM) return plan.take(t);
      if (planned < s.shots) {
        planned = s.shots;
        const shot = decide(s);
        const wait = human.thinkTicks(THINK_MS) + human.thinkTicks(PULL_MS, 0.2);
        if (shot) plan.at(t + wait, { k: 1, a: shot.a, b: shot.b, c: shot.c, d: 0 });
      }
      return plan.take(t);
    },
    game.init(seed),
  );
};

/** Inputs at random: a shot in a random direction at a random power whenever the table is still. */
export const randomBot: SkillBot = ({ game, seed, human }) =>
  driveEvents(
    game,
    (s: PoolState) => {
      if (s.phase !== POOL_AIM || !human.chance(1 / 90)) return null;
      const angle = human.u() * Math.PI * 2;
      return { k: 1, ...shotFor(angle, human.int(60, 1000), human.int(0, 24)), d: 0 };
    },
    game.init(seed),
  );
