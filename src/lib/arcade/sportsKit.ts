/**
 * The Sports group's shared kit (Minigolf, Speed Pool, Curling; 30 Oct 2026): integer ball physics, the run's wire
 * format and the one server replay every Sports game scores through.
 *
 * Every Sports game is a deterministic sim on the arcade engine (engine.ts): integer maths in 1/256 px (or 1/256 cm)
 * units, a fixed 60-tick step, no randomness after the deal (the seed lays out the course, table or sheet at init and
 * nothing else is drawn). The phone records each shot as one event on the sim tick it applied; the server replays the
 * log on the stored puzzle and keeps its own score.
 */
import {
  checkInputEvents,
  decodeInputEvents,
  encodeInputEvents,
  isqrt,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type InputDiag,
} from "./engine";

/* ================================ Vectors ================================ */

/** A unit normal scaled to this many parts (integer), so a reflection is integer maths only. */
export const NORM_ONE = 4096;

/** Integer division towards zero (the one rounding every Sports sim uses). */
export function idiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** A vector's length, as an integer (isqrt of the squared length). */
export function ilen(x: number, y: number): number {
  return isqrt(x * x + y * y);
}

/** A direction scaled to NORM_ONE; (0, -NORM_ONE) for a zero vector. */
export function inorm(x: number, y: number): { x: number; y: number } {
  const l = ilen(x, y);
  if (l <= 0) return { x: 0, y: -NORM_ONE };
  return { x: idiv(x * NORM_ONE, l), y: idiv(y * NORM_ONE, l) };
}

/** A vector rescaled to `length` (same units). */
export function iscale(x: number, y: number, length: number): { x: number; y: number } {
  const l = ilen(x, y);
  if (l <= 0) return { x: 0, y: 0 };
  return { x: idiv(x * length, l), y: idiv(y * length, l) };
}

/* ============================== Collisions ============================== */

/** A solid segment (a wall, a rail, a log's spine), with its unit normal precomputed. */
export interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** The segment's half thickness (0 for a thin rail), same units. */
  r: number;
}

/** The closest point on segment ab to p. */
export function closestOnSeg(s: Seg, px: number, py: number): { x: number; y: number } {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return { x: s.ax, y: s.ay };
  // t in 1/4096 of the segment, clamped to it.
  let t = idiv(((px - s.ax) * dx + (py - s.ay) * dy) * NORM_ONE, len2);
  if (t < 0) t = 0;
  if (t > NORM_ONE) t = NORM_ONE;
  return { x: s.ax + idiv(dx * t, NORM_ONE), y: s.ay + idiv(dy * t, NORM_ONE) };
}

/**
 * A ball (centre p, radius br, velocity v) against a point obstacle at q with radius qr: pushes the ball out and
 * reflects its velocity's normal part with restitution `e` (in 256ths). Returns the new state, or null when they do
 * not touch (or the ball is already moving away).
 */
export function bounceOff(
  b: { x: number; y: number; vx: number; vy: number },
  qx: number,
  qy: number,
  reach: number,
  e256: number,
): { x: number; y: number; vx: number; vy: number; impact: number } | null {
  const dx = b.x - qx;
  const dy = b.y - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= reach * reach) return null;
  const d = isqrt(d2);
  const n = d > 0 ? { x: idiv(dx * NORM_ONE, d), y: idiv(dy * NORM_ONE, d) } : inorm(-b.vx, -b.vy);
  const vn = idiv(b.vx * n.x + b.vy * n.y, NORM_ONE);
  const push = reach - d;
  const x = b.x + idiv(n.x * push, NORM_ONE);
  const y = b.y + idiv(n.y * push, NORM_ONE);
  if (vn >= 0) return { x, y, vx: b.vx, vy: b.vy, impact: 0 };
  const j = idiv(vn * (256 + e256), 256);
  return { x, y, vx: b.vx - idiv(j * n.x, NORM_ONE), vy: b.vy - idiv(j * n.y, NORM_ONE), impact: -vn };
}

