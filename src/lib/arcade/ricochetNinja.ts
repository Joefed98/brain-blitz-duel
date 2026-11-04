/**
 * Ricochet, the ninja wall-climb (`ricoRev 2`, 1 Nov 2026; docs/arcade-standard/ricochet.md). Unstamped Ricochet
 * puzzles keep the old ball-and-spikes shaft (ricochet.ts), which replays and scores exactly as before.
 *
 * A ninja clings to one of two temple walls and slides slowly down; a tap leaps across the gap to the other wall on
 * an arc, and a second tap in the air is the one double jump of that leap (new upward speed and a short hang, the
 * sideways travel paused for NINJA_HANG ticks). Moss patches make the ninja slide fast; ice patches give no grip at
 * all (leap at once). Katanas stuck in the walls and shurikens crossing the gap on seeded paths knock the ninja down
 * NINJA_KNOCK px with a 1 s stun (no game over). Coins sit along good arcs, gold lanterns on the walls (some sliding
 * slowly up and down), scrolls (rare) at the top of double-jump lines. 60 s, the old Ricochet's round length.
 *
 * The whole tower is dealt in the sim from the seed (ninjaDeal) and is its own proof: the deal plans a route (the
 * witness: which landings wait, which leaps double jump), lays every coin, lantern and scroll on that route and
 * every hazard clear of it, then plays the witness through the real step and keeps the deal only if it collects
 * every item, takes no hit and climbs at least NINJA_CORE_FULL_M metres (else the next attempt's seed). So a perfect
 * run reaches 200 on every dealt tower. Nothing random is drawn during play.
 *
 * Coordinates: x in whole px (world 390 wide), heights in 1/256 px above the floor (y up). Integer maths only.
 *
 * Scoring (the arcade standard, 200 in all): height climbed 130 on a straight line, full at NINJA_CORE_FULL_M metres
 * (the near-flawless skill-band median); coins 30 split across NINJA_COINS; lanterns 20 across NINJA_LANTERNS;
 * scrolls 20 across NINJA_SCROLLS. A hit costs only the height and time it takes. Any input scores at least 1.
 */
import { clampInt, inputRange, rngBelow, type ArcadeGame, type ArcadeInputEvent } from "./engine";
import { stdLine, stdPart, stdScore, stdSum, type StdPart, type StdSpec } from "./arcadeStandard";
import { bandCurve, type BandParts } from "./scoreBands";

/* ============================== Constants ============================== */

export const NINJA_REV = 2;
export const NINJA_WORLD_W = 390;
export const NINJA_WORLD_H = 730;
export const NINJA_RUN_SECONDS = 60;
export const NINJA_RUN_TICKS = NINJA_RUN_SECONDS * 60;
export const NINJA_INPUT_TAP = 1;

/**
 * The walls' inner faces (px), the ninja's body (a box NINJA_HW × NINJA_HH either side of its centre: the Joulz hero in
 * ninja gear is drawn inside it, so what you see is what is hit) and the cling x on each wall.
 */
export const NINJA_WALL_L = 70;
export const NINJA_WALL_R = 320;
export const NINJA_HW = 13;
export const NINJA_HH = 26;
export const NINJA_CLING_X = [NINJA_WALL_L + NINJA_HW, NINJA_WALL_R - NINJA_HW] as const;

/** A leap: NINJA_LEAP_TICKS of sideways travel; upward speed and gravity in 1/256 px a tick (about +108 px a leap). */
export const NINJA_LEAP_TICKS = 26;
export const NINJA_VY0 = 2304;
export const NINJA_G = 92;
/** The double jump: this upward speed, and the sideways travel paused this many ticks (the hang). */
export const NINJA_DJ_VY = 1792;
export const NINJA_HANG = 10;

/** Cling slides, 1/256 px a tick: stone, moss, ice. */
export const NINJA_SLIDE = [96, 640, 1408] as const;
export const SURF_STONE = 0;
export const SURF_MOSS = 1;
export const SURF_ICE = 2;

/** The ninja stands on the floor here (its centre's height, feet on the floor); height climbed is measured from it. */
export const NINJA_START = (NINJA_HH + 4) * 256;
/** A hit: knocked down this far (px) over the first NINJA_FALL_TICKS of a NINJA_STUN-tick stun; then a grace. */
export const NINJA_KNOCK = 120;
export const NINJA_STUN = 60;
export const NINJA_FALL_TICKS = 20;
export const NINJA_GRACE = 45;
export const NINJA_PX_PER_M = 40;

/** Katanas: the blade runs this far from the wall face, this thick (px); the guard sits at the wall. */
export const KATANA_LEN = 48;
export const KATANA_HALF = 4;
/** Shurikens: radius (px, the drawn star's points); they cross between these x (px). A hit is the body box within 1 px of a point. */
export const SHURIKEN_R = 11;
export const SHURIKEN_X0 = NINJA_WALL_L + 12;
export const SHURIKEN_X1 = NINJA_WALL_R - 12;

export const COIN_R = 8;
export const LANTERN_R = 11;
export const SCROLL_R = 10;

/** Fixed item counts on every tower (the arcade rule: every run deals the same count of scoring items). */
export const NINJA_COINS = 60;
export const NINJA_LANTERNS = 10;
export const NINJA_SCROLLS = 4;

export const NINJA_CORE_MAX = 130;
export const NINJA_COINS_MAX = 30;
export const NINJA_LANTERNS_MAX = 20;
export const NINJA_SCROLLS_MAX = 20;
/**
 * The core is full at this many metres climbed: the near-flawless skill-band median (`bun scripts/ninja-bands.ts`,
 * docs/arcade-standard/ricochet.md). Every dealt tower's witness reaches it (ninjaDeal).
 */
export const NINJA_CORE_FULL_M = 241;
/** The core's straight line (LIVE_BANDS and arcade-help-bands-check read it). */
export const NINJA_V2_BAND_CURVE = bandCurve([0, NINJA_CORE_FULL_M], [0, NINJA_CORE_MAX]);

export const NINJA_STD_SPEC: StdSpec = {
  field: "ricoRev",
  rev: NINJA_REV,
  parts: [
    { key: "core", label: "Height", max: NINJA_CORE_MAX, of: NINJA_CORE_FULL_M, item: "metre", how: `a straight line, full at ${NINJA_CORE_FULL_M} metres climbed` },
    { key: "coins", label: "Coins", max: NINJA_COINS_MAX, of: NINJA_COINS, item: "coin", how: `shared across ${NINJA_COINS} coins` },
    { key: "lanterns", label: "Lanterns", max: NINJA_LANTERNS_MAX, of: NINJA_LANTERNS, item: "lantern", how: `2 for each of ${NINJA_LANTERNS} gold lanterns` },
    { key: "scrolls", label: "Scrolls", max: NINJA_SCROLLS_MAX, of: NINJA_SCROLLS, item: "scroll", how: `5 for each of ${NINJA_SCROLLS} scrolls` },
  ],
};

/* ================================ Tower ================================ */

export interface NinjaKatana {
  wall: number;
  /** The blade's centre line, px above the floor. */
  y: number;
}
export interface NinjaShuriken {
  /** Height at the left end and the rise to the right end (px); one crossing takes `period` ticks; `phase` offsets it. */
  y0: number;
  dy: number;
  period: number;
  phase: number;
}
export interface NinjaPatch {
  wall: number;
  kind: number;
  /** px above the floor. */
  lo: number;
  hi: number;
}
export interface NinjaPoint {
  x: number;
  y: number;
}
export interface NinjaLantern {
  wall: number;
  /** px; the lantern's centre is base + amp × tri(tick + phase, period) (amp 0: fixed). */
  base: number;
  amp: number;
  period: number;
  phase: number;
}

export interface NinjaTower {
  katanas: NinjaKatana[];
  shurikens: NinjaShuriken[];
  patches: NinjaPatch[];
  coins: NinjaPoint[];
  lanterns: NinjaLantern[];
  scrolls: NinjaPoint[];
}

/** A triangle wave in 1/1024 from -1024 to 1024 over `period` ticks (integer). */
export function ninjaTri(t: number, period: number): number {
  const p = ((t % period) + period) % period;
  const half = Math.max(1, period >> 1);
  return p < half ? -1024 + Math.trunc((2048 * p) / half) : 1024 - Math.trunc((2048 * (p - half)) / Math.max(1, period - half));
}

/** Where a shuriken is on a tick (px). */
export function shurikenAt(s: NinjaShuriken, tick: number): NinjaPoint {
  const cycle = 2 * s.period;
  const p = (((tick + s.phase) % cycle) + cycle) % cycle;
  const u = p < s.period ? p : cycle - p;
  return {
    x: SHURIKEN_X0 + Math.trunc(((SHURIKEN_X1 - SHURIKEN_X0) * u) / s.period),
    y: s.y0 + Math.trunc((s.dy * u) / s.period),
  };
}

