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
  rallyPaddleWOf,
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
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";

/** Finger top speed, px a tick (world px are phone px here). */
const FINGER: Record<SkillLevel, number> = { weak: 20, average: 26, good: 32, great: 38, near: 44, elite: 47, perfect: 47 };
/** Landing-read error per tick of remaining flight, px. */
const READ: Record<SkillLevel, number> = { weak: 0.29, average: 0.22, good: 0.15, great: 0.1, near: 0.06, elite: 0.04, perfect: 0 };
/** Chance of trying to steer a gold ball to a pad. */
const STEER: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0.3, great: 0.6, near: 0.85, elite: 0.975, perfect: 1 };
/** rallyRev 10: chance of going for a gold bonus target with a return, and the aim error on the paddle (px, sd). */
const BONUS: Record<SkillLevel, number> = { weak: 0.1, average: 0.25, good: 0.5, great: 0.75, near: 0.9, elite: 1, perfect: 1 };
const BONUS_AIM: Record<SkillLevel, number> = { weak: 9, average: 7, good: 5, great: 3.6, near: 2.6, elite: 1.6, perfect: 0 };
/** rallyRev 10: how far from the paddle's centre (share of its half-width) a player dares take a ball to aim it at a target. */
const EDGE: Record<SkillLevel, number> = { weak: 0.4, average: 0.5, good: 0.6, great: 0.7, near: 0.8, elite: 0.85, perfect: 0.9 };
/**
 * rallyRev 10, without the Oct 2026 fixes: chance a player plans two balls at once (takes a gold ball when the blue
 * one lands soon after, if the finger can get from one to the other in time) instead of always leaving the gold one.
 * With the fixes (BotCtx.fixes) every level plans both whenever its finger can (canBoth below).
 */
const BOTH: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0.25, great: 0.5, near: 0.8, elite: 0.95, perfect: 1 };

/**
 * Whether the bots play rallyRev 10's gold targets (expansion-e9-bands.ts turns it off to measure each
 * feature's own payout on the same seeds).
 */
export const rallyBotOptions = { features: true };

/**
 * D5's ladder (rallyRev 14 with the Oct 2026 fixes only, 23 Nov 2026; Joe: a strong player uses spin shots, and the
 * paddle's width only tells when the paddle is put with a person's error). Every older revision, and every run without
 * the fixes, plays exactly as before.
 *
 *  - PLACE_SD: a seeded normal error on where the paddle is put for each ball (px, sd), fixed once per read (the spec's
 *    aim-error bot: 10 px average, 4 px elite).
 *  - SPIN_TRY: the chance a player tries a spin shot when one is in reach and the court is safe (no other ball landing
 *    soon after): the better levels only.
 *  - SPIN_V / SPIN_OFF: the sweeps (px a tick at contact) and contact points (shares of the paddle's half-width) a player
 *    weighs for a spin shot; the planner plays each forward from what the player has seen (the lagged view and the
 *    finger's own moves since) and keeps the one whose curling ball strikes a pink pad or a gold target soonest.
 */
const PLACE_SD: Record<SkillLevel, number> = { weak: 13, average: 10, good: 8, great: 6, near: 5, elite: 4, perfect: 0 };
const SPIN_TRY: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0, great: 0.3, near: 0.6, elite: 0.9, perfect: 1 };
const SPIN_V = [-8, -6, -4, -2.5, 2.5, 4, 6, 8];
const SPIN_OFF = [-0.6, -0.3, 0, 0.3, 0.6];
/** Ticks the sweep runs before contact, and how long after contact the planner follows the curling ball. */
const SPIN_SWEEP = 7;
const SPIN_LOOK = 110;
/** A spin shot is planned once the ball, as seen, is at most this many ticks from the paddle (and at least the sweep away). */
const SPIN_PLAN_T = 34;
/** The sweep carries on this many ticks past the expected contact (the hit can come a tick or two either side). */
const SPIN_AFTER = 3;
/**
 * A shot is kept only when it still scores with the wall bounces' small seeded nudges drawn differently after the hit
 * (these XOR masks on the fork's generator): a player aims a curve at a pad or a target, never at one exact bounce.
 */
const SPIN_ROBUST = [0x5a17c3e1, 0x2c9e6b4d];

interface SpinPlan {
  /** The expected contact tick, the paddle's centre there and the sweep's speed (px a tick, signed). */
  tc: number;
  centre: number;
  v: number;
}
/** One read of a ball segment (fixed once read); `place`, `spin` and `plan` on rallyRev 14 with the fixes only. */
interface Read {
  err: number;
  steer: number;
  bonus: number;
  aimErr: number;
  seenAt: number;
  place?: number;
  spin?: number;
  plan?: SpinPlan | null;
}
/** Where a spin shot puts the paddle's centre on a tick: moving at v through the contact point. */
function sweepAt(p: SpinPlan, t: number): number {
  return p.centre + p.v * Math.max(-SPIN_SWEEP, Math.min(SPIN_AFTER, t - p.tc));
}

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

