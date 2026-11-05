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
 * Rules: 6 strokes a hole on golfRev 1, par + 3 on golfRev 2 (mgStrokeLimit); the last that stays out ends the hole
 * with closeness credit. Water costs a stroke and puts
 * the ball back where it was played from. A hole holed moves on to the next tee after a short pause.
 *
 * Scoring (golfRev 1, the arcade standard; arcadeStandard.ts): Holes up to 120 (24 a hole holed; an unfinished hole up
 * to 20 by closeness to the cup, a straight line from the tee's distance to the cup), Par up to 40 (8 a hole: full at
 * par or better, falling evenly to 0 at the stroke limit), Under par up to 20 (4 a hole), Speed up to 20 (all five
 * holed: full by MINIGOLF_FULL_BY_S_V1, 0 at the buzzer). Together 200; any shot scores at least 1, no input 0.
 *
 * golfRev 2 (31 Oct 2026, crazy golf; the stamp rooms deal): the same five kinds of hole, now with the classic
 * obstacles (minigolfCourseV2): windmills whose four sails turn across a doorway on the sim tick (integer trig, a
 * seeded starting angle; time the putt through the gap), tunnels (a ball rolling over an entrance comes out of its exit
 * heading the exit's way with 7/8 of its speed), sand traps (strong friction), humped hills (a dome pushing away from its
 * top), banked curved walls (arcs of short segments) and castle gates (a wall with one archway); ramps are drawn raised.
 * The hardest putt is 9.6 px a tick (golfRev 1: 8). Same parts and rules; Speed full by MINIGOLF_FULL_BY_S. Every golfRev 2
 * change rolls through mgRollTickV2 and minigolfCourseV2, so golfRev 1's courses and replays are exactly as before.
 */
import { clampInt, fp, inputRange, isqrt, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import { STD_MAX, stdFinal, stdLine, stdPart, stdSpeed, type StdPart, type StdSpec } from "./arcadeStandard";
import { bounceOff, bounceSeg, closestOnSeg, idiv, ilen, NORM_ONE, rollFriction, sumInts, type Seg, type SportsCheckpoint } from "./sportsKit";
import { ANG_FULL, icos, isin, TRIG_ONE } from "./trig";

/* ================================ Constants ================================ */

/** The stamp rooms deal: golfRev 2, crazy golf (31 Oct 2026). golfRev 1 (the classic garden course) still replays. */
export const MINIGOLF_REV = 2;
export const MINIGOLF_REV_CLASSIC = 1;
export const MINIGOLF_RUN_S = 120;
export const MINIGOLF_RUN_TICKS = MINIGOLF_RUN_S * 60;
export const MINIGOLF_HOLES = 5;
export const MINIGOLF_STROKE_LIMIT = 6;

/**
 * A hole's stroke limit: 6 on golfRev 1; par + 3 on golfRev 2 (31 Oct 2026), so a par-5 finale leaves as much
 * room for mistakes as a par 3. Reaching it ends the hole with closeness credit, as before.
 */
export function mgStrokeLimit(rev: number, par: number): number {
  return rev >= 2 ? par + 3 : MINIGOLF_STROKE_LIMIT;
}

/** The world every hole is laid out in (world px); the holes grow inside it. */
export const MINIGOLF_W = 390;
export const MINIGOLF_H = 690;

export const MG_BALL_R = 5;
export const MG_CUP_R = 8;
/** The fastest a ball may cross the cup and still drop (px a tick, in units). */
export const MG_CAPTURE_V = fp(3.2);
/** A putt's speed from the softest to the hardest pull (units a tick). */
export const MG_MIN_V = fp(0.8);
export const MG_MAX_V = fp(8);
/** golfRev 2: the hardest putt about 20 % faster (9.6 px a tick). */
export const MG_MAX_V_V2 = fp(9.6);
/** Rolling friction: drag in 4096ths a tick and a constant slowing (units a tick). */
export const MG_DRAG = 96;
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
 * scripts/arcade-skill-bands.ts minigolf --levels=near), 0 at the buzzer. golfRev 2: 53 s (52.9 s, 28 of 30 near-perfect
 * runs holing all five on the golfRev 2 bank with the par + 3 stroke limit, 31 Oct 2026; 51 s under the flat six).
 */
export const MINIGOLF_FULL_BY_S = 53;
/** golfRev 1's speed full-by (its near-perfect median, 30 Oct 2026). */
export const MINIGOLF_FULL_BY_S_V1 = 50;
/** Speed's full-by time for a revision (seconds). */
export function minigolfFullByS(rev: number): number {
  return rev >= 2 ? MINIGOLF_FULL_BY_S : MINIGOLF_FULL_BY_S_V1;
}

