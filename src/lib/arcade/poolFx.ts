/**
 * Cue Ball's stage-2 effects (the Sports overhaul, phase 2 step 4): what the art and the sound observer read off the sim's
 * own state to place each effect. Pure functions of a state (and the previous one for transitions); nothing here writes
 * to a state, reads a clock or draws. Display only: the sim and the server never import this.
 *
 *   - poolSideBend: the turn side spin gives the cue ball's velocity at a cushion, exactly as the sim's roll applies it
 *     (pool.ts poolRollTick), so the aim preview's bend has the sim's direction and size.
 *   - poolContactPoint: where two balls just met (the flash): the closest touching pair with a ball moving.
 *   - poolJawContact: a ball bouncing off a pocket's jaw this tick (the rattle and its shiver).
 *   - poolStrikePoint: where the cue ball sat when it was struck (the cue's thrust and the chalk puff).
 *   - poolFoulLabel: where "FOUL −10" sits: beside the cue ball, kept inside the table.
 *   - poolFlight: a potted ball of the player's set flying from its pocket to its rack slot after the drop.
 */
import {
  POOL_BALL_R,
  POOL_CB,
  POOL_CL,
  POOL_CR,
  POOL_CT,
  POOL_CUE,
  poolFoulPts,
  POOL_JAWS,
  POOL_POCKETS,
  POOL_ROLL,
  POOL_SPIN_SAFE,
  POOL_SPOTS,
  POOL_V2_SIDE_MAX,
  POOL_V3_SIDE_MAX,
  type PoolBall,
  type PoolState,
} from "./pool";
import type { Seg } from "./sportsKit";

const px = (u: number) => u / 256;
const R = POOL_BALL_R;

/** The drop's length (ticks; the art's DROP_TICKS) and the flight to the rack after it. */
export const POOL_FX_DROP_TICKS = 18;
export const POOL_FX_FLIGHT_TICKS = 22;
/** How long each effect shows (ticks). */
export const POOL_FX_FLASH_TICKS = 9;
export const POOL_FX_THRUST_TICKS = 9;
export const POOL_FX_PUFF_TICKS = 16;
export const POOL_FX_SHIVER_TICKS = 16;
export const POOL_FX_FOUL_TICKS = 72;
/** A jaw contact is a ball within this many px of a jaw segment on a tick a cushion or jaw was struck. */
export const POOL_FX_JAW_REACH = R + 2.5;

/**
 * Side spin's turn at a cushion, as the sim applies it: v += (−vy, vx) × k / 256, k from the spin dot's side (−100…100 on
 * poolRev 2+, −2…2 on poolRev 1). Returns the bent velocity (any units; floats, the preview's only).
 */
export function poolSideBend(vx: number, vy: number, side: number, rev: number): { vx: number; vy: number } {
  if (side === 0) return { vx, vy };
  const k = rev >= 2 ? (side * (rev >= 3 ? POOL_V3_SIDE_MAX : POOL_V2_SIDE_MAX)) / POOL_SPIN_SAFE : side * 22;
  return { vx: vx + (-vy * k) / 256, vy: vy + (vx * k) / 256 };
}

function moving(b: PoolBall): boolean {
  return b.vx !== 0 || b.vy !== 0;
}

/**
 * Where two balls just met (world px): within POOL_FX_FLASH_TICKS of the sim's last ball-on-ball tick, the touching pair
 * (gap ≤ 3 px) with the smallest gap and at least one ball moving; null otherwise.
 */
export function poolContactPoint(s: PoolState): { x: number; y: number; age: number; a: number; b: number } | null {
  const age = s.tick - s.hitTick;
  if (s.hits === 0 || age < 0 || age >= POOL_FX_FLASH_TICKS) return null;
  let best: { x: number; y: number; a: number; b: number } | null = null;
  let bestScore = Infinity;
  const live = s.balls.filter((b) => !b.down);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i]!;
      const b = live[j]!;
      if (!moving(a) && !moving(b)) continue;
      // Since they met the pair has parted by about their separating speed for each tick (more within a fast tick).
      const gap = Math.hypot(px(a.x - b.x), px(a.y - b.y)) - 2 * R;
      const parting = px(Math.hypot(a.vx - b.vx, a.vy - b.vy)) * (age + 1);
      const score = gap - parting;
      if (gap <= 3 + parting && score < bestScore) {
        bestScore = score;
        // The meeting point: the pair's midpoint walked back along their mean velocity.
        best = { x: px(a.x + b.x - (a.vx + b.vx) * age) / 2, y: px(a.y + b.y - (a.vy + b.vy) * age) / 2, a: a.id, b: b.id };
      }
    }
  }
  return best ? { ...best, age } : null;
}

