/**
 * Apex's effects (the Sports overhaul, stage 2, 15 Nov 2026; display only). Every effect observes the sim's state and
 * never writes to it; each decision is a pure function of the state (so racing.renderer.ts and apex-overhaul-check ask
 * the same question), and the painters draw over the world but under the HUD, never moving a control or a hit area.
 *
 *  - Speed lines at the screen's edges above 200 km/h, stronger with speed (racingSpeedLines).
 *  - The kerb's rumble: the car's view shakes a pixel or two while a wheel runs on the kerb (racingKerbShake); the kerb
 *    haptic and loop are the sound observer's.
 *  - Grass: dust from the wheels while off the tarmac, and the speedo's drop in red (racingDust, racingGrassDrop).
 *  - A corner's sign flashes green when the corner is entered within its speed, red when over (racingCornerEntry).
 *  - A clean sector: its bar on the timing bar flashes as the car crosses into the next sector (racingSectorFlash).
 *  - A wall scrape (against the tyre wall and still moving): sparks off the car's side (racingScrape).
 *  - The finish: the chequered flag, then the lap times and the average speed counting up, during the stage's end hold
 *    (racingFinishHoldMs; timed on a presentation clock, as Orbit's sputter is).
 *
 * Reduced motion: no shake, no particles, no streaks; the sign, sector and finish show still. Reduced effects (a slow
 * phone, the battery saver): a third of the particles and lines. The celebrations switch off: the finish shows still.
 */
import { FX_CELEBRATIONS } from "@/config/betaConfig";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import {
  RACING_CAR_HALF,
  RACING_LAP,
  RACING_LAPS,
  RACING_ROAD_X,
  RACING_SECTOR_LEN,
  RACING_SECTORS,
  RACING_SEG,
  RACING_VMAX,
  RACING_WALL_LIMIT,
  racingCornerAdvice,
  racingGoTick,
  racingKmh,
  racingPace10,
  racingTrackOf,
  type RacingCornerSign,
  type RacingState,
} from "./racing";
import { skinReducedMotion } from "./skins/motion.renderer";

type Ctx2D = CanvasRenderingContext2D;

/** Speed lines start above this (km/h) and are full at RACING_LINES_FULL_KMH. */
export const RACING_LINES_FROM_KMH = 200;
export const RACING_LINES_FULL_KMH = 290;
/** How long a corner's verdict and a clean sector's bar flash (ticks). */
export const RACING_SIGN_FLASH_TICKS = 75;
export const RACING_SECTOR_FLASH_SHARE = 0.06;
/** The finish's hold: the flag, then the count-up, before the reveal (ms). */
export const RACING_FINISH_HOLD_MS = 2400;
export const RACING_FINISH_COUNT_MS = 1100;

let reducedMotionNow: () => boolean = skinReducedMotion;
let reducedEffectsNow: () => boolean = arcadeReducedEffects;
/** Checks only: stand in for the device's reduced motion / reduced effects (null restores them). */
export function setRacingFxModes(modes: { motion: boolean; effects: boolean } | null): void {
  reducedMotionNow = modes ? () => modes.motion : skinReducedMotion;
  reducedEffectsNow = modes ? () => modes.effects : arcadeReducedEffects;
}

/** A tick-seeded hash (display only; no Math.random). */
function h(n: number): number {
  let x = Math.imul(n | 0, 0x9e3779b1) ^ 0x27d4eb2f;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
}

const live = (s: RacingState) => s.tick > racingGoTick(s.rev) && s.finishTick === 0 && s.v > 0;

/** The speed lines' strength, 0 … 1: none at or below 200 km/h, full at 290; none under reduced motion. */
export function racingSpeedLines(s: RacingState): number {
  if (!live(s) || reducedMotionNow()) return 0;
  const kmh = racingKmh(s.v);
  if (kmh <= RACING_LINES_FROM_KMH) return 0;
  return Math.min(1, (kmh - RACING_LINES_FROM_KMH) / (RACING_LINES_FULL_KMH - RACING_LINES_FROM_KMH));
}

/** On the kerb: a wheel past the tarmac's edge, neither on the grass nor against the wall (the sound observer's rule). */
export function racingOnKerb(s: RacingState): boolean {
  return !s.off && !s.wall && Math.abs(s.x) + RACING_CAR_HALF > RACING_ROAD_X;
}