export const MINIGOLF_STD_SPEC: StdSpec = {
  field: "golfRev",
  rev: MINIGOLF_REV,
  parts: [
    { key: "core", label: "Holes", max: 120, of: MINIGOLF_HOLES, item: "hole", how: `${MG_HOLE_PTS} for each hole holed, or up to ${MG_CLOSE_PTS} by how close you get` },
    { key: "par", label: "Par", max: 40, of: MINIGOLF_HOLES, item: "hole", how: `${MG_PAR_PTS} for each hole in par or better, less for each stroke over` },
    { key: "under", label: "Under par", max: 20, of: MINIGOLF_HOLES, item: "hole", how: `${MG_UNDER_PTS} for each hole under par` },
    { key: "speed", label: "Speed", max: 20, of: 1, item: "finish", how: `hole all five within ${MINIGOLF_FULL_BY_S} s for all of it, falling to 0 at the buzzer` },
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
  /*
   * golfRev 2 (crazy golf) only: absent on golfRev 1's holes, so their course is exactly as it was dealt.
   */
  /** The revision whose physics roll this hole (2), absent on golfRev 1. */
  rev?: number;
  /** Walls across the fairway with one opening: castle gates (an archway) and the windmill's house (its doorway). */
  gates?: MgGate[];
  /** Windmills: four sails turning on a hub in a house's doorway (the angle from the sim tick). */
  windmills?: MgWindmill[];
  /** Tunnels: a ball rolling over an entrance comes out of its exit, heading the exit's way. */
  tunnels?: MgTunnel[];
  /** Sand traps (strong friction). */
  sands?: MgCircle[];
  /** Humped hills: a dome pushing a rolling ball away from its top. */
  hills?: MgHill[];
  /** Banked curved walls (arcs of short segments). */
  curves?: MgCurve[];
}

/** A wall from a to b (units) with one opening of half-width `half` centred at c; its two pieces are in `segs`. */
export interface MgGate {
  kind: "castle" | "mill";
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  half: number;
  /** True when the wall runs across the hole (along x). */
  across: boolean;
  segs: Seg[];
}

/** A windmill's hub (units), its turn (angle units a tick, ± by the mirror), the angle at tick 0 and its wall's line. */
export interface MgWindmill {
  x: number;
  y: number;
  spin: number;
  phase: number;
  /** The sails' turn in 4096ths of a radian a tick (the surface speed for the bounce), signed as `spin`. */
  w4096: number;
  across: boolean;
}

/** A tunnel: entrance centre, exit centre (units) and the exit's heading (NORM_ONE). */
export interface MgTunnel {
  x: number;
  y: number;
  ox: number;
  oy: number;
  dx: number;
  dy: number;
}

/** A hill: centre and radius (units); `k` is its push at the rim (units a tick², falling to 0 at the top). */
export interface MgHill {
  x: number;
  y: number;
  r: number;
  k: number;
}

/** A banked curved wall: centre and radius (units), angles (ANG units) and its segments. */
export interface MgCurve {
  x: number;
  y: number;
  r: number;
  a0: number;
  a1: number;
  segs: Seg[];
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
  /** Fixed timber walls inside the outline (never nudged): ends (px) and a spare field (0). */
  walls: [number, number, number, number, number][];
  /** Diagonal timber banks (nudged by the seed): ends (px) and a spare field (0). */
  logs: [number, number, number, number, number][];
  rocks: [number, number, number][];
  planters: [number, number, number][];
  ponds: [number, number, number][];
  /** Slopes: box and direction (dx, dy in −1…1, downhill), strength 1–3. */
  slopes: [number, number, number, number, number, number, number][];
  /** Obstacle nudge range (px). */
  jig: number;
}

/**
 * The five holes, each bigger and longer than the last (px, hole space; 30 Oct 2026, the longer course): a long lane
 * up a ramp through a boulder field, a long dogleg round a pond, a three-leg S-bend, two routes round an island pond
 * (a ramp one way, boulders the other) and a three-leg switchback finale. `walls` are fixed timber walls inside the
 * outline (never nudged); `logs` are the diagonal banks the seed nudges.
 */
const TEMPLATES: readonly Template[] = [
  {
    shape: "straight",
    w: 300,
    h: 520,
    poly: [0, 40, 40, 0, 260, 0, 300, 40, 300, 480, 260, 520, 40, 520, 0, 480],
    tee: [150, 482],
    cup: [150, 52],
    cupJig: 24,
    walls: [],
    logs: [[18, 200, 78, 150, 0], [282, 260, 222, 210, 0]],
    rocks: [[110, 340, 17], [200, 305, 16], [150, 395, 13]],
    planters: [[112, 92, 14], [188, 92, 14]],
    ponds: [],
    slopes: [[14, 150, 286, 245, 0, 1, 2], [14, 14, 286, 125, 1, 0, 1]],
    jig: 8,
  },
  {
    shape: "dogleg",
    w: 340,
    h: 580,
    poly: [0, 40, 40, 0, 300, 0, 340, 40, 340, 170, 300, 205, 150, 205, 150, 580, 0, 580],
    tee: [75, 545],
    cup: [292, 70],
    cupJig: 14,
    walls: [],
    logs: [[6, 90, 66, 16, 0]],
    rocks: [[60, 330, 15], [105, 420, 13]],
    planters: [[248, 48, 13], [262, 132, 12]],
    ponds: [[190, 140, 24]],
    slopes: [[8, 360, 142, 470, 0, 1, 2], [160, 10, 330, 195, 0, 1, 1]],
    jig: 6,
  },
  {
    shape: "sbend",
    w: 370,
    h: 620,
    poly: [0, 230, 220, 230, 220, 30, 250, 0, 340, 0, 370, 30, 370, 390, 150, 390, 150, 620, 0, 620],
    tee: [75, 585],
    cup: [300, 52],
    cupJig: 12,
    walls: [],
    logs: [[8, 300, 58, 240, 0], [362, 330, 318, 382, 0]],
    rocks: [[105, 480, 14], [290, 210, 14], [180, 320, 12]],
    planters: [[256, 74, 12], [346, 96, 12]],
    ponds: [[288, 330, 18]],
    slopes: [[226, 120, 364, 262, 0, 1, 2], [8, 400, 142, 560, 1, 0, 1]],
    jig: 5,
  },
  {
    shape: "split",
    w: 390,
    h: 660,
    poly: [0, 60, 60, 0, 330, 0, 390, 60, 390, 600, 330, 660, 60, 660, 0, 600],
    tee: [195, 625],
    cup: [195, 64],
    cupJig: 16,
    walls: [[195, 180, 195, 268, 0], [195, 432, 195, 540, 0]],
    logs: [[16, 560, 62, 610, 0], [374, 150, 330, 104, 0]],
    rocks: [[300, 310, 15], [282, 420, 14], [338, 365, 12]],
    planters: [[150, 104, 14], [240, 104, 14]],
    ponds: [[195, 350, 70]],
    slopes: [[14, 250, 120, 450, 0, 1, 2], [30, 14, 360, 150, -1, 0, 1]],
    jig: 5,
  },
  {
    shape: "grand",
    w: 390,
    h: 690,
    poly: [0, 40, 40, 0, 350, 0, 390, 40, 390, 650, 350, 690, 40, 690, 0, 650],
    tee: [55, 648],
    cup: [330, 100],
    cupJig: 8,
    walls: [[0, 460, 245, 460, 0], [150, 230, 390, 230, 0]],
    logs: [[310, 262, 365, 305, 0], [20, 420, 66, 376, 0]],
    rocks: [[180, 600, 14], [235, 545, 12], [120, 300, 12]],
    planters: [[288, 64, 13], [356, 150, 13], [232, 120, 11]],
    ponds: [[215, 350, 30], [80, 120, 22]],
    slopes: [[6, 240, 146, 452, 0, 1, 2], [10, 470, 384, 684, 0, 1, 1], [156, 8, 384, 222, 0, -1, 1]],
    jig: 4,
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
    const walls: Seg[] = t.walls.map(([ax, ay, bx, by]) => {
      const a = P(ax, ay);
      const b = P(bx, by);
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y, r: fp(5) };
    });
    const banks: Seg[] = t.logs.map(([ax, ay, bx, by]) => {
      const dx = jig();
      const dy = jig();
      const a = P(ax + dx, ay + dy);
      const b = P(bx + dx, by + dy);
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y, r: fp(5) };
    });
    const logs = [...walls, ...banks];
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

/* ========================= golfRev 2: crazy golf ========================= */

/** Gate and windmill-house walls: half thickness (px). */
export const MG_GATE_R = 6;
/** Banked curved walls: half thickness (px) and pieces per arc. */
export const MG_CURVE_R = 4;
const CURVE_PIECES = 8;
/**
 * The windmill (a classic mill: its sails turn upright, in the plane of the house's wall, over the doorway): the
 * doorway's half-width (its centre to the wall's end, px). The hub stands MG_MILL_H above the doorway; a sail reaches
 * down to the ball only while it points within MG_MILL_PHI of straight down, and there its foot (MG_SAIL_W wide, a
 * capsule MG_SAIL_R thick across the wall's line) sweeps along the doorway at H·tan(angle) from its centre. The art
 * draws the sails as a cross MG_MILL_H beyond the wall (its lower sail crossing the line exactly at the foot) and
 * MG_SAIL_LEN long; MG_HUB_R is the drawn hub.
 */
export const MG_MILL_HALF = 42;
export const MG_MILL_H = 28;
export const MG_SAIL_W = 16;
export const MG_SAIL_LEN = 38;
export const MG_SAIL_R = 3;
export const MG_HUB_R = 6;
/** 39° in angle units (39 × 65536 ÷ 360). */
export const MG_MILL_PHI = 7099;
/** Four sails, a quarter turn every 64 ticks (angle units a tick): the doorway repeats every MG_MILL_PERIOD ticks. */
export const MG_MILL_SPIN = 256;
export const MG_MILL_SAILS = 4;
export const MG_MILL_PERIOD = ANG_FULL / MG_MILL_SAILS / MG_MILL_SPIN;
/** MG_MILL_SPIN in 4096ths of a radian a tick (256 × 2π ÷ 65536 × 4096 = 100.5). */
const MILL_W4096 = 101;
export const MG_E_SAIL = 150;
/** A ball whose centre comes within this of a tunnel's entrance drops in (px). */
export const MG_TUNNEL_R = 9;
/** A tunnel's exit keeps 7/8 of the speed, at least this (units a tick). */
export const MG_TUNNEL_MIN_V = fp(1.5);
/** Sand: drag in 4096ths a tick and a constant slowing (units a tick). */
export const MG_SAND_DRAG = 520;
export const MG_SAND_DECEL = 24;
/** A ball that stops in the doorway's line (where a sail's foot sweeps) is set down this far from it, on its side (px). */
export const MG_APRON = MG_SAIL_R + MG_BALL_R + 3;

interface TemplateV2 {
  shape: MgHole["shape"];
  w: number;
  h: number;
  poly: number[];
  tee: [number, number];
  cup: [number, number];
  cupJig: number;
  jig: number;
  /** Fixed timber walls (px). */
  walls: [number, number, number, number][];
  /** Diagonal timber banks (nudged). */
  logs: [number, number, number, number][];
  rocks: [number, number, number][];
  planters: [number, number, number][];
  ponds: [number, number, number][];
  /** Ramps: box, downhill direction, strength 1–3 (as golfRev 1). */
  slopes: [number, number, number, number, number, number, number][];
  /** Castle gates and windmill houses: kind, wall ends (px), the opening's centre along the wall and its half-width. */
  gates: ["castle" | "mill", number, number, number, number, number, number][];
  /** Tunnels: entrance (px), exit (px) and the exit's heading in degrees (0 = right, 90 = down). */
  tunnels: [number, number, number, number, number][];
  /** Sand traps (nudged): centre and radius (px). */
  sands: [number, number, number][];
  /** Hills (nudged): centre, radius (px) and the push at the rim (units a tick²). */
  hills: [number, number, number, number][];
  /** Banked curves: centre, radius (px), from and to (degrees, 0 = right, 90 = down). */
  curves: [number, number, number, number, number][];
}

/**
 * golfRev 2's five holes (px, hole space; 31 Oct 2026, crazy golf): the same five kinds and sizes as golfRev 1, each
 * with its classic obstacles, more on the later holes. A windmill on the first; a banked curve and a bunker round the
 * dogleg; a tunnel and a hill on the S-bend; two tunnels to different exits, a castle gate and a bunker on the split;
 * and a windmill, a castle gate, a hill, a bunker and a banked curve on the switchback finale. Ramps span their lane.
 */
const TEMPLATES_V2: readonly TemplateV2[] = [
  {
    shape: "straight",
    w: 300,
    h: 520,
    poly: [0, 40, 40, 0, 260, 0, 300, 40, 300, 480, 260, 520, 40, 520, 0, 480],
    tee: [150, 482],
    cup: [150, 56],
    cupJig: 24,
    jig: 8,
    walls: [],
    logs: [],
    rocks: [[92, 168, 13]],
    planters: [[112, 96, 14], [188, 96, 14]],
    ponds: [],
    slopes: [[0, 300, 300, 400, 0, 1, 2]],
    gates: [["mill", 0, 250, 300, 250, 150, MG_MILL_HALF]],
    tunnels: [],
    sands: [],
    hills: [],
    curves: [],
  },
  {
    shape: "dogleg",
    w: 340,
    h: 580,
    poly: [0, 0, 300, 0, 340, 40, 340, 170, 300, 205, 150, 205, 150, 580, 0, 580],
    tee: [75, 545],
    cup: [292, 72],
    cupJig: 14,
    jig: 6,
    walls: [],
    logs: [],
    rocks: [[62, 300, 14]],
    planters: [[248, 48, 13], [262, 136, 12]],
    ponds: [[190, 140, 24]],
    slopes: [[0, 360, 150, 470, 0, 1, 2]],
    gates: [],
    tunnels: [],
    sands: [[176, 30, 26]],
    hills: [],
    curves: [[80, 80, 80, 180, 270]],
  },
  {
    shape: "sbend",
    w: 370,
    h: 620,
    poly: [0, 230, 220, 230, 220, 30, 250, 0, 340, 0, 370, 30, 370, 390, 150, 390, 150, 620, 0, 620],
    tee: [75, 585],
    cup: [300, 52],
    cupJig: 12,
    jig: 5,
    walls: [[0, 304, 74, 304]],
    logs: [[362, 330, 318, 382]],
    rocks: [[105, 470, 14], [312, 290, 12]],
    planters: [[256, 74, 12], [346, 96, 12]],
    ponds: [],
    slopes: [[220, 110, 370, 230, 0, 1, 2]],
    gates: [],
    tunnels: [[32, 262, 296, 214, -112]],
    sands: [],
    hills: [[180, 312, 42, 10]],
    curves: [],
  },
  {
    shape: "split",
    w: 390,
    h: 660,
    poly: [0, 60, 60, 0, 330, 0, 390, 60, 390, 600, 330, 660, 60, 660, 0, 600],
    tee: [195, 625],
    cup: [195, 64],
    cupJig: 16,
    jig: 5,
    walls: [[195, 180, 195, 268], [195, 432, 195, 540]],
    logs: [[374, 150, 330, 104]],
    rocks: [[300, 330, 14], [282, 440, 13]],
    planters: [[150, 104, 14], [240, 104, 14]],
    ponds: [[195, 350, 70]],
    slopes: [[0, 250, 125, 450, 0, 1, 2]],
    gates: [["castle", 201, 250, 390, 250, 322, 20]],
    tunnels: [
      [62, 566, 64, 150, 180],
      [328, 566, 345, 400, -100],
    ],
    sands: [[96, 92, 20]],
    hills: [],
    curves: [],
  },
  {
    shape: "grand",
    w: 390,
    h: 690,
    poly: [0, 0, 350, 0, 390, 40, 390, 650, 350, 690, 40, 690, 0, 650],
    tee: [55, 648],
    cup: [330, 100],
    cupJig: 8,
    jig: 4,
    walls: [],
    logs: [[20, 420, 66, 376]],
    rocks: [],
    planters: [[288, 64, 13], [356, 150, 13], [232, 120, 11]],
    ponds: [[318, 336, 20]],
    slopes: [[0, 240, 150, 450, 0, 1, 2]],
    gates: [
      ["mill", 0, 460, 390, 460, 318, MG_MILL_HALF],
      ["castle", 0, 230, 390, 230, 75, 20],
    ],
    tunnels: [],
    sands: [[178, 598, 22]],
    hills: [[210, 345, 40, 10]],
    curves: [[80, 80, 80, 180, 270]],
  },
];

/** Integer cos/sin of whole degrees (TRIG_ONE scale). */
const degAng = (deg: number) => idiv(deg * ANG_FULL, 360);

/** The five crazy-golf holes for a seed (golfRev 2): each template mirrored (or not) and nudged by the seed. */
export function minigolfCourseV2(seed: number): MgHole[] {
  const rnd = dealRng(seed ^ 0x6b1f2e);
  return TEMPLATES_V2.map((t, index) => {
    const mirror = rnd(2) === 1;
    const ox = Math.floor((MINIGOLF_W - t.w) / 2);
    const oy = Math.floor((MINIGOLF_H - t.h) / 2);
    const mx = (x: number) => (mirror ? t.w - x : x);
    const jig = () => rnd(t.jig * 2 + 1) - t.jig;
    const P = (x: number, y: number) => ({ x: fp(ox + mx(x)), y: fp(oy + y) });
    /** A point in hole px plus an offset in units (the curves' and tunnels' integer trig), placed in the world. */
    const PU = (x: number, y: number, ux: number, uy: number) => ({ x: fp(ox) + (mirror ? fp(t.w - x) - ux : fp(x) + ux), y: fp(oy + y) + uy });
    const poly: number[] = [];
    for (let i = 0; i < t.poly.length; i += 2) {
      const p = P(t.poly[i]!, t.poly[i + 1]!);
      poly.push(p.x, p.y);
    }
    const tee = P(t.tee[0], t.tee[1]);
    const cup = P(t.cup[0] + idiv(jig() * t.cupJig, Math.max(1, t.jig)), t.cup[1] + idiv(jig() * t.cupJig, Math.max(1, t.jig * 3)));
    const walls: Seg[] = t.walls.map(([ax, ay, bx, by]) => {
      const a = P(ax, ay);
      const b = P(bx, by);
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y, r: fp(5) };
    });
    const banks: Seg[] = t.logs.map(([ax, ay, bx, by]) => {
      const dx = jig();
      const dy = jig();
      const a = P(ax + dx, ay + dy);
      const b = P(bx + dx, by + dy);
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y, r: fp(5) };
    });
    const logs = [...walls, ...banks];
    const circ = ([x, y, r]: [number, number, number]): MgCircle => {
      const p = P(x + jig(), y + jig());
      return { x: p.x, y: p.y, r: fp(r) };
    };
    const rocks = t.rocks.map(circ);
    const planters = t.planters.map(([x, y, r]) => {
      const p = P(x, y);
      return { x: p.x, y: p.y, r: fp(r) };
    });
    const ponds = t.ponds.map(circ);
    const sands = t.sands.map(circ);
    const hills: MgHill[] = t.hills.map(([x, y, r, k]) => {
      const p = P(x + jig(), y + jig());
      return { x: p.x, y: p.y, r: fp(r), k };
    });
    const slopes = t.slopes.map(([x0, y0, x1, y1, dx, dy, k]) => {
      const a = P(x0, y0);
      const b = P(x1, y1);
      const strength = 3 + k * 2;
      return { x0: Math.min(a.x, b.x), y0: a.y, x1: Math.max(a.x, b.x), y1: b.y, ax: (mirror ? -dx : dx) * strength, ay: dy * strength };
    });
    const gates: MgGate[] = t.gates.map(([kind, ax, ay, bx, by, along, half]) => {
      const across = ay === by;
      const a = P(ax, ay);
      const b = P(bx, by);
      const c = across ? P(along, ay) : P(ax, along);
      const h2 = fp(half);
      // The two pieces, each from its outer end to the opening's edge (a mirror swaps which end is which).
      const lo = across ? { x: Math.min(a.x, b.x), y: a.y } : { x: a.x, y: Math.min(a.y, b.y) };
      const hi = across ? { x: Math.max(a.x, b.x), y: a.y } : { x: a.x, y: Math.max(a.y, b.y) };
      const r = fp(MG_GATE_R);
      const segs: Seg[] = across
        ? [
            { ax: lo.x, ay: lo.y, bx: c.x - h2, by: c.y, r },
            { ax: c.x + h2, ay: c.y, bx: hi.x, by: hi.y, r },
          ]
        : [
            { ax: lo.x, ay: lo.y, bx: c.x, by: c.y - h2, r },
            { ax: c.x, ay: c.y + h2, bx: hi.x, by: hi.y, r },
          ];
      return { kind, ax: lo.x, ay: lo.y, bx: hi.x, by: hi.y, cx: c.x, cy: c.y, half: h2, across, segs };
    });
    const windmills: MgWindmill[] = gates
      .filter((g) => g.kind === "mill")
      .map((g) => {
        const spin = mirror ? -MG_MILL_SPIN : MG_MILL_SPIN;
        return { x: g.cx, y: g.cy, spin, phase: rnd(ANG_FULL), w4096: mirror ? -MILL_W4096 : MILL_W4096, across: g.across };
      });
    const tunnels: MgTunnel[] = t.tunnels.map(([ix, iy, ex, ey, deg]) => {
      const a = degAng(deg);
      const dx = idiv(icos(a) * NORM_ONE, TRIG_ONE);
      const dy = idiv(isin(a) * NORM_ONE, TRIG_ONE);
      const i = P(ix, iy);
      const o = P(ex, ey);
      return { x: i.x, y: i.y, ox: o.x, oy: o.y, dx: mirror ? -dx : dx, dy };
    });
    const curves: MgCurve[] = t.curves.map(([cx, cy, r, d0, d1]) => {
      const a0 = degAng(d0);
      const a1 = degAng(d1);
      const pts: { x: number; y: number }[] = [];
      for (let k = 0; k <= CURVE_PIECES; k++) {
        const a = a0 + idiv((a1 - a0) * k, CURVE_PIECES);
        pts.push(PU(cx, cy, idiv(icos(a) * fp(r), TRIG_ONE), idiv(isin(a) * fp(r), TRIG_ONE)));
      }
      const segs: Seg[] = [];
      for (let k = 0; k < CURVE_PIECES; k++) segs.push({ ax: pts[k]!.x, ay: pts[k]!.y, bx: pts[k + 1]!.x, by: pts[k + 1]!.y, r: fp(MG_CURVE_R) });
      const c = P(cx, cy);
      // Mirrored, the arc runs the other way round: its angles are reflected (π − a).
      return { x: c.x, y: c.y, r: fp(r), a0: mirror ? (ANG_FULL / 2 - a1) & (ANG_FULL - 1) : a0, a1: mirror ? (ANG_FULL / 2 - a0) & (ANG_FULL - 1) : a1, segs };
    });
    const segs: Seg[] = [];
    for (let i = 0; i < poly.length; i += 2) {
      const j = (i + 2) % poly.length;
      if (poly[i] === poly[j] && poly[i + 1] === poly[j + 1]) continue;
      segs.push({ ax: poly[i]!, ay: poly[i + 1]!, bx: poly[j]!, by: poly[j + 1]!, r: 0 });
    }
    segs.push(...logs);
    for (const g of gates) segs.push(...g.segs);
    for (const c of curves) segs.push(...c.segs);
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
      rev: 2,
      gates,
      windmills,
      tunnels,
      sands,
      hills,
      curves,
    };
  });
}

