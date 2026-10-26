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
 * tiltRev 8 (the expansion, docs/expansions/x200-tilt.md; every addition below is on tiltRev 8 states only, so
 * older revisions play exactly as before): a shut gate is a wall until its key is taken, so a marble whose cup is
 * cut off goes for the nearest key; quick stars are taken first (by the players who go for them, while their
 * window still has time); a skilled player anticipates the roll since the eye last saw it (they know their own
 * tilt); a fall sends the marble back to its start (avoided like the old run-ending fall, but weighed as the time
 * it costs when the player is stuck), a hole fallen into is passed slowly afterwards, and the marble is not rolled
 * into its cup while the player is on the way to a star or key.
 */
import { tiltCellCentre, tiltQuickFullLeftX, tiltQuickLeftX, tiltStarPoint, TILT_INPUT_DRAG, TILT_MAX_MAZES, TILT_RUN_TICKS, TILT_WORLD_W, type Maze, type TiltState } from "../../../src/lib/arcade/tilt";
import { driveEvents, type SkillBot } from "../bot";
import type { SkillLevel } from "../human";

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const ANG_PER_PX = 91;
const TURN = 65536;
/** World px per phone px (the 440-wide world on a ~390-px phone). */
const WORLD_PER_PX = TILT_WORLD_W / 390;

/** Finger top speed for turning the disc, world px a tick (≈ 12–20 phone px: a controlled spin, not a flick). */
const FINGER: Record<SkillLevel, number> = { weak: 6, average: 7, good: 8, great: 9, near: 10, elite: 10, perfect: 10 };
/** Re-decision cadence, ticks (how often the player re-reads the board and changes the tilt). */
const GLANCE: Record<SkillLevel, number> = { weak: 14, average: 12, good: 10, great: 8, near: 6, elite: 5, perfect: 5 };
/** How far ahead (ticks) the player foresees where the marbles roll. */
const HORIZON: Record<SkillLevel, number> = { weak: 22, average: 30, good: 38, great: 44, near: 48, elite: 50, perfect: 50 };
/** Fixes: ticks of braking tried after the look-ahead (the disc turns slowly, so stopping takes a while). */
const BRAKE_TICKS = 60;
/** Fixes: chance per glance that the player weighs the marble's speed against the holes ahead (stopping distance). */
const CAUTION: Record<SkillLevel, number> = { weak: 0.35, average: 0.6, good: 0.75, great: 0.88, near: 0.96, elite: 0.98, perfect: 1 };
/** Fixes: ticks without progress before the player stops and tries something else (v1: 240 at every level). */
const STUCK: Record<SkillLevel, number> = { weak: 300, average: 260, good: 220, great: 190, near: 160, elite: 150, perfect: 120 };
/** Fixes: a typical strong player's ticks per route cell (thinking included), before the run gives its own. */
const PACE_PRIOR = 15;
/** Fixes: chance a stuck player works out the two-move way on (else they try something at random). */
const DEEP_FIND: Record<SkillLevel, number> = { weak: 0.25, average: 0.45, good: 0.65, great: 0.8, near: 0.92, elite: 0.96, perfect: 1 };
/** Fixes: how long the first move of a two-move plan is held, ticks after the turn. */
const DEEP_HOLDS = [3, 6, 10, 14, 20, 26];
/** tiltRev 4: a star at a hole's mouth is taken this much less often (the fall ends the run). */
const MOUTH_GO = 0.5;
/** Fixes: levels that leave a hole's star alone (elite policy: protect the run). */
const SKIP_MOUTH: Record<SkillLevel, boolean> = { weak: false, average: false, good: false, great: false, near: false, elite: true, perfect: true };
/** Chance of detouring for each bonus star. */
const STAR_GO: Record<SkillLevel, number> = process.env.TILT_NO_STARS ? { weak: 0, average: 0, good: 0, great: 0, near: 0, elite: 0, perfect: 0 } : { weak: 0, average: 0.15, good: 0.45, great: 0.75, near: 0.92, elite: 1, perfect: 1 };

