/**
 * Minigolf (`minigolf`, Sports group, 30 Oct 2026; docs/arcade-standard/minigolf.md): five holes in 120 s on a night
 * garden terrace, top down. Pull back from the ball to aim and set the power; let go to putt.
 *
 * Deterministic (engine.ts): the seed lays out the five holes at init (each from its own template, mirrored and nudged
 * by the seed) and nothing random happens after; the ball rolls in 1/256 px with integer friction, rails, logs,
 * boulders, planters, slopes and ponds. Each hole grows on the last: a straight, a dogleg, an S-bend, a split route
 * and a grand finale. Pars come with the puzzle (each hole's best proven route + 1, scripts/minigolf-bank.ts), so a
 * birdie is always possible.
 *
 * Rules: 6 strokes a hole; a sixth that stays out ends the hole with closeness credit. Water costs a stroke and puts
 * the ball back where it was played from. A hole holed moves on to the next tee after a short pause.
 *
 * Scoring (golfRev 1, the arcade standard; arcadeStandard.ts): Holes up to 120 (24 a hole holed; an unfinished hole up
 * to 20 by closeness to the cup, a straight line from the tee's distance to the cup), Par up to 40 (8 a hole: full at
 * par or better, falling evenly to 0 at the stroke limit), Under par up to 20 (4 a hole), Speed up to 20 (all five
 * holed: full by MINIGOLF_FULL_BY_S, 0 at the buzzer). Together 200; any shot scores at least 1, no input 0.
 */