/** Where a lantern is on a tick (px). */
export function lanternAt(l: NinjaLantern, tick: number): NinjaPoint {
  const y = l.amp === 0 ? l.base : l.base + Math.trunc((l.amp * ninjaTri(tick + l.phase, l.period)) / 1024);
  return { x: l.wall === 0 ? NINJA_WALL_L + LANTERN_R + 3 : NINJA_WALL_R - LANTERN_R - 3, y };
}

/** The wall surface at a height (px). */
export function ninjaSurface(patches: readonly NinjaPatch[], wall: number, ypx: number): number {
  for (const p of patches) {
    if (p.lo > ypx) break;
    if (p.wall === wall && ypx <= p.hi) return p.kind;
  }
  return SURF_STONE;
}

/* ================================ State ================================ */

export const MODE_CLING = 0;
export const MODE_FLIGHT = 1;
export const MODE_STUN = 2;

export interface NinjaState {
  tick: number;
  rev: number;
  std: number;
  tower: NinjaTower;
  /** The wall clung to, or (in flight) the wall the leap is heading for. */
  wall: number;
  mode: number;
  /** px. */
  x: number;
  /** 1/256 px above the floor; vy the same per tick (+ up). */
  y: number;
  vy: number;
  /** Flight: sideways ticks done, the x the leap started at, hang ticks left, the double jump used (0/1). */
  prog: number;
  fromX: number;
  hang: number;
  dj: number;
  /** Stun ticks left, the height the knock ends at, grace ticks left (no hit while > 0). */
  stun: number;
  knockTo: number;
  safe: number;
  best: number;
  /** Collected flags (0/1), one per item, in the tower's order. */
  gotCoins: number[];
  gotLanterns: number[];
  gotScrolls: number[];
  coins: number;
  lanterns: number;
  scrolls: number;
  hits: number;
  leaps: number;
  djs: number;
  acted: number;
  ended: number;
  /** Display only: the tick of the last hit, item taken and landing. */
  hitTick: number;
  pickTick: number;
  landTick: number;
}

export function ninjaClimbedPx(state: Pick<NinjaState, "best">): number {
  return Math.max(0, Math.trunc((state.best - NINJA_START) / 256));
}

export function ninjaMetres(state: Pick<NinjaState, "best">): number {
  return Math.trunc(ninjaClimbedPx(state) / NINJA_PX_PER_M);
}

function freshState(tower: NinjaTower): NinjaState {
  return {
    tick: 0, rev: NINJA_REV, std: 1, tower,
    wall: 0, mode: MODE_CLING, x: NINJA_CLING_X[0], y: NINJA_START, vy: 0,
    prog: 0, fromX: NINJA_CLING_X[0], hang: 0, dj: 0,
    stun: 0, knockTo: NINJA_START, safe: 0, best: NINJA_START,
    gotCoins: tower.coins.map(() => 0), gotLanterns: tower.lanterns.map(() => 0), gotScrolls: tower.scrolls.map(() => 0),
    coins: 0, lanterns: 0, scrolls: 0, hits: 0, leaps: 0, djs: 0, acted: 0, ended: 0,
    hitTick: -999, pickTick: -999, landTick: -999,
  };
}

/** Movement only (no hazards or items): the input, then one tick of motion. Shared by the run and the deal's planner. */
function move(s: NinjaState, tapped: boolean): void {
  if (s.mode === MODE_STUN) {
    s.stun -= 1;
    if (s.y > s.knockTo) s.y = Math.max(s.knockTo, s.y - Math.trunc((NINJA_KNOCK * 256) / NINJA_FALL_TICKS));
    if (s.stun <= 0) {
      s.mode = MODE_CLING;
      s.vy = 0;
    }
    return;
  }
  if (tapped) {
    if (s.mode === MODE_CLING) {
      s.mode = MODE_FLIGHT;
      s.fromX = s.x;
      s.wall = 1 - s.wall;
      s.prog = 0;
      s.hang = 0;
      s.dj = 0;
      s.vy = NINJA_VY0;
      s.leaps += 1;
    } else if (s.mode === MODE_FLIGHT && s.dj === 0) {
      s.dj = 1;
      s.vy = NINJA_DJ_VY;
      s.hang = NINJA_HANG;
      s.djs += 1;
    }
  }
  if (s.mode === MODE_FLIGHT) {
    s.vy -= NINJA_G;
    s.y += s.vy;
    if (s.y < NINJA_START) s.y = NINJA_START;
    if (s.hang > 0) s.hang -= 1;
    else s.prog += 1;
    const toX = NINJA_CLING_X[s.wall]!;
    s.x = s.fromX + Math.trunc(((toX - s.fromX) * s.prog) / NINJA_LEAP_TICKS);
    if (s.prog >= NINJA_LEAP_TICKS) {
      s.x = toX;
      s.mode = MODE_CLING;
      s.vy = 0;
      s.landTick = s.tick;
    }
    return;
  }
  // Clinging: slide by the surface under the ninja.
  const kind = ninjaSurface(s.tower.patches, s.wall, s.y >> 8);
  s.y = Math.max(NINJA_START, s.y - NINJA_SLIDE[kind]!);
}

/** Squared distance (px) from a point to the ninja's body box centred at (x, ypx); 0 inside it. */
export function ninjaBoxD2(x: number, ypx: number, px: number, py: number): number {
  const dx = Math.max(0, Math.abs(px - x) - NINJA_HW);
  const dy = Math.max(0, Math.abs(py - ypx) - NINJA_HH);
  return dx * dx + dy * dy;
}

/** True when the ninja's body box at (x, ypx), grown by `slack`, overlaps this katana's blade. */
export function katanaTouches(k: NinjaKatana, x: number, ypx: number, slack = 0): boolean {
  const x0 = k.wall === 0 ? NINJA_WALL_L : NINJA_WALL_R - KATANA_LEN;
  const x1 = k.wall === 0 ? NINJA_WALL_L + KATANA_LEN : NINJA_WALL_R;
  return x + NINJA_HW + slack > x0 && x - NINJA_HW - slack < x1 && ypx + NINJA_HH + slack > k.y - KATANA_HALF && ypx - NINJA_HH - slack < k.y + KATANA_HALF;
}

const SHURIKEN_HIT = SHURIKEN_R - 1;
export function shurikenTouches(sh: NinjaShuriken, tick: number, x: number, ypx: number, slack = 0): boolean {
  if (Math.abs(ypx - sh.y0 - (sh.dy >> 1)) > Math.abs(sh.dy) + 80) return false;
  const p = shurikenAt(sh, tick);
  const r = SHURIKEN_HIT + slack;
  return ninjaBoxD2(x, ypx, p.x, p.y) < r * r;
}

/** The first hazard hit at this tick, or false. Katanas and shurikens are listed by height; only the near ones are tested. */
function hazardHit(s: NinjaState): boolean {
  const ypx = s.y >> 8;
  for (const k of s.tower.katanas) {
    if (k.y < ypx - 70) continue;
    if (k.y > ypx + 70) break;
    if (katanaTouches(k, s.x, ypx)) return true;
  }
  for (const sh of s.tower.shurikens) {
    if (Math.min(sh.y0, sh.y0 + sh.dy) > ypx + 70) break;
    if (shurikenTouches(sh, s.tick, s.x, ypx)) return true;
  }
  return false;
}

function collect(s: NinjaState): void {
  const ypx = s.y >> 8;
  const t = s.tower;
  for (let i = 0; i < t.coins.length; i++) {
    const c = t.coins[i]!;
    if (c.y > ypx + 70) break;
    if (s.gotCoins[i] || c.y < ypx - 70) continue;
    if (ninjaBoxD2(s.x, ypx, c.x, c.y) < COIN_R ** 2) {
      s.gotCoins = s.gotCoins.slice();
      s.gotCoins[i] = 1;
      s.coins += 1;
      s.pickTick = s.tick;
    }
  }
  for (let i = 0; i < t.lanterns.length; i++) {
    if (s.gotLanterns[i]) continue;
    const p = lanternAt(t.lanterns[i]!, s.tick);
    if (Math.abs(p.y - ypx) > 70) continue;
    if (ninjaBoxD2(s.x, ypx, p.x, p.y) < LANTERN_R ** 2) {
      s.gotLanterns = s.gotLanterns.slice();
      s.gotLanterns[i] = 1;
      s.lanterns += 1;
      s.pickTick = s.tick;
    }
  }
  for (let i = 0; i < t.scrolls.length; i++) {
    if (s.gotScrolls[i]) continue;
    const c = t.scrolls[i]!;
    if (Math.abs(c.y - ypx) > 70) continue;
    if (ninjaBoxD2(s.x, ypx, c.x, c.y) < SCROLL_R ** 2) {
      s.gotScrolls = s.gotScrolls.slice();
      s.gotScrolls[i] = 1;
      s.scrolls += 1;
      s.pickTick = s.tick;
    }
  }
}

