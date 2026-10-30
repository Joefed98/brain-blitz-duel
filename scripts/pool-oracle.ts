/**
 * Speed Pool's shot search (script only; floats are fine here, the result is an input log the sim replays):
 *
 *  - `simShot`: one shot rolled through the sim's own poolRollTick until every ball is still;
 *  - `candidates`: the ghost-ball aims at each target to each pocket with a clear line for the cue ball and the object
 *    ball, easiest (straightest, shortest) first;
 *  - `goodShots`: candidates swept over small aim nudges, powers and spins, kept when the target drops with no foul,
 *    no scratch and no early black;
 *  - `clearRack`: a depth-first search for a whole clearance (seven spots, then the black) without a miss or a foul,
 *    which also gives the six follow-up pots in a row; its shots are the bank's witness.
 *
 * Used by scripts/pool-bank.ts (the bank of proven layouts), the skill-band bot and pool-check.
 */
import {
  poolIsSpot,
  poolRollTick,
  poolShotC,
  poolShotVelocity,
  poolSpinCode,
  POOL_BALL_R,
  POOL_BLACK,
  POOL_CUE,
  POOL_POCKETS,
  POOL_SHOT_CAP,
  type PoolBall,
  type PoolSpin,
} from "../src/lib/arcade/pool";

export interface Shot {
  a: number;
  b: number;
  c: number;
}

export interface ShotEnd {
  balls: PoolBall[];
  dropped: number[];
  firstHit: number;
  ticks: number;
}

/** Rolls one shot from a still table to rest, exactly as the sim does. */
export function simShot(start: readonly PoolBall[], shot: Shot): ShotEnd {
  const balls = start.map((b) => ({ ...b }));
  const cue = balls.find((b) => b.id === POOL_CUE)!;
  const power = Math.floor(shot.c / 25);
  const code = shot.c % 25;
  const v = poolShotVelocity(shot.a, shot.b, power);
  cue.vx = v.vx;
  cue.vy = v.vy;
  const spin: PoolSpin = { firstHit: -1, topBack: Math.floor(code / 5) - 2, side: (code % 5) - 2, sideLeft: (code % 5) - 2 !== 0 ? 2 : 0 };
  const dropped: number[] = [];
  for (let t = 1; t <= POOL_SHOT_CAP + 1; t++) {
    const ev = poolRollTick(balls, spin, t);
    dropped.push(...ev.dropped);
    if (ev.still) return { balls, dropped, firstHit: spin.firstHit, ticks: t };
  }
  return { balls, dropped, firstHit: spin.firstHit, ticks: POOL_SHOT_CAP };
}

/** Spots still up. */
export const spotsLeft = (balls: readonly PoolBall[]) => balls.filter((b) => !b.down && poolIsSpot(b.id)).length;

/** True when the shot was clean and potted the target group's ball(s) only. */
export function legalPot(before: readonly PoolBall[], end: ShotEnd): boolean {
  const left = spotsLeft(before);
  if (end.dropped.includes(POOL_CUE)) return false;
  if (end.dropped.some((id) => id >= 9)) return false;
  if (left > 0) {
    if (end.firstHit < 0 || !poolIsSpot(end.firstHit)) return false;
    if (end.dropped.includes(POOL_BLACK)) return false;
    return end.dropped.some(poolIsSpot);
  }
  return end.firstHit === POOL_BLACK && end.dropped.includes(POOL_BLACK);
}

export interface Candidate {
  target: number;
  pocket: number;
  /** Aim angle (radians) from the cue ball to the ghost ball. */
  angle: number;
  /** Cut angle (degrees, 0 straight) and the two distances (px). */
  cut: number;
  cueDist: number;
  objDist: number;
  /** Lower is easier. */
  ease: number;
}

