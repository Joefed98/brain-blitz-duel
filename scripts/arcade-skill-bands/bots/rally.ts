/**
 * Rally: the finger chases where it thinks the next ball will reach the paddle.
 * The human sees the field late (tracking lag), reads each ball's landing with
 * an error that grows with its remaining flight time (re-read after every
 * bounce, one reaction later), and moves the finger at a human top speed.
 * Gold balls are aimed off-centre towards a pink pad by the better levels.
 *
 * rallyRev 10 (the expansion, docs/expansions/e9.md): the court is 420 wide.
 * While a gold bonus target is up (or about to be), a player who goes for it
 * works out where on the paddle to take the ball so the return crosses the
 * target (straight flight with wall bounces, the player's own estimate) and
 * takes it there, with an aim error of their level; the better the level, the
 * more often they try and the closer the aim.
 */
import { ARCADE_INPUT_DRAG } from "../../../src/lib/arcade/engine";
import {
  rallyBonusLive,
  rallyPaddleW,
  rallyTotalHits,
  rallyTargetLeft,
  rallyWorldW,
  RALLY_BALL_R,
  rallyPaddleY,
  RALLY_MIN_VY,
  RALLY_SPEED_CAP,
  RALLY_TARGET_W,
  RALLY_V10_BONUS_R,
  RALLY_WALL,
  type RallyBall,
  type RallyState,
} from "../../../src/lib/arcade/rally";
import { driveEvents, type SkillBot } from "../bot";

/** Finger top speed, px a tick (world px are phone px here). */
const FINGER: Record<string, number> = { weak: 22, average: 26, good: 32, great: 38, near: 44, elite: 48 };
/** Landing-read error per tick of remaining flight, px. */
const READ: Record<string, number> = { weak: 0.3, average: 0.22, good: 0.15, great: 0.1, near: 0.06, elite: 0.04 };
/** Chance of trying to steer a gold ball to a pad. */
const STEER: Record<string, number> = { weak: 0, average: 0, good: 0.3, great: 0.6, near: 0.85, elite: 0.9 };
/** rallyRev 10: chance of going for a gold bonus target with a return, and the aim error on the paddle (px, sd). */
const BONUS: Record<string, number> = { weak: 0.1, average: 0.25, good: 0.5, great: 0.75, near: 0.9, elite: 1 };
const BONUS_AIM: Record<string, number> = { weak: 9, average: 7, good: 5, great: 3.6, near: 2.6, elite: 1.6 };
/**
 * rallyRev 10: chance a player plans two balls at once (takes a gold ball when the blue one lands soon after,
 * if the finger can get from one to the other in time) instead of always leaving the gold one.
 */
const BOTH: Record<string, number> = { weak: 0, average: 0, good: 0.25, great: 0.5, near: 0.8, elite: 0.95 };

/**
 * Whether the bots play rallyRev 10's gold targets (expansion-e9-bands.ts turns it off to measure each
 * feature's own payout on the same seeds).
 */
export const rallyBotOptions = { features: true };

/** The paddle line and court width, set per run from the game's own court. */
let PADDLE_Y = 0;
let WORLD_W = 390;

function landing(b: RallyBall): { x: number; t: number } | null {
  if (b.vy <= 0) return null;
  const t = ((PADDLE_Y - RALLY_BALL_R) * 256 - b.y) / b.vy;
  if (t < 0) return null;
  return { x: fold(b.x + b.vx * t) / 256, t };
}

/** A straight flight's x (1/256 px) folded between the side walls. */
function fold(x: number): number {
  const lo = (RALLY_WALL + RALLY_BALL_R) * 256;
  const w = (WORLD_W - RALLY_WALL - RALLY_BALL_R) * 256 - lo;
  let v = x - lo;
  v = ((v % (2 * w)) + 2 * w) % (2 * w);
  if (v > w) v = 2 * w - v;
  return v + lo;
}

/**
 * The player's own estimate: the paddle offset (px from the paddle's centre, ball minus centre) that sends a
 * ball arriving with (vx, vy) at x through the point (tx, ty), and the ticks it takes to get there; null when
 * no offset on the paddle does.
 */