/** A windmill's first sail's angle at a sim tick (angle units; 0 is straight down). */
export function mgMillAngle(m: MgWindmill, tick: number): number {
  return (m.phase + m.spin * tick) & (ANG_FULL - 1);
}

/** A sail's foot in the doorway: a capsule along the wall's line (units) and its speed along the line (units a tick). */
export interface MgSailFoot {
  seg: Seg;
  vx: number;
  vy: number;
  /** The sail's angle from straight down (signed angle units). */
  phi: number;
}

/**
 * The sails reaching the ground at a sim tick: each sail pointing within MG_MILL_PHI of straight down puts its foot in
 * the doorway at H·tan(φ) along the line from the doorway's centre, MG_SAIL_W ÷ cos(φ) long (integer trig).
 */
export function mgSails(m: MgWindmill, tick: number): MgSailFoot[] {
  const base = mgMillAngle(m, tick);
  const out: MgSailFoot[] = [];
  for (let k = 0; k < MG_MILL_SAILS; k++) {
    const phi = (((base + k * (ANG_FULL / MG_MILL_SAILS) + ANG_FULL / 2) & (ANG_FULL - 1)) - ANG_FULL / 2);
    if (phi <= -MG_MILL_PHI || phi >= MG_MILL_PHI) continue;
    const c = icos(phi);
    const s = isin(phi);
    const at = idiv(fp(MG_MILL_H) * s, c);
    const half = idiv(fp(MG_SAIL_W / 2) * TRIG_ONE, c);
    // The foot's speed along the line: H·ω ÷ cos²(φ).
    const v = idiv(idiv(fp(MG_MILL_H) * m.w4096, 4096) * TRIG_ONE * TRIG_ONE, c * c);
    const seg: Seg = m.across
      ? { ax: m.x + at - half, ay: m.y, bx: m.x + at + half, by: m.y, r: fp(MG_SAIL_R) }
      : { ax: m.x, ay: m.y + at - half, bx: m.x, by: m.y + at + half, r: fp(MG_SAIL_R) };
    out.push({ seg, vx: m.across ? v : 0, vy: m.across ? 0 : v, phi });
  }
  return out;
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
  /** golfRev 2: tunnels ridden (a count) and the last one's tick (display only reads these). */
  tunnels: number;
  tunnelTick: number;
  over: number;
}

