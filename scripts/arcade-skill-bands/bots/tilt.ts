/**
 * Tilt: the human studies each new maze (think time), then steers. Every
 * "glance" (a human re-decision cadence) the player works out which way to
 * tilt from the state the eye saw `lagTicks` ago: the ideal tilt is found as
 * the checks' perfect bot does (try 24 tilts on the seen state, keep the one
 * that rolls the marble furthest along the maze toward the current goal and
 * clear of spikes and the chaser), standing in for an experienced player's
 * feel for the maze. The player then executes it badly: the wanted tilt
 * carries an aim error, the finger turns the disc at a human speed and must
 * re-grip at the screen edge, and the decision is stale by the perception lag.
 * Goals: the cup (one marble at a time when there are two), bonus stars only
 * for the players who go for them, and at forks a weaker player sometimes
 * misreads a long dead-end branch as the way on, rolls down it and stops to
 * rethink. A slip is a moment of tilting the wrong way.
 *
 * tiltRev 7 (the expansion): a shut gate is a wall until its key is taken, so a marble whose cup is
 * cut off goes for the nearest key first; quick stars are taken first (by the players who go for them,
 * while their window still has time), then the bonus stars, then the cup.
 */
import { tiltCellCentre, tiltQuickLeft, tiltStarPoint, TILT_INPUT_DRAG, TILT_WORLD_W, type Maze, type TiltState } from "../../../src/lib/arcade/tilt";
import { driveEvents, type SkillBot } from "../bot";
import type { SkillLevel } from "../human";

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const ANG_PER_PX = 91;
const TURN = 65536;
/** World px per phone px (the 440-wide world on a ~390-px phone). */
const WORLD_PER_PX = TILT_WORLD_W / 390;

/** Finger top speed for turning the disc, world px a tick (≈ 12–20 phone px: a controlled spin, not a flick). */
const FINGER: Record<SkillLevel, number> = { average: 7, good: 8, great: 9, near: 10 };
/** Re-decision cadence, ticks (how often the player re-reads the board and changes the tilt). */
const GLANCE: Record<SkillLevel, number> = { average: 12, good: 10, great: 8, near: 6 };
/** How far ahead (ticks) the player foresees where the marbles roll. */
const HORIZON: Record<SkillLevel, number> = { average: 30, good: 38, great: 44, near: 48 };
/** tiltRev 4: a star at a hole's mouth is taken this much less often (the fall ends the run). */
const MOUTH_GO = 0.5;
/** Chance of detouring for each bonus star. */
const STAR_GO: Record<SkillLevel, number> = process.env.TILT_NO_STARS ? { average: 0, good: 0, great: 0, near: 0 } : { average: 0.15, good: 0.45, great: 0.75, near: 0.92 };
/** tiltRev 7: chance of going for each quick star (while its window has time left). */
const QUICK_GO: Record<SkillLevel, number> = process.env.TILT_NO_STARS ? { average: 0, good: 0, great: 0, near: 0 } : { average: 0.25, good: 0.5, great: 0.8, near: 0.97 };

/** tiltRev 7: the keys taken in the maze being played (the bot's own view of the gates). */
let KEYS = 0;
function gateShut(m: Maze, c: number, nc: number): boolean {
  const gates = m.gates ?? [];
  for (let k = 0; 2 * k < gates.length; k++) {
    if ((KEYS >> k) & 1) continue;
    const gc = gates[2 * k]!;
    const gd = gates[2 * k + 1]!;
    const other = (Math.trunc(gc / m.n) + DY[gd]!) * m.n + (gc % m.n) + DX[gd]!;
    if ((c === gc && nc === other) || (c === other && nc === gc)) return true;
  }
  return false;
}

function openCell(m: Maze, c: number, d: number): number {
  const i = (c % m.n) + DX[d]!;
  const j = Math.trunc(c / m.n) + DY[d]!;
  if (i < 0 || j < 0 || i >= m.n || j >= m.n) return -1;
  const nc = j * m.n + i;
  if (!m.inside[nc]) return -1;
  const wall = d === 0 ? m.wallR[c] : d === 1 ? m.wallD[c] : d === 2 ? m.wallR[nc] : m.wallD[nc];
  return wall || gateShut(m, c, nc) ? -1 : nc;
}

