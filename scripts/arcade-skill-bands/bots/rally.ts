/**
 * Rally: the finger chases where it thinks the next ball will reach the paddle.
 * The human sees the field late (tracking lag), reads each ball's landing with
 * an error that grows with its remaining flight time (re-read after every
 * bounce, one reaction later), and moves the finger at a human top speed.
 * Gold balls are aimed off-centre towards a pink pad by the better levels.
 *
 * rallyRev 9 (the expansion): the court is 420 wide; the twin ball is chased
 * like a gold one (it never ends the run); better players aim the blue ball at
 * the teal multi-ball pad while it is lit, and flick the paddle as a gold ball
 * they are steering at a pad lands, so it curves and earns the spin bonus.
 */
import { ARCADE_INPUT_DRAG } from "../../../src/lib/arcade/engine";
import { rallyDeepPadLeft, rallyPaddleW, rallyTotalHits, rallyTargetLeft, rallyWorldW, RALLY_BALL_R, RALLY_HUD_H, rallyPaddleY, RALLY_TARGET_W, RALLY_V9_MULTI_W, RALLY_WALL, type RallyBall, type RallyState } from "../../../src/lib/arcade/rally";
import { driveEvents, type SkillBot } from "../bot";

/** Finger top speed, px a tick (world px are phone px here). */
const FINGER: Record<string, number> = { average: 26, good: 32, great: 38, near: 44 };
/** Landing-read error per tick of remaining flight, px. */
const READ: Record<string, number> = { average: 0.22, good: 0.15, great: 0.1, near: 0.06 };
/** Chance of trying to steer a gold ball to a pad. */
const STEER: Record<string, number> = { average: 0, good: 0.3, great: 0.6, near: 0.85 };
/** rallyRev 9: chance of flicking the paddle at contact on a steered gold ball, and of aiming the blue ball at a lit multi-ball pad. */
const FLICK: Record<string, number> = { average: 0, good: 0.1, great: 0.45, near: 0.8 };
const MULTI: Record<string, number> = { average: 0, good: 0.15, great: 0.5, near: 0.8 };

/** The paddle line and court width, set per run from the game's own court. */
let PADDLE_Y = 0;
let WORLD_W = 390;

