/**
 * Bastion, bastionRev 2 (1 Nov 2026; docs/arcade-standard/bastion.md): a first-person tank-defence shooter on the
 * arcade scoring standard. The original Bastion (no stamp: a turret shooting shapes, src/lib/arcade/bastion.ts) keeps
 * replaying and scoring exactly as before; a puzzle stamped `bastionRev: 2` plays this sim.
 *
 * The view is from a gun turret behind a wall at dusk, looking down three lanes that meet on the horizon. Tanks only
 * (Scout 1 hit, Medium 2, Heavy 4) roll down their lanes in five waves on a fixed seeded schedule, the same for every
 * player: every run deals the same 30 tanks (63 hit points) in the same wave shapes, the last two bigger and faster; the
 * seed picks only each tank's lane, spawn moment, order, where it speeds up or slows down (every tank does once) and
 * its weak spot's phase (exposed 60 of every 90 ticks; a shell on it while closed is a hull hit). A tank that reaches the wall hits the
 * base; three hits end the run early (the score is kept).
 *
 * Aim is a point on the screen (the phone floats the crosshair 120 px above the finger); lifting fires a shell at that
 * point, which lands FLIGHT_MIN…FLIGHT_MAX ticks later (0.3–0.5 s, longer the further up the screen), so a moving tank
 * must be led. The shell hits the front-most tank whose drawn hull or turret covers the point at landing; a hit on the
 * tank's glowing weak spot does double damage. Five shells; empty reloads by itself in 2 s, a swipe down reloads early;
 * during a reload a needle sweeps a bar: a tap with the needle in the green zone finishes the reload in half the time,
 * a tap outside jams it for 0.5 s more.
 *
 * Everything is integer maths on the 60-tick clock: depth z in 1/256 units, the perspective scale from one integer
 * division (bastionScale256), and every collision rectangle (bastionTankRects) is what the renderer draws.
 *
 * Score (the arcade standard, exactly 200): Armour 140 on a straight line (hit points destroyed of 63), Weak spots 30
 * (1 each, up to 30), Fast reloads 20 (2 each, up to 10), Base intact 10 (10 with 3 of 3 left at the end, 5 with 2).
 */
import { bandCurve, type BandParts } from "./scoreBands";
import { clampInt, inputRange, rngBelow, ARCADE_INPUT_DRAG, TICKS_PER_SECOND, type ArcadeGame, type ArcadeInputEvent, type CanvasSize, type InputRange } from "./engine";
import { stdBandParts, stdEach, stdLine, stdPart, stdScore, type StdPart, type StdSpec } from "./arcadeStandard";

/* ------------------------------------------------------------------ world */

export const BASTION_REV_TANK = 2;
/**
 * bastionRev 3 (3 Nov 2026, shown as Iron Wall; docs/arcade-standard/bastion.md "bastionRev 3"): rev 2's plan, tanks and
 * rules with waves 4 and 5 eased (BT3_WAVE_PACE), a 90 ms green zone (BT3_ZONE_W), three seeded drones crossing the sky
 * (bastionDrones: shooting one down pays a fixed bonus; they never touch the base) and the parts re-cut for them.
 */
export const BASTION_REV_IRON = 3;
export const BASTION_REV_DEALT = BASTION_REV_IRON;

export const BT2_WORLD_W = 390;
export const BT2_WORLD_H = 720;
export const BT2_BG = "#0B0A14";
export const BT2_RUN_SECONDS = 60;
export const BT2_RUN_TICKS = BT2_RUN_SECONDS * TICKS_PER_SECOND;

/** The horizon (where the lanes meet), the wall's top edge (depth 0) and the vanishing point's x. */
export const BT2_HORIZON_Y = 250;
export const BT2_WALL_Y = 600;
export const BT2_VP_X = 195;
/** Perspective: scale = K / (K + z); tanks roll on from depth BT2_FAR (a fifth of full size). */
export const BT2_K = 320;
export const BT2_FAR = 1280;
const FP = 256;
/** Each lane's x at the wall, from the centre. */
export const BT2_LANE_X = [-128, 0, 128] as const;

export const BT2_SCOUT = 0;
export const BT2_MEDIUM = 1;
export const BT2_HEAVY = 2;
export const BT2_KIND_NAMES = ["Scout", "Medium", "Heavy"] as const;
export const BT2_HP = [1, 2, 4] as const;
/** Hull and turret sizes at the wall (scale 1), px. */
export const BT2_HULL_W = [64, 78, 94] as const;
export const BT2_HULL_H = [30, 36, 42] as const;
export const BT2_TUR_W = [30, 38, 46] as const;
export const BT2_TUR_H = [15, 18, 22] as const;
/** The weak spot by type: its centre's x from the tank's centre, its bottom above the ground, at scale 1. */
export const BT2_WEAK_X = [0, -24, 14] as const;
export const BT2_WEAK_UP = [6, 13, 36] as const;
export const BT2_WEAK_W = 14;
export const BT2_WEAK_H = 14;
/** Speeds, depth units ×256 a tick: a scout crosses the whole field in 7.8 s, a medium in 10, a heavy in 12.3. */
export const BT2_SPEED = [700, 545, 445] as const;
/** Each wave's speed, per cent of the type's: the first three roll on gently, the last two press hard. */
export const BT2_WAVE_PACE = [44, 50, 56, 100, 134] as const;
/** bastionRev 3: waves 4 and 5 eased (wave 5 the most); waves 1–3 as rev 2. */
export const BT3_WAVE_PACE = [44, 50, 56, 80, 104] as const;