/** The kerb's rumble: the view's offset this tick (a pixel or two), 0 off the kerb or under reduced motion. */
export function racingKerbShake(s: RacingState): { dx: number; dy: number } {
  if (!live(s) || !racingOnKerb(s) || reducedMotionNow()) return { dx: 0, dy: 0 };
  const amp = s.v > RACING_VMAX / 2 ? 2 : 1;
  return { dx: (s.tick % 2 === 0 ? 1 : -1) * (amp - 1), dy: s.tick % 3 === 0 ? -amp : s.tick % 3 === 1 ? amp : 0 };
}

export interface FxParticle {
  /** Offset from the car's centre at its contact line (world px), its size and opacity. */
  x: number;
  y: number;
  r: number;
  a: number;
}

/** Dust thrown from the wheels on the grass (the last 12 ticks' puffs, drifting back and out); none on the tarmac. */
export function racingDust(s: RacingState, carW: number): FxParticle[] {
  if (!live(s) || !s.off || reducedMotionNow()) return [];
  const every = reducedEffectsNow() ? 3 : 1;
  const out: FxParticle[] = [];
  for (let age = 0; age < 12; age += every) {
    const t = s.tick - age;
    for (const side of [-1, 1]) {
      const r0 = h(t * 2 + (side > 0 ? 1 : 0));
      out.push({
        x: side * carW * (0.4 + 0.05 * age + r0 * 0.1),
        y: 4 + age * 2.2 + r0 * 3,
        r: 3 + age * 1.1 + r0 * 2,
        a: 0.42 * (1 - age / 12),
      });
    }
  }
  return out;
}

/** The speedo's drop on the grass: how much slower than when it left the tarmac (km/h), 0 when none to show. */
export function racingGrassDrop(s: RacingState): number {
  if (!s.off || !s.offFrom) return 0;
  return Math.max(0, racingKmh(s.offFrom) - racingKmh(s.v));
}

/** A wall scrape: against the tyre wall and still moving (at least an eighth of top speed); the side (−1 left, 1 right). */
export function racingScrape(s: RacingState): number {
  if (!live(s) || !s.wall || s.v < RACING_VMAX / 8) return 0;
  return s.x > 0 || s.x >= RACING_WALL_LIMIT ? 1 : -1;
}

/** Sparks off the car's side while it scrapes (fanning back from the touching side); none otherwise. */
export function racingSparks(s: RacingState, carW: number): FxParticle[] {
  const side = racingScrape(s);
  if (!side || reducedMotionNow()) return [];
  const n = reducedEffectsNow() ? 4 : 12;
  const out: FxParticle[] = [];
  for (let k = 0; k < n; k++) {
    const r = h(s.tick * 31 + k);
    const r2 = h(s.tick * 17 + k * 7);
    const age = (k % 6) / 6;
    // Thrown out from the touching side and back towards us, longer and fainter as they age.
    out.push({ x: side * (carW * 0.46 + 4 + age * 46 * (0.4 + r)), y: -carW * 0.22 + age * 52 * (0.5 + r2) - r * 10, r: 1.8 + (1 - age) * 2.6, a: 1 - age * 0.7 });
  }
  return out;
}

export interface CornerEntry {
  sign: RacingCornerSign;
  /** The speed at the corner's entry (km/h) and whether it was within the sign's. */
  kmh: number;
  ok: boolean;
  /** Ticks since the entry. */
  age: number;
}

/**
 * The corner just entered and its verdict, judged by the sim's own speed as the car's distance reached the corner's
 * start (observeRacingFx records it per canvas as frames pass it). Null outside a corner's flash.
 */
export function racingCornerEntry(s: RacingState, entryAt: (startS: number) => { v: number; tick: number } | null): CornerEntry | null {
  if (s.tick <= racingGoTick(s.rev) || s.finishTick > 0) return null;
  const track = racingTrackOf(s);
  const lapS = s.s % RACING_LAP;
  for (const sign of racingCornerAdvice(track)) {
    const start = sign.corner.start * RACING_SEG;
    const into = lapS - start;
    if (into < 0 || into > sign.corner.len * RACING_SEG) continue;
    const lapBase = s.s - lapS;
    const seen = entryAt(lapBase + start);
    if (seen === null) return null;
    const kmh = racingKmh(seen.v);
    const age = s.tick - seen.tick;
    if (age < 0 || age > RACING_SIGN_FLASH_TICKS) return null;
    return { sign, kmh, ok: kmh <= sign.kmh, age };
  }
  return null;
}

/** The sector bar flashing: the sector just completed clean, while the car is in the next one's first few metres. */
export function racingSectorFlash(s: RacingState): number | null {
  if (s.sector === 0 || s.sector >= RACING_SECTORS) return null;
  const done = s.sector - 1;
  if (!((s.cleanMask >> done) & 1)) return null;
  const into = s.s - s.sector * RACING_SECTOR_LEN;
  return into >= 0 && into < RACING_SECTOR_LEN * RACING_SECTOR_FLASH_SHARE ? done : null;
}