function step(state: NinjaState, input: ArcadeInputEvent | null): NinjaState {
  if (state.ended) return state;
  const s: NinjaState = { ...state, tick: state.tick + 1 };
  const tapped = input !== null && input.k === NINJA_INPUT_TAP;
  if (tapped) s.acted = 1;
  move(s, tapped);
  if (s.safe > 0) s.safe -= 1;
  else if (s.mode !== MODE_STUN && hazardHit(s)) {
    // Knocked down onto the wall nearer the hit, stunned for a second.
    if (s.mode === MODE_FLIGHT && s.prog * 2 < NINJA_LEAP_TICKS) s.wall = 1 - s.wall;
    s.mode = MODE_STUN;
    s.x = NINJA_CLING_X[s.wall]!;
    s.vy = 0;
    s.hang = 0;
    s.stun = NINJA_STUN;
    s.safe = NINJA_STUN + NINJA_GRACE;
    s.knockTo = Math.max(NINJA_START, s.y - NINJA_KNOCK * 256);
    s.hits += 1;
    s.hitTick = s.tick;
  }
  collect(s);
  if (s.y > s.best) s.best = s.y;
  if (s.tick >= NINJA_RUN_TICKS) s.ended = 1;
  return s;
}

/* ================================ The deal ================================ */

export interface NinjaDeal {
  tower: NinjaTower;
  /** The witness's tap ticks (what perfect play taps) and its height climbed (metres). */
  witnessTaps: number[];
  witnessMetres: number;
}

/** The highest any run can climb (px above the start), with margin: every leap at once. */
const TOWER_TOP = Math.trunc((NINJA_RUN_TICKS / NINJA_LEAP_TICKS) * 110) + 800;

interface Rng {
  s: number;
}
function below(r: Rng, n: number): number {
  const b = rngBelow(r.s, n);
  r.s = b.state;
  return b.value;
}

function buildPatches(r: Rng): NinjaPatch[] {
  const out: NinjaPatch[] = [];
  for (let wall = 0; wall < 2; wall++) {
    let y = 520 + below(r, 300);
    while (y < TOWER_TOP + 400) {
      const len = 70 + below(r, 90);
      const kind = below(r, 10) < 6 ? SURF_MOSS : SURF_ICE;
      out.push({ wall, kind, lo: y, hi: y + len });
      // Patches come closer together higher up.
      const gap = Math.max(260, 760 - Math.trunc(y / 40)) + below(r, 320);
      y += len + gap;
    }
  }
  return out.sort((a, b) => a.lo - b.lo || a.wall - b.wall);
}

interface Plan {
  taps: number[];
  /** Per tick 0…RUN: x, y (px) and mode, and the double-jump leaps' (tick, x, y) apexes. */
  xs: Int16Array;
  ys: Int32Array;
  modes: Uint8Array;
  landings: { tick: number; wall: number; y: number; surf: number; waited: number }[];
  djApex: { tick: number }[];
  leapsFrom: { tick: number; dj: boolean; djAt: number }[];
}

/** Plans the witness's route on this tower's surfaces: at each landing a wait (0 on ice), on some leaps a double jump. */
function planRoute(r: Rng, tower: NinjaTower): Plan {
  const s = freshState(tower);
  const taps: number[] = [];
  const xs = new Int16Array(NINJA_RUN_TICKS + 1);
  const ys = new Int32Array(NINJA_RUN_TICKS + 1);
  const modes = new Uint8Array(NINJA_RUN_TICKS + 1);
  const landings: Plan["landings"] = [];
  const djApex: Plan["djApex"] = [];
  const leapsFrom: Plan["leapsFrom"] = [];
  xs[0] = s.x;
  ys[0] = s.y >> 8;
  let tapAt = 1 + below(r, 20);
  let djAt = -1;
  let djApexTick = -1;
  for (let t = 1; t <= NINJA_RUN_TICKS; t++) {
    s.tick = t;
    const wasFlight = s.mode === MODE_FLIGHT;
    let tap = false;
    if (s.mode === MODE_CLING && t === tapAt) {
      tap = true;
      // This leap: a double jump on about one in three, somewhere in its first two thirds.
      if (below(r, 100) < 34) {
        djAt = t + 7 + below(r, 10);
        djApexTick = djAt + 8;
      } else djAt = -1;
      leapsFrom.push({ tick: t, dj: djAt > 0, djAt });
    } else if (s.mode === MODE_FLIGHT && t === djAt) tap = true;
    if (tap) taps.push(t);
    move(s, tap);
    if (t === djApexTick) djApex.push({ tick: t });
    if (wasFlight && s.mode === MODE_CLING) {
      const surf = ninjaSurface(tower.patches, s.wall, s.y >> 8);
      let wait = 0;
      if (surf === SURF_ICE) wait = 0;
      else if (surf === SURF_MOSS) wait = below(r, 3);
      else {
        const roll = below(r, 100);
        wait = roll < 58 ? 0 : roll < 82 ? 3 + below(r, 10) : 14 + below(r, 18);
      }
      landings.push({ tick: t, wall: s.wall, y: s.y >> 8, surf, waited: wait });
      tapAt = t + 1 + wait;
    }
    xs[t] = s.x;
    ys[t] = s.y >> 8;
    modes[t] = s.mode;
  }
  return { taps, xs, ys, modes, landings, djApex, leapsFrom };
}

/** True when a katana is clear of the witness at every tick, with margin. */
function katanaClear(k: NinjaKatana, plan: Plan): boolean {
  for (let t = 0; t <= NINJA_RUN_TICKS; t++) {
    const y = plan.ys[t]!;
    if (Math.abs(y - k.y) > 70) continue;
    if (katanaTouches(k, plan.xs[t]!, y, 6)) return false;
  }
  return true;
}

function shurikenClear(sh: NinjaShuriken, plan: Plan): boolean {
  for (let t = 0; t <= NINJA_RUN_TICKS; t++) {
    if (shurikenTouches(sh, t, plan.xs[t]!, plan.ys[t]!, 8)) return false;
  }
  return true;
}

/** Where a plain leap from this take-off tick would be after `m` sideways ticks (px), on the witness's take-off. */
function plainLeapPoint(plan: Plan, tick: number, m: number): NinjaPoint {
  const x0 = plan.xs[tick - 1]!;
  const y0 = plan.ys[tick - 1]! * 256;
  const toX = x0 < NINJA_WORLD_W / 2 ? NINJA_CLING_X[1] : NINJA_CLING_X[0];
  let vy = NINJA_VY0;
  let y = y0;
  for (let i = 0; i < m; i++) {
    vy -= NINJA_G;
    y += vy;
  }
  return { x: x0 + Math.trunc(((toX - x0) * m) / NINJA_LEAP_TICKS), y: y >> 8 };
}