/** A wave's pace (per cent of each type's speed) on a revision. */
export function bastionWavePace(rev: number, wave: number): number {
  return (rev >= BASTION_REV_IRON ? BT3_WAVE_PACE : BT2_WAVE_PACE)[wave]!;
}
/** Two tanks in one lane keep at least this much depth apart (the one behind waits). */
export const BT2_GAP = 150;

/** The five waves: scouts, mediums, heavies. */
export const BT2_WAVES: readonly (readonly [number, number, number])[] = [
  [4, 1, 0],
  [3, 2, 0],
  [3, 1, 1],
  [2, 2, 3],
  [1, 3, 4],
];
export const BT2_WAVE_COUNT = BT2_WAVES.length;
/** Each wave's first tick and the window its tanks roll on in. */
export const BT2_WAVE_START = [60, 660, 1260, 1860, 2460] as const;
export const BT2_WAVE_WINDOW = 300;
export const BT2_TANKS = BT2_WAVES.reduce((a, w) => a + w[0] + w[1] + w[2], 0);
export const BT2_TOTAL_HP = BT2_WAVES.reduce((a, w) => a + w[0] * BT2_HP[0] + w[1] * BT2_HP[1] + w[2] * BT2_HP[2], 0);
/** The most weak-spot hits a run allows (one a scout or medium, two a heavy). */
export const BT2_WEAK_POSSIBLE = BT2_WAVES.reduce((a, w) => a + w[0] + w[1] + 2 * w[2], 0);

export const BT2_BASE = 3;
export const BT2_MAG = 5;
/** Ticks between shots. */
export const BT2_FIRE_COOL = 15;
/** Shell flight: 18 ticks at the wall's line, 30 at the horizon. */
export const BT2_FLIGHT_MIN = 18;
export const BT2_FLIGHT_MAX = 30;
/** Reload: 2 s; a fast reload finishes at half; a jam adds 0.5 s. */
export const BT2_RELOAD_TICKS = 120;
export const BT2_FAST_TICKS = 60;
export const BT2_JAM_TICKS = 30;
/** The green zone (per mille of the needle's sweep): starts 250…450, 30 wide (60 ms), so it always ends before half time. */
export const BT2_ZONE_W = 30;
/** bastionRev 3: the green zone 45 ‰ wide (90 ms), still ending before half time (250…450 + 45 < 500). */
export const BT3_ZONE_W = 45;

/** The green zone's width (per mille of the sweep) on a revision. */
export function bastionZoneW(rev: number): number {
  return rev >= BASTION_REV_IRON ? BT3_ZONE_W : BT2_ZONE_W;
}
/** The run ends this long after the last tank is gone (destroyed or at the wall). */
export const BT2_END_HOLD = 45;

/* ------------------------------------------------------------------ input */

/** k = 7 aim: a = x, b = y (the crosshair), c = 1 while the finger is down. */
export const BT2_INPUT_AIM = ARCADE_INPUT_DRAG;
/** k = 1 fire at (a, b); k = 2 reload early; k = 3 the fast-reload tap. */
export const BT2_INPUT_FIRE = 1;
export const BT2_INPUT_RELOAD = 2;
export const BT2_INPUT_TAP = 3;
export const BT2_INPUT_RANGES: readonly InputRange[] = [
  inputRange(BT2_INPUT_AIM, [0, BT2_WORLD_W], [0, BT2_WORLD_H], [0, 1]),
  inputRange(BT2_INPUT_FIRE, [0, BT2_WORLD_W], [0, BT2_WORLD_H]),
  inputRange(BT2_INPUT_RELOAD),
  inputRange(BT2_INPUT_TAP),
];

/* ------------------------------------------------------------------- plan */

export interface Bt2PlanTank {
  wave: number;
  kind: number;
  lane: number;
  spawn: number;
  /** Speed change: 0 none, 1 speeds up (×3/2), 2 slows (×2/3), at depth `chgZ` (units). */
  chg: number;
  chgZ: number;
  /** Where in its exposure cycle the weak spot starts (ticks; the vent is open BT2_WEAK_OPEN of every BT2_WEAK_CYCLE). */
  wphase: number;
}

/** The weak spot glows (is exposed) for BT2_WEAK_OPEN ticks of every BT2_WEAK_CYCLE; closed, a hit there is a hull hit. */
export const BT2_WEAK_CYCLE = 90;
export const BT2_WEAK_OPEN = 60;

/** Is plan tank `p`'s weak spot exposed on `tick`? */
export function bastionWeakOpen(p: Pick<Bt2PlanTank, "wphase">, tick: number): boolean {
  return (tick + p.wphase) % BT2_WEAK_CYCLE < BT2_WEAK_OPEN;
}