function initState(seed: number, pars: readonly number[], rev: number): MinigolfState {
  const course = rev >= 2 ? minigolfCourseV2(seed) : minigolfCourse(seed);
  const first = course[0]!;
  return {
    tick: 0,
    rev,
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
    tunnels: 0,
    tunnelTick: 0,
    over: 0,
  };
}

/** A putt's velocity for an aim direction and a power (units a tick). */
export function mgPuttVelocity(dx: number, dy: number, power: number, rev = 1): { vx: number; vy: number } {
  const p = clampInt(Math.trunc(power), 1, MG_POWER_MAX);
  const max = rev >= 2 ? MG_MAX_V_V2 : MG_MAX_V;
  const speed = MG_MIN_V + idiv((max - MG_MIN_V) * p, MG_POWER_MAX);
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

/** golfRev 2's roll tick result: the ends as mgRollTick, plus whether a sail was touched and a tunnel ridden. */
export interface MgRollV2 {
  hits: number;
  end: number;
  sail: boolean;
  tunnel: boolean;
}

/**
 * A ball against a sail's foot: the bounce off its closest point, measured against the foot's own speed along the
 * doorway, so a sail sweeping into the ball pushes it on. Mutates b; -1 when they do not touch.
 */
function bounceSail(b: { x: number; y: number; vx: number; vy: number }, f: MgSailFoot, br: number): number {
  const s = f.seg;
  const c = closestOnSeg(s, b.x, b.y);
  const reach = br + s.r;
  const dx = b.x - c.x;
  const dy = b.y - c.y;
  if (dx * dx + dy * dy >= reach * reach) return -1;
  const sx = f.vx;
  const sy = f.vy;
  const out = bounceOff({ x: b.x, y: b.y, vx: b.vx - sx, vy: b.vy - sy }, c.x, c.y, reach, MG_E_SAIL);
  if (!out) return -1;
  b.x = out.x;
  b.y = out.y;
  b.vx = out.vx + sx;
  b.vy = out.vy + sy;
  return out.impact;
}

/**
 * One tick of a rolling ball on a golfRev 2 hole (mutates b), `tick` the sim tick it rolls on (the sails' angle):
 * four substeps against the rails, logs, gates, curves, boulders, planters and the windmills' sails' feet, then the
 * tunnels, the cup and the ponds; then the ramps' and hills' pull and the friction (sand's where the ball is in a
 * bunker). A ball that stops in a windmill's doorway is set down clear of it on its side of the wall. The sim and
 * every script that searches putts roll through this one function.
 */
export function mgRollTickV2(h: MgHole, b: { x: number; y: number; vx: number; vy: number }, rollTicks: number, tick: number): MgRollV2 {
  let hits = 0;
  let sail = false;
  let tunnel = false;
  const cupR = fp(MG_CUP_R - 2);
  const br = fp(MG_BALL_R);
  const mills = h.windmills ?? [];
  const feet = mills.map((m) => mgSails(m, tick));
  const tunR = fp(MG_TUNNEL_R);
  for (let i = 0; i < SUB; i++) {
    hits += substep(h, b);
    for (let k = 0; k < mills.length; k++) {
      for (const f of feet[k]!) {
        const impact = bounceSail(b, f, br);
        if (impact >= 0) {
          sail = true;
          if (impact > 40) hits++;
        }
      }
    }
    for (const t of h.tunnels ?? []) {
      const dx = b.x - t.x;
      const dy = b.y - t.y;
      if (dx * dx + dy * dy > tunR * tunR) continue;
      const speed = Math.max(idiv(ilen(b.vx, b.vy) * 7, 8), MG_TUNNEL_MIN_V);
      b.x = t.ox;
      b.y = t.oy;
      b.vx = idiv(t.dx * speed, NORM_ONE);
      b.vy = idiv(t.dy * speed, NORM_ONE);
      tunnel = true;
      break;
    }
    const dx = b.x - h.cup.x;
    const dy = b.y - h.cup.y;
    if (dx * dx + dy * dy <= cupR * cupR && ilen(b.vx, b.vy) <= MG_CAPTURE_V) return { hits, end: MG_END_HOLED, sail, tunnel };
    for (const p of h.ponds) if (inCircle(p, b.x, b.y, fp(2))) return { hits, end: MG_END_WATER, sail, tunnel };
  }
  const slope = slopeAt(h, b.x, b.y);
  if (slope) {
    b.vx += slope.ax;
    b.vy += slope.ay;
  }
  for (const hl of h.hills ?? []) {
    const dx = b.x - hl.x;
    const dy = b.y - hl.y;
    if (dx * dx + dy * dy >= hl.r * hl.r) continue;
    // A dome: the push grows from nothing at the top to k at the rim, always away from the top.
    b.vx += idiv(dx * hl.k, hl.r);
    b.vy += idiv(dy * hl.k, hl.r);
  }
  const sandy = (h.sands ?? []).some((c) => inCircle(c, b.x, b.y));
  const f = sandy ? rollFriction(b.vx, b.vy, MG_SAND_DRAG, MG_SAND_DECEL) : rollFriction(b.vx, b.vy, MG_DRAG, MG_DECEL);
  b.vx = f.vx;
  b.vy = f.vy;
  if (ilen(b.vx, b.vy) <= MG_STOP_V || rollTicks >= MG_ROLL_CAP) {
    b.vx = 0;
    b.vy = 0;
    mgApron(h, b);
    return { hits, end: MG_END_REST, sail, tunnel };
  }
  return { hits, end: MG_END_NONE, sail, tunnel };
}

/**
 * A ball resting in a windmill's doorway, where a sail's foot will sweep, is set down MG_APRON from the wall's line on
 * its own side (mutates b).
 */
export function mgApron(h: MgHole, b: { x: number; y: number }): void {
  const near = fp(MG_SAIL_R + MG_BALL_R + 1);
  const half = fp(MG_MILL_HALF);
  for (const m of h.windmills ?? []) {
    const across = m.across ? b.y - m.y : b.x - m.x;
    const along = m.across ? b.x - m.x : b.y - m.y;
    if (across >= near || across <= -near || along >= half || along <= -half) continue;
    if (m.across) b.y = m.y + (across < 0 ? -1 : 1) * fp(MG_APRON);
    else b.x = m.x + (across < 0 ? -1 : 1) * fp(MG_APRON);
  }
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
      const v = mgPuttVelocity(input.a, input.b, input.c, s.rev);
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
    let r: { hits: number; end: number };
    if (s.rev >= 2) {
      const r2 = mgRollTickV2(h, b, s.rollTicks, s.tick);
      if (r2.tunnel) {
        s.tunnels += 1;
        s.tunnelTick = s.tick;
      }
      r = r2;
    } else r = mgRollTick(h, b, s.rollTicks);
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
      if (s.strokes >= mgStrokeLimit(s.rev, s.pars[s.hole]!)) endHole(s, false);
      else s.phase = MG_AIM;
    } else if (r.end === MG_END_REST) {
      if (s.strokes >= mgStrokeLimit(s.rev, s.pars[s.hole]!)) endHole(s, false);
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
  if (s.rev !== MINIGOLF_REV_CLASSIC && s.rev !== MINIGOLF_REV) return null;
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
      const limit = mgStrokeLimit(s.rev, p);
      const pp = strokes <= p ? MG_PAR_PTS : stdLine(MG_PAR_PTS, limit - strokes, limit - p);
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
  const speed = done ? stdSpeed(MG_SPEED_PTS, s.finishTick, minigolfFullByS(s.rev) * 60, MINIGOLF_RUN_TICKS) : 0;
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

/** The game for a puzzle's pars and stamp (golfRev 1 when unstamped; rooms deal golfRev 2). */
export function minigolfGameFor(pars: readonly number[] = [3, 3, 3, 3, 3], rev: number = MINIGOLF_REV_CLASSIC): ArcadeGame<MinigolfState, ArcadeInputEvent | null> {
  return {
    key: "minigolf",
    runTicks: MINIGOLF_RUN_TICKS,
    init: (seed) => initState(seed, pars, rev >= MINIGOLF_REV ? MINIGOLF_REV : MINIGOLF_REV_CLASSIC),
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