/** The closest point of a segment to (x, y), and its distance (world px). */
function segNearest(x: number, y: number, s: Seg): { x: number; y: number; d: number } {
  const x1 = px(s.ax);
  const y1 = px(s.ay);
  const dx = px(s.bx) - x1;
  const dy = px(s.by) - y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2)) : 0;
  const nx = x1 + dx * t;
  const ny = y1 + dy * t;
  return { x: nx, y: ny, d: Math.hypot(x - nx, y - ny) };
}

/**
 * The ball bouncing off a pocket's jaw on this tick (the sim struck a cushion or jaw this tick) and where on the jaw (the
 * jaw's nearest point to it, world px), else null.
 */
export function poolJawHit(s: PoolState): { id: number; x: number; y: number } | null {
  if (s.phase !== POOL_ROLL || s.cushionTick !== s.tick) return null;
  let best: { id: number; x: number; y: number } | null = null;
  let bestD = POOL_FX_JAW_REACH;
  for (const b of s.balls) {
    if (b.down) continue;
    const x = px(b.x);
    const y = px(b.y);
    for (const j of POOL_JAWS) {
      const n = segNearest(x, y, j);
      if (n.d <= bestD) {
        bestD = n.d;
        best = { id: b.id, x: n.x, y: n.y };
      }
    }
  }
  return best;
}

/** The ball (its id) bouncing off a pocket's jaw on this tick, else null (poolJawHit's ball). */
export function poolJawContact(s: PoolState): number | null {
  return poolJawHit(s)?.id ?? null;
}

/**
 * Where the cue ball was struck (world px) and how long ago, while the shot is young: its position less its velocity for
 * each tick since the shot (no ball touched yet, so it has run straight), else null.
 */
export function poolStrikePoint(s: PoolState): { x: number; y: number; ux: number; uy: number; age: number } | null {
  if (s.phase !== POOL_ROLL || s.shots === 0 || s.shotTicks > POOL_FX_PUFF_TICKS) return null;
  const cue = s.balls.find((b) => b.id === POOL_CUE);
  if (!cue || cue.down) return null;
  const v = Math.hypot(cue.vx, cue.vy);
  // Once the cue ball has touched a ball (or stopped) its velocity no longer points back to the strike.
  if (v === 0 || s.firstHit >= 0) return null;
  const ux = cue.vx / v;
  const uy = cue.vy / v;
  // A straight run at a gently falling speed: each tick moved it by about its velocity.
  const back = px(v) * s.shotTicks;
  return { x: px(cue.x) - ux * back, y: px(cue.y) - uy * back, ux, uy, age: s.shotTicks };
}

/** The foul label's text and its place (world px, the label's centre) beside the cue ball, kept inside the table. */
export function poolFoulLabel(s: PoolState, w = 74, h = 20): { text: string; x: number; y: number; age: number } | null {
  const age = s.tick - s.foulTick;
  if (s.fouls === 0 || age < 0 || age >= POOL_FX_FOUL_TICKS) return null;
  const cue = s.balls.find((b) => b.id === POOL_CUE && !b.down);
  if (!cue) return null;
  const cx = px(cue.x);
  const cy = px(cue.y);
  // Above the ball, or below when there is no room above; clamped inside the cushions.
  let y = cy - R - 8 - h / 2;
  if (y - h / 2 < POOL_CT + 2) y = cy + R + 8 + h / 2;
  const x = Math.max(POOL_CL + 2 + w / 2, Math.min(POOL_CR - 2 - w / 2, cx));
  y = Math.max(POOL_CT + 2 + h / 2, Math.min(POOL_CB - 2 - h / 2, y));
  return { text: `FOUL −${poolFoulPts(s)}`, x, y, age };
}

/** The pocket a ball went down in (world px): the nearest. */
export function poolPocketOf(b: PoolBall): { x: number; y: number; r: number } {
  let best = POOL_POCKETS[0]!;
  let bestD = Infinity;
  for (const p of POOL_POCKETS) {
    const d = (p.x - b.x) * (p.x - b.x) + (p.y - b.y) * (p.y - b.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return { x: px(best.x), y: px(best.y), r: px(best.r) };
}

/** A potted ball of the player's set (ids 1…7, poolRev 2+) is flying to the rack: its share of the flight (0…1), else null. */
export function poolFlight(s: PoolState, b: PoolBall): number | null {
  if (!b.down || b.downAt === undefined || b.id < 1 || b.id > POOL_SPOTS) return null;
  const age = s.tick - b.downAt - POOL_FX_DROP_TICKS;
  if (age < 0 || age >= POOL_FX_FLIGHT_TICKS) return null;
  return age / POOL_FX_FLIGHT_TICKS;
}

/** The ball has reached its rack slot (lit in the rack): at once on poolRev 1, after the drop and flight on poolRev 2+. */
export function poolInRack(s: PoolState, b: PoolBall): boolean {
  if (!b.down) return false;
  if (b.downAt === undefined) return true;
  return s.tick - b.downAt >= POOL_FX_DROP_TICKS + POOL_FX_FLIGHT_TICKS || s.over === 1;
}