/* ============================== Per-canvas memory ============================== */

interface FxMemory {
  /** The run's speed by race distance, for the corner verdicts (distance → speed, sampled each frame). */
  seed: number;
  lastS: number;
  lastV: number;
  entries: Map<number, { v: number; tick: number }>;
  /** The tick the first lap was completed (0 until then). */
  lapTick: number;
  finishedAt: number | null;
}
const memories = new WeakMap<object, FxMemory>();
let fxClock: () => number = () => (typeof performance !== "undefined" ? performance.now() : 0);
/** Screenshot and check hook: the clock the finish is timed on (null restores the presentation clock). */
export function setRacingFxClock(clock: (() => number) | null): void {
  fxClock = clock ?? (() => (typeof performance !== "undefined" ? performance.now() : 0));
}

function memoryOf(ctx: object, s: RacingState): FxMemory {
  let m = memories.get(ctx);
  if (!m || m.seed !== s.seed || s.s < m.lastS) {
    m = { seed: s.seed, lastS: s.s, lastV: s.v, entries: new Map(), lapTick: 0, finishedAt: null };
    memories.set(ctx, m);
  }
  return m;
}

/**
 * Records the corners' entry speeds as the run passes them (each frame: a corner start crossed since the last frame
 * takes the speed of whichever side of it is nearer) and answers the speed at a start, null if it wasn't seen.
 */
export function observeRacingFx(
  ctx: object,
  s: RacingState,
): { entryAt: (startS: number) => { v: number; tick: number } | null; finishedMs: number | null; laps: number[] } {
  const m = memoryOf(ctx, s);
  if (s.s > m.lastS) {
    const track = racingTrackOf(s);
    for (const sign of racingCornerAdvice(track)) {
      for (let lap = 0; lap < RACING_LAPS; lap++) {
        const at = lap * RACING_LAP + sign.corner.start * RACING_SEG;
        if (m.lastS < at && s.s >= at && !m.entries.has(at)) m.entries.set(at, { v: at - m.lastS < s.s - at ? m.lastV : s.v, tick: s.tick });
      }
    }
    if (m.lastS < RACING_LAP && s.s >= RACING_LAP && !m.lapTick) m.lapTick = s.tick;
  }
  m.lastS = s.s;
  m.lastV = s.v;
  if (s.finishTick > 0 && m.finishedAt === null) m.finishedAt = fxClock();
  const go = racingGoTick(s.rev);
  const laps = m.lapTick && s.finishTick ? [m.lapTick - go, s.finishTick - m.lapTick] : [];
  return {
    entryAt: (at) => m.entries.get(at) ?? null,
    finishedMs: m.finishedAt === null ? null : fxClock() - m.finishedAt,
    laps,
  };
}

/** The stage's submit hold after a finished race, so the flag and the count-up play before the reveal. */
export function racingFinishHoldMs(s: RacingState): number {
  return s.finishTick > 0 ? RACING_FINISH_HOLD_MS : 0;
}

/* ============================== Painters ============================== */

/** Speed lines: short pale streaks at the left and right edges rushing outwards from the vanishing point. */
export function drawSpeedLines(ctx: Ctx2D, s: RacingState, w: number, horizon: number, bottom: number): void {
  const k = racingSpeedLines(s);
  if (k <= 0) return;
  const n = reducedEffectsNow() ? 6 : 18;
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const r = h(i * 977 + Math.floor(s.tick / 2));
    const phase = ((s.tick * 0.09 + h(i * 13)) % 1 + 1) % 1;
    const y = horizon + 40 + r * (bottom - horizon - 120);
    const edge = side < 0 ? 0 : w;
    // Each streak at the screen's edge (the outer quarter), sliding outwards and fading in with speed.
    const x0 = edge - side * (w * 0.24 * (1 - phase));
    const len = 30 + 56 * k;
    const dy = (y - horizon) / (w / 2);
    ctx.strokeStyle = `rgba(255,244,228,${(0.16 + 0.5 * k) * (1 - phase * 0.5)})`;
    ctx.lineWidth = 1.4 + 1.6 * k;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + side * len, y + dy * len);
    ctx.stroke();
  }
  ctx.restore();
}