function landing(b: RallyBall): { x: number; t: number } | null {
  if (b.vy <= 0) return null;
  const t = ((PADDLE_Y - RALLY_BALL_R) * 256 - b.y) / b.vy;
  if (t < 0) return null;
  const lo = (RALLY_WALL + RALLY_BALL_R) * 256;
  const w = (WORLD_W - RALLY_WALL - RALLY_BALL_R) * 256 - lo;
  let x = b.x + b.vx * t - lo;
  x = ((x % (2 * w)) + 2 * w) % (2 * w);
  if (x > w) x = 2 * w - x;
  return { x: (x + lo) / 256, t };
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const init = game.init(seed) as RallyState;
  PADDLE_Y = rallyPaddleY(init);
  WORLD_W = rallyWorldW(init);
  const deep = !!init.deep;
  const level = human.level;
  const history: RallyState[] = [];
  let finger = WORLD_W / 2;
  /** Read error per ball segment (key: which ball + direction sign + hit count), fixed once read. */
  const reads = new Map<string, { err: number; steer: number; flick: number; seenAt: number }>();
  const lag = human.lagTicks();
  /** Attention: switching to a different ball costs one reaction before the finger heads for it. */
  let focus = "";
  let switchAt = 0;
  let held = finger;
  return driveEvents(game, (s: RallyState, t) => {
    history.push(s);
    const seen = history[Math.max(0, history.length - 1 - lag)]!;
    const balls: { ball: RallyBall; key: string; id: string; gold: boolean; twin?: boolean }[] = [{ ball: seen, key: `m${Math.sign(seen.vx)}${seen.hits}`, id: "m", gold: false }];
    seen.golds.forEach((g, i) => balls.push({ ball: g, key: `g${i}${Math.sign(g.vx)}${seen.goldHits}`, id: `g${i}`, gold: true }));
    if (seen.twin) balls.push({ ball: seen.twin, key: `t${Math.sign(seen.twin.vx)}${seen.twinHits ?? 0}`, id: "t", gold: false, twin: true });
    const cands: { x: number; t: number; gold: boolean; twin: boolean; key: string; id: string }[] = [];
    for (const b of balls) {
      const l = landing(b.ball);
      if (l) cands.push({ ...l, gold: b.gold, twin: !!b.twin, key: b.key, id: b.id });
    }
    cands.sort((a, b) => a.t - b.t);
    let aim = cands[0];
    // Don't chase a gold (or twin) ball if the blue one (which ends the run) lands soon after it.
    const blue = cands.find((c) => !c.gold && !c.twin);
    if (aim && aim.id !== "m" && blue && blue.t - aim.t < 30) aim = blue;
    // The twin is worth least: a gold ball landing soon after it comes first.
    const gold = cands.find((c) => c.gold);
    if (aim && aim.twin && gold && gold.t - aim.t < 30) aim = gold;
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
        const steer = aim.gold && human.chance(STEER[level]!) ? 1 : !aim.gold && !aim.twin && deep && human.chance(MULTI[level]!) ? 2 : 0;
        // A flick only when there is time for it: the blue ball is not about to land as well.
        const calm = !blue || blue.t - aim.t > 45;
        r = { err: human.normal(), steer, flick: steer === 1 && deep && calm && human.chance(FLICK[level]!) ? 1 : 0, seenAt: t };
        reads.set(aim.key, r);
      }
      // The read sharpens as the ball comes in, but one reaction late.
      const half = rallyPaddleW(rallyTotalHits(s)) / 2;
      const err = r.err * (READ[level]! * aim.t + human.p.aimSdPx * 0.6);
      let off = 0;
      let goal: number | null = null;
      if (r.steer === 1 && s.live && s.spots) {
        // On rallyRev 9 the pads glide: lead the pad, aiming where it will be when the return reaches the far wall
        // (the ball's flight up the court at the rally's speed), at whichever of the two pads is nearer then.
        if (deep) {
          const arrive = s.tick + Math.round(aim.t + ((PADDLE_Y - RALLY_HUD_H - RALLY_WALL) * 256) / Math.max(1, s.speed));
          const pads = [0, 1].map((k) => rallyDeepPadLeft(s, k, arrive) + RALLY_TARGET_W / 2);
          goal = Math.abs(pads[0]! - aim.x) <= Math.abs(pads[1]! - aim.x) ? pads[0]! : pads[1]!;
        } else goal = rallyTargetLeft(s.spots, s.live[0] ?? 0) + RALLY_TARGET_W / 2;
      } else if (r.steer === 2 && s.mspots && (s.multiAt ?? 0) > 0 && s.tick + aim.t >= (s.multiAt ?? 0)) {
        goal = (s.mspots[(s.multiSpot ?? 0) % 12] ?? WORLD_W / 2) + RALLY_V9_MULTI_W / 2;
      }
      // Aim the return towards the goal: hit the ball on the side facing away from it.
      if (goal !== null) off = (goal < aim.x ? 1 : -1) * half * 0.5;
      target = aim.x + off + err;
      // A flick: the finger waits a little to one side, then sweeps through the landing point at contact
      // (towards the pad), so the return curves.
      // The flick is timed on the player's own anticipation of contact (the field is seen `lag` ticks late).
      const contact = aim.t - lag;
      if (r.flick && goal !== null && contact < 14) {
        // A short, gentle sweep: spin needs only 2 px a tick of paddle movement at contact.
        const v = 8;
        target -= (goal < aim.x ? -1 : 1) * v * Math.max(0, Math.min(contact, 2));
      }
      if (human.slip(0.02)) target += human.normal() * half * 2;
    }
    const step = FINGER[level]!;
    finger += Math.max(-step, Math.min(step, target - finger));
    return { k: ARCADE_INPUT_DRAG, a: Math.max(0, Math.min(WORLD_W, Math.round(finger))), b: 0, c: 0, d: 0 };
  }, init);
};
