/**
 * Rally: the finger chases where it thinks the next ball will reach the paddle.
 * The human sees the field late (tracking lag), reads each ball's landing with
 * an error that grows with its remaining flight time (re-read after every
 * bounce, one reaction later), and moves the finger at a human top speed.
 * Gold balls are aimed off-centre towards a pink pad by the better levels.
 */
import { ARCADE_INPUT_DRAG } from "../../../src/lib/arcade/engine";
import { rallyPaddleW, rallyTotalHits, rallyTargetLeft, RALLY_BALL_R, rallyPaddleY, RALLY_TARGET_W, RALLY_WALL, RALLY_WORLD_W, type RallyBall, type RallyState } from "../../../src/lib/arcade/rally";
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";

/** Finger top speed, px a tick (world px are phone px here). */
const FINGER: Record<SkillLevel, number> = { weak: 20, average: 26, good: 32, great: 38, near: 44, elite: 47, perfect: 47 };
/** Landing-read error per tick of remaining flight, px. */
const READ: Record<SkillLevel, number> = { weak: 0.29, average: 0.22, good: 0.15, great: 0.1, near: 0.06, elite: 0.04, perfect: 0 };
/** Chance of trying to steer a gold ball to a pad. */
const STEER: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0.3, great: 0.6, near: 0.85, elite: 0.975, perfect: 1 };

/** The paddle line, set per run from the game's own court (rallyRev 6's taller court). */
let PADDLE_Y = 0;

function landing(b: RallyBall): { x: number; t: number } | null {
  if (b.vy <= 0) return null;
  const t = ((PADDLE_Y - RALLY_BALL_R) * 256 - b.y) / b.vy;
  if (t < 0) return null;
  const lo = (RALLY_WALL + RALLY_BALL_R) * 256;
  const w = (RALLY_WORLD_W - RALLY_WALL - RALLY_BALL_R) * 256 - lo;
  let x = b.x + b.vx * t - lo;
  x = ((x % (2 * w)) + 2 * w) % (2 * w);
  if (x > w) x = 2 * w - x;
  return { x: (x + lo) / 256, t };
}

export const bot: SkillBot = ({ game, seed, human, fixes }) => {
  /** Oct 2026 competence fixes (BotCtx.fixes): a gold ball is given up for the blue one only when both can't be reached. */
  const fx = Boolean(fixes);
  PADDLE_Y = rallyPaddleY(game.init(seed));
  const level = human.level;
  const history: RallyState[] = [];
  let finger = RALLY_WORLD_W / 2;
  /** Read error per ball segment (key: which ball + direction sign + hit count), fixed once read. */
  const reads = new Map<string, { err: number; steer: number; seenAt: number }>();
  const lag = human.lagTicks();
  /** Attention: switching to a different ball costs one reaction before the finger heads for it. */
  let focus = "";
  let switchAt = 0;
  let held = finger;
  const init = game.init(seed) as RallyState;
  /** Mean reaction in ticks: the pause before the finger heads for the next ball. */
  const react = Math.round(human.p.reactionMs[0] / (1000 / 60));
  /**
   * Can the finger take `first` and still get to `second` (one reaction to switch, then at top speed, the
   * paddle's half-width to spare)? A strong player keeps both balls when they can.
   */
  const canBoth = (first: { x: number; t: number }, second: { x: number; t: number }, s: RallyState): boolean => {
    const half = rallyPaddleW(rallyTotalHits(s) + 1) / 2;
    const step = FINGER[level]!;
    const reachFirst = Math.max(0, Math.abs(first.x - finger) - half * 0.6) / step;
    const reachSecond = react + Math.max(0, Math.abs(second.x - first.x) - half * 0.6) / step;
    return reachFirst <= first.t - lag && reachSecond + 2 <= second.t - first.t;
  };
  return driveEvents(game, (s: RallyState, t) => {
    history.push(s);
    const seen = history[Math.max(0, history.length - 1 - lag)]!;
    const balls: { ball: RallyBall; key: string; id: string; gold: boolean }[] = [{ ball: seen, key: `m${Math.sign(seen.vx)}${seen.hits}`, id: "m", gold: false }];
    seen.golds.forEach((g, i) => balls.push({ ball: g, key: `g${i}${Math.sign(g.vx)}${seen.goldHits}`, id: `g${i}`, gold: true }));
    const cands: { x: number; t: number; gold: boolean; key: string; id: string }[] = [];
    for (const b of balls) {
      const l = landing(b.ball);
      if (l) cands.push({ ...l, gold: b.gold, key: b.key, id: b.id });
    }
    cands.sort((a, b) => a.t - b.t);
    let aim = cands[0];
    // Don't chase a gold ball if the blue one (which ends the run) lands soon after it.
    const blue = cands.find((c) => !c.gold);
    if (aim && aim.gold && blue && blue.t - aim.t < 30 && !(fx && canBoth(aim, blue, s))) aim = blue;
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
        r = { err: human.normal(), steer: aim.gold && human.chance(STEER[level]!) ? 1 : 0, seenAt: t };
        reads.set(aim.key, r);
      }
      // The read sharpens as the ball comes in, but one reaction late.
      const half = rallyPaddleW(rallyTotalHits(s)) / 2;
      const err = r.err * (READ[level]! * aim.t + human.p.aimSdPx * 0.6);
      let off = 0;
      if (r.steer && s.live && s.spots) {
        // Aim the return towards the nearer live pad: hit the ball on the side facing away from it.
        const pad = rallyTargetLeft(s.spots, s.live[0] ?? 0) + RALLY_TARGET_W / 2;
        off = (pad < aim.x ? 1 : -1) * half * 0.5;
      }
      target = aim.x + off + err;
      if (human.slip(0.02)) target += human.normal() * half * 2;
    }
    const step = FINGER[level]!;
    finger += Math.max(-step, Math.min(step, target - finger));
    return { k: ARCADE_INPUT_DRAG, a: Math.round(finger), b: 0, c: 0, d: 0 };
  }, init);
};