const fieldCache = new WeakMap<Maze, Map<number, number[]>>();
function field(m: Maze, target: number): number[] {
  let byMaze = fieldCache.get(m);
  if (!byMaze) fieldCache.set(m, (byMaze = new Map()));
  const key = target + 100000 * KEYS;
  const hit = byMaze.get(key);
  if (hit) return hit;
  const dist = new Array<number>(m.n * m.n).fill(1e6);
  dist[target] = 0;
  const q = [target];
  for (let k = 0; k < q.length; k++) {
    const c = q[k]!;
    for (let d = 0; d < 4; d++) {
      const nc = openCell(m, c, d);
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

/** FP distance along the maze from a point to a cell centre (or out through `exitDir` when given). */
function pathDist(m: Maze, x: number, y: number, target: number, exitDir = -1, pt?: { x: number; y: number }): number {
  const c = cellAt(m, x, y);
  if (c < 0) return 0;
  const dist = field(m, target);
  // tiltRev 4 star at a hole's mouth: in its cell, the distance to the star itself.
  const centre = dist[c] === 0 && pt ? pt : tiltCellCentre(m, c);
  if (dist[c] === 0) {
    if (exitDir < 0) return Math.abs(x - centre.x) + Math.abs(y - centre.y);
    const edge = { x: centre.x + (DX[exitDir]! * m.cs) / 2, y: centre.y + (DY[exitDir]! * m.cs) / 2 };
    return Math.abs(x - edge.x) + Math.abs(y - edge.y) + m.cs / 2;
  }
  for (let d = 0; d < 4; d++) {
    const nc = openCell(m, c, d);
    if (nc >= 0 && dist[nc]! === dist[c]! - 1) {
      const edge = { x: centre.x + (DX[d]! * m.cs) / 2, y: centre.y + (DY[d]! * m.cs) / 2 };
      return (dist[c]! - 1) * m.cs + m.cs / 2 + (exitDir >= 0 ? m.cs / 2 : 0) + Math.abs(x - edge.x) + Math.abs(y - edge.y);
    }
  }
  return 1e9;
}

function degree(m: Maze, c: number): number {
  let k = 0;
  for (let d = 0; d < 4; d++) if (openCell(m, c, d) >= 0) k++;
  return k;
}

/** The deepest cell of the subtree entered from `from` through `first`, and whether it holds a spike. */
function branchEnd(m: Maze, from: number, first: number): { cell: number; depth: number; pit: boolean } {
  let best = first;
  let bestDepth = 1;
  let pit = false;
  const stack: [number, number, number][] = [[first, from, 1]];
  while (stack.length) {
    const [c, parent, depth] = stack.pop()!;
    if (m.pits.includes(c)) pit = true;
    if (depth > bestDepth) {
      bestDepth = depth;
      best = c;
    }
    for (let d = 0; d < 4; d++) {
      const nc = openCell(m, c, d);
      if (nc >= 0 && nc !== parent) stack.push([nc, c, depth + 1]);
    }
  }
  return { cell: best, depth: bestDepth, pit };
}

const wrap = (d: number) => ((((d + TURN / 2) % TURN) + TURN) % TURN) - TURN / 2;

interface Goal {
  /** Marble being steered (0 blue, 1 amber). */
  which: number;
  /** Target cell; leave through `dir` when it is the cup. */
  cell: number;
  dir: number;
  /** tiltRev 4: the star's own point inside the target cell. */
  pt?: { x: number; y: number };
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const init = game.init(seed) as TiltState;
  const history: TiltState[] = [];
  const lag = human.lagTicks();
  const fingerTop = FINGER[level];

  let touch = 0;
  let finger = TILT_WORLD_W / 2;
  let fingerDown = false;
  let regripUntil = 0;

  let mazeLevel = -1;
  let thinkUntil = 0;
  let focus = 0;
  let starPlan: number[] = [];
  let quickPlan: number[] = [];
  const decided = new Set<number>();
  let detour: { cell: number; until: number } | null = null;
  let rethinkUntil = 0;
  let nextGlance = 0;
  let wantAngle = 0;
  let slipUntil = -1;
  // Stuck: no progress for a while → try something else for a moment.
  let bestProgress = Infinity;
  let bestAt = 0;
  let wanderUntil = -1;

  const bodyOf = (s: TiltState, which: number) => {
    if (which === 0) return s.aHome ? null : { x: s.x, y: s.y, vx: s.vx, vy: s.vy };
    return s.b && !s.bHome ? s.b : null;
  };

  const enter = (s: TiltState, t: number) => {
    mazeLevel = s.level;
    const m = s.list[s.level]!;
    const two = !!s.b;
    thinkUntil = t + human.thinkTicks(2600 + 700 * s.level + (two ? 1200 : 0));
    decided.clear();
    detour = null;
    // tiltRev 4 stars beside a black hole (not at their cell's centre) are a risk to the whole run: half as tempting.
    starPlan = (m.stars ?? []).filter((c, k) => {
      const centre = tiltCellCentre(m, c);
      const atHole = !!m.starXY && (m.starXY[2 * k] !== centre.x || m.starXY[2 * k + 1] !== centre.y);
      return human.chance(STAR_GO[level] * (atHole ? MOUTH_GO : 1));
    });
    quickPlan = (m.quick ?? []).filter(() => human.chance(QUICK_GO[level]));
    focus = 0;
    if (two) {
      const da = field(m, m.exit)[cellAt(m, s.x, s.y)] ?? 99;
      const db = field(m, m.exit2!)[cellAt(m, s.b!.x, s.b!.y)] ?? 99;
      focus = human.pick([-da, -db]);
    }
    bestProgress = Infinity;
    bestAt = t;
  };

  /** The current goal of the steered marble (as the player has it in mind). */
  const goalOf = (s: TiltState, m: Maze, t: number): Goal | null => {
    if (!bodyOf(s, focus)) focus = 1 - focus;
    const b = bodyOf(s, focus);
    if (!b) return null;
    const which = focus;
    const c = cellAt(m, b.x, b.y);
    const exit = which === 0 ? m.exit : m.exit2!;
    const exitDir = which === 0 ? m.exitDir : m.exitDir2!;
    if (detour) return { which, cell: detour.cell, dir: -1 };
    if (s.xp && c >= 0) {
      // Quick stars first while their window still has time for the trip (about 4 ticks a cell, and a margin).
      const qGot = s.quickGot ?? [];
      const quick = m.quick ?? [];
      const dist = field(m, c);
      const live = quickPlan.filter((q) => !qGot[quick.indexOf(q)] && dist[q]! < 1e6 && dist[q]! * 4 + 60 < tiltQuickLeft(s));
      if (live.length) {
        live.sort((p, q) => dist[p]! - dist[q]!);
        return { which, cell: live[0]!, dir: -1 };
      }
      // A cup cut off by a shut gate: the nearest key that can be reached.
      if (field(m, exit)[c]! >= 1e6) {
        const keys = (m.keys ?? []).filter((k, i) => !((KEYS >> i) & 1) && dist[k]! < 1e6);
        if (keys.length) {
          keys.sort((p, q) => dist[p]! - dist[q]!);
          return { which, cell: keys[0]!, dir: -1 };
        }
        // This marble cannot reach a key: the other one must.
        if (bodyOf(s, 1 - which)) focus = 1 - which;
      }
    }
    const got = s.starGot ?? [];
    const stars = m.stars ?? [];
    const want = starPlan.filter((sc) => !got[stars.indexOf(sc)]);
    if (want.length && c >= 0) {
      const dist = field(m, c);
      want.sort((p, q) => dist[p]! - dist[q]!);
      return { which, cell: want[0]!, dir: -1, pt: tiltStarPoint(m, stars.indexOf(want[0]!)) };
    }
    // Reading a fork for the first time: a long dead-end branch can look like the way on.
    if (c >= 0 && degree(m, c) >= 3 && !decided.has(c)) {
      decided.add(c);
      const dist = field(m, exit);
      for (let d = 0; d < 4; d++) {
        const nc = openCell(m, c, d);
        if (nc < 0 || dist[nc]! < dist[c]!) continue;
        // Not back the way the marble came.
        if (b.vx * DX[d]! + b.vy * DY[d]! < -96) continue;
        const end = branchEnd(m, c, nc);
        if (end.pit || end.depth < 3) continue;
        if (human.chance(human.p.judgement * Math.min(1, end.depth / 10) * 0.5) || human.slip(0.25)) {
          detour = { cell: end.cell, until: t + 45 * (end.depth + 3) };
          return { which, cell: end.cell, dir: -1 };
        }
      }
    }
    return { which, cell: exit, dir: exitDir };
  };

  /** How good a (forked) state is for the goal, as an experienced eye judges it. */
  const value = (p: TiltState, s0: TiltState, goal: Goal): number => {
    if (p.ended === 2) return -1e15;
    if (p.mazes > s0.mazes || p.ended === 1) return 1e13;
    const m = p.list[p.level]!;
    let v = 0;
    const home0 = (s0.aHome ?? 0) + (s0.bHome ?? 0);
    const home = (p.aHome ?? 0) + (p.bHome ?? 0);
    v += (home - home0) * 1e10;
    v += ((p.stars ?? 0) - (s0.stars ?? 0) + (p.quickTaken ?? 0) - (s0.quickTaken ?? 0)) * (goal.dir < 0 ? 1e8 : 0);
    if ((p.keysGot ?? 0) !== (s0.keysGot ?? 0)) v += 1e9;
    const b = bodyOf(p, goal.which);
    if (b) v -= pathDist(m, b.x, b.y, goal.cell, goal.dir, goal.pt);
    // A light pull on the other marble toward its own cup.
    const o = bodyOf(p, 1 - goal.which);
    if (o) v -= 0.05 * pathDist(m, o.x, o.y, goal.which === 0 ? m.exit2! : m.exit, goal.which === 0 ? m.exitDir2! : m.exitDir);
    if (p.chaser && p.gate) for (const ball of [bodyOf(p, 0), bodyOf(p, 1)]) if (ball) v += Math.min(4 * m.cs, Math.abs(ball.x - p.chaser.x) + Math.abs(ball.y - p.chaser.y));
    return v;
  };

  /** Ideal tilt for the seen state (24 candidates rolled forward with the player's own turning speed). */
  const idealAngle = (seen: TiltState, goal: Goal): number => {
    let best = seen.angle;
    let bestV = -Infinity;
    const horizon = HORIZON[level];
    for (let k = 0; k < 24; k++) {
      const target = (k * TURN) / 24;
      let p: TiltState = seen;
      const turn = Math.ceil(Math.abs(wrap(target - seen.angle)) / (ANG_PER_PX * fingerTop));
      for (let h = 0; h < turn + horizon && !game.isOver(p); h++) {
        const px = Math.max(-fingerTop, Math.min(fingerTop, Math.round(wrap(target - p.angle) / ANG_PER_PX)));
        p = game.step({ ...p, angle: (p.angle + px * ANG_PER_PX) & (TURN - 1) }, null);
      }
      const v = value(p, seen, goal);
      if (v > bestV) {
        bestV = v;
        best = target;
      }
    }
    return best;
  };

  return driveEvents(
    game,
    (s: TiltState, t) => {
      history.push(s);
      if (s.level !== mazeLevel) enter(s, t);
      KEYS = s.keysGot ?? 0;
      const seen = history[Math.max(0, history.length - 1 - lag)]!;
      if (seen.level !== s.level || t < thinkUntil || t < rethinkUntil) return null;
      const m = s.list[s.level]!;

      if (t >= nextGlance) {
        nextGlance = t + Math.max(3, GLANCE[level] + human.int(-2, 2));
        const goal = goalOf(seen, m, t);
        if (!goal) return null;
        if (detour) {
          const b = bodyOf(seen, goal.which)!;
          if (cellAt(m, b.x, b.y) === detour.cell || t > detour.until) {
            // Dead end: stop and rethink.
            detour = null;
            rethinkUntil = t + human.thinkTicks(1000);
            return null;
          }
        }
        // Stuck guard on the goal distance.
        const b = bodyOf(seen, goal.which)!;
        const prog = pathDist(m, b.x, b.y, goal.cell, goal.dir, goal.pt);
        if (prog < bestProgress - 8 * 256) {
          bestProgress = prog;
          bestAt = t;
        } else if (t - bestAt > 240 && t > wanderUntil) {
          wanderUntil = t + 30 + human.int(0, 50);
          wantAngle = human.int(0, TURN - 1);
          bestAt = t;
          bestProgress = Infinity;
        }
        if (t > wanderUntil) {
          if (human.slip(0.3)) {
            slipUntil = t + human.reactTicks();
            wantAngle = (s.angle + (human.chance(0.5) ? 1 : -1) * human.int(4000, 12000)) & (TURN - 1);
          } else if (t > slipUntil) {
            wantAngle = (idealAngle(seen, goal) + Math.round(human.aim(WORLD_PER_PX) * ANG_PER_PX * 1.5)) & (TURN - 1);
          }
        }
      }
      return turnToward(s, t, wantAngle);
    },
    init,
  );

  function turnToward(s: TiltState, t: number, target: number) {
    if (t < regripUntil) return null;
    const need = wrap(target - s.angle);
    if (!fingerDown) {
      if (Math.abs(need) < ANG_PER_PX * 2) return null;
      // Put the finger down with room to drag the way it needs to go.
      finger = need > 0 ? 80 : TILT_WORLD_W - 80;
      finger = Math.round(finger + human.aim(WORLD_PER_PX) * 2);
      touch = (touch + 1) % 256;
      fingerDown = true;
      return { k: TILT_INPUT_DRAG, a: finger, b: 0, c: touch, d: 0 };
    }
    const errPx = need / ANG_PER_PX;
    if (Math.abs(errPx) < 1) return null;
    let stepPx = Math.max(-fingerTop, Math.min(fingerTop, errPx * 0.6));
    stepPx += human.normal() * human.p.aimSdPx * 0.05;
    let next = Math.round(finger + stepPx);
    if (next === finger) next += Math.sign(errPx);
    if (next < 4 || next > TILT_WORLD_W - 4) {
      // Off the screen edge: lift and re-grip.
      fingerDown = false;
      regripUntil = t + 3 + human.int(0, 3) + Math.round(6 * human.p.thinkScale);
      return null;
    }
    finger = next;
    return { k: TILT_INPUT_DRAG, a: finger, b: 0, c: touch, d: 0 };
  }
};