import { clampInt, fp, inputRange, isqrt, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import { STD_MAX, stdFinal, stdLine, stdPart, stdSpeed, type StdPart, type StdSpec } from "./arcadeStandard";
import { bounceOff, bounceSeg, idiv, ilen, rollFriction, sumInts, type Seg, type SportsCheckpoint } from "./sportsKit";

/* ================================ Constants ================================ */

export const MINIGOLF_REV = 1;
export const MINIGOLF_RUN_S = 120;
export const MINIGOLF_RUN_TICKS = MINIGOLF_RUN_S * 60;
export const MINIGOLF_HOLES = 5;
export const MINIGOLF_STROKE_LIMIT = 6;

/** The world every hole is laid out in (world px); the holes grow inside it. */
export const MINIGOLF_W = 390;
export const MINIGOLF_H = 690;

export const MG_BALL_R = 5;
export const MG_CUP_R = 8;
/** The fastest a ball may cross the cup and still drop (px a tick, in units). */
export const MG_CAPTURE_V = fp(3.2);
/** A putt's speed from the softest to the hardest pull (units a tick). */
export const MG_MIN_V = fp(0.8);
export const MG_MAX_V = fp(11);
/** Rolling friction: drag in 4096ths a tick and a constant slowing (units a tick). */
export const MG_DRAG = 80;
export const MG_DECEL = 6;
/** Below this speed a ball on a gentle slope stops. */
export const MG_STOP_V = 22;
/** Restitution (256ths): rails, logs, boulders, planters. */
export const MG_E_RAIL = 190;
export const MG_E_LOG = 205;
export const MG_E_ROCK = 150;
export const MG_E_PLANTER = 140;
/** Ticks between holing out and the next tee. */
export const MG_HOLE_PAUSE = 50;
/** A putt that has not stopped by this many ticks is stopped where it is. */
export const MG_ROLL_CAP = 720;
/** Substeps a tick (the ball never moves more than 3 px a substep). */
const SUB = 4;

/** Input kind 1: a putt. a, b = the aim direction (any length); c = power 1…1000. */
export const MG_INPUT_PUTT = 1;
export const MG_POWER_MAX = 1000;
export const MINIGOLF_INPUT_RANGES = [inputRange(MG_INPUT_PUTT, [-4096, 4096], [-4096, 4096], [1, MG_POWER_MAX])] as const;

export const MG_AIM = 0;
export const MG_ROLL = 1;
export const MG_PAUSE = 2;
export const MG_DONE = 3;

/* ============================== The standard ============================== */

export const MG_HOLE_PTS = 24;
export const MG_CLOSE_PTS = 20;
export const MG_PAR_PTS = 8;
export const MG_UNDER_PTS = 4;
export const MG_SPEED_PTS = 20;
/**
 * Speed: full when all five are holed by this many seconds (the near-perfect skill-band median finish, measured with
 * scripts/arcade-skill-bands.ts minigolf --levels=near), 0 at the buzzer.
 */
export const MINIGOLF_FULL_BY_S = 33;

export const MINIGOLF_STD_SPEC: StdSpec = {
  field: "golfRev",
  rev: MINIGOLF_REV,
  parts: [
    { key: "core", label: "Holes", max: 120, of: MINIGOLF_HOLES, item: "hole", how: `${MG_HOLE_PTS} a hole holed; an unfinished hole up to ${MG_CLOSE_PTS} by how close you finish` },
    { key: "par", label: "Par", max: 40, of: MINIGOLF_HOLES, item: "hole", how: `${MG_PAR_PTS} a hole at par or better, less for each stroke over` },
    { key: "under", label: "Under par", max: 20, of: MINIGOLF_HOLES, item: "hole", how: `${MG_UNDER_PTS} a hole under par` },
    { key: "speed", label: "Speed", max: 20, of: 1, item: "finish", how: `all five holed: full by ${MINIGOLF_FULL_BY_S} s, none at the buzzer` },
  ],
};

/* ================================= Course ================================= */

export interface MgCircle {
  x: number;
  y: number;
  r: number;
}
export interface MgSlope {
  /** Box (units) and the pull it gives a rolling ball (units a tick², downhill). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  ax: number;
  ay: number;
}
export interface MgHole {
  index: number;
  /** The kind of hole, for the art and the reveal. */
  shape: "straight" | "dogleg" | "sbend" | "split" | "grand";
  /** The fairway outline (units, x,y pairs, world space); its edges are the rails. */
  poly: number[];
  tee: { x: number; y: number };
  cup: { x: number; y: number };
  logs: Seg[];
  rocks: MgCircle[];
  planters: MgCircle[];
  ponds: MgCircle[];
  slopes: MgSlope[];
  /** Every solid edge (rails and logs) in one list, for the sim. */
  segs: Seg[];
  /** The tee's straight distance to the cup (units): an unfinished hole's closeness line. */
  reach: number;
  /** The hole's box in world px (for the art and the camera). */
  box: { x: number; y: number; w: number; h: number };
}

/** A tiny integer PRNG for the deal only (mulberry32); play never draws. */
function dealRng(seed: number): (n: number) => number {
  let a = seed >>> 0;
  return (n: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return n <= 1 ? 0 : ((t ^ (t >>> 14)) >>> 0) % n;
  };
}

interface Template {
  shape: MgHole["shape"];
  w: number;
  h: number;
  poly: number[];
  tee: [number, number];
  cup: [number, number];
  /** Cup nudge range (px, each way). */
  cupJig: number;
  /** Logs: ends (px) and a spare field (0). */
  logs: [number, number, number, number, number][];
  rocks: [number, number, number][];
  planters: [number, number, number][];
  ponds: [number, number, number][];
  /** Slopes: box and direction (dx, dy in −1…1, downhill), strength 1–3. */
  slopes: [number, number, number, number, number, number, number][];
  /** Obstacle nudge range (px). */
  jig: number;
}

/** The five holes, each bigger than the last (px, hole space). */
const TEMPLATES: readonly Template[] = [
  {
    shape: "straight",
    w: 230,
    h: 380,
    poly: [0, 30, 30, 0, 200, 0, 230, 30, 230, 350, 200, 380, 30, 380, 0, 350],
    tee: [115, 335],
    cup: [115, 62],
    cupJig: 30,
    logs: [],
    rocks: [[115, 200, 20]],
    planters: [],
    ponds: [],
    slopes: [[20, 120, 210, 160, 0, 1, 2], [40, 30, 190, 100, 1, 0, 1]],
    jig: 14,
  },
  {
    shape: "dogleg",
    w: 300,
    h: 440,
    poly: [0, 40, 40, 0, 260, 0, 300, 40, 300, 150, 270, 170, 140, 170, 140, 440, 0, 440],
    tee: [70, 400],
    cup: [240, 80],
    cupJig: 18,
    logs: [[150, 120, 200, 168, 0]],
    rocks: [[70, 250, 16]],
    planters: [[268, 135, 15]],
    ponds: [[34, 34, 20]],
    slopes: [[10, 180, 130, 300, 0, 1, 2]],
    jig: 10,
  },
  {
    shape: "sbend",
    w: 330,
    h: 520,
    poly: [0, 190, 190, 190, 190, 30, 220, 0, 300, 0, 330, 30, 330, 330, 140, 330, 140, 520, 0, 520],
    tee: [70, 480],
    cup: [262, 60],
    cupJig: 16,
    logs: [[150, 196, 186, 232, 0], [214, 290, 262, 326, 0]],
    rocks: [[110, 262, 15]],
    planters: [[304, 118, 14]],
    ponds: [],
    slopes: [[200, 200, 320, 320, -1, 1, 2], [200, 40, 320, 150, -1, 0, 1]],
    jig: 8,
  },
  {
    shape: "split",
    w: 360,
    h: 600,
    poly: [0, 60, 60, 0, 300, 0, 360, 60, 360, 540, 300, 600, 60, 600, 0, 540],
    tee: [180, 556],
    cup: [180, 72],
    cupJig: 22,
    logs: [[20, 230, 70, 180, 0], [340, 230, 290, 180, 0]],
    rocks: [[110, 440, 14], [250, 440, 14]],
    planters: [[146, 120, 14], [214, 120, 14]],
    ponds: [[180, 320, 64]],
    slopes: [[30, 400, 150, 470, 0, 1, 1], [210, 400, 330, 470, 0, 1, 1]],
    jig: 8,
  },
  {
    shape: "grand",
    w: 380,
    h: 680,
    poly: [0, 680, 170, 680, 170, 520, 380, 520, 380, 60, 320, 0, 120, 0, 60, 60, 60, 300, 0, 360],
    tee: [85, 640],
    cup: [190, 70],
    cupJig: 14,
    logs: [[230, 350, 270, 310, 0], [90, 230, 130, 270, 0]],
    rocks: [[300, 420, 16], [140, 140, 14]],
    planters: [[158, 72, 14], [222, 72, 14]],
    ponds: [[300, 220, 44]],
    slopes: [[180, 360, 370, 490, -1, 0, 2], [70, 160, 200, 250, 0, 1, 1]],
    jig: 6,
  },
];

/** The five holes for a seed: each template mirrored (or not) and nudged by the seed, placed in the world. */
export function minigolfCourse(seed: number): MgHole[] {
  const rnd = dealRng(seed ^ 0x51f15e);
  return TEMPLATES.map((t, index) => {
    const mirror = rnd(2) === 1;
    const ox = Math.floor((MINIGOLF_W - t.w) / 2);
    const oy = Math.floor((MINIGOLF_H - t.h) / 2);
    const mx = (x: number) => (mirror ? t.w - x : x);
    const jig = () => rnd(t.jig * 2 + 1) - t.jig;
    const P = (x: number, y: number) => ({ x: fp(ox + mx(x)), y: fp(oy + y) });
    const poly: number[] = [];
    const raw = t.poly;
    // A mirrored outline runs the other way round; the rails do not care.
    for (let i = 0; i < raw.length; i += 2) {
      const p = P(raw[i]!, raw[i + 1]!);
      poly.push(p.x, p.y);
    }
    const tee = P(t.tee[0], t.tee[1]);
    const cupJx = jig() * t.cupJig / Math.max(1, t.jig);
    const cup = P(t.cup[0] + Math.trunc(cupJx), t.cup[1] + Math.trunc((jig() * t.cupJig) / Math.max(1, t.jig * 3)));
    const logs: Seg[] = t.logs.map(([ax, ay, bx, by]) => {
      const dx = jig();
      const dy = jig();
      const a = P(ax + dx, ay + dy);
      const b = P(bx + dx, by + dy);
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y, r: fp(5) };
    });
    const circ = ([x, y, r]: [number, number, number]): MgCircle => {
      const p = P(x + jig(), y + jig());
      return { x: p.x, y: p.y, r: fp(r) };
    };
    const rocks = t.rocks.map(circ);
    const planters = t.planters.map(([x, y, r]) => {
      const p = P(x, y);
      return { x: p.x, y: p.y, r: fp(r) };
    });
    const ponds = t.ponds.map(([x, y, r]) => {
      const p = P(x + jig(), y + jig());
      return { x: p.x, y: p.y, r: fp(r) };
    });
    const slopes = t.slopes.map(([x0, y0, x1, y1, dx, dy, k]) => {
      const a = P(x0, y0);
      const b = P(x1, y1);
      const strength = 3 + k * 2;
      const sx = (mirror ? -dx : dx) * strength;
      const sy = dy * strength;
      return { x0: Math.min(a.x, b.x), y0: a.y, x1: Math.max(a.x, b.x), y1: b.y, ax: sx, ay: sy };
    });
    const segs: Seg[] = [];
    for (let i = 0; i < poly.length; i += 2) {
      const j = (i + 2) % poly.length;
      if (poly[i] === poly[j] && poly[i + 1] === poly[j + 1]) continue;
      segs.push({ ax: poly[i]!, ay: poly[i + 1]!, bx: poly[j]!, by: poly[j + 1]!, r: 0 });
    }
    segs.push(...logs);
    return {
      index,
      shape: t.shape,
      poly,
      tee,
      cup,
      logs,
      rocks,
      planters,
      ponds,
      slopes,
      segs,
      reach: ilen(cup.x - tee.x, cup.y - tee.y),
      box: { x: ox, y: oy, w: t.w, h: t.h },
    };
  });
}