export const bot: SkillBot = ({ game, seed, human, fixes }) => {
  /** Oct 2026 competence fixes (BotCtx.fixes): a gold ball is given up for the blue one only when both can't be reached. */
  const fx = Boolean(fixes);
  const init = game.init(seed) as RallyState;
  PADDLE_Y = rallyPaddleY(init);
  WORLD_W = rallyWorldW(init);
  // rallyRev 10's own court (the planning below is new there; older revisions play exactly as before), and its targets.
  const tenCourt = !!init.exp;
  const bonusOn = tenCourt && rallyBotOptions.features;
  const level = human.level;
  const history: RallyState[] = [];
  let finger = WORLD_W / 2;
  /** Read error per ball segment (key: which ball + direction sign + hit count), fixed once read. */
  const reads = new Map<string, Read>();
  const lag = human.lagTicks();
  /** Attention: switching to a different ball costs one reaction before the finger heads for it. */
  let focus = "";
  let switchAt = 0;
  let held = finger;
  const plans = new Map<string, boolean>();
  /** rallyRev 14 with the fixes (D5's ladder): the placement error and spin shots (PLACE_SD, SPIN_TRY above). */
  const fx16 = fx && Boolean(init.ladder);
  /** The finger's position given on each tick (the planner replays the player's own moves since the lagged view). */
  const fingers: number[] = [];
  /** Mean reaction in ticks: the pause before the finger heads for the next ball. */
  const react = Math.round(human.p.reactionMs[0] / (1000 / 60));
  /**
   * Can the finger take `first` and still get to `second` (one reaction to switch, then at top speed, the
   * paddle's half-width to spare)? A strong player keeps both balls when they can.
   */
  const canBoth = (first: { x: number; t: number }, second: { x: number; t: number }, s: RallyState): boolean => {
    const half = rallyPaddleWOf(s, 1) / 2;
    const step = FINGER[level]!;
    const reachFirst = Math.max(0, Math.abs(first.x - finger) - half * 0.6) / step;
    const reachSecond = react + Math.max(0, Math.abs(second.x - first.x) - half * 0.6) / step;
    return reachFirst <= first.t - lag && reachSecond + 2 <= second.t - first.t;
  };
  const drag = (x: number) => ({ k: ARCADE_INPUT_DRAG, a: Math.max(0, Math.min(WORLD_W, Math.round(x))), b: 0, c: 0, d: 0, t: 0 });
  /**
   * rallyRev 14 with the fixes: the spin shot for the ball about to land (main: the blue ball, else a gold one), as the
   * player can know it: the lagged view stepped on with the finger's own moves since, then each sweep and contact point
   * played forward through the sim with the finger at its own top speed; the shot kept is the one whose curling ball
   * strikes a pink pad or a gold target soonest, the blue ball kept, for the bounces' nudges as dealt and as two other
   * draws (SPIN_ROBUST). Null when none does.
   */
  const planSpin = (seen: RallyState, t: number, main: boolean, landX: number, landT: number, half: number): SpinPlan | null => {
    let now = seen;
    for (let tt = seen.tick + 1; tt < t && !game.isOver(now); tt++) now = game.step(now, drag(fingers[tt] ?? finger));
    const tc = seen.tick + Math.ceil(landT);
    const hitsOf = (st: RallyState) => (main ? st.hits : st.goldHits);
    const step = FINGER[level]!;
    /** The tick the planned shot scores a spin shot (-1: it does not), with the bounces' generator XORed by `mask` after the hit. */
    const play = (p: SpinPlan, mask: number): number => {
      let st = now;
      let fx = finger;
      const hits0 = hitsOf(st);
      const spins0 = st.spinScores ?? 0;
      const lives0 = st.lives ?? 0;
      let hitAt = -1;
      for (let tt = t; tt <= tc + SPIN_LOOK && !game.isOver(st); tt++) {
        fx += Math.max(-step, Math.min(step, sweepAt(p, tt) - fx));
        st = game.step(st, drag(fx));
        if (hitAt < 0 && hitsOf(st) > hits0) {
          hitAt = tt;
          if (Math.abs(tt - tc) > SPIN_AFTER + 1) return -1;
          if (mask) st = { ...st, rng: (st.rng ^ mask) | 0 };
        }
        if ((st.lives ?? 0) < lives0 || st.dead) return -1;
        if (hitAt < 0 && tt > tc + SPIN_AFTER + 1) return -1;
        if ((st.spinScores ?? 0) > spins0) return hitAt >= 0 ? tt : -1;
      }
      return -1;
    };
    let best: SpinPlan | null = null;
    let bestAt = Infinity;
    for (const v of SPIN_V) {
      for (const share of SPIN_OFF) {
        const p = { tc, centre: landX - share * half, v };
        const at = play(p, 0);
        if (at < 0 || at >= bestAt) continue;
        if (SPIN_ROBUST.every((mask) => play(p, mask) >= 0)) {
          best = p;
          bestAt = at;
        }
      }
    }
    return best;
  };
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
      if (fx) {
        if (!canBoth(aim, blue, s)) aim = blue;
      } else {
        const key = `both:${aim.key}:${blue.key}`;
        let both = plans.get(key);
        if (both === undefined) plans.set(key, (both = tenCourt && human.chance(BOTH[level]!)));
        const half = rallyPaddleWOf(s) / 2;
        const reach = FINGER[level]! * Math.max(0, blue.t - aim.t - 6) + half * 0.8;
        if (!both || Math.abs(blue.x - aim.x) > reach) aim = blue;
      }
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
        // rallyRev 14 with the fixes: where the paddle is put (drawn after everything older revisions draw).
        if (fx16) {
          r.place = human.normal() * PLACE_SD[level]!;
          r.spin = human.chance(SPIN_TRY[level]!) ? 1 : 0;
        }
        reads.set(aim.key, r);
      }
      // The read sharpens as the ball comes in, but one reaction late.
      const half = rallyPaddleWOf(s) / 2;
      const err = r.err * (READ[level]! * aim.t + human.p.aimSdPx * 0.6);
      let off = 0;
      let goal: number | null = null;
      // rallyRev 10: a gold bonus target up when the return would reach it: take the ball where it goes there.
      let bonusOff: number | null = null;
      // Only when it is safe: no other ball lands soon after (the paddle must get back in time), and the
      // contact point the target needs is well inside the paddle (better players use more of it).
      const busy = cands.some((c) => c !== aim && c.t - aim.t < 40);
      if (r.bonus && s.bonus && !busy) {
        const speed = Math.min(RALLY_SPEED_CAP, Math.trunc((s.speed * 103) / 100));
        for (let n = 0; n < s.bonus.length && bonusOff === null; n++) {
          const tg = s.bonus[n]!;
          const est = offsetFor(aim.x, aim.ball.vx, aim.ball.vy, speed, half, tg.x, tg.y);
          if (!est) continue;
          const at = s.tick + Math.round(aim.t) + Math.round(est.ticks);
          if (Math.abs(est.off) <= half * EDGE[level]! && rallyBonusLive(s, n, at) && rallyBonusLive(s, n, at + 6)) bonusOff = est.off;
        }
      }
      // rallyRev 14 with the fixes: a spin shot, planned once for this ball when it is close and the court is safe.
      if (fx16 && r.spin && r.plan === undefined && !busy && aim.t <= SPIN_PLAN_T && aim.t > SPIN_SWEEP + 2) {
        r.plan = planSpin(seen, t, aim.id === "m", aim.x, aim.t, half);
        if (r.plan && level !== "perfect") r.plan = { ...r.plan, v: r.plan.v * human.power() };
      }
      const plan = fx16 && r.plan && t <= r.plan.tc + SPIN_AFTER ? r.plan : null;
      if (plan) {
        // The sweep: the paddle's centre reaches the contact point on the contact tick, moving at the planned speed.
        target = sweepAt(plan, t) + (r.place ?? 0);
      } else if (bonusOff !== null) {
        // The ball meets the paddle `bonusOff` px from its centre: the paddle's centre goes that far the other way.
        target = aim.x - bonusOff + r.aimErr * BONUS_AIM[level]! + err * 0.5 + (r.place ?? 0);
      } else {
        if (r.steer === 1 && s.live && s.spots) goal = rallyTargetLeft(s.spots, s.live[0] ?? 0) + RALLY_TARGET_W / 2;
        // Aim the return towards the goal: hit the ball on the side facing away from it.
        if (goal !== null) off = (goal < aim.x ? 1 : -1) * half * 0.5;
        target = aim.x + off + err + (r.place ?? 0);
      }
      if (human.slip(0.02)) target += human.normal() * half * 2;
    }
    const step = FINGER[level]!;
    finger += Math.max(-step, Math.min(step, target - finger));
    const out = Math.max(0, Math.min(WORLD_W, Math.round(finger)));
    fingers[t] = out;
    return { k: ARCADE_INPUT_DRAG, a: out, b: 0, c: 0, d: 0 };
  }, init);
};