/** tiltRev 8: chance of going for each quick star (while its window has time left). */
const QUICK_GO: Record<SkillLevel, number> = process.env.TILT_NO_STARS ? { weak: 0, average: 0, good: 0, great: 0, near: 0, elite: 0, perfect: 0 } : { weak: 0.1, average: 0.25, good: 0.5, great: 0.8, near: 0.97, elite: 1, perfect: 1 };
/** tiltRev 8: the share of the perception lag a player anticipates away. */
const ANTICIPATE: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0.3, great: 0.5, near: 0.7, elite: 0.85, perfect: 1 };
/** tiltRev 8: what a fall is worth to a stuck player, in cells of path, beyond the ground it loses. */
const FALL_COST = 12;
/** tiltRev 8: how much a player who has fallen into a hole weighs rolling fast past it again (path distance, FP, per FP of speed). */
const BURNT_CAUTION = 6;
/** tiltRev 8: the ticks a cell the player reckons a trip to a quick star takes. */
const QUICK_TRIP = 14;

/** tiltRev 8: the keys taken in the maze being played (the bot's own view of the gates). */
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
  // tiltRev 8: the gates open as their keys are taken (no gates on older revisions: KEYS stays 0 there).
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

export const bot: SkillBot = ({ game, seed, human, fixes }) => {
  const level = human.level;
  const init = game.init(seed) as TiltState;
  const history: TiltState[] = [];
  // tiltRev 8: a skilled player anticipates where the marble has rolled since the eye last saw it.
  const lag = init.xp ? Math.round(human.lagTicks() * (1 - ANTICIPATE[level])) : human.lagTicks();
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
  // tiltRev 8: black holes fallen into in the maze being played.
  const burnt = new Set<number>();
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
  let switchedAt = -10000;
  let lastGoalKey = -1;
  let deep: { from: number; a1: number; until1: number; a2: number; until2: number } | null = null;
  /** Fixes: the tilts the last look-ahead found no marble falling with (for a safe "try something else"). */
  let safeAngles: number[] = [];

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
    burnt.clear();
    // tiltRev 4 stars beside a black hole (not at their cell's centre) are a risk to the whole run: half as tempting.
    starPlan = (m.stars ?? []).filter((c, k) => {
      const centre = tiltCellCentre(m, c);
      const atHole = !!m.starXY && (m.starXY[2 * k] !== centre.x || m.starXY[2 * k + 1] !== centre.y);
      // Elite and flawless (fixes): never a hole's star. Leaning into a hole's mouth risks the whole run for 5 points
      // (on the tuning seeds elite fell in 8 runs of 60 taking the ones on its route, 2 of 60 taking none, same median).
      if (atHole && fixes && SKIP_MOUTH[level]) return false;
      return human.chance(STAR_GO[level] * (atHole ? MOUTH_GO : 1));
    });
    quickPlan = s.xp ? (m.quick ?? []).filter(() => human.chance(QUICK_GO[level])) : [];
    focus = 0;
    if (two) {
      const da = field(m, m.exit)[cellAt(m, s.x, s.y)] ?? 99;
      const db = field(m, m.exit2!)[cellAt(m, s.b!.x, s.b!.y)] ?? 99;
      focus = human.pick([-da, -db]);
    }
    bestProgress = Infinity;
    bestAt = t;
  };

  /** Route cells from each maze's start(s) to its cup(s): the work a run must do. */
  const routeCells = (mz: Maze) => {
    const a = field(mz, mz.exit)[mz.start] ?? 0;
    const b = mz.start2 !== undefined && mz.start2 >= 0 && mz.exit2 !== undefined && mz.exit2 >= 0 ? (field(mz, mz.exit2)[mz.start2] ?? 0) : 0;
    return a + b;
  };
  /** Fixes: whether the detour to `star` still leaves time to finish every maze at the player's pace. */
  const starAffordable = (s: TiltState, m: Maze, which: number, c: number, star: number, t: number): boolean => {
    const left = (b: { x: number; y: number } | null, exit: number) => (b ? (field(m, exit)[cellAt(m, b.x, b.y)] ?? 0) : 0);
    const here = left(bodyOf(s, 0), m.exit) + (s.b ? left(bodyOf(s, 1), m.exit2!) : 0);
    let later = 0;
    for (let k = s.level + 1; k < TILT_MAX_MAZES && k < s.list.length; k++) later += routeCells(s.list[k]!);
    let done = 0;
    for (let k = 0; k < s.level; k++) done += routeCells(s.list[k]!);
    done += Math.max(0, routeCells(m) - here);
    const exit = which === 0 ? m.exit : m.exit2!;
    const detour = Math.max(0, (field(m, c)[star] ?? 0) + (field(m, exit)[star] ?? 0) - (field(m, exit)[c] ?? 0));
    // Pace (ticks a route cell, thinking included): the run's own once it has some, else a typical one.
    const pace = done >= 40 ? Math.max(9, Math.min(30, t / done)) : PACE_PRIOR;
    const need = pace * (here + later + detour + 4) * Math.exp(human.p.judgement * human.normal());
    return t + need < TILT_RUN_TICKS - 60;
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
      // tiltRev 8: quick stars first while the player reckons the trip still beats the star's window.
      const qGot = s.quickGot ?? [];
      const quick = m.quick ?? [];
      const dist = field(m, c);
      const live = quickPlan.filter((q) => {
        const k = quick.indexOf(q);
        return !qGot[k] && dist[q]! < 1e6 && dist[q]! * QUICK_TRIP + 30 < tiltQuickFullLeftX(s, k) + (tiltQuickLeftX(s, k) - tiltQuickFullLeftX(s, k)) / 2;
      });
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
      // Fixes: a star is worth 5 points, finishing every maze far more; the player drops a star whose detour the
      // clock can no longer spare (judged by their own pace so far, with their own misjudgement).
      if (fixes && !starAffordable(s, m, which, c, want[0]!, t)) {
        starPlan = starPlan.filter((sc) => sc !== want[0]);
        return goalOf(s, m, t);
      }
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

  /**
   * Fixes (Oct 2026): can the marble(s) still be stopped from here? Tilt against the steered marble's
   * motion at the player's own turning speed and see whether either marble rolls into a hole first: a
   * hole the player can see coming is one to brake for, not only one the held tilt drops into.
   */
  const brakeFalls = (p: TiltState, which: number): boolean => {
    let q = p;
    for (let h = 0; h < BRAKE_TICKS && !game.isOver(q); h++) {
      const b = bodyOf(q, which) ?? bodyOf(q, 1 - which);
      if (!b) return false;
      if (Math.abs(b.vx) + Math.abs(b.vy) < 48) {
        const o = bodyOf(q, 1 - which);
        if (!o || Math.abs(o.vx) + Math.abs(o.vy) < 48) return false;
      }
      const target = Math.round((Math.atan2(-b.vx, -b.vy) / (2 * Math.PI)) * TURN) & (TURN - 1);
      const px = Math.max(-fingerTop, Math.min(fingerTop, Math.round(wrap(target - q.angle) / ANG_PER_PX)));
      q = game.step({ ...q, angle: (q.angle + px * ANG_PER_PX) & (TURN - 1) }, null);
    }
    return q.ended === 2 || (q.falls ?? 0) > (p.falls ?? 0);
  };

  /** How good a (forked) state is for the goal, as an experienced eye judges it. */
  const value = (p: TiltState, s0: TiltState, goal: Goal, careful = false, stuck = false): number => {
    // Fixes: of runs that all fall, the latest fall is the least bad (more time to correct).
    if (p.ended === 2) return fixes ? -1e15 + p.endedTick * 1e6 : -1e15;
    // tiltRev 8: a fall sends the marble back to its start. Normally avoided as the old run-ending fall was (the
    // latest least bad); once stuck, it costs only the ground lost (the end state shows it) and the wait.
    const fell = (p.falls ?? 0) > (s0.falls ?? 0) ? (stuck ? FALL_COST * p.list[p.level]!.cs : 1e14 - Math.min(p.fallTick ?? 0, 5400) * 1e6) : 0;
    // tiltRev 8: on the way to a star or key, rolling into the cup first would give the star up.
    if (s0.xp && goal.dir < 0 && !detour && p.mazes > s0.mazes) return -1e12;
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
    if (careful && brakeFalls(p, goal.which)) v -= 1e12;
    return v - fell;
  };

  /** Ideal tilt for the seen state (24 candidates rolled forward with the player's own turning speed). */
  const idealAngle = (seen: TiltState, goal: Goal): number => {
    let best = seen.angle;
    let bestV = -Infinity;
    safeAngles = [];
    const horizon = HORIZON[level];
    // Fixes: this glance the player also judges whether the marble could still be stopped short of a hole.
    const careful = !!fixes && human.chance(CAUTION[level]);
    for (let k = 0; k < 24; k++) {
      const target = (k * TURN) / 24;
      let p: TiltState = seen;
      const turn = Math.ceil(Math.abs(wrap(target - seen.angle)) / (ANG_PER_PX * fingerTop));
      // tiltRev 8: how fast a marble rolls past a hole the player has already fallen into.
      let caution = 0;
      for (let h = 0; h < turn + horizon && !game.isOver(p); h++) {
        const px = Math.max(-fingerTop, Math.min(fingerTop, Math.round(wrap(target - p.angle) / ANG_PER_PX)));
        p = game.step({ ...p, angle: (p.angle + px * ANG_PER_PX) & (TURN - 1) }, null);
        if (burnt.size && p.level === seen.level) {
          const m = p.list[p.level]!;
          for (const b of [bodyOf(p, 0), bodyOf(p, 1)]) {
            if (!b) continue;
            for (const pit of burnt) {
              const c = tiltCellCentre(m, pit);
              const d = Math.abs(b.x - c.x) + Math.abs(b.y - c.y);
              if (d < 2 * m.cs) caution = Math.max(caution, ((Math.abs(b.vx) + Math.abs(b.vy)) * (2 * m.cs - d)) / m.cs);
            }
          }
        }
      }
      const v = value(p, seen, goal, careful) - BURNT_CAUTION * caution;
      if (v > -1e11) safeAngles.push(target);
      if (v > bestV) {
        bestV = v;
        best = target;
      }
    }
    return best;
  };

  /** Rolls `p` with the disc turned toward `target` (the player's own turning speed) for `n` ticks. */
  const roll = (p: TiltState, target: number, n: number): TiltState => {
    for (let h = 0; h < n && !game.isOver(p); h++) {
      const px = Math.max(-fingerTop, Math.min(fingerTop, Math.round(wrap(target - p.angle) / ANG_PER_PX)));
      p = game.step({ ...p, angle: (p.angle + px * ANG_PER_PX) & (TURN - 1) }, null);
    }
    return p;
  };

  /**
   * Fixes: when a held tilt can't get the marble on (it must drop into a one-cell gap, or brake before a hole and
   * then turn), the player thinks it through as two moves: tilt one way for a moment, then another. Tried only when
   * stuck (it is a harder think, and it costs think time). Returns the plan, or null when nothing beats the held tilt.
   */
  const deepPlan = (seen: TiltState, goal: Goal): { a1: number; h1: number; a2: number } | null => {
    const horizon = HORIZON[level];
    let bestV = -Infinity;
    let plan: { a1: number; h1: number; a2: number } | null = null;
    let single = -Infinity;
    // The first move: each of 24 tilts, or holding the tilt as it is (waiting for the right moment).
    for (let k1 = 0; k1 <= 24; k1++) {
      const a1 = k1 < 24 ? (k1 * TURN) / 24 : seen.angle;
      const turn1 = Math.ceil(Math.abs(wrap(a1 - seen.angle)) / (ANG_PER_PX * fingerTop));
      let p = roll(seen, a1, turn1);
      let held = 0;
      for (const h1 of DEEP_HOLDS) {
        p = roll(p, a1, h1 - held);
        held = h1;
        if (game.isOver(p)) break;
        for (let k2 = 0; k2 < 24; k2++) {
          const a2 = (k2 * TURN) / 24;
          const turn2 = Math.ceil(Math.abs(wrap(a2 - p.angle)) / (ANG_PER_PX * fingerTop));
          const v = value(roll(p, a2, turn2 + horizon), seen, goal, true, true);
          if (v > bestV) {
            bestV = v;
            plan = { a1, h1: turn1 + h1, a2 };
          }
        }
      }
      const one = value(roll(p, a1, horizon), seen, goal, true, true);
      single = Math.max(single, one);
    }
    return plan && bestV > single + 4 * 256 ? plan : null;
  };

  return driveEvents(
    game,
    (s: TiltState, t) => {
      // tiltRev 8: remember the black hole a marble just fell into (the player learns where it is).
      const before = history[history.length - 1];
      if (s.xp && before && before.level === s.level && (s.falls ?? 0) > (before.falls ?? 0)) {
        const mz = s.list[s.level]!;
        for (const b of [bodyOf(before, 0), bodyOf(before, 1)]) {
          if (!b) continue;
          let near = -1;
          let nearD = Infinity;
          for (const pit of mz.pits) {
            const c = tiltCellCentre(mz, pit);
            const d = Math.abs(b.x + b.vx - c.x) + Math.abs(b.y + b.vy - c.y);
            if (d < nearD) {
              nearD = d;
              near = pit;
            }
          }
          if (near >= 0 && nearD < mz.cs) burnt.add(near);
        }
      }
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
        // Fixes: progress is measured toward the goal in mind; a new goal (a star taken, the other marble) starts afresh
        // (v1 compared the cup's distance with the star's, so every star taken set off a pointless wander 4 s later).
        const goalKey = goal.which * 100000 + goal.cell * 4 + goal.dir + 1;
        if (fixes && goalKey !== lastGoalKey) {
          bestProgress = Infinity;
          bestAt = t;
        }
        lastGoalKey = goalKey;
        if (prog < bestProgress - 8 * 256) {
          bestProgress = prog;
          bestAt = t;
        } else if (t - bestAt > (fixes ? STUCK[level] : 240) && t > wanderUntil && !(deep && t < deep.until2)) {
          const plan = fixes && human.chance(DEEP_FIND[level]) ? deepPlan(seen, goal) : null;
          if (plan) {
            // Fixes: the two-move plan (see deepPlan) after a moment's thought, then back to steering by eye.
            const think = human.thinkTicks(800);
            deep = { from: t + think, a1: plan.a1, until1: t + think + plan.h1, a2: plan.a2, until2: t + think + plan.h1 + 30 };
          } else if (fixes && bodyOf(seen, 1 - goal.which) && t - switchedAt > 480) {
            // Fixes: two marbles and one tilt; when one is boxed in, a player brings the other home first.
            focus = 1 - goal.which;
            switchedAt = t;
          } else {
            wanderUntil = t + 30 + human.int(0, 50);
            wantAngle = human.int(0, TURN - 1);
            // Fixes: a player trying something else still doesn't tilt a marble into a hole they can see.
            if (fixes) {
              idealAngle(seen, goal);
              if (safeAngles.length) wantAngle = safeAngles[human.int(0, safeAngles.length - 1)]!;
            }
          }
          bestAt = t;
          bestProgress = Infinity;
        }
        if (deep && t < deep.until2) {
          if (t >= deep.from) wantAngle = t < deep.until1 ? deep.a1 : deep.a2;
        } else if (t > wanderUntil) {
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
