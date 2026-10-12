/**
 * A Tilt bot for checks: every few ticks it tries 24 target angles, simulates
 * ahead with the real sim (rotating at most MAX_PX of drag a tick, about
 * 4° — a brisk human drag), and keeps the angle whose end state is closest
 * (by maze path distance) to its next goal: this maze's bonus stars first when
 * `stars` is set, then each marble's own cup. Inputs go through recordInput, so
 * the run replays on the server exactly as a phone's would.
 */
import { inputAt, recordInput, type ArcadeGame, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { tiltCellCentre, tiltCheckpoint, TILT_CHECKPOINT_INTERVAL, TILT_INPUT_DRAG, type Maze, type TiltState } from "../src/lib/arcade/tilt";

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const ANG_PER_PX = 91;
const MAX_PX = 8;
const W = 440;

function open(m: Maze, c: number, d: number): number {
  const i = (c % m.n) + DX[d]!;
  const j = Math.trunc(c / m.n) + DY[d]!;
  if (i < 0 || j < 0 || i >= m.n || j >= m.n) return -1;
  const nc = j * m.n + i;
  if (!m.inside[nc]) return -1;
  const wall = d === 0 ? m.wallR[c] : d === 1 ? m.wallD[c] : d === 2 ? m.wallR[nc] : m.wallD[nc];
  return wall ? -1 : nc;
}

const fields = new WeakMap<Maze, Map<string, number[]>>();
/** Path distance (cells) from every cell to `target`. */
function field(m: Maze, target: number): number[] {
  let byMaze = fields.get(m);
  if (!byMaze) fields.set(m, (byMaze = new Map()));
  const key = String(target);
  const hit = byMaze.get(key);
  if (hit) return hit;
  const dist = new Array<number>(m.n * m.n).fill(1e6);
  dist[target] = 0;
  const q = [target];
  for (let k = 0; k < q.length; k++) {
    const c = q[k]!;
    for (let d = 0; d < 4; d++) {
      const nc = open(m, c, d);
      if (nc >= 0 && dist[nc]! > dist[c]! + 1) {
        dist[nc] = dist[c]! + 1;
        q.push(nc);
      }
    }
  }
  byMaze.set(key, dist);
  return dist;
}

function cellAt(m: Maze, x: number, y: number): number {
  const i = Math.floor(x / m.cs);
  const j = Math.floor(y / m.cs);
  if (i < 0 || j < 0 || i >= m.n || j >= m.n || !m.inside[j * m.n + i]) return -1;
  return j * m.n + i;
}

/** FP distance along the maze from a body to a cell centre (or out through `exitDir` when given). */
function pathDist(m: Maze, x: number, y: number, target: number, exitDir = -1): number {
  const c = cellAt(m, x, y);
  if (c < 0) return 0;
  const dist = field(m, target);
  const centre = tiltCellCentre(m, c);
  if (dist[c] === 0) {
    if (exitDir < 0) return Math.abs(x - centre.x) + Math.abs(y - centre.y);
    const edge = { x: centre.x + (DX[exitDir]! * m.cs) / 2, y: centre.y + (DY[exitDir]! * m.cs) / 2 };
    return Math.abs(x - edge.x) + Math.abs(y - edge.y) + m.cs / 2;
  }
  for (let d = 0; d < 4; d++) {
    const nc = open(m, c, d);
    if (nc >= 0 && dist[nc]! === dist[c]! - 1) {
      const edge = { x: centre.x + (DX[d]! * m.cs) / 2, y: centre.y + (DY[d]! * m.cs) / 2 };
      return (dist[c]! - 1) * m.cs + m.cs / 2 + (exitDir >= 0 ? m.cs / 2 : 0) + Math.abs(x - edge.x) + Math.abs(y - edge.y);
    }
  }
  return 1e9;
}

export function value(s: TiltState, stars: boolean): number {
  if (s.ended === 2) return -1e15;
  let v = s.mazes * 1e12 + (s.stars ?? 0) * 1e8;
  if (s.ended === 1) return v + 1e13;
  const m = s.list[s.level]!;
  const live: { x: number; y: number; exit: number; dir: number }[] = [];
  if (!s.aHome) live.push({ x: s.x, y: s.y, exit: m.exit, dir: m.exitDir });
  if (s.b && !s.bHome) live.push({ x: s.b.x, y: s.b.y, exit: m.exit2!, dir: m.exitDir2! });
  v += (2 - live.length) * 1e10;
  const wanted = stars ? (m.stars ?? []).filter((_, k) => !(s.starGot ?? [])[k]) : [];
  if (wanted.length) {
    let best = Infinity;
    for (const star of wanted) for (const ball of live) best = Math.min(best, pathDist(m, ball.x, ball.y, star));
    return v - best;
  }
  // One marble at a time: chase the nearer cup, with only a light pull on the other.
  const ds = live.map((ball) => pathDist(m, ball.x, ball.y, ball.exit, ball.dir)).sort((x, y) => x - y);
  if (ds.length) v -= ds[0]! + 0.05 * (ds[1] ?? 0);
  // Keep away from the free chaser.
  if (s.chaser && s.gate) for (const ball of live) v += Math.min(4 * m.cs, Math.abs(ball.x - s.chaser.x) + Math.abs(ball.y - s.chaser.y));
  return v;
}

export interface TiltBotRun {
  state: TiltState;
  events: ArcadeInputEvent[];
  checkpoints: ReturnType<typeof tiltCheckpoint>[];
}

export function playTilt(game: ArcadeGame<TiltState, ArcadeInputEvent | null>, seed: number, opts: { stars?: boolean; every?: number; horizon?: number; variant?: number } = {}): TiltBotRun {
  const every = opts.every ?? 4;
  const horizon = opts.horizon ?? 48;
  const stars = opts.stars ?? true;
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof tiltCheckpoint>[] = [];
  let finger = W / 2;
  let touch = 1;
  let fresh = true;
  let goal = 0;
  const turnStep = (angle: number, target: number) => {
    const delta = ((target - angle + 32768) & 65535) - 32768;
    const px = Math.max(-MAX_PX, Math.min(MAX_PX, Math.round(delta / ANG_PER_PX)));
    return px;
  };
  // Stuck guard: when the goal value has not improved for a while, wander for a moment.
  let bestSeen = -Infinity;
  let bestAt = 0;
  let wanderUntil = -1;
  let r = ((seed + (opts.variant ?? 0) * 7919) * 2654435761) >>> 0;
  const rand = (n: number) => {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    return r % n;
  };
  while (!game.isOver(s)) {
    const now = value(s, stars);
    if (now > bestSeen + 64) {
      bestSeen = now;
      bestAt = s.tick;
    } else if (s.tick - bestAt > 150 && s.tick > wanderUntil) {
      wanderUntil = s.tick + 30 + rand(60);
      goal = rand(24) * (65536 / 24);
      bestAt = s.tick;
      bestSeen = -Infinity;
    }
    if (s.tick % every === 0 && s.tick > wanderUntil) {
      let best = -Infinity;
      for (let k = 0; k < 24; k++) {
        const target = (k * 65536) / 24;
        // Simulated drag on one unbounded touch: rotate toward the target, then hold.
        let p: TiltState = { ...s, lastC: 255, lastA: 0 };
        let fa = 0;
        // Long enough to finish turning, then roll for `horizon` ticks.
        const turn = Math.ceil(Math.abs(((target - s.angle + 32768) & 65535) - 32768) / (ANG_PER_PX * MAX_PX));
        for (let h = 0; h < turn + horizon && !game.isOver(p); h++) {
          fa += turnStep(p.angle, target);
          p = game.step(p, { t: p.tick + 1, k: TILT_INPUT_DRAG, a: fa, b: 0, c: 255, d: 0 });
        }
        const v = value(p, stars);
        if (v > best) {
          best = v;
          goal = target;
        }
      }
    }
    const t = s.tick + 1;
    const px = turnStep(s.angle, goal);
    let ev: ArcadeInputEvent | null = null;
    if (fresh || finger + px < 0 || finger + px > W) {
      touch = (touch + 1) % 256;
      finger = W / 2;
      fresh = false;
      ev = { t, k: TILT_INPUT_DRAG, a: finger, b: 0, c: touch, d: 0 };
    } else if (px !== 0) {
      finger += px;
      ev = { t, k: TILT_INPUT_DRAG, a: finger, b: 0, c: touch, d: 0 };
    }
    recordInput(events, ev, game.inputRanges);
    s = game.step(s, inputAt(events, t));
    if (s.tick % TILT_CHECKPOINT_INTERVAL === 0) checkpoints.push(tiltCheckpoint(s));
  }
  return { state: s, events, checkpoints };
}
