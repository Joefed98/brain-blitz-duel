/**
 * Orbit's in-world effects (the Action overhaul, stage 2, 15 Nov 2026; display only, drawn by Orbit's own renderer on the
 * expansion's view, orbitRev 12–16). Each observes the sim (its ticks, counters and fuel) and never writes to it; no glow
 * halos or glare; reduced motion gets the calm version (a still mark, no movement); every motion is over within 900 ms.
 *
 *  - Launch: a thruster puff where the rocket left its orbit (orbit.launch, and the orbit.thrust hiss in flight).
 *  - Low fuel (a quarter of the tank or less, in flight): the gauge pulses red and the flame stutters (orbit.lowFuel
 *    beeps, gameSounds.ts).
 *  - Every catch: a lock ring closing onto the planet with four clamps (orbit.planetCaught's clunk-whirr).
 *  - The respawn's hold (orbitRev 15): a gold arc round the planet draining over the 3 s, then GO (orbit.respawnReady).
 *  - The sun: a bloom of light from the sun, "ALL 40 PLANETS!" and the planets counting up (orbit.sunBloom).
 * The out-of-fuel sputter (cough, fizzle, drift) is in orbit.renderer.ts beside the fuel meter it shares a clock with.
 */
import { ORBIT_TOTAL, type Planet } from "./orbit";
import { ORBIT_GRACE_HOLD_TICKS, orbitTankOf, type OrbitRev3State } from "./orbitRev3";

const FP = 256;
/** A quarter of the 160-tick tank: the low-fuel line on a full-size tank (gameSounds.ts uses the same rule). */
export const ORBIT_LOW_FUEL = 40;
/**
 * The low-fuel line for this run's tank (H5, the polish plan, 20 Nov 2026): a quarter of it, so Easy's 240 warns at 60 and
 * Expert's 120 at 30 (it was 40 on every tank). Display and sound only.
 */
export function orbitLowFuelLine(s: Pick<OrbitRev3State, "tank">): number {
  return Math.trunc(orbitTankOf(s) / 4);
}
/** The launch puff's length, ticks (300 ms). */
export const ORBIT_PUFF_TICKS = 18;
/** The catch lock's length, ms. */
export const ORBIT_LOCK_MS = 520;
/** The GO after a respawn's hold, ticks (500 ms). */
export const ORBIT_GO_TICKS = 30;
/** The sun's bloom and its banner, ms (the count-up inside it 700 ms). */
export const ORBIT_BLOOM_MS = 900;
export const ORBIT_BLOOM_COUNT_MS = 700;
/** A finished run's submit hold (15 Nov 2026, Joe): the bloom, ALL 40 PLANETS! and the count-up show before the reveal. */
export const ORBIT_SUN_HOLD_MS = 1500;

let fxClock: () => number = () => (typeof performance !== "undefined" ? performance.now() : 0);
/** Screenshot and check hook: the clock the catch lock and the sun's bloom are timed on (null restores it). */
export function setOrbitFxClock(clock: (() => number) | null): void {
  fxClock = clock ?? (() => (typeof performance !== "undefined" ? performance.now() : 0));
}

/** In flight with a quarter of the tank or less (the low-fuel warning's moment). */
export function orbitLowFuel(s: Pick<OrbitRev3State, "fuel" | "flying" | "ended" | "tank">): boolean {
  return s.fuel !== undefined && s.flying > 0 && s.ended === 0 && s.fuel <= orbitLowFuelLine(s);
}

/** The low-fuel gauge's red wash (0–1): a 3 Hz pulse on the round tick, a steady wash under reduced motion. */
export function orbitLowFuelWash(tick: number, still: boolean): number {
  return still ? 0.32 : 0.14 + 0.3 * (0.5 + 0.5 * Math.sin((tick * Math.PI * 2) / 20));
}

/** Whether the flame shows this tick on low fuel: a seeded stutter on the round tick (out about one tick in four). */
export function orbitFlameOn(tick: number, low: boolean, still: boolean): boolean {
  if (!low || still) return true;
  const h = Math.imul(tick ^ 0x5bd1e995, 0x27d4eb2f) >>> 0;
  return (h >>> 7) % 4 !== 0;
}