/* ================================= State ================================= */

export interface MinigolfState {
  tick: number;
  rev: number;
  seed: number;
  /** The holes (dealt at init; never changed). */
  course: MgHole[];
  pars: number[];
  hole: number;
  phase: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Where the current putt was played from (water puts the ball back here). */
  fromX: number;
  fromY: number;
  strokes: number;
  rollTicks: number;
  pauseUntil: number;
  /** Per hole: strokes taken, holed (1/0), closeness points (an unfinished hole). */
  taken: number[];
  holed: number[];
  close: number[];
  /** The tick the fifth hole was holed (0 until then). */
  finishTick: number;
  acted: number;
  /** Effects (display only reads these): counts that rise on each event, and the last event's tick. */
  waters: number;
  bounces: number;
  holedTick: number;
  waterTick: number;
  bounceTick: number;
  over: number;
}

function initState(seed: number, pars: readonly number[]): MinigolfState {
  const course = minigolfCourse(seed);
  const first = course[0]!;
  return {
    tick: 0,
    rev: MINIGOLF_REV,
    seed,
    course,
    pars: Array.from({ length: MINIGOLF_HOLES }, (_, i) => clampInt(pars[i] ?? 3, 2, MINIGOLF_STROKE_LIMIT - 1)),
    hole: 0,
    phase: MG_AIM,
    x: first.tee.x,
    y: first.tee.y,
    vx: 0,
    vy: 0,
    fromX: first.tee.x,
    fromY: first.tee.y,
    strokes: 0,
    rollTicks: 0,
    pauseUntil: 0,
    taken: Array.from({ length: MINIGOLF_HOLES }, () => 0),
    holed: Array.from({ length: MINIGOLF_HOLES }, () => 0),
    close: Array.from({ length: MINIGOLF_HOLES }, () => 0),
    finishTick: 0,
    acted: 0,
    waters: 0,
    bounces: 0,
    holedTick: 0,
    waterTick: 0,
    bounceTick: 0,
    over: 0,
  };
}