/** The run's tanks in spawn order, from the seed alone (cached; never mutated). */
export function bastionPlan(seed: number): readonly Bt2PlanTank[] {
  const hit = planCache.get(seed | 0);
  if (hit) return hit;
  let rng = (seed ^ 0x7a4c_b35d) | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const out: Bt2PlanTank[] = [];
  let lastLane = -1;
  BT2_WAVES.forEach((shape, wave) => {
    const kinds: number[] = [];
    shape.forEach((n, kind) => {
      for (let i = 0; i < n; i++) kinds.push(kind);
    });
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = draw(i + 1);
      [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
    }
    const step = Math.floor(BT2_WAVE_WINDOW / kinds.length);
    kinds.forEach((kind, i) => {
      // Never the lane the previous tank rolled on in.
      const lane = lastLane < 0 ? draw(3) : (lastLane + 1 + draw(2)) % 3;
      lastLane = lane;
      const spawn = BT2_WAVE_START[wave]! + i * step + draw(Math.max(1, step - 30));
      // Every tank changes speed once, up or down, at a seeded depth.
      const c = 1 + draw(2);
      out.push({ wave, kind, lane, spawn, chg: c, chgZ: 400 + draw(500), wphase: draw(BT2_WEAK_CYCLE) });
    });
  });
  if (planCache.size > 32) planCache.clear();
  planCache.set(seed | 0, out);
  return out;
}
const planCache = new Map<number, readonly Bt2PlanTank[]>();

