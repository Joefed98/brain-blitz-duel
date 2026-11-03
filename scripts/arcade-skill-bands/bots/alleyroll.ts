/**
 * Alley Roll / Ringer: nine balls up the lane in at most 60 s.
 *
 * alleyRollRev 1 (Alley Roll): for each ball the player lines up (a slide along the bottom, about 900 ms of thought at
 * the level's think scale), picks a target and swipes. They know the lane after a few goes: the release and swipe
 * that would land dead on the target come from the oracle's table (scripts/alleyroll-oracle.ts), then the hand's
 * errors go in: the release point off by the level's pointing error (1.5 px of screen a lane unit at the release
 * line), the swipe's direction off by the pointing error over a 120 px swipe, and its speed off by 1.4× the level's
 * power error (a swipe's speed is harder to hold than a drag's length). A slip is a fumbled swipe: 4–8 % too soft or
 * too hard. Weak and average players aim at the centre ring; good ones go for a pocket once; great ones for a pocket
 * on three balls (the first, fourth and seventh); near-perfect and elite ones on every ball until three pockets are
 * made, then the centre. The perfect level is the oracle.
 *
 * alleyRollRev 2 (Ringer): the same hand, through the phone's own swipe mapping (src/lib/arcade/alleyrollSwipe.ts):
 * the swipe starts where the finger goes down (the release point, off by the pointing error in screen px), its angle
 * off by the pointing error over a 120 px swipe, its speed off by 1.4× the power error, and a gold-cup roll's release
 * off by the timing error of a hard read (×2.5: the cup is 1.2 s from the ball's landing when the swipe goes). Targets
 * by level (weak players on a first go: the lane's pace misjudged by about 12 % at the start, learnt a quarter a ball): weak and average players roll for the tower's middle (the 40's front: short a 30, long a 50) and try the gold cup once (average) or never (weak); good ones
 * try it twice and a pocket once; great ones three gold tries and two pocket tries; near-perfect and elite ones chase
 * the gold cup until three are in (at most five tries), then the pockets until two are in (at most three tries), then
 * the 50. The perfect level is the oracle (scripts/ringer-oracle.ts).
 */
import { AR2_GOLD_POINTS, AR_BALLS, AR_INPUT_ROLL, AR_POCKET_POINTS, AR_WAIT, ALLEYROLL_REV_RINGER, type ArState } from "../../../src/lib/arcade/alleyroll";
import { arReleaseScreenX, ringerSwipeFor, ringerSwipeInput } from "../../../src/lib/arcade/alleyrollSwipe";
import { alleyRollOracleEvents, arAim, ORACLE_RELEASE, type ArTarget } from "../../alleyroll-oracle";
import { RINGER_GOLD_X, RINGER_RELEASE, ringerAim, ringerGoldAim, ringerGoldTick, ringerOracleEvents, type RingerTarget } from "../../ringer-oracle";
import { driveEvents, type SkillBot } from "../bot";
import type { Human } from "../human";

const THINK_MS = 900;
const SWIPE_PX = 120;
/** A gold-cup roll's timing is a hard read: the cup is about 1.2 s from where it will be met. */
const GOLD_READ = 5;

const botV1: SkillBot = ({ game, seed, human }) => {
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

/** Each level's tries: gold cups and pockets (`chase`: keep trying until made, within the try limit). */
const RINGER_TRIES: Record<string, { gold: number; pockets: number; chase: boolean; safe?: boolean; short?: number; firstGo?: number }> = {
  weak: { gold: 3, pockets: 1, chase: false, firstGo: 0.25 },
  average: { gold: 2, pockets: 0, chase: false, safe: true },
  good: { gold: 0, pockets: 1, chase: false, short: 6 },
  great: { gold: 0, pockets: 2, chase: false, short: 4 },
  near: { gold: 3, pockets: 2, chase: false, short: 2 },
  elite: { gold: 4, pockets: 3, chase: true, short: 1 },
};

/** A swipe toward an input, through the phone's mapping, with the hand's errors (and a misjudged pace, `bias`). */
function handSwipe(human: Human, aim: { a: number; b: number; c: number }, bias = 0) {
  const want = ringerSwipeFor(aim.b, aim.c);
  const startX = arReleaseScreenX(aim.a) + human.aim(1);
  const slope = want.slope + human.aim(1) / SWIPE_PX;
  let speed = want.speed * human.power(1.4) * (1 + bias);
  if (human.slip()) speed *= human.chance(0.5) ? 0.82 : 1.18;
  const dy = -SWIPE_PX;
  const dx = slope * SWIPE_PX;
  return ringerSwipeInput(startX, dx, dy, Math.hypot(dx, dy) / Math.max(0.05, speed));
}

const botV2: SkillBot = ({ game, seed, human }) => {
  if (human.level === "perfect") return { events: ringerOracleEvents(seed).events };
  const tries = RINGER_TRIES[human.level]!;
  let rollAt = -1;
  let kind: "gold" | RingerTarget = "fifty";
  let goldTries = 0;
  let pocketTries = 0;
  // A first go: the lane's pace misjudged at the start, learnt a quarter at a time ball by ball.
  let bias = (tries.firstGo ?? 0) * human.normal();
  const { events } = driveEvents<ArState>(game, (s, t) => {
    if (s.phase !== AR_WAIT || s.balls.length >= AR_BALLS) {
      rollAt = -1;
      return null;
    }
    if (rollAt < 0) {
      const golds = s.balls.filter((b) => b.points === AR2_GOLD_POINTS).length;
      const pockets = s.balls.filter((b) => b.points === AR_POCKET_POINTS).length;
      const left = AR_BALLS - s.balls.length;
      const goldWanted = tries.chase ? golds < 3 && goldTries < tries.gold : goldTries < tries.gold;
      const pocketWanted = tries.chase ? pockets < 2 && pocketTries < tries.pockets : pocketTries < tries.pockets;
      // Leave room for the pockets: a chaser stops on gold with as many balls left as pocket tries it still wants.
      if (goldWanted && (!pocketWanted || left > Math.min(2, tries.pockets - pocketTries))) kind = "gold";
      else if (pocketWanted) kind = pockets % 2 === 0 ? "left" : "right";
      else kind = tries.safe ? "forty" : "fifty";
      const ready = t + human.thinkTicks(THINK_MS) + human.int(10, 16);
      rollAt = kind === "gold" ? ringerGoldTick(s, ringerGoldAim(RINGER_GOLD_X), ready) + human.timingTicks(GOLD_READ) : ready;
      if (kind === "gold") goldTries++;
      else if (kind !== "fifty") pocketTries++;
    }
    if (t < rollAt) return null;
    rollAt = -1;
    const aim = kind === "gold" ? ringerGoldAim(RINGER_GOLD_X) : ringerAim(kind, RINGER_RELEASE[kind], kind === "fifty" ? tries.short ?? 0 : 0);
    const input = handSwipe(human, aim, bias);
    bias *= 0.75;
    return input ? { ...input, d: 0 } : null;
  }, game.init(seed) as ArState);
  return { events };
};

export const bot: SkillBot = (ctx) => ((ctx.rev ?? 1) >= ALLEYROLL_REV_RINGER ? botV2(ctx) : botV1(ctx));