/** Particles round the car's contact point (dust: warm brown; sparks: hot gold). */
export function drawParticles(ctx: Ctx2D, cx: number, cy: number, list: readonly FxParticle[], kind: "dust" | "spark"): void {
  if (list.length === 0) return;
  ctx.save();
  for (const p of list) {
    if (kind === "dust") {
      ctx.fillStyle = `rgba(150,122,88,${p.a})`;
      ctx.beginPath();
      ctx.arc(cx + p.x, cy + p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // A hot streak (gold to white at its head), angled along its flight.
      ctx.fillStyle = `rgba(255,${190 + Math.round(50 * p.a)},${90 + Math.round(90 * p.a)},${p.a})`;
      ctx.fillRect(cx + p.x - p.r, cy + p.y - p.r * 0.45, p.r * 3.2, p.r * 0.9);
      ctx.fillStyle = `rgba(255,252,230,${p.a})`;
      ctx.fillRect(cx + p.x - p.r * 0.4, cy + p.y - p.r * 0.3, p.r * 0.9, p.r * 0.6);
    }
  }
  ctx.restore();
}

/** The corner's verdict: its speed sign under the lap chip, ringed green (within) or red (over), pulsing twice. */
export function drawCornerFlash(ctx: Ctx2D, e: CornerEntry, x: number, y: number, font: string): void {
  const still = reducedMotionNow();
  const pulse = still ? 1 : 0.75 + 0.25 * Math.abs(Math.cos((e.age / 18) * Math.PI));
  const fade = e.age > RACING_SIGN_FLASH_TICKS - 15 ? (RACING_SIGN_FLASH_TICKS - e.age) / 15 : 1;
  const r = 24;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.fillStyle = e.ok ? `rgba(46,190,96,${pulse})` : `rgba(226,58,48,${pulse})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F7F5EF";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.76, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#16161B";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 16px ${font}`;
  ctx.fillText(String(e.sign.kmh), x, y + 0.5);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.restore();
}

/**
 * The finish: a chequered flag waving in over the road, then the two lap times and the average speed counting up on a
 * dark panel under it. `ms` since the finish was seen (null: not finished); still under reduced motion or with the
 * celebrations off (the final numbers at once).
 */
export function drawFinish(ctx: Ctx2D, s: RacingState, ms: number | null, w: number, top: number, font: string, laps: readonly number[]): void {
  if (ms === null) return;
  const still = reducedMotionNow() || !FX_CELEBRATIONS;
  const t = still ? RACING_FINISH_HOLD_MS : ms;
  const flagIn = Math.min(1, t / 320);
  const cx = w / 2;
  const fw = 120;
  const fh = 70;
  ctx.save();
  ctx.globalAlpha = flagIn;
  const fy = top + (1 - flagIn) * -30;
  // The pole and the flag in a waving 8 × 5 check.
  ctx.fillStyle = "#2A2830";
  ctx.fillRect(cx - fw / 2 - 4, fy, 3, fh + 18);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 5; j++) {
      const wave = still ? 0 : Math.sin(t / 140 + i * 0.7) * 3;
      ctx.fillStyle = (i + j) % 2 ? "#F4F1EA" : "#141418";
      ctx.fillRect(cx - fw / 2 + (i * fw) / 8, fy + (j * fh) / 5 + wave * (i / 8), fw / 8 + 0.5, fh / 5 + 0.5);
    }
  }
  ctx.restore();
  // The count-up panel.
  const counted = still ? 1 : Math.max(0, Math.min(1, (t - 380) / RACING_FINISH_COUNT_MS));
  if (counted <= 0) return;
  const ease = 1 - Math.pow(1 - counted, 3);
  const py = top + fh + 10;
  ctx.save();
  ctx.fillStyle = "rgba(10,10,14,0.78)";
  ctx.beginPath();
  ctx.roundRect(cx - 130, py, 260, 92, 14);
  ctx.fill();
  ctx.textAlign = "center";
  const lapText = (ticks: number) => `${((ticks * ease) / 60).toFixed(1)} s`;
  const cols = [
    { label: "LAP 1", value: lapText(laps[0] ?? 0) },
    { label: "LAP 2", value: lapText(laps[1] ?? 0) },
    { label: "AVG KM/H", value: ((racingPace10(s) / 10) * ease).toFixed(1) },
  ];
  cols.forEach((c, i) => {
    const x = cx - 86 + i * 86;
    ctx.fillStyle = "#F3F1EC";
    ctx.font = `800 20px ${font}`;
    ctx.fillText(c.value, x, py + 46);
    ctx.fillStyle = "rgba(243,241,236,0.72)";
    ctx.font = `800 10px ${font}`;
    ctx.fillText(c.label, x, py + 66);
  });
  ctx.restore();
}
