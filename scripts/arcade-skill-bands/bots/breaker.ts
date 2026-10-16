/**
 * Breaker: the finger chases where the player thinks the next ball will reach
 * the paddle (Rally's model). The field is seen late (tracking lag); each
 * falling ball's landing is read with an error that grows with its remaining
 * flight time and is re-read after every bounce; the finger has a top speed.
 * With several balls, attention sits on one (the soonest to land) and moving
 * to another costs a reaction. Better players often land a ball off-centre to
 * send it towards the thickest part of the wall. A falling capsule is chased
 * when the player judges there is time to get back to the ball.
 *
 * Firing a held power-up needs the finger off the screen: a short still tap
 * (under 150 ms), then the finger goes back down and the paddle only follows
 * again once it moves. Players fire when a ball is not about to land and the
 * paddle sits under bricks, a reaction and a short think after the catch.
 */
import { ARCADE_INPUT_BUTTON, ARCADE_INPUT_DRAG } from "../../../src/lib/arcade/engine";
import {
  brkRowOffset,
  BRK_BALL_R,
  BRK_BRICK_W,
  BRK_COLS,
  BRK_PADDLE_W,
  brkPaddleY,
  BRK_POWER_LASER,
  BRK_ROWS,
  BRK_ROW_PITCH,
  BRK_WALL,
  BRK_WALL_X,
  BRK_WALL_Y,
  BRK_WORLD_W,
  BRK_ZONES,
  type BrkBall,
  type BrkState,
} from "../../../src/lib/arcade/breaker";
import { driveEvents, type SkillBot } from "../bot";

/** Finger top speed, px a tick (world px are phone px: the world is 390 wide). */
const FINGER: Record<string, number> = { average: 26, good: 32, great: 38, near: 44 };
/** Landing-read error per tick of remaining flight, px. */
const READ: Record<string, number> = { average: 0.22, good: 0.15, great: 0.1, near: 0.06 };
/** Chance of trying to angle a return towards the bricks (instead of just catching it centrally). */
const STEER: Record<string, number> = { average: 0.1, good: 0.35, great: 0.6, near: 0.85 };
/** Chance of going for a falling capsule at all. */
const CAPSULE: Record<string, number> = { average: 0.55, good: 0.75, great: 0.9, near: 0.97 };
/** Tap: finger down-to-up ticks (must stay under 150 ms = 9 ticks), and finger back down and moving again. */
const TAP: Record<string, number> = { average: 7, good: 6, great: 6, near: 5 };
const REGRIP: Record<string, number> = { average: 12, good: 10, great: 8, near: 6 };

const LO = BRK_WALL + BRK_BALL_R;
const HI = BRK_WORLD_W - BRK_WALL - BRK_BALL_R;
/** The paddle line the ball is caught on: set per run from the game's own world (brkRev 6's taller court). */
let PADDLE_Y = 0;
let CATCH_Y = 0;

/** Where and when a falling ball reaches the paddle line, bouncing off the side walls only. */
function landing(b: BrkBall): { x: number; t: number } | null {
  if (b.vy <= 0) return null;
  const t = (CATCH_Y * 256 - b.y) / b.vy;
  if (t < -1) return null;
  const lo = LO * 256;
  const w = HI * 256 - lo;
  let x = b.x + b.vx * Math.max(0, t) - lo;
  x = ((x % (2 * w)) + 2 * w) % (2 * w);
  if (x > w) x = 2 * w - x;
  return { x: (x + lo) / 256, t: Math.max(0, t) };
}

/**
 * Experience standing in for skill: how many bricks a return off zone z would break soon after.
 * A short look-ahead on a copy of the sim with the paddle parked for that zone until the ball
 * leaves it, then simply following the lowest falling ball. Used only to rank the five zones
 * before the player's own blur and execution error.
 */