/** A putt's velocity for an aim direction and a power (units a tick). */
export function mgPuttVelocity(dx: number, dy: number, power: number): { vx: number; vy: number } {
  const p = clampInt(Math.trunc(power), 1, MG_POWER_MAX);
  const speed = MG_MIN_V + idiv((MG_MAX_V - MG_MIN_V) * p, MG_POWER_MAX);
  const l = ilen(dx, dy);
  if (l <= 0) return { vx: 0, vy: -speed };
  return { vx: idiv(dx * speed, l), vy: idiv(dy * speed, l) };
}

/** Closeness points for a ball resting at (x, y) on hole h: 0 at the tee's distance or further, 20 in the cup. */
export function mgClosePoints(h: MgHole, x: number, y: number): number {
  const d = ilen(x - h.cup.x, y - h.cup.y);
  return stdLine(MG_CLOSE_PTS, Math.max(0, h.reach - d), Math.max(1, h.reach));
}

function inCircle(c: MgCircle, x: number, y: number, inset = 0): boolean {
  const dx = x - c.x;
  const dy = y - c.y;
  const r = c.r - inset;
  return r > 0 && dx * dx + dy * dy < r * r;
}

/** One substep of a rolling ball on hole h (mutates b). Returns a bounce count. */
function substep(h: MgHole, b: { x: number; y: number; vx: number; vy: number }): number {
  b.x += idiv(b.vx, SUB);
  b.y += idiv(b.vy, SUB);
  let hits = 0;
  const br = fp(MG_BALL_R);
  for (const s of h.segs) {
    const out = bounceSeg(b, s, br, s.r > 0 ? MG_E_LOG : MG_E_RAIL);
    if (out) {
      if (out.impact > 40) hits++;
      b.x = out.x;
      b.y = out.y;
      b.vx = out.vx;
      b.vy = out.vy;
    }
  }
  for (const c of h.rocks) {
    const out = bounceOff(b, c.x, c.y, br + c.r, MG_E_ROCK);
    if (out) {
      if (out.impact > 40) hits++;
      Object.assign(b, { x: out.x, y: out.y, vx: out.vx, vy: out.vy });
    }
  }
  for (const c of h.planters) {
    const out = bounceOff(b, c.x, c.y, br + c.r, MG_E_PLANTER);
    if (out) {
      if (out.impact > 40) hits++;
      Object.assign(b, { x: out.x, y: out.y, vx: out.vx, vy: out.vy });
    }
  }
  return hits;
}