/** Distance (units) from point p to segment ab. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(ax + dx * t - px, ay + dy * t - py);
}

/** Every ghost-ball aim with clear lines, easiest first (`maxCut` in degrees). */
export function candidates(balls: readonly PoolBall[], maxCut = 78): Candidate[] {
  const cue = balls.find((b) => b.id === POOL_CUE && !b.down);
  if (!cue) return [];
  const left = spotsLeft(balls);
  const targets = balls.filter((b) => !b.down && (left > 0 ? poolIsSpot(b.id) : b.id === POOL_BLACK));
  const D = 2 * POOL_BALL_R * 256;
  const out: Candidate[] = [];
  for (const t of targets) {
    POOL_POCKETS.forEach((p, pi) => {
      // Aim at a point just inside the pocket's mouth.
      const px = p.x;
      const py = p.y;
      const ux = px - t.x;
      const uy = py - t.y;
      const l = Math.hypot(ux, uy);
      if (l <= 0) return;
      const gx = t.x - (ux / l) * D;
      const gy = t.y - (uy / l) * D;
      const ax = gx - cue.x;
      const ay = gy - cue.y;
      const al = Math.hypot(ax, ay);
      if (al < 1) return;
      const cos = (ax * ux + ay * uy) / (al * l);
      const cut = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
      if (cut > maxCut) return;
      // Middle pockets take only balls coming in fairly square.
      if (!p.corner && Math.abs(uy) / l > 0.72) return;
      for (const o of balls) {
        if (o.down || o.id === POOL_CUE || o.id === t.id) continue;
        if (segDist(o.x, o.y, cue.x, cue.y, gx, gy) < D) return;
        if (segDist(o.x, o.y, t.x, t.y, px, py) < D) return;
      }
      const ease = cut * 1.2 + al / 256 / 6 + l / 256 / 5;
      out.push({ target: t.id, pocket: pi, angle: Math.atan2(ay, ax), cut, cueDist: al / 256, objDist: l / 256, ease });
    });
  }
  out.sort((a, b) => a.ease - b.ease);
  return out;
}

export function shotFor(angle: number, power: number, spin: number): Shot {
  return { a: Math.round(Math.cos(angle) * 4000), b: Math.round(Math.sin(angle) * 4000), c: poolShotC(power, spin) };
}

/** The power that rolls a cue ball about `px` px and then some (a rough feel, for ordering the sweep). */
export function powerFor(cueDist: number, objDist: number, cut: number): number {
  const need = cueDist + objDist / Math.max(0.25, Math.cos((cut * Math.PI) / 180)) + 60;
  return Math.max(120, Math.min(950, Math.round(need * 1.15)));
}

export interface Good {
  shot: Shot;
  end: ShotEnd;
  cand: Candidate;
  /** How easy the next shot is from where the cue ball stops (lower is better). */
  leave: number;
}

const SPINS = [poolSpinCode(0, 0), poolSpinCode(1, 0), poolSpinCode(-1, 0), poolSpinCode(2, 0), poolSpinCode(-2, 0)];
const NUDGES = [0, 0.15, -0.15, 0.35, -0.35, 0.6, -0.6];

/** The leave's quality: the easiest next candidate's ease (999 with none; 0 when the rack is done). */
export function leaveQuality(balls: readonly PoolBall[]): number {
  if (balls.every((b) => b.down || b.id === POOL_CUE)) return 0;
  if (!balls.some((b) => !b.down && (poolIsSpot(b.id) || b.id === POOL_BLACK))) return 0;
  const c = candidates(balls, 65);
  if (!c.length) return 999;
  return c[0]!.ease + (c.length > 1 ? 0 : 15);
}

/** Clean pots from a still table, with each one's leave (best first); `limit` caps the candidates tried. */
export function goodShots(balls: readonly PoolBall[], opts: { limit?: number; want?: number } = {}): Good[] {
  const out: Good[] = [];
  const cands = candidates(balls).slice(0, opts.limit ?? 8);
  for (const cand of cands) {
    const base = powerFor(cand.cueDist, cand.objDist, cand.cut);
    const powers = [base, Math.round(base * 0.8), Math.round(base * 1.25), Math.round(base * 0.6), Math.round(base * 1.6)].map((p) => Math.max(60, Math.min(1000, p)));
    let found = 0;
    for (const nudge of NUDGES) {
      for (const power of powers) {
        for (const spin of SPINS) {
          const shot = shotFor(cand.angle + (nudge * Math.PI) / 180, power, spin);
          const end = simShot(balls, shot);
          if (!legalPot(balls, end)) {
            if (spin === SPINS[0] && !end.dropped.includes(cand.target)) break; // this power misses: spins won't help much
            continue;
          }
          out.push({ shot, end, cand, leave: leaveQuality(end.balls) });
          found++;
          if (found >= 6) break;
        }
        if (found >= 6) break;
      }
      if (found >= 3) break;
    }
    if (opts.want && out.length >= opts.want) break;
  }
  out.sort((a, b) => a.leave - b.leave);
  return out;
}

/** A clearance's shots (from the dealt table): seven spots and the black, every shot a clean pot. Null if none found. */
export function clearRack(balls: readonly PoolBall[], budget = { sims: 0, max: 60_000 }, depth = 0): Shot[] | null {
  if (!balls.some((b) => !b.down && b.id === POOL_BLACK)) return [];
  if (budget.sims > budget.max) return null;
  const goods = goodShots(balls, { limit: 6 });
  budget.sims += 1;
  for (const g of goods.slice(0, depth < 2 ? 4 : 3)) {
    const rest = clearRack(g.end.balls, budget, depth + 1);
    if (rest) return [g.shot, ...rest];
    if (budget.sims > budget.max) return null;
  }
  return null;
}