/** The launch puff: a few soft grey puffs where the rocket left its orbit, spreading back and fading in 300 ms. */
export function drawLaunchPuff(ctx: CanvasRenderingContext2D, s: OrbitRev3State, cam: { x: number; y: number }, still: boolean): void {
  const since = s.tick - s.releaseTick;
  if (still || !(since >= 0 && since < ORBIT_PUFF_TICKS) || s.flying <= 0) return;
  const p = since / ORBIT_PUFF_TICKS;
  const len = Math.hypot(s.vx, s.vy) || 1;
  const ux = s.vx / len, uy = s.vy / len;
  const x = s.releaseX / FP - cam.x, y = s.releaseY / FP - cam.y;
  ctx.save();
  for (let k = 0; k < 5; k++) {
    const side = (k - 2) * 0.45;
    const back = 4 + 14 * p * (0.7 + 0.15 * k);
    const px = x - ux * back - uy * side * 9 * p;
    const py = y - uy * back + ux * side * 9 * p;
    ctx.globalAlpha = 0.5 * (1 - p) * (k === 2 ? 1 : 0.75);
    ctx.fillStyle = k % 2 ? "#C9CED8" : "#9AA1AE";
    ctx.beginPath();
    ctx.arc(px, py, 2.2 + 5.5 * p, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

interface LockMemory {
  tick: number;
  captured: number;
  at: number;
  planet: number;
}
const lockMemories = new WeakMap<object, LockMemory>();

/** Remembers the moment of each catch (presentation only); a rewind or a canvas's first frame never fires. */
function observeLock(ctx: object, s: OrbitRev3State): LockMemory {
  let m = lockMemories.get(ctx);
  if (!m || s.tick < m.tick) {
    m = { tick: s.tick, captured: s.captured, at: -Infinity, planet: s.cur };
    lockMemories.set(ctx, m);
    return m;
  }
  if (s.captured > m.captured) {
    m.at = fxClock();
    m.planet = s.cur;
  }
  m.captured = s.captured;
  m.tick = s.tick;
  return m;
}

/**
 * Every catch: a crisp ring closing from wide onto the planet (180 ms), then four clamps snapping in on it and fading
 * (to 520 ms); no glow. Reduced motion: the ring at rest round the planet, fading.
 */
/** The largest radius a ring round planet `p` may take: 4 px inside its orbit path (and never inside the body). */
export function orbitRingLimit(p: Planet, r: number): number {
  const ring = p.ring / FP;
  return ring > 0 ? Math.max(r + 2, ring - 4) : Infinity;
}
export function drawCatchLock(ctx: CanvasRenderingContext2D, s: OrbitRev3State, cam: { x: number; y: number }, colour: string, still: boolean): void {
  const m = observeLock(ctx, s);
  const age = fxClock() - m.at;
  if (!(age >= 0 && age < ORBIT_LOCK_MS)) return;
  const p: Planet | undefined = s.planets[m.planet];
  if (!p) return;
  const x = p.x / FP - cam.x, y = p.y / FP - cam.y, r = p.r / FP;
  const close = still ? 1 : Math.min(1, age / 180);
  const ease = 1 - (1 - close) * (1 - close);
  const fade = age < 300 ? 1 : 1 - (age - 300) / (ORBIT_LOCK_MS - 300);
  // H6 (the polish plan, 20 Nov 2026): never past the planet's orbit path (orbitRev 16's bigger bodies sit 13 px inside it).
  const ringR = Math.min(r + 4 + 16 * (1 - ease), orbitRingLimit(p, r));
  ctx.save();
  ctx.globalAlpha = 0.9 * fade;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, ringR, 0, Math.PI * 2);
  ctx.stroke();
  if (close >= 1) {
    // The clamps: four short white bars at the diagonals, pressing in by 2 px as they lock.
    const press = still ? 0 : Math.min(1, (age - 180) / 90);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const r0 = ringR + 5 - 2 * press;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      ctx.lineTo(x + Math.cos(a) * (r0 + 5), y + Math.sin(a) * (r0 + 5));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The tick each canvas's last respawn hold ended on (presentation only). */
const holdEnds = new WeakMap<object, number>();

/**
 * orbitRev 15's respawn hold: a gold arc round the planet the rocket waits on, draining clockwise over the hold, so the
 * wait reads at a glance beside the "BACK IN n" card; then GO over the planet as the hold ends.
 */
export function drawHoldRing(ctx: CanvasRenderingContext2D, s: OrbitRev3State, cam: { x: number; y: number }, still: boolean): void {
  const p = s.planets[s.cur];
  if (!p || s.ended !== 0) return;
  const x = p.x / FP - cam.x, y = p.y / FP - cam.y, r = p.r / FP;
  const holdR = Math.min(r + 9, orbitRingLimit(p, r));
  const hold = s.hold ?? 0;
  if (hold > 0) holdEnds.set(ctx, s.tick + hold);
  else if ((holdEnds.get(ctx) ?? -1) > s.tick) holdEnds.delete(ctx); // a rewind
  ctx.save();
  if (hold > 0) {
    const left = hold / ORBIT_GRACE_HOLD_TICKS;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, holdR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#F5B82E";
    ctx.beginPath();
    ctx.arc(x, y, holdR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
    ctx.stroke();
  } else {
    // GO: the hold just ended (remembered from the frames that showed it; a checkpoint respawn has no hold).
    const end = holdEnds.get(ctx);
    const since = end !== undefined && s.tick >= end ? s.tick - end : -1;
    if (since >= 0 && since < ORBIT_GO_TICKS) {
      const k = since / ORBIT_GO_TICKS;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = "#F5B82E";
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.font = `800 ${Math.round(still ? 22 : 22 + 6 * k)}px 'Archivo', system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText("GO", x, y - r - 18);
      ctx.fillText("GO", x, y - r - 18);
    }
  }
  ctx.restore();
}

interface BloomMemory {
  tick: number;
  finished: number;
  at: number;
}
const bloomMemories = new WeakMap<object, BloomMemory>();

/** The sun's bloom's age (ms) on this canvas, or null before the sun is reached (or if this canvas opened on it). */
export function orbitBloomAge(ctx: object, s: OrbitRev3State): number | null {
  let m = bloomMemories.get(ctx);
  if (!m || s.tick < m.tick) {
    m = { tick: s.tick, finished: s.finished, at: s.finished ? -Infinity : 0 };
    bloomMemories.set(ctx, m);
  }
  if (s.finished && !m.finished) m.at = fxClock();
  m.finished = s.finished;
  m.tick = s.tick;
  if (!s.finished || !Number.isFinite(m.at)) return null;
  return Math.max(0, fxClock() - m.at);
}

/**
 * The sun reached: a bloom of warm light from the sun across the view (rising in 200 ms, easing back by 900 ms, never
 * over the HUD), then "ALL 40 PLANETS!" with the planets counting up to 40 under it, held. Reduced motion: the banner and
 * 40 at once, no bloom.
 */
export function drawSunBloom(ctx: CanvasRenderingContext2D, s: OrbitRev3State, cam: { x: number; y: number }, W: number, H: number, still: boolean): void {
  const age = orbitBloomAge(ctx, s);
  if (age === null) return;
  const sun = s.planets[ORBIT_TOTAL];
  ctx.save();
  if (!still && sun && age < ORBIT_BLOOM_MS) {
    const rise = Math.min(1, age / 200);
    const fall = age < 200 ? 1 : 1 - (age - 200) / (ORBIT_BLOOM_MS - 200);
    const x = sun.x / FP - cam.x, y = sun.y / FP - cam.y;
    const reach = Math.hypot(W, H) * (0.35 + 0.65 * rise);
    const g = ctx.createRadialGradient(x, y, 0, x, y, reach);
    g.addColorStop(0, `rgba(255,236,190,${(0.55 * fall).toFixed(3)})`);
    g.addColorStop(0.35, `rgba(255,200,110,${(0.22 * fall).toFixed(3)})`);
    g.addColorStop(1, "rgba(255,170,60,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // The banner: a dark card with the words and the count, centred, over the view.
  const count = still ? ORBIT_TOTAL : Math.min(ORBIT_TOTAL, Math.round((ORBIT_TOTAL * Math.min(1, Math.max(0, age - 150) / ORBIT_BLOOM_COUNT_MS))));
  const bw = 280, bh = 96, bx = W / 2 - bw / 2, by = H * 0.4 - bh / 2;
  ctx.globalAlpha = still ? 1 : Math.min(1, age / 150);
  ctx.fillStyle = "rgba(6,8,16,0.82)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(bx, by, bw, bh, 14);
  else ctx.rect(bx, by, bw, bh);
  ctx.fill();
  ctx.strokeStyle = "rgba(245,184,46,0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#F5B82E";
  ctx.font = "800 24px 'Archivo', system-ui, sans-serif";
  ctx.fillText(`ALL ${ORBIT_TOTAL} PLANETS!`, W / 2, by + 32);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 26px 'Archivo', system-ui, sans-serif";
  ctx.fillText(`${count} / ${ORBIT_TOTAL}`, W / 2, by + 68);
  ctx.restore();
}