function zoneValue(game: { step: (s: BrkState, e: unknown) => BrkState; isOver: (s: BrkState) => boolean }, start: BrkState, landX: number, zone: number): number {
  const off = ((zone + 0.5) * BRK_PADDLE_W) / 5 - BRK_PADDLE_W / 2;
  const park = Math.round(landX - off);
  let s = start;
  let committed = true;
  for (let i = 0; i < 160 && !game.isOver(s); i++) {
    let a = park;
    if (!committed) {
      let best: BrkBall | null = null;
      for (const b of s.balls) if (b.vy > 0 && (!best || b.y > best.y)) best = b;
      a = best ? Math.round(best.x / 256) : s.paddleX;
    }
    s = game.step(s, { t: s.tick + 1, k: ARCADE_INPUT_DRAG, a: Math.max(0, Math.min(BRK_WORLD_W, a)), b: 0, c: 0, d: 0 });
    if (committed && s.balls.some((b) => b.vy < 0 && b.y > (CATCH_Y - 20) * 256)) committed = false;
    if (s.losses > start.losses) return s.hits - start.hits - 20;
  }
  return s.hits - start.hits;
}

/** Live bricks above the paddle centre, bottom-up (what a laser or a fired ball would meet). */
function columnBricks(s: BrkState, x: number): number {
  let n = 0;
  for (let row = BRK_ROWS - 1; row >= 0; row--) {
    const local = x - BRK_WALL_X - brkRowOffset(s, row, s.tick);
    if (local < 0) continue;
    const col = Math.trunc(local / BRK_BRICK_W);
    if (col >= BRK_COLS) continue;
    if ((s.bricks[row * BRK_COLS + col] ?? 0) > 0) n++;
  }
  return n;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  PADDLE_Y = brkPaddleY(game.init(seed));
  CATCH_Y = PADDLE_Y - BRK_BALL_R;
  const level = human.level;
  const speed = FINGER[level]!;
  const history: BrkState[] = [];
  const lag = human.lagTicks();
  const init = game.init(seed) as BrkState;
  let finger = init.paddleX;
  let sent = init.aimX;
  /** Read per ball segment, fixed once read. */
  const reads = new Map<string, { err: number; zone: number }>();
  /** Capsules the player has decided about (key: spawn x and spawn tick). */
  const capsuleWill = new Map<string, boolean>();
  let focus = "";
  let switchAt = 0;
  let held = finger;
  /** Firing: when the player has taken in the power-up, and the tap/regrip schedule. */
  let heldSince = -1;
  let heldKind = 0;
  let fireReadyAt = 0;
  const presses = new Set<number>();
  let frozenUntil = 0;
  let catchHits = -1;

  return driveEvents(game, (s: BrkState, t) => {
    history.push(s);
    // Hits at the last paddle bounce.
    const prev = history[history.length - 2];
    if (prev && s.balls.some((b, i) => !b.spam && b.vy < 0 && (prev.balls[i]?.vy ?? 0) > 0 && b.y > (CATCH_Y - 10) * 256)) catchHits = s.hits;
    const seen = history[Math.max(0, history.length - 1 - lag)]!;

    // A press scheduled for this tick goes first (the phone sends one event a tick).
    if (presses.has(t)) {
      presses.delete(t);
      // The phone only sends a tap while something is held.
      if (s.held) return { k: ARCADE_INPUT_BUTTON, a: 0, b: 0, c: 0, d: 0 };
    }

    // Candidates: falling balls (seen late), and capsules worth chasing.
    type Cand = { x: number; t: number; key: string; id: string; ball: boolean; seg: string };
    const cands: Cand[] = [];
    seen.balls.forEach((b, i) => {
      if (b.spam) return;
      const l = landing(b);
      if (l) cands.push({ ...l, key: `b${i}`, id: `b${i}`, ball: true, seg: `b${i}:${Math.sign(b.vx)}:${seen.hits}:${seen.losses}` });
    });
    cands.sort((a, b) => a.t - b.t);
    const firstBall = cands[0];
    for (const c of seen.capsules) {
      const key = `c${c.x}:${c.kind}`;
      if (!capsuleWill.has(key)) capsuleWill.set(key, human.chance(CAPSULE[level]!));
      if (!capsuleWill.get(key)) continue;
      const ct = (PADDLE_Y * 256 - c.y) / 640;
      if (ct < 0) continue;
      const cx = c.x / 256;
      // Go for it only if, after catching it, the finger can still reach the next ball in time
      // (judged with the player's own blur on the margin).
      if (firstBall) {
        const back = Math.abs(firstBall.x - cx) / speed + 12;
        const margin = firstBall.t - ct - back;
        if (margin * (1 + human.p.judgement * human.normal()) < 0) continue;
      }
      cands.push({ x: cx, t: ct, key, id: key, ball: false, seg: key });
    }
    cands.sort((a, b) => a.t - b.t);
    const aim = cands[0];

    let target = finger;
    if (aim && aim.id !== focus) {
      focus = aim.id;
      switchAt = t + human.reactTicks();
      held = finger;
    }
    if (aim && t < switchAt) target = held;
    else if (aim) {
      let r = reads.get(aim.seg);
      if (!r) {
        let zone = 2;
        // A return that hit nothing (the ball looping up an empty channel) makes anyone try an angle.
        const dry = s.hits === catchHits;
        const steer = STEER[level]! + (dry ? (1 - STEER[level]!) * 0.6 : 0);
        if (aim.ball && human.chance(steer)) {
          const values = [0, 1, 2, 3, 4].map((z) => zoneValue(game, s, aim.x, z));
          zone = human.pick(values);
        }
        r = { err: human.normal(), zone };
        reads.set(aim.seg, r);
      }
      const err = r.err * (READ[level]! * aim.t + human.p.aimSdPx * 0.6);
      // Land the ball on the chosen zone: the paddle centre sits off the ball by the zone's offset.
      const off = aim.ball ? ((r.zone + 0.5) * BRK_PADDLE_W) / 5 - BRK_PADDLE_W / 2 : 0;
      target = aim.x - off + err;
      if (human.slip(0.02)) target += human.normal() * BRK_PADDLE_W;
    } else if (seen.balls.length > 0) {
      // Nothing falling: drift under the ball that will come down first.
      const b = seen.balls.find((x) => !x.spam) ?? seen.balls[0]!;
      target = finger + (b.x / 256 - finger) * 0.15;
    }

    // Held power-up: notice it, then fire at a sensible moment.
    if (s.held && heldSince < 0) {
      heldSince = t;
      heldKind = s.held;
      fireReadyAt = t + human.reactTicks() + human.thinkTicks(250);
    }
    if (!s.held) heldSince = -1;
    if (s.held && heldSince >= 0 && t >= fireReadyAt && t >= frozenUntil) {
      const taps = heldKind === BRK_POWER_LASER + 1 ? 1 : s.charges;
      const cycle = TAP[level]! + 4;
      const need = taps * cycle + REGRIP[level]! + (firstBall ? Math.abs(firstBall.x - finger) / speed : 0) + 10;
      const ballT = firstBall ? firstBall.t : 999;
      const useful = columnBricks(s, s.paddleX) >= (heldKind === BRK_POWER_LASER + 1 ? 3 : 1);
      const waited = t - heldSince > 300;
      const go = (ballT * (1 + human.p.judgement * human.normal()) > need && (useful || waited)) || human.slip(0.02);
      if (go) {
        // Finger lifts now; each tap's press lands as the finger comes up.
        let at = t + TAP[level]!;
        for (let i = 0; i < taps; i++) {
          presses.add(at);
          at += cycle + Math.max(0, human.timingTicks());
        }
        frozenUntil = at - cycle + 4 + REGRIP[level]! + Math.max(0, human.timingTicks());
        fireReadyAt = frozenUntil + 1;
      } else fireReadyAt = t + 6;
    }

    // Finger off the glass: the paddle stays where it was.
    if (t < frozenUntil) return null;
    if (t === frozenUntil) {
      // Back down roughly where the player means the paddle to be.
      finger = target + human.aim(1, 1.5);
    }

    finger += Math.max(-speed, Math.min(speed, target - finger));
    const a = Math.max(0, Math.min(BRK_WORLD_W, Math.round(finger)));
    if (a === sent) return null;
    sent = a;
    return { k: ARCADE_INPUT_DRAG, a, b: 0, c: 0, d: 0 };
  }, init);
};