/** A ball against a segment (rail or capsule): the bounce off its closest point. */
export function bounceSeg(
  b: { x: number; y: number; vx: number; vy: number },
  s: Seg,
  br: number,
  e256: number,
): { x: number; y: number; vx: number; vy: number; impact: number } | null {
  const c = closestOnSeg(s, b.x, b.y);
  return bounceOff(b, c.x, c.y, br + s.r, e256);
}

/**
 * Two equal balls: if they overlap, separate them along the line of centres and exchange the normal parts of their
 * velocities with restitution `e` (256ths). Mutates and returns true on a hit.
 */
export function collideEqual(
  a: { x: number; y: number; vx: number; vy: number },
  b: { x: number; y: number; vx: number; vy: number },
  reach: number,
  e256: number,
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= reach * reach) return false;
  const d = isqrt(d2);
  const n = d > 0 ? { x: idiv(dx * NORM_ONE, d), y: idiv(dy * NORM_ONE, d) } : { x: NORM_ONE, y: 0 };
  const half = idiv(reach - d + 1, 2);
  a.x -= idiv(n.x * half, NORM_ONE);
  a.y -= idiv(n.y * half, NORM_ONE);
  b.x += idiv(n.x * half, NORM_ONE);
  b.y += idiv(n.y * half, NORM_ONE);
  // Relative velocity along the normal (a towards b is positive).
  const rel = idiv((a.vx - b.vx) * n.x + (a.vy - b.vy) * n.y, NORM_ONE);
  if (rel <= 0) return true;
  const j = idiv(rel * (256 + e256), 512);
  a.vx -= idiv(j * n.x, NORM_ONE);
  a.vy -= idiv(j * n.y, NORM_ONE);
  b.vx += idiv(j * n.x, NORM_ONE);
  b.vy += idiv(j * n.y, NORM_ONE);
  return true;
}

/**
 * Rolling friction: the speed falls by `speed × drag ÷ 4096 + decel` a tick, never below 0, the direction kept.
 * Returns the new velocity.
 */
export function rollFriction(vx: number, vy: number, drag4096: number, decel: number): { vx: number; vy: number } {
  const s = ilen(vx, vy);
  if (s <= 0) return { vx: 0, vy: 0 };
  const ns = s - idiv(s * drag4096, 4096) - decel;
  if (ns <= 0) return { vx: 0, vy: 0 };
  return { vx: idiv(vx * ns, s), vy: idiv(vy * ns, s) };
}

/** True when point p is inside the polygon (integer crossing test). */
export function insidePoly(poly: readonly number[], px: number, py: number): boolean {
  let inside = false;
  const n = poly.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2]!;
    const yi = poly[i * 2 + 1]!;
    const xj = poly[j * 2]!;
    const yj = poly[j * 2 + 1]!;
    if (yi > py !== yj > py) {
      // x of the edge at py, compared without division: (px - xi) * (yj - yi) < (xj - xi) * (py - yi), sign-aware.
      const lhs = (px - xi) * (yj - yi);
      const rhs = (xj - xi) * (py - yi);
      if (yj - yi > 0 ? lhs < rhs : lhs > rhs) inside = !inside;
    }
  }
  return inside;
}

/* ============================== Checksums ============================== */

/** FNV-1a over a list of integers: the checkpoint checksum every Sports sim states. */
export function sumInts(values: readonly number[]): number {
  let h = 2166136261;
  for (const v of values) {
    let x = v | 0;
    for (let k = 0; k < 4; k++) {
      h = Math.imul(h ^ (x & 0xff), 16777619);
      x >>>= 8;
    }
  }
  return h >>> 0;
}

/* ============================== The run ============================== */

/** Checkpoints every 5 s: the sim tick and the state's checksum. */
export const SPORTS_CHECKPOINT_INTERVAL = 300;

export interface SportsCheckpoint {
  tick: number;
  checksum: number;
}

export interface SportsRun {
  seed: number;
  claimedScore: number;
  events: ArcadeInputEvent[];
  /** The sim tick the phone reached; 0 or the run length means a full run. */
  endTick?: number;
  checkpoints?: SportsCheckpoint[];
}