/** The green zone's start (per mille) for reload number `n` of a run. */
export function bastionZoneStart(seed: number, n: number): number {
  let h = Math.imul((seed | 0) ^ Math.imul(n + 1, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return 250 + ((h >>> 0) % 21) * 10;
}

/* ----------------------------------------------------------------- drones */

/**
 * bastionRev 3's drones: three a run, each crossing the sky once on a fixed seeded path (the same for everyone in a
 * room): its moment inside its window, the side it enters from and its height at each end; it flies straight at
 * BT3_DRONE_SPEED px a tick. A shell landing on its rectangle (drawn exactly) downs it; it never harms the base.
 */
export const BT3_DRONES = 3;
export const BT3_DRONE_WINDOW_AT = [780, 1620, 2880] as const;
export const BT3_DRONE_WINDOW = 240;
export const BT3_DRONE_SPEED = 4;
export const BT3_DRONE_W = 24;
export const BT3_DRONE_H = 10;
export const BT3_DRONE_Y_MIN = 100;
export const BT3_DRONE_Y_MAX = 190;
/** Off-screen margin at each end of a crossing (px). */
export const BT3_DRONE_MARGIN = 24;
export const BT3_DRONE_TICKS = Math.ceil((BT2_WORLD_W + 2 * BT3_DRONE_MARGIN) / BT3_DRONE_SPEED);

export interface Bt3Drone {
  /** The tick it enters, its direction (1 left → right, -1 right → left) and its height entering and leaving. */
  at: number;
  dir: 1 | -1;
  y0: number;
  y1: number;
}

/** The run's drones, from the seed alone (its own stream, so the tank plan is rev 2's exactly). */
export function bastionDrones(seed: number): readonly Bt3Drone[] {
  const hit = droneCache.get(seed | 0);
  if (hit) return hit;
  let rng = (seed ^ 0x3d0e_51a7) | 0;
  const draw = (bound: number) => {
    const r = rngBelow(rng, bound);
    rng = r.state;
    return r.value;
  };
  const span = BT3_DRONE_Y_MAX - BT3_DRONE_Y_MIN + 1;
  const out: Bt3Drone[] = BT3_DRONE_WINDOW_AT.map((w) => ({ at: w + draw(BT3_DRONE_WINDOW), dir: draw(2) === 0 ? 1 : -1, y0: BT3_DRONE_Y_MIN + draw(span), y1: BT3_DRONE_Y_MIN + draw(span) }));
  if (droneCache.size > 32) droneCache.clear();
  droneCache.set(seed | 0, out);
  return out;
}
const droneCache = new Map<number, readonly Bt3Drone[]>();

/** Drone `d`'s centre on `tick`, or null while it is not in the sky. */
export function bastionDronePos(d: Bt3Drone, tick: number): { x: number; y: number } | null {
  const k = tick - d.at;
  if (k < 0 || k > BT3_DRONE_TICKS) return null;
  const x = d.dir > 0 ? -BT3_DRONE_MARGIN + BT3_DRONE_SPEED * k : BT2_WORLD_W + BT3_DRONE_MARGIN - BT3_DRONE_SPEED * k;
  const y = d.y0 + Math.floor(((d.y1 - d.y0) * k) / BT3_DRONE_TICKS);
  return { x, y };
}

/** A drone's drawn (and collision) rectangle round its centre. */
export function bastionDroneRect(x: number, y: number): readonly [number, number, number, number] {
  return [x - BT3_DRONE_W / 2, y - BT3_DRONE_H / 2, x + BT3_DRONE_W / 2, y + BT3_DRONE_H / 2];
}

/** The tick the last drone has left the sky. */
export function bastionDronesGone(seed: number): number {
  const ds = bastionDrones(seed);
  return ds[ds.length - 1]!.at + BT3_DRONE_TICKS + 1;
}

/* ------------------------------------------------------------- projection */

/** Perspective scale ×256 at depth `zfp` (1/256 units): 256 at the wall. */
export function bastionScale256(zfp: number): number {
  const z = Math.max(0, zfp);
  return Math.floor((65536 * BT2_K) / (BT2_K * FP + z));
}

/** The ground's screen y at depth `zfp`. */
export function bastionGroundY(zfp: number): number {
  return BT2_HORIZON_Y + Math.floor(((BT2_WALL_Y - BT2_HORIZON_Y) * bastionScale256(zfp)) / 256);
}

export type Bt2Rect = readonly [number, number, number, number];

export interface Bt2Rects {
  cx: number;
  ground: number;
  s256: number;
  hull: Bt2Rect;
  turret: Bt2Rect;
  weak: Bt2Rect;
}

const sc = (v: number, s256: number) => Math.floor((v * s256) / 256);

/** A tank's drawn (and collision) rectangles at depth `zfp`: [x0, y0, x1, y1], whole world px. */
export function bastionTankRects(kind: number, lane: number, zfp: number): Bt2Rects {
  const s = bastionScale256(zfp);
  const ground = BT2_HORIZON_Y + Math.floor(((BT2_WALL_Y - BT2_HORIZON_Y) * s) / 256);
  const cx = BT2_VP_X + sc(BT2_LANE_X[lane] ?? 0, s);
  const hw = Math.max(4, sc(BT2_HULL_W[kind]!, s));
  const hh = Math.max(2, sc(BT2_HULL_H[kind]!, s));
  const tw = Math.max(2, sc(BT2_TUR_W[kind]!, s));
  const th = Math.max(1, sc(BT2_TUR_H[kind]!, s));
  const hx0 = cx - Math.floor(hw / 2);
  const hull: Bt2Rect = [hx0, ground - hh, hx0 + hw, ground];
  const tx0 = cx - Math.floor(tw / 2);
  const turret: Bt2Rect = [tx0, ground - hh - th, tx0 + tw, ground - hh];
  const ww = Math.max(2, sc(BT2_WEAK_W, s));
  const wh = Math.max(2, sc(BT2_WEAK_H, s));
  const wx0 = cx + sc(BT2_WEAK_X[kind]!, s) - Math.floor(ww / 2);
  const wy1 = ground - sc(BT2_WEAK_UP[kind]!, s);
  const weak: Bt2Rect = [wx0, wy1 - wh, wx0 + ww, wy1];
  return { cx, ground, s256: s, hull, turret, weak };
}

const inside = (r: Bt2Rect, x: number, y: number, pad = 0) => x >= r[0] - pad && x <= r[2] + pad && y >= r[1] - pad && y <= r[3] + pad;

/** Shell flight in ticks for a shot aimed at screen y. */
export function bastionFlight(y: number): number {
  const d = clampInt(BT2_WALL_Y - y, 0, BT2_WALL_Y - BT2_HORIZON_Y);
  return BT2_FLIGHT_MIN + Math.floor(((BT2_FLIGHT_MAX - BT2_FLIGHT_MIN) * d) / (BT2_WALL_Y - BT2_HORIZON_Y));
}

/* ------------------------------------------------------------------ state */

export interface Bt2Tank {
  /** Index into the plan. */
  i: number;
  kind: number;
  lane: number;
  /** Depth ×256 (0 = the wall) and speed ×256 a tick. */
  z: number;
  v: number;
  hp: number;
  /** 1 once its speed change has happened. */
  changed: number;
  /** Ticks of hit flash left (display). */
  flash: number;
}

export interface Bt2Shell {
  x: number;
  y: number;
  from: number;
  at: number;
}

/** A shell's landing (display: hits, weak hits, misses, wrecks). */
export interface Bt2Impact {
  x: number;
  y: number;
  t: number;
  /** 0 miss, 1 hit, 2 weak-spot hit, 3 destroyed (a weak-spot kill is 4). */
  r: number;
  kind: number;
  s256: number;
}

export interface BastionTankState {
  tick: number;
  seed: number;
  rev: number;
  /** Inputs that reached the sim (any input counts: anyone who plays scores at least 1). */
  acted: number;
  aimX: number;
  aimY: number;
  aiming: number;
  mag: number;
  cool: number;
  /** The current reload's start tick (-1 = none), end tick, tap result (0 none, 1 fast, 2 jam) and zone start. */
  reloadAt: number;
  reloadEnd: number;
  reloadTap: number;
  zone: number;
  reloads: number;
  fast: number;
  jams: number;
  shots: number;
  hits: number;
  weak: number;
  /** Shots fired with no shell to fire (display: the dry click). */
  dry: number;
  base: number;
  /** The tick the base was last hit (display: the shake), 0 = never. */
  breachAt: number;
  destroyedHp: number;
  kills: number;
  breached: number;
  nextSpawn: number;
  tanks: Bt2Tank[];
  shells: Bt2Shell[];
  /** Recent landings (display; the last second's). */
  impacts: Bt2Impact[];
  /** The tick the field emptied after the last spawn (0 until then). */
  clearedAt: number;
  /** bastionRev 3: drones downed and which (bit n = drone n); always 0 on rev 2. */
  drones: number;
  droneMask: number;
  /** 0 running, 1 the clock ran out, 2 the base fell, 3 every tank gone. */
  ended: number;
  endedTick: number;
}

export function bastionTankInit(seed: number, rev: number = BASTION_REV_TANK): BastionTankState {
  bastionPlan(seed);
  if (rev >= BASTION_REV_IRON) bastionDrones(seed);
  return {
    tick: 0,
    seed: seed | 0,
    rev: rev >= BASTION_REV_IRON ? BASTION_REV_IRON : BASTION_REV_TANK,
    acted: 0,
    aimX: BT2_VP_X,
    aimY: 470,
    aiming: 0,
    mag: BT2_MAG,
    cool: 0,
    reloadAt: -1,
    reloadEnd: 0,
    reloadTap: 0,
    zone: 0,
    reloads: 0,
    fast: 0,
    jams: 0,
    shots: 0,
    hits: 0,
    weak: 0,
    dry: 0,
    base: BT2_BASE,
    breachAt: 0,
    destroyedHp: 0,
    kills: 0,
    breached: 0,
    nextSpawn: 0,
    tanks: [],
    shells: [],
    impacts: [],
    clearedAt: 0,
    drones: 0,
    droneMask: 0,
    ended: 0,
    endedTick: 0,
  };
}

/** The wave on screen (0-based): the last one whose first tick has come. */
export function bastionWave(state: Pick<BastionTankState, "tick">): number {
  let w = 0;
  for (let i = 0; i < BT2_WAVE_COUNT; i++) if (state.tick >= BT2_WAVE_START[i]!) w = i;
  return w;
}

/** The reload needle (per mille of its sweep), or -1 when not reloading. */
export function bastionNeedle(state: Pick<BastionTankState, "tick" | "reloadAt">): number {
  if (state.reloadAt < 0) return -1;
  return clampInt(Math.floor(((state.tick - state.reloadAt) * 1000) / BT2_RELOAD_TICKS), 0, 1000);
}

function startReload(s: BastionTankState): void {
  s.reloadAt = s.tick;
  s.reloadEnd = s.tick + BT2_RELOAD_TICKS;
  s.reloadTap = 0;
  s.zone = bastionZoneStart(s.seed, s.reloads);
  s.reloads += 1;
}

function land(s: BastionTankState, shell: Bt2Shell): void {
  if (s.rev >= BASTION_REV_IRON) {
    const ds = bastionDrones(s.seed);
    for (let n = 0; n < ds.length; n++) {
      if (s.droneMask & (1 << n)) continue;
      const at = bastionDronePos(ds[n]!, s.tick);
      if (!at || !inside(bastionDroneRect(at.x, at.y), shell.x, shell.y)) continue;
      s.droneMask |= 1 << n;
      s.drones += 1;
      s.impacts.push({ x: shell.x, y: shell.y, t: s.tick, r: 5, kind: -1, s256: 256 });
      return;
    }
  }
  // Front-most first: the tanks are kept nearest the wall first.
  for (const t of s.tanks) {
    const r = bastionTankRects(t.kind, t.lane, t.z);
    const weak = bastionWeakOpen(bastionPlan(s.seed)[t.i]!, s.tick) && inside(r.weak, shell.x, shell.y, 1);
    if (!weak && !inside(r.hull, shell.x, shell.y) && !inside(r.turret, shell.x, shell.y)) continue;
    const dmg = weak ? 2 : 1;
    const took = Math.min(dmg, t.hp);
    t.hp -= dmg;
    t.flash = 8;
    s.hits += 1;
    if (weak) s.weak += 1;
    s.destroyedHp += took;
    const dead = t.hp <= 0;
    if (dead) s.kills += 1;
    s.impacts.push({ x: shell.x, y: shell.y, t: s.tick, r: dead ? (weak ? 4 : 3) : weak ? 2 : 1, kind: t.kind, s256: r.s256 });
    if (dead) s.tanks = s.tanks.filter((x) => x !== t);
    return;
  }
  s.impacts.push({ x: shell.x, y: shell.y, t: s.tick, r: 0, kind: -1, s256: bastionScale256(0) });
}

export function bastionTankStep(prev: BastionTankState, input: ArcadeInputEvent | null): BastionTankState {
  if (prev.ended !== 0) return prev;
  const tick = prev.tick + 1;
  const s: BastionTankState = {
    ...prev,
    tick,
    tanks: prev.tanks.map((t) => ({ ...t })),
    shells: prev.shells.slice(),
    impacts: prev.impacts.filter((m) => tick - m.t < 60),
  };
  if (s.cool > 0) s.cool -= 1;
  if (s.reloadAt >= 0 && tick >= s.reloadEnd) {
    s.reloadAt = -1;
    s.mag = BT2_MAG;
  }

  if (input) {
    s.acted += 1;
    if (input.k === BT2_INPUT_AIM) {
      s.aimX = clampInt(input.a, 0, BT2_WORLD_W);
      s.aimY = clampInt(input.b, 0, BT2_WORLD_H);
      s.aiming = clampInt(input.c, 0, 1);
    } else if (input.k === BT2_INPUT_FIRE) {
      s.aimX = clampInt(input.a, 0, BT2_WORLD_W);
      s.aimY = clampInt(input.b, 0, BT2_WORLD_H);
      s.aiming = 0;
      if (s.mag > 0 && s.cool === 0 && s.reloadAt < 0) {
        s.shells.push({ x: s.aimX, y: s.aimY, from: tick, at: tick + bastionFlight(s.aimY) });
        s.mag -= 1;
        s.cool = BT2_FIRE_COOL;
        s.shots += 1;
        if (s.mag === 0) startReload(s);
      } else s.dry += 1;
    } else if (input.k === BT2_INPUT_RELOAD) {
      if (s.reloadAt < 0 && s.mag < BT2_MAG) startReload(s);
    } else if (input.k === BT2_INPUT_TAP) {
      if (s.reloadAt >= 0 && s.reloadTap === 0) {
        const needle = bastionNeedle(s);
        if (needle >= s.zone && needle <= s.zone + bastionZoneW(s.rev)) {
          s.reloadTap = 1;
          s.fast += 1;
          s.reloadEnd = Math.max(tick + 1, s.reloadAt + BT2_FAST_TICKS);
        } else {
          s.reloadTap = 2;
          s.jams += 1;
          s.reloadEnd += BT2_JAM_TICKS;
        }
      }
    }
  }

  // Spawns.
  const plan = bastionPlan(s.seed);
  while (s.nextSpawn < plan.length && plan[s.nextSpawn]!.spawn <= tick) {
    const p = plan[s.nextSpawn]!;
    const v = Math.floor((BT2_SPEED[p.kind]! * bastionWavePace(s.rev, p.wave)) / 100);
    s.tanks.push({ i: s.nextSpawn, kind: p.kind, lane: p.lane, z: BT2_FAR * FP, v, hp: BT2_HP[p.kind]!, changed: 0, flash: 0 });
    s.nextSpawn += 1;
  }

  // Movement, nearest the wall first, so each tank behind sees where the one ahead now is.
  s.tanks.sort((a, b) => a.z - b.z || a.i - b.i);
  const ahead = [-1, -1, -1];
  const kept: Bt2Tank[] = [];
  for (const t of s.tanks) {
    if (t.flash > 0) t.flash -= 1;
    t.z -= t.v;
    const p = plan[t.i]!;
    if (t.changed === 0 && p.chg !== 0 && t.z <= p.chgZ * FP) {
      t.changed = 1;
      t.v = p.chg === 1 ? Math.floor((t.v * 3) / 2) : Math.floor((t.v * 2) / 3);
    }
    const a = ahead[t.lane]!;
    if (a >= 0 && t.z < a + BT2_GAP * FP) t.z = a + BT2_GAP * FP;
    if (t.z <= 0) {
      s.base -= 1;
      s.breached += 1;
      s.breachAt = tick;
      continue;
    }
    ahead[t.lane] = t.z;
    kept.push(t);
  }
  s.tanks = kept;
  if (s.base < 0) s.base = 0;

  // Landings.
  if (s.shells.some((sh) => sh.at <= tick)) {
    const flying: Bt2Shell[] = [];
    for (const sh of s.shells) {
      if (sh.at <= tick) land(s, sh);
      else flying.push(sh);
    }
    s.shells = flying;
  }

  if (s.base <= 0) {
    s.ended = 2;
    s.endedTick = tick;
  } else if (tick >= BT2_RUN_TICKS) {
    s.ended = 1;
    s.endedTick = tick;
  } else if (s.nextSpawn >= plan.length && s.tanks.length === 0 && s.shells.length === 0 && (s.rev < BASTION_REV_IRON || s.droneMask === (1 << BT3_DRONES) - 1 || tick >= bastionDronesGone(s.seed))) {
    if (s.clearedAt === 0) s.clearedAt = tick;
    if (tick >= s.clearedAt + BT2_END_HOLD) {
      s.ended = 3;
      s.endedTick = tick;
    }
  }
  return s;
}

export function bastionTankIsOver(state: BastionTankState): boolean {
  return state.ended !== 0;
}

/* ---------------------------------------------------------------- scoring */

export const BT2_CORE_MAX = 140;
export const BT2_WEAK_MAX = 30;
export const BT2_FAST_EACH = 2;
export const BT2_FAST_MAX = 20;
export const BT2_BASE_MAX = 10;

export const BASTION_STD_SPEC: StdSpec = {
  field: "bastionRev",
  rev: BASTION_REV_TANK,
  parts: [
    { key: "core", label: "Armour", max: BT2_CORE_MAX, of: BT2_TOTAL_HP, how: `a share of all ${BT2_TOTAL_HP} tank hit points destroyed across the ${BT2_WAVE_COUNT} waves` },
    { key: "weak", label: "Weak spots", max: BT2_WEAK_MAX, of: BT2_WEAK_MAX, item: "weak-spot hit", how: `1 for each weak-spot hit, up to ${BT2_WEAK_MAX}` },
    { key: "fast", label: "Fast reloads", max: BT2_FAST_MAX, of: BT2_FAST_MAX / BT2_FAST_EACH, item: "fast reload", how: `${BT2_FAST_EACH} for each fast reload, up to ${BT2_FAST_MAX / BT2_FAST_EACH}` },
    { key: "base", label: "Base intact", max: BT2_BASE_MAX, of: BT2_BASE, item: "base hit point", how: `${BT2_BASE_MAX} with 3 of 3 left at the end, 5 with 2 of 3` },
  ],
};

export const BASTION_V2_BAND_CURVE = bandCurve([0, BT2_TOTAL_HP], [0, BT2_CORE_MAX]);

/** bastionRev 3's parts (exactly 200): Armour, Weak spots, Fast reloads, Drones, Base intact. */
export const BT3_CORE_MAX = 110;
export const BT3_WEAK_MAX = 30;
export const BT3_FAST_EACH = 2;
export const BT3_FAST_MAX = 20;
export const BT3_DRONE_EACH = 10;
export const BT3_DRONE_MAX = BT3_DRONE_EACH * BT3_DRONES;
export const BT3_BASE_MAX = 10;

export const BASTION_STD_SPEC_V3: StdSpec = {
  field: "bastionRev",
  rev: BASTION_REV_IRON,
  parts: [
    { key: "core", label: "Armour", max: BT3_CORE_MAX, of: BT2_TOTAL_HP, how: `knock out tank armour, every hit point of the ${BT2_TOTAL_HP} worth the same` },
    { key: "weak", label: "Weak spots", max: BT3_WEAK_MAX, of: BT3_WEAK_MAX, item: "weak-spot hit", how: "1 for each hit on a glowing weak spot" },
    { key: "fast", label: "Fast reloads", max: BT3_FAST_MAX, of: BT3_FAST_MAX / BT3_FAST_EACH, item: "fast reload", how: `${BT3_FAST_EACH} for each fast reload` },
    { key: "drone", label: "Drones", max: BT3_DRONE_MAX, of: BT3_DRONES, item: "drone", how: `${BT3_DRONE_EACH} for each of the ${BT3_DRONES} drones shot down` },
    { key: "base", label: "Base intact", max: BT3_BASE_MAX, of: BT2_BASE, item: "base hit point", how: "all of it with the base unhurt, half with one hit" },
  ],
};

export const BASTION_V3_BAND_CURVE = bandCurve([0, BT2_TOTAL_HP], [0, BT3_CORE_MAX]);

/** The spec a revision scores on. */
export function bastionStdSpecFor(rev?: number | null): StdSpec {
  return (rev ?? 0) >= BASTION_REV_IRON ? BASTION_STD_SPEC_V3 : BASTION_STD_SPEC;
}

export function bastionBasePoints(base: number, ended: number): number {
  if (ended === 2) return 0;
  return base >= 3 ? BT2_BASE_MAX : base === 2 ? 5 : 0;
}

/** bastionRev 2's scored parts (null for a state of any other revision). */
export function bastionStdParts(state: BastionTankState): StdPart[] | null {
  if (!state) return null;
  if (state.rev === BASTION_REV_IRON) {
    const v3 = BASTION_STD_SPEC_V3;
    const drones = state.drones ?? 0;
    return [
      stdPart(v3, "core", stdLine(BT3_CORE_MAX, state.destroyedHp, BT2_TOTAL_HP), `${state.destroyedHp} of ${BT2_TOTAL_HP} hit points · ${state.kills} of ${BT2_TANKS} tanks`),
      stdPart(v3, "weak", stdEach(state.weak, 1, BT3_WEAK_MAX), `${state.weak} weak-spot hit${state.weak === 1 ? "" : "s"}`),
      stdPart(v3, "fast", stdEach(state.fast, BT3_FAST_EACH, BT3_FAST_MAX), `${state.fast} fast reload${state.fast === 1 ? "" : "s"}${state.jams ? ` · ${state.jams} jam${state.jams === 1 ? "" : "s"}` : ""}`),
      stdPart(v3, "drone", stdEach(drones, BT3_DRONE_EACH, BT3_DRONE_MAX), `${drones} of ${BT3_DRONES} drones`),
      stdPart(v3, "base", bastionBasePoints(state.base, state.ended), `base ${state.base} of ${BT2_BASE}`),
    ];
  }
  if (state.rev !== BASTION_REV_TANK) return null;
  const spec = BASTION_STD_SPEC;
  return [
    stdPart(spec, "core", stdLine(BT2_CORE_MAX, state.destroyedHp, BT2_TOTAL_HP), `${state.destroyedHp} of ${BT2_TOTAL_HP} hit points · ${state.kills} of ${BT2_TANKS} tanks`),
    stdPart(spec, "weak", stdEach(state.weak, 1, BT2_WEAK_MAX), `${state.weak} weak-spot hit${state.weak === 1 ? "" : "s"}`),
    stdPart(spec, "fast", stdEach(state.fast, BT2_FAST_EACH, BT2_FAST_MAX), `${state.fast} fast reload${state.fast === 1 ? "" : "s"}${state.jams ? ` · ${state.jams} jam${state.jams === 1 ? "" : "s"}` : ""}`),
    stdPart(spec, "base", bastionBasePoints(state.base, state.ended), `base ${state.base} of ${BT2_BASE}`),
  ];
}

export function bastionTankScore(state: BastionTankState): number {
  const parts = bastionStdParts(state);
  return parts ? stdScore(parts, state.acted > 0) : 0;
}

/** For the skill-band tool and the reveal: units = hit points destroyed, points = the core, bonus = the features. */
export function bastionBandParts(state: BastionTankState): BandParts {
  const parts = bastionStdParts(state) ?? [];
  const get = (k: string) => parts.find((p) => p.key === k)?.points ?? 0;
  const iron = state.rev === BASTION_REV_IRON;
  return stdBandParts(
    iron ? BASTION_STD_SPEC_V3 : BASTION_STD_SPEC,
    { core: get("core"), features: iron ? { weak: get("weak"), fast: get("fast"), drone: get("drone"), base: get("base") } : { weak: get("weak"), fast: get("fast"), base: get("base") }, penalty: 0 },
    state.destroyedHp,
    `${state.kills} tanks · ${state.destroyedHp} HP`,
    state.ended !== 2,
  );
}

/* ------------------------------------------------------------- checkpoint */

export const BT2_CHECKPOINT_INTERVAL = 300;
export const BT2_CHECKPOINT_KEYS = ["tick", "mag", "reloadAt", "base", "destroyedHp", "weak", "fast", "tanks", "shells", "acted", "checksum"] as const;
export interface Bt2Checkpoint {
  tick: number;
  mag: number;
  reloadAt: number;
  base: number;
  destroyedHp: number;
  weak: number;
  fast: number;
  tanks: number;
  shells: number;
  acted: number;
  checksum: number;
}

export function bastionTankCheckpoint(state: BastionTankState): Bt2Checkpoint {
  const snap = {
    tick: state.tick,
    mag: state.mag,
    reloadAt: state.reloadAt,
    base: state.base,
    destroyedHp: state.destroyedHp,
    weak: state.weak,
    fast: state.fast,
    tanks: state.tanks.length,
    shells: state.shells.length,
    acted: state.acted,
  };
  let checksum = 0x811c9dc5;
  const extra = [state.aimX, state.aimY, state.cool, state.reloadEnd, state.jams, state.shots, state.nextSpawn, ...state.tanks.flatMap((t) => [t.i, t.z, t.v, t.hp]), ...state.shells.flatMap((s) => [s.x, s.y, s.at])];
  // bastionRev 3 adds its drones (rev 2's checksum is unchanged).
  if (state.rev === BASTION_REV_IRON) extra.push(state.drones, state.droneMask);
  for (const value of [...Object.values(snap), ...extra]) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

/* -------------------------------------------------------------- the game */

/** A plain fallback picture (the play screen draws bastionTank.renderer.ts). */
function drawPlain(ctx: CanvasRenderingContext2D, state: BastionTankState, size: CanvasSize): void {
  ctx.fillStyle = BT2_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  for (let i = state.tanks.length - 1; i >= 0; i--) {
    const t = state.tanks[i]!;
    const r = bastionTankRects(t.kind, t.lane, t.z);
    ctx.fillStyle = "#555";
    ctx.fillRect(r.hull[0], r.hull[1], r.hull[2] - r.hull[0], r.hull[3] - r.hull[1]);
    ctx.fillRect(r.turret[0], r.turret[1], r.turret[2] - r.turret[0], r.turret[3] - r.turret[1]);
    ctx.fillStyle = "#FFB43A";
    ctx.fillRect(r.weak[0], r.weak[1], r.weak[2] - r.weak[0], r.weak[3] - r.weak[1]);
  }
}

/** bastionRev 2's game (the tank shooter as first dealt). */
export const bastionTankGame: ArcadeGame<BastionTankState, ArcadeInputEvent | null> = {
  key: "bastion",
  runTicks: BT2_RUN_TICKS,
  init: (seed: number) => bastionTankInit(seed),
  step: bastionTankStep,
  isOver: bastionTankIsOver,
  score: bastionTankScore,
  draw: drawPlain,
  inputRanges: BT2_INPUT_RANGES,
};

/** bastionRev 3's game (Iron Wall: eased waves 4–5, the wider green zone, the drones). */
export const bastionIronGame: ArcadeGame<BastionTankState, ArcadeInputEvent | null> = {
  ...bastionTankGame,
  init: (seed: number) => bastionTankInit(seed, BASTION_REV_IRON),
};

/** The tank game for a stored stamp (2 or 3; anything later plays rev 3). */
export function bastionTankGameFor(rev?: number | null): ArcadeGame<BastionTankState, ArcadeInputEvent | null> {
  return (rev ?? 0) >= BASTION_REV_IRON ? bastionIronGame : bastionTankGame;
}