/** The slope pulling at (x, y), if any. */
function slopeAt(h: MgHole, x: number, y: number): MgSlope | null {
  for (const s of h.slopes) if (x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1) return s;
  return null;
}

export const MG_END_NONE = 0;
export const MG_END_HOLED = 1;
export const MG_END_WATER = 2;
export const MG_END_REST = 3;

/**
 * One tick of a rolling ball on hole h (mutates b; `rollTicks` counts this tick): four substeps against the rails,
 * logs, boulders and planters, the cup and the ponds, then the slope's pull and the friction. The sim and every
 * script that searches putts (scripts/minigolf-oracle.ts) roll through this one function.
 */
export function mgRollTick(h: MgHole, b: { x: number; y: number; vx: number; vy: number }, rollTicks: number): { hits: number; end: number } {
  let hits = 0;
  const cupR = fp(MG_CUP_R - 2);
  for (let i = 0; i < SUB; i++) {
    hits += substep(h, b);
    const dx = b.x - h.cup.x;
    const dy = b.y - h.cup.y;
    if (dx * dx + dy * dy <= cupR * cupR && ilen(b.vx, b.vy) <= MG_CAPTURE_V) return { hits, end: MG_END_HOLED };
    for (const p of h.ponds) if (inCircle(p, b.x, b.y, fp(2))) return { hits, end: MG_END_WATER };
  }
  const slope = slopeAt(h, b.x, b.y);
  if (slope) {
    b.vx += slope.ax;
    b.vy += slope.ay;
  }
  const f = rollFriction(b.vx, b.vy, MG_DRAG, MG_DECEL);
  b.vx = f.vx;
  b.vy = f.vy;
  if (ilen(b.vx, b.vy) <= MG_STOP_V || rollTicks >= MG_ROLL_CAP) {
    b.vx = 0;
    b.vy = 0;
    return { hits, end: MG_END_REST };
  }
  return { hits, end: MG_END_NONE };
}