function buildTower(r: Rng, patches: NinjaPatch[]): { tower: NinjaTower; plan: Plan } {
  const tower: NinjaTower = { katanas: [], shurikens: [], patches, coins: [], lanterns: [], scrolls: [] };
  const plan = planRoute(r, tower);
  const topPx = plan.ys[NINJA_RUN_TICKS]!;
  const lastUseful = NINJA_RUN_TICKS - 180;

  // Coins: three along the arc of 20 leaps spread through the route.
  const leaps = plan.leapsFrom.filter((l) => l.tick < lastUseful - 40 && l.tick > 30);
  const coinLeaps = NINJA_COINS / 3;
  for (let k = 0; k < coinLeaps; k++) {
    const leap = leaps[Math.min(leaps.length - 1, Math.trunc(((k + 0.5) * leaps.length) / coinLeaps) + below(r, 2))]!;
    for (const m of [7, 13, 19]) {
      const t = leap.tick + m;
      tower.coins.push({ x: plan.xs[t]!, y: plan.ys[t]! });
    }
  }
  // Lanterns: on ten stone landings, about half sliding slowly, placed where the witness hangs on that wall.
  const stoneLandings = plan.landings.filter((l) => l.tick > 60 && l.tick < lastUseful && l.surf === SURF_STONE);
  for (let k = 0; k < NINJA_LANTERNS; k++) {
    const land = stoneLandings[Math.min(stoneLandings.length - 1, Math.trunc(((k + 0.5) * stoneLandings.length) / NINJA_LANTERNS))]!;
    const at = land.tick + 1;
    const wy = plan.ys[at]!;
    if (below(r, 2) === 0) tower.lanterns.push({ wall: land.wall, base: wy, amp: 0, period: 1, phase: 0 });
    else {
      const amp = 22 + below(r, 26);
      const period = 160 + below(r, 120);
      const phase = below(r, period);
      tower.lanterns.push({ wall: land.wall, base: wy - Math.trunc((amp * ninjaTri(at + phase, period)) / 1024), amp, period, phase });
    }
  }
  // Scrolls: at the top of four double-jump lines, spread through the route.
  const apexes = plan.djApex.filter((a) => a.tick > 120 && a.tick < lastUseful);
  for (let k = 0; k < NINJA_SCROLLS; k++) {
    const a = apexes[Math.min(apexes.length - 1, Math.trunc(((k + 0.5) * apexes.length) / NINJA_SCROLLS))]!;
    tower.scrolls.push({ x: plan.xs[a.tick]!, y: plan.ys[a.tick]! });
  }

  // Katanas where a plain leap would land on a double-jump leap's wall (so the double jump is the way past).
  for (const leap of plan.leapsFrom) {
    if (!leap.dj || leap.tick < 90) continue;
    const p = plainLeapPoint(plan, leap.tick, NINJA_LEAP_TICKS);
    const k: NinjaKatana = { wall: p.x < NINJA_WORLD_W / 2 ? 0 : 1, y: p.y };
    if (katanaClear(k, plan)) tower.katanas.push(k);
  }
  // Katanas up each wall, closer together higher up, each clear of the route.
  for (let wall = 0; wall < 2; wall++) {
    let y = 300 + below(r, 160);
    while (y < TOWER_TOP) {
      for (let tries = 0; tries < 8; tries++) {
        const k = { wall, y: y + tries * 14 };
        if (y > topPx + 200 || katanaClear(k, plan)) {
          tower.katanas.push(k);
          break;
        }
      }
      y += Math.max(110, 300 - Math.trunc(y / 60)) + below(r, 140);
    }
  }
  // Shurikens that cross where a leap-at-once would be on the witness's waited landings (so waiting is the way past).
  for (const land of plan.landings) {
    if (land.waited < 6 || land.tick < 120 || land.tick > lastUseful) continue;
    const leapTick = land.tick + 1;
    const m = 8 + below(r, 10);
    const p = plainLeapPoint(plan, leapTick, m);
    const period = 80 + below(r, 60);
    const dy = below(r, 81) - 40;
    const u = clampInt(Math.trunc(((p.x - SHURIKEN_X0) * period) / (SHURIKEN_X1 - SHURIKEN_X0)), 0, period);
    const y0 = p.y - Math.trunc((dy * u) / period);
    // Moving right (u rising) or left at the plain leap's tick.
    const at = leapTick - 1 + m;
    const goingRight = below(r, 2) === 0;
    const cyc = 2 * period;
    const pos = goingRight ? u : cyc - u;
    const phase = (((pos - at) % cyc) + cyc) % cyc;
    const sh = { y0, dy, period, phase };
    if (shurikenClear(sh, plan)) tower.shurikens.push(sh);
  }
  // Shurikens through the tower, closer together higher up, each clear of the route.
  let y = 700 + below(r, 200);
  while (y < TOWER_TOP) {
    for (let tries = 0; tries < 6; tries++) {
      const period = 70 + below(r, 70);
      const sh = { y0: y + tries * 18, dy: below(r, 121) - 60, period, phase: below(r, 2 * period) };
      if (y > topPx + 200 || shurikenClear(sh, plan)) {
        tower.shurikens.push(sh);
        break;
      }
    }
    y += Math.max(170, 420 - Math.trunc(y / 50)) + below(r, 160);
  }
  tower.katanas.sort((a, b) => a.y - b.y || a.wall - b.wall);
  tower.shurikens.sort((a, b) => Math.min(a.y0, a.y0 + a.dy) - Math.min(b.y0, b.y0 + b.dy));
  tower.coins.sort((a, b) => a.y - b.y || a.x - b.x);
  return { tower, plan };
}