export function encodeSportsRun(run: SportsRun): string {
  const checkpoints = (run.checkpoints ?? []).map((c) => `${c.tick}:${c.checksum >>> 0}`).join(",");
  return [run.seed, run.claimedScore, encodeInputEvents(run.events), run.endTick ?? 0, checkpoints].join("|");
}

export function decodeSportsRun(raw: string, runTicks: number): SportsRun {
  const [seedPart = "", scorePart = "", eventPart = "", tickPart = "", cpPart = ""] = (String(raw ?? "").split("~")[0] ?? "").split("|");
  const checkpoints = cpPart
    .split(",")
    .filter(Boolean)
    .slice(0, Math.ceil(runTicks / SPORTS_CHECKPOINT_INTERVAL) + 1)
    .map((part) => part.split(":").map((v) => Number.parseInt(v, 10)))
    .filter((v) => v.length === 2 && v.every(Number.isInteger))
    .map(([tick, sum]) => ({ tick: tick ?? 0, checksum: (sum ?? 0) >>> 0 }));
  return {
    seed: Number.parseInt(seedPart, 10) || 0,
    claimedScore: Number.parseInt(scorePart, 10) || 0,
    events: decodeInputEvents(eventPart),
    endTick: Number.parseInt(tickPart, 10) || 0,
    checkpoints,
  };
}

export interface SportsResult<S> {
  score: number;
  state: S;
  endedSeconds: number;
  flagged: boolean;
  clientLag: boolean;
  clientTick: number;
  desyncTick: number | null;
  inputDiag: InputDiag;
  replayTick: number;
  inputs: number;
  claimedScore: number;
  checkpoints: SportsCheckpoint[];
  reason?: string;
}

/**
 * The single place a Sports game's score is worked out: the stored game (built from the stored puzzle), the log
 * repaired against its declared ranges and replayed tick by tick, the client's checkpoints compared on the way.
 */
export function replaySportsRun<S extends { tick: number }>(
  label: string,
  game: ArcadeGame<S, ArcadeInputEvent | null>,
  checkpoint: (state: S) => SportsCheckpoint,
  seed: number,
  raw: string,
): SportsResult<S> {
  const run = decodeSportsRun(raw, game.runTicks);
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, game.runTicks) : 0;
  const check = checkInputEvents(run.events, game.runTicks, game.inputRanges ?? []);
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of check.events) events.set(event.t, event);
  const clientLag = endTick > 0 && endTick < game.runTicks;
  const lastTick = clientLag ? endTick : game.runTicks;
  const client = new Map((run.checkpoints ?? []).map((c) => [c.tick, c]));
  let state = game.init(seed);
  let reached = 0;
  let desyncTick: number | null = null;
  const server: SportsCheckpoint[] = [];
  for (let tick = 1; tick <= lastTick; tick++) {
    state = game.step(state, events.get(tick) ?? null);
    reached = tick;
    if (state.tick % SPORTS_CHECKPOINT_INTERVAL === 0) {
      const mine = checkpoint(state);
      server.push(mine);
      const theirs = client.get(state.tick);
      if ((!theirs || theirs.checksum !== mine.checksum) && desyncTick === null && state.tick <= (endTick || lastTick)) {
        desyncTick = state.tick;
        console.error(`[${label}] client/server desync`, { tick: state.tick, client: theirs, server: mine });
      }
    }
    if (game.isOver(state)) break;
  }
  const score = game.score(state);
  const mismatch = run.claimedScore !== score || run.seed !== seed;
  const result: SportsResult<S> = {
    score,
    state,
    endedSeconds: Math.round((reached / TICKS_PER_SECOND) * 10) / 10,
    flagged: !check.ok || mismatch || desyncTick !== null,
    clientLag,
    clientTick: endTick,
    desyncTick,
    inputDiag: check.diag,
    replayTick: reached,
    inputs: run.events.length,
    claimedScore: run.claimedScore,
    checkpoints: server,
  };
  if (check.reason) result.reason = check.reason;
  else if (mismatch) result.reason = "score did not match the replay";
  return result;
}