/** Ends the current hole (holed or not) and starts the pause before the next tee. */
function endHole(s: MinigolfState, holed: boolean): void {
  const h = s.course[s.hole]!;
  s.taken[s.hole] = s.strokes;
  s.holed[s.hole] = holed ? 1 : 0;
  s.close[s.hole] = holed ? 0 : mgClosePoints(h, s.x, s.y);
  s.vx = 0;
  s.vy = 0;
  if (holed) {
    s.holedTick = s.tick;
    s.x = h.cup.x;
    s.y = h.cup.y;
  }
  if (s.hole === MINIGOLF_HOLES - 1) {
    if (holed && s.holed.every((v) => v === 1)) s.finishTick = s.tick;
    s.phase = MG_DONE;
    s.over = 1;
    return;
  }
  s.phase = MG_PAUSE;
  s.pauseUntil = s.tick + MG_HOLE_PAUSE;
}

function stepState(prev: MinigolfState, input: ArcadeInputEvent | null): MinigolfState {
  if (prev.over) return prev;
  const s: MinigolfState = { ...prev, taken: prev.taken.slice(), holed: prev.holed.slice(), close: prev.close.slice() };
  s.tick += 1;
  const h = s.course[s.hole]!;

  if (s.phase === MG_PAUSE) {
    if (s.tick >= s.pauseUntil) {
      s.hole += 1;
      const next = s.course[s.hole]!;
      s.x = next.tee.x;
      s.y = next.tee.y;
      s.fromX = next.tee.x;
      s.fromY = next.tee.y;
      s.strokes = 0;
      s.phase = MG_AIM;
    }
  } else if (s.phase === MG_AIM) {
    if (input && input.k === MG_INPUT_PUTT && input.c > 0 && (input.a !== 0 || input.b !== 0)) {
      const v = mgPuttVelocity(input.a, input.b, input.c);
      s.vx = v.vx;
      s.vy = v.vy;
      s.fromX = s.x;
      s.fromY = s.y;
      s.strokes += 1;
      s.rollTicks = 0;
      s.phase = MG_ROLL;
      s.acted = 1;
    }
  } else if (s.phase === MG_ROLL) {
    s.rollTicks += 1;
    const b = { x: s.x, y: s.y, vx: s.vx, vy: s.vy };
    const r = mgRollTick(h, b, s.rollTicks);
    s.x = b.x;
    s.y = b.y;
    s.vx = b.vx;
    s.vy = b.vy;
    if (r.hits > 0) {
      s.bounces += 1;
      s.bounceTick = s.tick;
    }
    if (r.end === MG_END_HOLED) {
      endHole(s, true);
    } else if (r.end === MG_END_WATER) {
      s.waters += 1;
      s.waterTick = s.tick;
      s.strokes += 1;
      s.x = s.fromX;
      s.y = s.fromY;
      s.vx = 0;
      s.vy = 0;
      if (s.strokes >= MINIGOLF_STROKE_LIMIT) endHole(s, false);
      else s.phase = MG_AIM;
    } else if (r.end === MG_END_REST) {
      if (s.strokes >= MINIGOLF_STROKE_LIMIT) endHole(s, false);
      else s.phase = MG_AIM;
    }
  }

  if (!s.over && s.tick >= MINIGOLF_RUN_TICKS) {
    // The buzzer: the hole in play earns its closeness from where the ball is.
    if (s.phase !== MG_PAUSE) {
      const cur = s.course[s.hole]!;
      s.taken[s.hole] = s.strokes;
      s.close[s.hole] = mgClosePoints(cur, s.x, s.y);
    }
    s.over = 1;
    s.phase = MG_DONE;
  }
  return s;
}