/** Plays a tap list through the real run (the deal's proof and the oracle's). */
export function ninjaPlayTaps(seed: number, taps: readonly number[]): NinjaState {
  let s = ninjaInit(seed);
  const set = new Set(taps);
  while (!s.ended) s = step(s, set.has(s.tick + 1) ? { t: s.tick + 1, k: NINJA_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null);
  return s;
}

export function ninjaBuildDeal(seed: number): NinjaDeal {
  for (let attempt = 0; ; attempt++) {
    const r: Rng = { s: (seed ^ Math.imul(attempt + 1, 0x9e3779b1)) | 0 };
    const patches = buildPatches(r);
    const { tower, plan } = buildTower(r, patches);
    // The proof: the witness through the real step collects everything, takes no hit and climbs far enough.
    let s = freshState(tower);
    const set = new Set(plan.taps);
    while (!s.ended) s = step(s, set.has(s.tick + 1) ? { t: s.tick + 1, k: NINJA_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null);
    const ok = s.hits === 0 && s.coins === NINJA_COINS && s.lanterns === NINJA_LANTERNS && s.scrolls === NINJA_SCROLLS && ninjaMetres(s) >= NINJA_CORE_FULL_M
      && tower.coins.length === NINJA_COINS && tower.lanterns.length === NINJA_LANTERNS && tower.scrolls.length === NINJA_SCROLLS;
    if (ok || attempt >= 40) return { tower, witnessTaps: plan.taps, witnessMetres: ninjaMetres(s) };
  }
}

const DEAL_CACHE = new Map<number, NinjaDeal>();
export function ninjaDeal(seed: number): NinjaDeal {
  let d = DEAL_CACHE.get(seed);
  if (!d) {
    d = ninjaBuildDeal(seed);
    if (DEAL_CACHE.size >= 8) DEAL_CACHE.delete(DEAL_CACHE.keys().next().value!);
    DEAL_CACHE.set(seed, d);
  }
  return d;
}

export function ninjaInit(seed: number): NinjaState {
  return freshState(ninjaDeal(seed | 0).tower);
}

/* ================================ Scoring ================================ */

export function ninjaStdParts(state: NinjaState): StdPart[] | null {
  if (!state || state.rev !== NINJA_REV || !state.std) return null;
  const m = ninjaMetres(state);
  return [
    stdPart(NINJA_STD_SPEC, "core", stdLine(NINJA_CORE_MAX, m, NINJA_CORE_FULL_M), `${m} m`),
    stdPart(NINJA_STD_SPEC, "coins", stdLine(NINJA_COINS_MAX, state.coins, NINJA_COINS), `${state.coins} / ${NINJA_COINS}`),
    stdPart(NINJA_STD_SPEC, "lanterns", stdLine(NINJA_LANTERNS_MAX, state.lanterns, NINJA_LANTERNS), `${state.lanterns} / ${NINJA_LANTERNS}`),
    stdPart(NINJA_STD_SPEC, "scrolls", stdLine(NINJA_SCROLLS_MAX, state.scrolls, NINJA_SCROLLS), `${state.scrolls} / ${NINJA_SCROLLS}`),
  ];
}

export function ninjaScore(state: NinjaState): number {
  return stdScore(ninjaStdParts(state) ?? [], Boolean(state.acted));
}

export function ninjaBandParts(state: NinjaState): BandParts {
  const parts = ninjaStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  const m = ninjaMetres(state);
  return { units: m, points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${m} m climbed` };
}

/* ============================== Checkpoints ============================== */

export const NINJA_CHECKPOINT_INTERVAL = 300;
export const NINJA_CHECKPOINT_KEYS = ["tick", "mode", "wall", "x", "y", "best", "hits", "coins", "lanterns", "scrolls", "checksum"] as const;
export interface NinjaCheckpoint {
  tick: number;
  mode: number;
  wall: number;
  x: number;
  y: number;
  best: number;
  hits: number;
  coins: number;
  lanterns: number;
  scrolls: number;
  checksum: number;
}

export function ninjaCheckpoint(s: NinjaState): NinjaCheckpoint {
  const snap = {
    tick: s.tick, mode: s.mode, wall: s.wall, x: s.x, y: s.y, best: s.best,
    hits: s.hits, coins: s.coins, lanterns: s.lanterns, scrolls: s.scrolls,
  };
  let checksum = 0x811c9dc5;
  for (const v of [...Object.values(snap), s.vy, s.prog, s.hang, s.dj, s.stun, s.safe, s.leaps]) {
    checksum ^= v | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

export const ninjaGame: ArcadeGame<NinjaState, ArcadeInputEvent | null> = {
  key: "ricochet",
  runTicks: NINJA_RUN_TICKS,
  init: ninjaInit,
  step,
  isOver: (s) => s.ended !== 0,
  score: ninjaScore,
  draw: () => {},
  inputRanges: [inputRange(NINJA_INPUT_TAP)],
};

/* ======================= ricoRev 3: Moon Climb (3 Nov 2026) ======================= */
/*
 * Moon Climb (docs/arcade-standard/ricochet.md "ricoRev 3"): the ninja wall-climb with no coins and no gold lanterns.
 * Everything rev 2 does above stays exactly as it was (its own step, deal and scoring); rev 3 has its own step
 * (stepMoon), deal (moonBuildDeal) and parts, and its states carry `rev: 3`.
 *
 * New on rev 3:
 * - Sky lanterns (MOON_SKY a tower): paper lanterns that float slowly up the middle of the shaft for a while
 *   (seeded: where, when, from what height). Touching one in a leap grabs it: the ninja rides it up for MOON_RIDE
 *   ticks (1.75 s, MOON_RIDE_VY a tick), then lets go towards the wall it was heading for; a tap leaps off at once,
 *   towards the left wall (a −1), the right wall (a 1) or the wall it was heading for (a 0). One ride a lantern.
 * - Mid-ledges: short hanging wall pieces in the middle of the shaft, MOON_LEDGE_HW × 2 px wide. A leap that meets
 *   one clings to its near side; a tap from there leaps back to the wall it came from (a shorter, quicker hop: the
 *   sideways travel takes ticks in proportion to the distance). Clinging on a ledge slides as stone and holds at its
 *   lower end.
 * - Flow: a landing (on a wall or a ledge, or a lantern grabbed) after a clean leap adds one to the streak; a hit, or a
 *   take-off after sliding MOON_FLOW_SLIDE px or more since the landing, sets it to 0. Every MOON_FLOW_STEP in a row
 *   (Flow ×7, ×14, …) pays MOON_FLOW_EACH points, up to MOON_FLOW_MAX.
 * - Scrolls: MOON_SCROLLS (3) at the top of double-jump lines on the route, never off it.
 *
 * The deal plans a route (the witness) that rides every sky lantern, hops on the ledges, takes every scroll and never
 * breaks its flow, lays the hazards clear of it and plays it through the real step; it keeps the tower only if the
 * witness takes every scroll and lantern ride, earns the whole flow part, takes no hit and climbs at least
 * MOON_CORE_FULL_M. So a perfect run reaches 200 on every dealt tower.
 *
 * Scoring (the arcade standard, 200 in all): height 125 on a straight line, full at MOON_CORE_FULL_M; flow 30
 * (3 for every Flow ×7); lantern rides 30 (5 a ride, 6 lanterns); scrolls 15 (5 each). Any input scores at least 1.
 */

export const MOON_REV = 3;
export const MODE_RIDE = 3;
/** A mid-ledge's half width (18 px wide) and its least height. */
export const MOON_LEDGE_HW = 9;
/** Sky lanterns: the touch radius round the lantern's centre, the free float (1/256 px a tick), how long one floats. */
export const MOON_SKY_R = 14;
export const MOON_SKY_VY = 192;
export const MOON_SKY_LIFE = 900;
/** A ride: this many ticks, rising this fast (1/256 px a tick). */
export const MOON_RIDE = 105;
export const MOON_RIDE_VY = 768;
/** The ninja hangs this far (px) below a ridden lantern's centre. */
export const MOON_RIDE_HANG = MOON_SKY_R + NINJA_HH - 4;
/** Flow: a take-off after sliding this far (1/256 px) since the landing breaks the streak. */
export const MOON_FLOW_SLIDE = 16 * 256;
export const MOON_FLOW_STEP = 7;

export const MOON_SKY = 6;
export const MOON_SCROLLS = 3;
export const MOON_CORE_MAX = 125;
export const MOON_FLOW_EACH = 3;
export const MOON_FLOW_MAX = 30;
export const MOON_RIDE_EACH = 5;
export const MOON_RIDES_MAX = MOON_RIDE_EACH * MOON_SKY;
export const MOON_SCROLL_EACH = 5;
export const MOON_SCROLLS_MAX = MOON_SCROLL_EACH * MOON_SCROLLS;
/** The core is full at this many metres: between the great and near-perfect skill-band medians, fitted to the targets (`bun scripts/ninja-bands.ts --rev=3`). */
export const MOON_CORE_FULL_M = 245;
export const MOON_V3_BAND_CURVE = bandCurve([0, MOON_CORE_FULL_M], [0, MOON_CORE_MAX]);

export const MOON_STD_SPEC: StdSpec = {
  field: "ricoRev",
  rev: MOON_REV,
  parts: [
    { key: "core", label: "Height", max: MOON_CORE_MAX, of: MOON_CORE_FULL_M, item: "metre", how: `every metre climbed counts the same, all of it at ${MOON_CORE_FULL_M} m` },
    { key: "flow", label: "Flow", max: MOON_FLOW_MAX, of: MOON_FLOW_MAX / MOON_FLOW_EACH, item: "flow", how: `${MOON_FLOW_EACH} for every ${MOON_FLOW_STEP} clean leaps in a row` },
    { key: "rides", label: "Lantern rides", max: MOON_RIDES_MAX, of: MOON_SKY, item: "ride", how: `${MOON_RIDE_EACH} for each of the ${MOON_SKY} sky lanterns you ride` },
    { key: "scrolls", label: "Scrolls", max: MOON_SCROLLS_MAX, of: MOON_SCROLLS, item: "scroll", how: `${MOON_SCROLL_EACH} for each of the ${MOON_SCROLLS} scrolls` },
  ],
};

export interface MoonLedge {
  /** The ledge's centre x and its lower and upper ends (px above the floor). */
  x: number;
  lo: number;
  hi: number;
}
export interface MoonSky {
  /** Centre x (px); its height y0 (px) at tick t0; it floats from t0 for MOON_SKY_LIFE ticks. */
  x: number;
  y0: number;
  t0: number;
}

/** Where a sky lantern is on a tick (px), or null while it is not in the sky. */
export function moonSkyAt(l: MoonSky, tick: number): NinjaPoint | null {
  const dt = tick - l.t0;
  if (dt < 0 || dt >= MOON_SKY_LIFE) return null;
  return { x: l.x, y: l.y0 + ((dt * MOON_SKY_VY) >> 8) };
}

/** The x the ninja clings at on a ledge's side: side 0 its left face (heading right), 1 its right face. */
export function moonLedgeX(l: MoonLedge, side: number): number {
  return side === 0 ? l.x - MOON_LEDGE_HW - NINJA_HW : l.x + MOON_LEDGE_HW + NINJA_HW;
}

/** The sideways ticks a leap of this many px takes (a wall-to-wall leap NINJA_LEAP_TICKS). */
const MOON_FULL_GAP = NINJA_CLING_X[1] - NINJA_CLING_X[0];
export function moonLeapTicks(dist: number): number {
  return Math.max(8, Math.trunc((NINJA_LEAP_TICKS * Math.abs(dist) + (MOON_FULL_GAP >> 1)) / MOON_FULL_GAP));
}

/** Rev 3's extra state (absent on rev 2 states). */
export interface MoonFields {
  /** The ledge clung to (-1: a wall), the flight's target x and sideways ticks. */
  ledge: number;
  toX: number;
  ft: number;
  /** Slide since the landing (1/256 px), the streak, Flow steps reached, the best streak. */
  slid: number;
  streak: number;
  flow: number;
  bestStreak: number;
  /** Ride ticks left and the lantern ridden. */
  ride: number;
  rideIdx: number;
  rides: number;
  gotSky: number[];
  /** Display only: the tick of the last Flow step and of the last grab. */
  flowTick: number;
  grabTick: number;
}
export type MoonState = NinjaState & MoonFields & { tower: NinjaTower & { ledges: MoonLedge[]; sky: MoonSky[] } };

function freshMoon(tower: MoonState["tower"]): MoonState {
  return {
    ...freshState(tower),
    tower,
    rev: MOON_REV,
    ledge: -1, toX: NINJA_CLING_X[0], ft: NINJA_LEAP_TICKS,
    slid: 0, streak: 0, flow: 0, bestStreak: 0,
    ride: 0, rideIdx: -1, rides: 0, gotSky: tower.sky.map(() => 0),
    flowTick: -999, grabTick: -999,
  };
}

/** A landing (wall, ledge or lantern): the streak goes on. */
function moonLanded(s: MoonState): void {
  s.streak += 1;
  if (s.streak > s.bestStreak) s.bestStreak = s.streak;
  if (s.streak % MOON_FLOW_STEP === 0) {
    s.flow += 1;
    s.flowTick = s.tick;
  }
  s.slid = 0;
}

function moonTakeOff(s: MoonState, fromX: number, toWall: number, vy: number): void {
  s.mode = MODE_FLIGHT;
  s.fromX = fromX;
  s.wall = toWall;
  s.toX = NINJA_CLING_X[toWall]!;
  s.ft = moonLeapTicks(s.toX - fromX);
  s.prog = 0;
  s.hang = 0;
  s.dj = 0;
  s.vy = vy;
  s.ledge = -1;
}

/** Rev 3 movement (no hazards or scrolls): the input, then one tick of motion. Shared by the run and the deal's planner. */
function moveMoon(s: MoonState, tapped: boolean, dir: number): void {
  if (s.mode === MODE_STUN) {
    s.stun -= 1;
    if (s.y > s.knockTo) s.y = Math.max(s.knockTo, s.y - Math.trunc((NINJA_KNOCK * 256) / NINJA_FALL_TICKS));
    if (s.stun <= 0) {
      s.mode = MODE_CLING;
      s.vy = 0;
      s.slid = 0;
    }
    return;
  }
  if (s.mode === MODE_RIDE) {
    if (tapped) {
      // Leap off: towards the wall asked for, or the one it was heading for.
      s.leaps += 1;
      moonTakeOff(s, s.x, dir < 0 ? 0 : dir > 0 ? 1 : s.wall, NINJA_VY0);
      s.ride = 0;
    } else {
      s.y += MOON_RIDE_VY;
      s.ride -= 1;
      if (s.ride <= 0) {
        // The lantern lets go: a drop towards the wall it was heading for (not a leap: the streak is unchanged).
        moonTakeOff(s, s.x, s.wall, 0);
        return;
      }
      return;
    }
  } else if (tapped) {
    if (s.mode === MODE_CLING) {
      if (s.slid >= MOON_FLOW_SLIDE) s.streak = 0;
      const from = s.x;
      s.leaps += 1;
      moonTakeOff(s, from, 1 - s.wall, NINJA_VY0);
    } else if (s.mode === MODE_FLIGHT && s.dj === 0) {
      s.dj = 1;
      s.vy = NINJA_DJ_VY;
      s.hang = NINJA_HANG;
      s.djs += 1;
    }
  }
  const tower = s.tower;
  if (s.mode === MODE_FLIGHT) {
    s.vy -= NINJA_G;
    s.y += s.vy;
    if (s.y < NINJA_START) s.y = NINJA_START;
    if (s.hang > 0) s.hang -= 1;
    else s.prog += 1;
    const prevX = s.x;
    s.x = s.fromX + Math.trunc(((s.toX - s.fromX) * s.prog) / s.ft);
    const ypx = s.y >> 8;
    // A sky lantern touched: grab it and ride.
    for (let i = 0; i < tower.sky.length; i++) {
      if (s.gotSky[i]) continue;
      const p = moonSkyAt(tower.sky[i]!, s.tick);
      if (!p || Math.abs(p.y - ypx) > 60) continue;
      if (ninjaBoxD2(s.x, ypx, p.x, p.y) < MOON_SKY_R * MOON_SKY_R) {
        s.gotSky = s.gotSky.slice();
        s.gotSky[i] = 1;
        s.rides += 1;
        s.mode = MODE_RIDE;
        s.ride = MOON_RIDE;
        s.rideIdx = i;
        s.vy = 0;
        s.hang = 0;
        s.grabTick = s.tick;
        moonLanded(s);
        return;
      }
    }
    // A ledge met on the way: cling to its near side.
    if (s.x !== prevX) {
      const right = s.toX > s.fromX;
      for (let i = 0; i < tower.ledges.length; i++) {
        const l = tower.ledges[i]!;
        if (l.lo > ypx + NINJA_HH) break;
        if (!(ypx + NINJA_HH > l.lo + 2 && ypx - NINJA_HH < l.hi - 2)) continue;
        const face = moonLedgeX(l, right ? 0 : 1);
        if (right ? prevX < face && s.x >= face : prevX > face && s.x <= face) {
          s.x = face;
          s.mode = MODE_CLING;
          s.ledge = i;
          s.vy = 0;
          s.landTick = s.tick;
          moonLanded(s);
          return;
        }
      }
    }
    if (s.prog >= s.ft) {
      s.x = s.toX;
      s.mode = MODE_CLING;
      s.vy = 0;
      s.landTick = s.tick;
      moonLanded(s);
    }
    return;
  }
  // Clinging: slide by the surface under the ninja (a ledge is stone and holds at its lower end).
  const before = s.y;
  if (s.ledge >= 0) {
    const l = tower.ledges[s.ledge]!;
    s.y = Math.max((l.lo - NINJA_HH + 3) * 256, s.y - NINJA_SLIDE[SURF_STONE]);
  } else {
    const kind = ninjaSurface(tower.patches, s.wall, s.y >> 8);
    s.y = Math.max(NINJA_START, s.y - NINJA_SLIDE[kind]!);
  }
  s.slid += before - s.y;
}

function stepMoon(state: MoonState, input: ArcadeInputEvent | null): MoonState {
  if (state.ended) return state;
  const s: MoonState = { ...state, tick: state.tick + 1 };
  const tapped = input !== null && input.k === NINJA_INPUT_TAP;
  if (tapped) s.acted = 1;
  moveMoon(s, tapped, tapped ? input!.a : 0);
  if (s.safe > 0) s.safe -= 1;
  else if (s.mode !== MODE_STUN && hazardHit(s)) {
    // Knocked down onto the wall nearer the ninja, stunned for a second; the streak ends.
    s.wall = s.x * 2 < NINJA_WORLD_W ? 0 : 1;
    s.mode = MODE_STUN;
    s.x = NINJA_CLING_X[s.wall]!;
    s.vy = 0;
    s.hang = 0;
    s.ride = 0;
    s.ledge = -1;
    s.stun = NINJA_STUN;
    s.safe = NINJA_STUN + NINJA_GRACE;
    s.knockTo = Math.max(NINJA_START, s.y - NINJA_KNOCK * 256);
    s.hits += 1;
    s.hitTick = s.tick;
    s.streak = 0;
  }
  collect(s);
  if (s.y > s.best) s.best = s.y;
  if (s.tick >= NINJA_RUN_TICKS) s.ended = 1;
  return s;
}

/* ------------------------------- The deal ------------------------------- */

export interface MoonEvent {
  t: number;
  a: number;
}
export interface MoonDeal {
  tower: MoonState["tower"];
  /** The witness's taps (tick and direction) and its height climbed (metres). */
  witness: MoonEvent[];
  witnessMetres: number;
}

interface MoonPlan {
  events: MoonEvent[];
  xs: Int16Array;
  ys: Int32Array;
  landings: { tick: number; y: number; surf: number; waited: number; wall: boolean }[];
  djApex: { tick: number }[];
  leapsFrom: { tick: number; dj: boolean; wall: boolean }[];
}

function cloneMoon(s: MoonState): MoonState {
  return { ...s, gotSky: s.gotSky.slice() };
}

/** True when the route's body box (ticks from..to) never comes within `m` px of this rectangle. */
function routeClearOfRect(plan: { xs: Int16Array; ys: Int32Array }, to: number, x0: number, x1: number, y0: number, y1: number, m: number): boolean {
  for (let t = 0; t < to; t++) {
    const x = plan.xs[t]!;
    const y = plan.ys[t]!;
    if (x + NINJA_HW + m > x0 && x - NINJA_HW - m < x1 && y + NINJA_HH + m > y0 && y - NINJA_HH - m < y1) return false;
  }
  return true;
}

/**
 * Plans the witness's route on this tower's surfaces, adding sky lanterns and ledges as it goes: at each landing a
 * wait that keeps the flow (none on ice, at most 2 ticks on moss, a short or longer wait on stone), on some leaps a
 * double jump; MOON_SKY leaps grab a lantern placed to meet them (and leap off after a seeded part of the ride, to a
 * seeded wall); several leaps meet a ledge placed in their way (and hop back).
 */
function planMoon(r: Rng, tower: MoonState["tower"]): MoonPlan {
  const s = freshMoon(tower);
  const events: MoonEvent[] = [];
  const xs = new Int16Array(NINJA_RUN_TICKS + 1);
  const ys = new Int32Array(NINJA_RUN_TICKS + 1);
  const landings: MoonPlan["landings"] = [];
  const djApex: MoonPlan["djApex"] = [];
  const leapsFrom: MoonPlan["leapsFrom"] = [];
  xs[0] = s.x;
  ys[0] = s.y >> 8;
  const skyAt: number[] = [];
  for (let k = 0; k < MOON_SKY; k++) skyAt.push(240 + k * 500 + below(r, 140));
  const ledgeAt: number[] = [];
  for (let t = 120 + below(r, 200); t < NINJA_RUN_TICKS - 300; t += 330 + below(r, 220)) ledgeAt.push(t);
  let nextSky = 0;
  let nextLedge = 0;
  let tapAt = 1 + below(r, 20);
  let djAt = -1;
  let djApexTick = -1;
  let offAt = -1;
  let offDir = 0;
  for (let t = 1; t <= NINJA_RUN_TICKS; t++) {
    s.tick = t;
    const was = s.mode;
    let tap = false;
    let a = 0;
    // Never let a wait slide far enough to break the flow (a slide onto moss or ice ends the wait).
    if (s.mode === MODE_CLING && t < tapAt && s.slid >= MOON_FLOW_SLIDE - 3 * 256) tapAt = t;
    if (s.mode === MODE_CLING && t === tapAt) {
      tap = true;
      djAt = -1;
      const onWall = s.ledge < 0;
      let feature = false;
      if (onWall && nextSky < MOON_SKY && t >= skyAt[nextSky]!) feature = placeSky(r, s, t, xs, ys, tower) && (nextSky++, true);
      if (!feature && onWall && nextLedge < ledgeAt.length && t >= ledgeAt[nextLedge]!) feature = placeLedge(r, s, t, xs, ys, tower) && (nextLedge++, true);
      // This leap: a double jump on about one in three, somewhere in its first two thirds.
      if (!feature && below(r, 100) < 34) {
        djAt = t + 7 + below(r, 10);
        djApexTick = djAt + 8;
      }
      leapsFrom.push({ tick: t, dj: djAt > 0, wall: onWall });
    } else if (s.mode === MODE_FLIGHT && t === djAt) tap = true;
    else if (s.mode === MODE_RIDE && t === offAt) {
      tap = true;
      a = offDir;
    }
    if (tap) events.push({ t, a });
    moveMoon(s, tap, a);
    if (t === djApexTick) djApex.push({ tick: t });
    if (was !== MODE_RIDE && s.mode === MODE_RIDE) {
      offAt = t + 30 + below(r, 60);
      offDir = below(r, 2) === 0 ? -1 : 1;
    }
    if (was === MODE_FLIGHT && s.mode === MODE_CLING) {
      const onWall = s.ledge < 0;
      const surf = onWall ? ninjaSurface(tower.patches, s.wall, s.y >> 8) : SURF_STONE;
      let wait = 0;
      if (!onWall) wait = below(r, 4);
      else if (surf === SURF_ICE) wait = 0;
      else if (surf === SURF_MOSS) wait = below(r, 3);
      else {
        const roll = below(r, 100);
        wait = roll < 58 ? 0 : roll < 82 ? 3 + below(r, 10) : 14 + below(r, 18);
      }
      landings.push({ tick: t, y: s.y >> 8, surf, waited: wait, wall: onWall });
      tapAt = t + 1 + wait;
    }
    xs[t] = s.x;
    ys[t] = s.y >> 8;
  }
  return { events, xs, ys, landings, djApex, leapsFrom };
}

/** Places a sky lantern where this leap (taken at tick t) will be in mid-gap; false when it can't. */
function placeSky(r: Rng, s: MoonState, t: number, xs: Int16Array, ys: Int32Array, tower: MoonState["tower"]): boolean {
  const m = 9 + below(r, 6);
  const lead = 120 + below(r, 180);
  const c = cloneMoon(s);
  c.tick = t;
  moveMoon(c, true, 0);
  for (let k = 1; k < m; k++) {
    c.tick = t + k;
    moveMoon(c, false, 0);
    if (c.mode !== MODE_FLIGHT) return false;
  }
  const lx = c.x;
  const ly = (c.y >> 8) + NINJA_HH + MOON_SKY_R - 4;
  if (lx < 130 || lx > NINJA_WORLD_W - 130) return false;
  const sky: MoonSky = { x: lx, y0: ly - ((lead * MOON_SKY_VY) >> 8), t0: t + m - 1 - lead };
  if (sky.t0 < 1) return false;
  // The route so far never comes near it while it floats.
  for (let k = sky.t0; k < t; k++) {
    const p = moonSkyAt(sky, k)!;
    if (ninjaBoxD2(xs[k]!, ys[k]!, p.x, p.y) < (MOON_SKY_R + 10) ** 2) return false;
  }
  // Clear of the ledges (by 40 px over its whole float).
  for (const l of tower.ledges) {
    if (Math.abs(l.x - lx) < 60 && sky.y0 - 40 < l.hi && sky.y0 + ((MOON_SKY_LIFE * MOON_SKY_VY) >> 8) + 40 > l.lo) return false;
  }
  tower.sky.push(sky);
  s.gotSky = s.gotSky.concat(0);
  return true;
}

/** Places a ledge in this leap's way (taken at tick t from a wall); false when it can't. */
function placeLedge(r: Rng, s: MoonState, t: number, xs: Int16Array, ys: Int32Array, tower: MoonState["tower"]): boolean {
  const lx = (NINJA_WORLD_W >> 1) + below(r, 41) - 20;
  const right = s.wall === 0;
  const face = right ? lx - MOON_LEDGE_HW - NINJA_HW : lx + MOON_LEDGE_HW + NINJA_HW;
  const c = cloneMoon(s);
  c.tick = t;
  moveMoon(c, true, 0);
  let at = -1;
  for (let k = 1; k < NINJA_LEAP_TICKS + 2; k++) {
    if (c.mode !== MODE_FLIGHT) return false;
    if (right ? c.x >= face : c.x <= face) {
      at = c.y >> 8;
      break;
    }
    c.tick = t + k;
    moveMoon(c, false, 0);
  }
  if (at < 0) return false;
  const lo = at - 40 - below(r, 20);
  const hi = lo + 130 + below(r, 50);
  if (!routeClearOfRect({ xs, ys }, t, lx - MOON_LEDGE_HW, lx + MOON_LEDGE_HW, lo, hi, 4)) return false;
  const last = tower.ledges[tower.ledges.length - 1];
  if (last && lo < last.hi + 120) return false;
  for (const sk of tower.sky) {
    if (Math.abs(sk.x - lx) < 60 && sk.y0 - 40 < hi && sk.y0 + ((MOON_SKY_LIFE * MOON_SKY_VY) >> 8) + 40 > lo) return false;
  }
  tower.ledges.push({ x: lx, lo, hi });
  return true;
}

/** A shuriken's band clear of every ledge (they would pass through one). */
function shurikenClearOfLedges(sh: NinjaShuriken, ledges: readonly MoonLedge[]): boolean {
  const y0 = Math.min(sh.y0, sh.y0 + sh.dy) - SHURIKEN_R - 30;
  const y1 = Math.max(sh.y0, sh.y0 + sh.dy) + SHURIKEN_R + 30;
  return ledges.every((l) => l.hi < y0 || l.lo > y1);
}

function buildMoon(r: Rng, patches: NinjaPatch[]): { tower: MoonState["tower"]; plan: MoonPlan } {
  const tower: MoonState["tower"] = { katanas: [], shurikens: [], patches, coins: [], lanterns: [], scrolls: [], ledges: [], sky: [] };
  const plan = planMoon(r, tower);
  const topPx = plan.ys[NINJA_RUN_TICKS]!;
  const lastUseful = NINJA_RUN_TICKS - 180;
  const asPlan = plan as unknown as Plan;

  // Scrolls: at the top of three double-jump lines, spread through the route (rare, on harder lines).
  const apexes = plan.djApex.filter((a) => a.tick > 200 && a.tick < lastUseful);
  for (let k = 0; k < MOON_SCROLLS && apexes.length; k++) {
    const a = apexes[Math.min(apexes.length - 1, Math.trunc(((k + 0.5) * apexes.length) / MOON_SCROLLS))]!;
    tower.scrolls.push({ x: plan.xs[a.tick]!, y: plan.ys[a.tick]! });
  }
  // Katanas where a plain leap would land on a double-jump leap's wall (so the double jump is the way past).
  for (const leap of plan.leapsFrom) {
    if (!leap.dj || !leap.wall || leap.tick < 90) continue;
    const p = plainLeapPoint(asPlan, leap.tick, NINJA_LEAP_TICKS);
    const k: NinjaKatana = { wall: p.x < NINJA_WORLD_W / 2 ? 0 : 1, y: p.y };
    if (katanaClear(k, asPlan)) tower.katanas.push(k);
  }
  // Katanas up each wall, closer together higher up, each clear of the route.
  for (let wall = 0; wall < 2; wall++) {
    let y = 300 + below(r, 160);
    while (y < TOWER_TOP) {
      for (let tries = 0; tries < 8; tries++) {
        const k = { wall, y: y + tries * 14 };
        if (y > topPx + 200 || katanaClear(k, asPlan)) {
          tower.katanas.push(k);
          break;
        }
      }
      y += Math.max(110, 300 - Math.trunc(y / 60)) + below(r, 140);
    }
  }
  // Shurikens where a leap-at-once would be on the witness's waited wall landings (so waiting is the way past).
  for (const land of plan.landings) {
    if (!land.wall || land.waited < 6 || land.tick < 120 || land.tick > lastUseful) continue;
    const leapTick = land.tick + 1;
    const m = 8 + below(r, 10);
    const p = plainLeapPoint(asPlan, leapTick, m);
    const period = 80 + below(r, 60);
    const dy = below(r, 81) - 40;
    const u = clampInt(Math.trunc(((p.x - SHURIKEN_X0) * period) / (SHURIKEN_X1 - SHURIKEN_X0)), 0, period);
    const y0 = p.y - Math.trunc((dy * u) / period);
    const at = leapTick - 1 + m;
    const goingRight = below(r, 2) === 0;
    const cyc = 2 * period;
    const pos = goingRight ? u : cyc - u;
    const phase = (((pos - at) % cyc) + cyc) % cyc;
    const sh = { y0, dy, period, phase };
    if (shurikenClear(sh, asPlan) && shurikenClearOfLedges(sh, tower.ledges)) tower.shurikens.push(sh);
  }
  // Shurikens through the tower, closer together higher up, each clear of the route and the ledges.
  let y = 700 + below(r, 200);
  while (y < TOWER_TOP) {
    for (let tries = 0; tries < 6; tries++) {
      const period = 70 + below(r, 70);
      const sh = { y0: y + tries * 18, dy: below(r, 121) - 60, period, phase: below(r, 2 * period) };
      if ((y > topPx + 200 || shurikenClear(sh, asPlan)) && shurikenClearOfLedges(sh, tower.ledges)) {
        tower.shurikens.push(sh);
        break;
      }
    }
    y += Math.max(170, 420 - Math.trunc(y / 50)) + below(r, 160);
  }
  tower.katanas.sort((a, b) => a.y - b.y || a.wall - b.wall);
  tower.shurikens.sort((a, b) => Math.min(a.y0, a.y0 + a.dy) - Math.min(b.y0, b.y0 + b.dy));
  return { tower, plan };
}

/** Plays a tap list (tick and direction) through the real rev-3 run (the deal's proof and the oracle's). */
export function moonPlayEvents(seed: number, events: readonly MoonEvent[]): MoonState {
  let s = moonInit(seed);
  const at = new Map(events.map((e) => [e.t, e.a]));
  while (!s.ended) {
    const a = at.get(s.tick + 1);
    s = stepMoon(s, a === undefined ? null : { t: s.tick + 1, k: NINJA_INPUT_TAP, a, b: 0, c: 0, d: 0 });
  }
  return s;
}

/** True when a rev-3 state earned every part in full (the deal's proof). */
function moonPerfect(s: MoonState): boolean {
  return s.hits === 0 && s.scrolls === MOON_SCROLLS && s.rides === MOON_SKY && s.flow * MOON_FLOW_EACH >= MOON_FLOW_MAX && ninjaMetres(s) >= MOON_CORE_FULL_M;
}

export function moonBuildDeal(seed: number): MoonDeal {
  let fallback: MoonDeal | null = null;
  for (let attempt = 0; ; attempt++) {
    const r: Rng = { s: (seed ^ Math.imul(attempt + 1, 0x7f4a7c15)) | 0 };
    const patches = buildPatches(r);
    const { tower, plan } = buildMoon(r, patches);
    if (tower.sky.length !== MOON_SKY || tower.scrolls.length !== MOON_SCROLLS) {
      if (attempt >= 60) return fallback ?? { tower, witness: plan.events, witnessMetres: 0 };
      continue;
    }
    let s = freshMoon(tower);
    const at = new Map(plan.events.map((e) => [e.t, e.a]));
    while (!s.ended) {
      const a = at.get(s.tick + 1);
      s = stepMoon(s, a === undefined ? null : { t: s.tick + 1, k: NINJA_INPUT_TAP, a, b: 0, c: 0, d: 0 });
    }
    const deal = { tower, witness: plan.events, witnessMetres: ninjaMetres(s) };
    if (moonPerfect(s)) return deal;
    fallback ??= deal;
    if (attempt >= 60) return fallback;
  }
}

const MOON_CACHE = new Map<number, MoonDeal>();
export function moonDeal(seed: number): MoonDeal {
  let d = MOON_CACHE.get(seed);
  if (!d) {
    d = moonBuildDeal(seed);
    if (MOON_CACHE.size >= 8) MOON_CACHE.delete(MOON_CACHE.keys().next().value!);
    MOON_CACHE.set(seed, d);
  }
  return d;
}

export function moonInit(seed: number): MoonState {
  return freshMoon(moonDeal(seed | 0).tower);
}

/* ------------------------------- Scoring ------------------------------- */

export function moonStdParts(state: MoonState): StdPart[] | null {
  if (!state || state.rev !== MOON_REV || !state.std) return null;
  const m = ninjaMetres(state);
  return [
    stdPart(MOON_STD_SPEC, "core", stdLine(MOON_CORE_MAX, m, MOON_CORE_FULL_M), `${m} m`),
    stdPart(MOON_STD_SPEC, "flow", Math.min(MOON_FLOW_MAX, state.flow * MOON_FLOW_EACH), `best Flow ×${state.bestStreak}`),
    stdPart(MOON_STD_SPEC, "rides", Math.min(MOON_RIDES_MAX, state.rides * MOON_RIDE_EACH), `${state.rides} / ${MOON_SKY}`),
    stdPart(MOON_STD_SPEC, "scrolls", Math.min(MOON_SCROLLS_MAX, state.scrolls * MOON_SCROLL_EACH), `${state.scrolls} / ${MOON_SCROLLS}`),
  ];
}

/** Either revision's parts (null for the original shaft). */
export function ricochetStdParts(state: NinjaState): StdPart[] | null {
  if (state && state.rev === MOON_REV) return moonStdParts(state as MoonState);
  return ninjaStdParts(state);
}

export function moonScore(state: MoonState): number {
  return stdScore(moonStdParts(state) ?? [], Boolean(state.acted));
}

export function moonBandParts(state: MoonState): BandParts {
  const parts = moonStdParts(state) ?? [];
  const core = parts[0]?.points ?? 0;
  const m = ninjaMetres(state);
  return { units: m, points: core, bonus: stdSum(parts) - core, penalty: 0, finished: state.ended === 1, text: `${m} m climbed` };
}

/** Either revision's band parts. */
export function ricochetBandParts(state: NinjaState): BandParts {
  return state.rev === MOON_REV ? moonBandParts(state as MoonState) : ninjaBandParts(state);
}

/* ------------------------------ Checkpoints ------------------------------ */

export const MOON_CHECKPOINT_KEYS = ["tick", "mode", "wall", "x", "y", "best", "hits", "rides", "flow", "scrolls", "checksum"] as const;
export interface MoonCheckpoint {
  tick: number;
  mode: number;
  wall: number;
  x: number;
  y: number;
  best: number;
  hits: number;
  rides: number;
  flow: number;
  scrolls: number;
  checksum: number;
}

export function moonCheckpoint(s: MoonState): MoonCheckpoint {
  const snap = { tick: s.tick, mode: s.mode, wall: s.wall, x: s.x, y: s.y, best: s.best, hits: s.hits, rides: s.rides, flow: s.flow, scrolls: s.scrolls };
  let checksum = 0x811c9dc5;
  for (const v of [...Object.values(snap), s.vy, s.prog, s.hang, s.dj, s.stun, s.safe, s.leaps, s.ledge, s.ride, s.streak, s.slid, s.toX, s.ft]) {
    checksum ^= v | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snap, checksum };
}

export const moonGame: ArcadeGame<MoonState, ArcadeInputEvent | null> = {
  key: "ricochet",
  runTicks: NINJA_RUN_TICKS,
  init: moonInit,
  step: stepMoon,
  isOver: (s) => s.ended !== 0,
  score: moonScore,
  draw: () => {},
  inputRanges: [inputRange(NINJA_INPUT_TAP, [-1, 1])],
};

/** The ninja climb's game for a stamp (rev 2 or 3). */
export function ninjaGameFor(rev: number | null | undefined): ArcadeGame<NinjaState, ArcadeInputEvent | null> {
  return ((rev ?? 0) >= MOON_REV ? moonGame : ninjaGame) as ArcadeGame<NinjaState, ArcadeInputEvent | null>;
}