function offsetFor(x: number, vx: number, vy: number, speed: number, half: number, tx: number, ty: number): { off: number; ticks: number } | null {
  let best: { off: number; ticks: number; miss: number } | null = null;
  for (let off = -half; off <= half; off += 1) {
    const ox = off * 256 / Math.max(1, half) + vx / 4;
    const oy = -Math.max(RALLY_MIN_VY, Math.abs(vy));
    const len = Math.hypot(ox, oy) || 1;
    const sx = (ox * speed) / len;
    const sy = (oy * speed) / len;
    const ticks = ((ty - PADDLE_Y + RALLY_BALL_R) * 256) / sy;
    if (ticks <= 0) continue;
    const at = fold(x * 256 + sx * ticks) / 256;
    const miss = Math.abs(at - tx);
    if (!best || miss < best.miss) best = { off, ticks, miss };
  }
  return best && best.miss < RALLY_V10_BONUS_R ? { off: best.off, ticks: best.ticks } : null;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const init = game.init(seed) as RallyState;
  PADDLE_Y = rallyPaddleY(init);
  WORLD_W = rallyWorldW(init);
  const bonusOn = !!init.exp && rallyBotOptions.features;
  const level = human.level;
  const history: RallyState[] = [];
  let finger = WORLD_W / 2;
  /** Read error per ball segment (key: which ball + direction sign + hit count), fixed once read. */
  const reads = new Map<string, { err: number; steer: number; bonus: number; aimErr: number; seenAt: number }>();
  const lag = human.lagTicks();
  /** Attention: switching to a different ball costs one reaction before the finger heads for it. */
  let focus = "";
  let switchAt = 0;
  let held = finger;
  const plans = new Map<string, boolean>();
  return driveEvents(game, (s: RallyState, t) => {
    history.push(s);
    const seen = history[Math.max(0, history.length - 1 - lag)]!;
    const balls: { ball: RallyBall; key: string; id: string; gold: boolean }[] = [{ ball: seen, key: `m${Math.sign(seen.vx)}${seen.hits}`, id: "m", gold: false }];
    seen.golds.forEach((g, i) => balls.push({ ball: g, key: `g${i}${Math.sign(g.vx)}${seen.goldHits}`, id: `g${i}`, gold: true }));
    const cands: { x: number; t: number; gold: boolean; key: string; id: string; ball: RallyBall }[] = [];
    for (const b of balls) {
      const l = landing(b.ball);
      if (l) cands.push({ ...l, gold: b.gold, key: b.key, id: b.id, ball: b.ball });
    }
    cands.sort((a, b) => a.t - b.t);
    let aim = cands[0];
    // Don't chase a gold ball if the blue one (which ends the run) lands soon after it, unless the player
    // plans both and the finger can get from the gold ball to the blue one in time (with a reaction's margin).
    const blue = cands.find((c) => !c.gold);
    if (aim && aim.gold && blue && blue.t - aim.t < 30) {
      const key = `both:${aim.key}:${blue.key}`;
      let both = plans.get(key);
      if (both === undefined) plans.set(key, (both = bonusOn && human.chance(BOTH[level]!)));
      const half = rallyPaddleW(rallyTotalHits(s)) / 2;
      const reach = FINGER[level]! * Math.max(0, blue.t - aim.t - 6) + half * 0.8;
      if (!both || Math.abs(blue.x - aim.x) > reach) aim = blue;
    }
    let target = finger;
    if (aim && aim.id !== focus) {
      focus = aim.id;
      switchAt = t + human.reactTicks();
      held = finger;
    }
    if (aim && t < switchAt) target = held;
    else if (aim) {
      let r = reads.get(aim.key);
      if (!r) {
        // (Older revisions draw exactly what they always drew: the err, then the steer.)
        r = { err: human.normal(), steer: aim.gold && human.chance(STEER[level]!) ? 1 : 0, bonus: bonusOn && human.chance(BONUS[level]!) ? 1 : 0, aimErr: bonusOn ? human.normal() : 0, seenAt: t };
        reads.set(aim.key, r);
      }
      // The read sharpens as the ball comes in, but one reaction late.
      const half = rallyPaddleW(rallyTotalHits(s)) / 2;
      const err = r.err * (READ[level]! * aim.t + human.p.aimSdPx * 0.6);
      let off = 0;
      let goal: number | null = null;
      // rallyRev 10: a gold bonus target up when the return would reach it: take the ball where it goes there.
      let bonusOff: number | null = null;
      if (r.bonus && s.bonus) {
        const speed = Math.min(RALLY_SPEED_CAP, Math.trunc((s.speed * 103) / 100));
        for (let n = 0; n < s.bonus.length && bonusOff === null; n++) {
          const tg = s.bonus[n]!;
          const est = offsetFor(aim.x, aim.ball.vx, aim.ball.vy, speed, half, tg.x, tg.y);
          if (!est) continue;
          const at = s.tick + Math.round(aim.t) + Math.round(est.ticks);
          if (rallyBonusLive(s, n, at) && rallyBonusLive(s, n, at + 6)) bonusOff = est.off;
        }
      }
      if (bonusOff !== null) {
        // The ball meets the paddle `bonusOff` px from its centre: the paddle's centre goes that far the other way.
        target = aim.x - bonusOff + r.aimErr * BONUS_AIM[level]! + err * 0.5;
      } else {
        if (r.steer === 1 && s.live && s.spots) goal = rallyTargetLeft(s.spots, s.live[0] ?? 0) + RALLY_TARGET_W / 2;
        // Aim the return towards the goal: hit the ball on the side facing away from it.
        if (goal !== null) off = (goal < aim.x ? 1 : -1) * half * 0.5;
        target = aim.x + off + err;
      }
      if (human.slip(0.02)) target += human.normal() * half * 2;
    }
    const step = FINGER[level]!;
    finger += Math.max(-step, Math.min(step, target - finger));
    return { k: ARCADE_INPUT_DRAG, a: Math.max(0, Math.min(WORLD_W, Math.round(finger))), b: 0, c: 0, d: 0 };
  }, init);
};