/* ================================= Score ================================= */

/** Each part of a final (or any) state, the core first. */
export function minigolfStdParts(s: MinigolfState): StdPart[] | null {
  if (s.rev !== MINIGOLF_REV) return null;
  let core = 0;
  let par = 0;
  let under = 0;
  let holedN = 0;
  let pars = 0;
  let unders = 0;
  for (let i = 0; i < MINIGOLF_HOLES; i++) {
    if (s.holed[i]) {
      holedN++;
      core += MG_HOLE_PTS;
      const strokes = s.taken[i]!;
      const p = s.pars[i]!;
      const pp = strokes <= p ? MG_PAR_PTS : stdLine(MG_PAR_PTS, MINIGOLF_STROKE_LIMIT - strokes, MINIGOLF_STROKE_LIMIT - p);
      par += pp;
      if (strokes <= p) pars++;
      if (strokes < p) {
        under += MG_UNDER_PTS;
        unders++;
      }
    } else core += s.close[i]!;
  }
  core = Math.min(120, core);
  const done = holedN === MINIGOLF_HOLES && s.finishTick > 0;
  const speed = done ? stdSpeed(MG_SPEED_PTS, s.finishTick, MINIGOLF_FULL_BY_S * 60, MINIGOLF_RUN_TICKS) : 0;
  const spec = MINIGOLF_STD_SPEC;
  return [
    stdPart(spec, "core", core, `${holedN} of ${MINIGOLF_HOLES} holed`),
    stdPart(spec, "par", par, `${pars} at par or better`),
    stdPart(spec, "under", under, `${unders} under par`),
    stdPart(spec, "speed", speed, done ? `all holed in ${Math.round(s.finishTick / 6) / 10} s` : "not all holed"),
  ];
}

export function minigolfScore(s: MinigolfState): number {
  const parts = minigolfStdParts(s);
  if (!parts) return 0;
  return stdFinal(parts.reduce((a, p) => a + p.points, 0), s.acted === 1);
}

export function minigolfCheckpoint(s: MinigolfState): SportsCheckpoint & { hole: number; strokes: number } {
  return {
    tick: s.tick,
    hole: s.hole,
    strokes: s.strokes,
    checksum: sumInts([s.tick, s.hole, s.phase, s.x, s.y, s.vx, s.vy, s.strokes, ...s.taken, ...s.holed, ...s.close, s.finishTick]),
  };
}

/** Strokes over the whole run (taken on finished holes plus the hole in play). */
export function minigolfStrokes(s: MinigolfState): number {
  let n = 0;
  for (let i = 0; i < MINIGOLF_HOLES; i++) n += i === s.hole && !s.over && s.phase !== MG_PAUSE ? s.strokes : s.taken[i]!;
  return n;
}

const noDraw = (_ctx: CanvasRenderingContext2D, _s: MinigolfState, _size: CanvasSize) => {};

/** The game for a puzzle's pars (rooms deal golfRev 1 only). */
export function minigolfGameFor(pars: readonly number[] = [3, 3, 3, 3, 3]): ArcadeGame<MinigolfState, ArcadeInputEvent | null> {
  return {
    key: "minigolf",
    runTicks: MINIGOLF_RUN_TICKS,
    init: (seed) => initState(seed, pars),
    step: stepState,
    isOver: (s) => s.over === 1,
    score: minigolfScore,
    draw: noDraw,
    inputRanges: MINIGOLF_INPUT_RANGES,
  };
}

/** Squared distance helper for bots and art (units). */
export function mgDist(ax: number, ay: number, bx: number, by: number): number {
  return isqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
}

export { STD_MAX as MINIGOLF_MAX };
