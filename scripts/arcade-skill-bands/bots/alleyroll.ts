/**
 * Alley Roll: nine balls up the lane in at most 60 s.
 *
 * For each ball the player lines up (a slide along the bottom, about 900 ms of thought at the level's think scale),
 * picks a target and swipes. They know the lane after a few goes: the release and swipe that would land dead on the
 * target come from the oracle's table (scripts/alleyroll-oracle.ts), then the hand's errors go in: the release point
 * off by the level's pointing error (1.5 px of screen a lane unit at the release line), the swipe's direction off by
 * the pointing error over a 120 px swipe, and its speed off by 1.4× the level's power error (a swipe's speed is harder
 * to hold than a drag's length). A slip is a fumbled swipe: 4–8 % too soft or too hard.
 * Weak and average players aim at the centre ring; good ones go for a pocket once; great ones for a pocket on three
 * balls (the first, fourth and seventh); near-perfect and elite ones on every ball until three pockets are made, then
 * the centre. The perfect level is the oracle.
 */
import { AR_BALLS, AR_INPUT_ROLL, AR_POCKET_POINTS, AR_WAIT, type ArState } from "../../../src/lib/arcade/alleyroll";
import { alleyRollOracleEvents, arAim, ORACLE_RELEASE, type ArTarget } from "../../alleyroll-oracle";
import { driveEvents, type SkillBot } from "../bot";

const THINK_MS = 900;
const SWIPE_PX = 120;

export const bot: SkillBot = ({ game, seed, human }) => {
  if (human.level === "perfect") return { events: alleyRollOracleEvents(seed).events };
  const level = human.level;
  const pocketBalls = level === "great" ? [0, 3, 6] : level === "good" ? [4] : [];
  // Near-perfect and elite players go for a pocket on every ball until they have the three that pay.
  const chasesPockets = level === "near" || level === "elite";
  let rollAt = -1;
  const { events } = driveEvents<ArState>(game, (s, t) => {
    if (s.phase !== AR_WAIT || s.balls.length >= AR_BALLS) {
      rollAt = -1;
      return null;
    }
    if (rollAt < 0) rollAt = t + human.thinkTicks(THINK_MS) + human.int(10, 16);
    if (t < rollAt) return null;
    const n = s.balls.length;
    const pocketsMade = s.balls.filter((b) => b.points === AR_POCKET_POINTS).length;
    const wantsPocket = chasesPockets ? pocketsMade < 3 : pocketBalls.includes(n);
    const target: ArTarget = wantsPocket ? (n % 2 === 0 ? "left" : "right") : "centre";
    const aim = arAim(target, ORACLE_RELEASE[target]);
    const a = Math.round(aim.a + human.aim(1 / 1.5));
    const angleErr = human.aim(1) / SWIPE_PX;
    let power = human.power(1.4);
    if (human.slip()) power *= human.chance(0.5) ? 0.94 : 1.06;
    const c = Math.round(aim.c * power);
    const b = Math.round(aim.b * power + c * angleErr);
    rollAt = -1;
    return { k: AR_INPUT_ROLL, a, b, c, d: 0 };
  }, game.init(seed) as ArState);
  return { events };
};
