/**
 * Grappler's stage-2 effects (the Action overhaul, 15 Nov 2026; display only, the jungle, swingRev 17+): each is drawn
 * from the sim moment it observes and never writes the state. A physical moment lasts at most 900 ms and never holds an
 * input back. No glowing edges and no glare; reduced motion and reduced effects get the calm versions.
 *  - The grab: the vine flexes as it takes the weight (a damped bow, 0 after GRAB_FLEX_TICKS), from the state's grabTick.
 *  - The release: a faint speed streak behind the hero while flying fast enough to light a gate.
 *  - The streak meter: an arc of eight segments under the HUD's STREAK, one lit per clean grab of the block of eight;
 *    the eighth bursts (gold sparks round the arc, STREAK_BURST_TICKS) as the block pays.
 *  - The pterodactyl's shadow sweeping across the canopy as it starts the chase, before its screech (PTERO_SHADOW_TICKS).
 *  - The end: "COURSE CLEARED!" (or "TIME") with the stretches cleared tallying up (swingEndTally; the stage holds its
 *    submit SWING_END_HOLD_MS so it is seen).
 * The out-of-reach tint is drawn by drawJungleGrabPoints from swingPress.ts.
 */
import { SWING_V15_GATE_SPEED, SWING_V17_STREAK_BLOCK, swingAssaultCounts, swingStreakNow, type SwingState } from "./swing";
import { ARCADE_FX_DISPLAY_FONT } from "./arcadeFx.renderer";

const FP = 256;

/** The grab's flex (ticks) and its largest bow (px, at the vine's middle). */
export const GRAB_FLEX_TICKS = 18;
export const GRAB_FLEX_PX = 7;
/** The vine's bow (px, perpendicular at its middle) `age` ticks after a grab: a damped swing, 0 from GRAB_FLEX_TICKS. */
export function swingGrabFlex(age: number, still: boolean): number {
  if (still || age < 0 || age >= GRAB_FLEX_TICKS) return 0;
  return GRAB_FLEX_PX * Math.exp(-age / 6) * Math.sin(((age + 2) / GRAB_FLEX_TICKS) * Math.PI * 2.2);
}

/** The flying hero's speed (px a tick) and whether it is fast enough to light a gate (rev 15+'s 3.5 px a tick). */
export function swingFastFlight(s: SwingState): boolean {
  return s.rope < 0 && s.ended === 0 && (s.ledgeOn ?? -1) < 0 && (s.respawn ?? 0) === 0 && Math.hypot(s.vx, s.vy) >= SWING_V15_GATE_SPEED * FP;
}

/** Three faint lines trailing behind the hero (the body's centre at fx, fy; `k` its drawing scale). */
export function drawSpeedStreak(ctx: CanvasRenderingContext2D, s: SwingState, fx: number, fy: number, k: number, still: boolean, lite: boolean): void {
  if (still || lite || !swingFastFlight(s)) return;
  const v = Math.hypot(s.vx, s.vy);
  const ux = s.vx / v;
  const uy = s.vy / v;
  const len = Math.min(46, (v / FP) * 5) * k;
  ctx.save();
  ctx.lineCap = "round";
  for (const [off, a] of [[-6, 0.18], [0, 0.28], [6, 0.18]] as const) {
    const ox = -uy * off * k;
    const oy = ux * off * k;
    const x0 = fx - ux * 12 * k + ox;
    const y0 = fy - uy * 12 * k + oy;
    const g = ctx.createLinearGradient(x0, y0, x0 - ux * len, y0 - uy * len);
    g.addColorStop(0, `rgba(240,255,220,${a})`);
    g.addColorStop(1, "rgba(240,255,220,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.6 * k;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 - ux * len, y0 - uy * len);
    ctx.stroke();
  }
  ctx.restore();
}

/** The streak meter's burst (ticks after the eighth grab of a block). */
export const STREAK_BURST_TICKS = 40;
/** Lit segments (0–8) and the burst's age (ticks, or -1) for a state. */
export function swingStreakMeter(s: SwingState): { lit: number; burst: number } {
  const now = swingStreakNow(s);
  const age = s.tick - (s.streakAt ?? 0);
  // The burst follows the grab that completed the block (a landing also restarts the stall count but pays nothing).
  if (now > 0 && now % SWING_V17_STREAK_BLOCK === 0 && s.streakAt === s.grabTick && age >= 0 && age < STREAK_BURST_TICKS) return { lit: SWING_V17_STREAK_BLOCK, burst: age };
  return { lit: now % SWING_V17_STREAK_BLOCK, burst: -1 };
}

/** The meter: an arc (opening down) of eight segments centred at (cx, cy), radius r; gold lit, the burst's sparks. */
export function drawStreakMeter(ctx: CanvasRenderingContext2D, s: SwingState, cx: number, cy: number, r: number, still: boolean, lite: boolean): void {
  const { lit, burst } = swingStreakMeter(s);
  const n = SWING_V17_STREAK_BLOCK;
  const a0 = Math.PI * 1.08;
  const a1 = Math.PI * 1.92;
  const step = (a1 - a0) / n;
  ctx.save();
  ctx.lineCap = "round";
  // The backing: a dark band under the segments.
  ctx.strokeStyle = "rgba(10,12,18,0.82)";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0 - 0.06, a1 + 0.06);
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const on = i < lit;
    ctx.strokeStyle = on ? (burst >= 0 && !still ? "#FFF2B8" : "#F2C75C") : "rgba(255,255,255,0.22)";
    ctx.lineWidth = on ? 5 : 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0 + i * step + 0.05, a0 + (i + 1) * step - 0.05);
    ctx.stroke();
  }
  // The burst: gold sparks flying out from the arc, fading (none under reduced motion or effects: the arc stays lit).
  if (burst >= 0 && !still && !lite) {
    const p = burst / STREAK_BURST_TICKS;
    for (let i = 0; i < 10; i++) {
      const a = a0 + ((i + 0.5) / 10) * (a1 - a0);
      const d = r + 4 + p * 18;
      ctx.fillStyle = `rgba(242,199,92,${(1 - p).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.8 * (1 - p * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The pterodactyl's shadow (ticks it takes to cross). */
export const PTERO_SHADOW_TICKS = 72;
/** Ticks since the chase started (the stretch `chaseFrom` reached), or -1 before it or on an older stamp. */
export function swingChaseAge(s: SwingState): number {
  const from = s.chaseFrom ?? -1;
  if (!s.slide || from <= 0 || (s.chaseX ?? 0) === 0) return -1;
  const at = s.secTicks?.[from - 1] ?? 0;
  return at > 0 ? s.tick - at : -1;
}

/** The shadow sweeping left to right across the world over PTERO_SHADOW_TICKS (none with reduced motion). */
export function drawPteroShadow(ctx: CanvasRenderingContext2D, s: SwingState, W: number, H: number, still: boolean): void {
  const age = swingChaseAge(s);
  if (still || age < 0 || age >= PTERO_SHADOW_TICKS) return;
  const p = age / PTERO_SHADOW_TICKS;
  const x = -120 + p * (W + 240);
  const y = H * 0.32 + Math.sin(p * Math.PI) * 30;
  const a = 0.4 * Math.sin(p * Math.PI);
  const flap = Math.sin(age * 0.35);
  ctx.save();
  ctx.fillStyle = `rgba(2,8,6,${a.toFixed(3)})`;
  ctx.translate(x, y);
  ctx.scale(2.4, 2.4);
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 6, 0, 0, Math.PI * 2);
  for (const side of [-1, 1] as const) {
    ctx.moveTo(-8, 0);
    ctx.lineTo(-22, side * (20 + flap * 10));
    ctx.quadraticCurveTo(-2, side * (12 + flap * 6), 12, 0);
  }
  ctx.moveTo(14, -3);
  ctx.lineTo(40, 0);
  ctx.lineTo(14, 3);
  ctx.fill();
  ctx.restore();
}

/* ---- The end ---- */

/** How long the stage holds its submit after the run ends (the banner and the tally). */
export const SWING_END_HOLD_MS = 1600;
/** The tally's length (ms) and the banner's fade in. */
export const SWING_TALLY_MS = 1100;
let endSeen: { course: unknown; at: number } | null = null;
const realNow = () => (typeof performance === "undefined" ? 0 : performance.now());

/** When (wall clock, ms) this run's end was first seen: the renderer and the sound observer share it. */
export function swingEndAt(s: SwingState): number {
  if (s.ended === 0) return -1;
  if (!endSeen || endSeen.course !== s.ceil) endSeen = { course: s.ceil, at: realNow() };
  return endSeen.at;
}

/** The stretches tallied `ms` after the end (0 up to the cleared count over SWING_TALLY_MS; at once when still). */
export function swingEndTally(s: SwingState, ms: number, still: boolean): number {
  const cleared = swingAssaultCounts(s).sections;
  if (still) return cleared;
  const p = Math.max(0, Math.min(1, ms / SWING_TALLY_MS));
  return Math.round(cleared * (1 - (1 - p) * (1 - p)));
}

/** The end banner over the world (W wide): "COURSE CLEARED!" or "TIME", and the stretches counting up. */
export function drawSwingEnd(ctx: CanvasRenderingContext2D, s: SwingState, W: number, H: number, still: boolean): void {
  const at = swingEndAt(s);
  if (at < 0 || !s.sections) return;
  const ms = realNow() - at;
  const c = swingAssaultCounts(s);
  const cleared = c.sections >= c.sectionTotal;
  const n = swingEndTally(s, ms, still);
  const fade = still ? 1 : Math.min(1, ms / 250);
  const cy = H * 0.36;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = "rgba(6,12,10,0.78)";
  ctx.beginPath();
  ctx.roundRect(W / 2 - 170, cy - 48, 340, 104, 18);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.fillStyle = cleared ? "#F2C75C" : "#F5F5F7";
  ctx.font = `900 34px ${ARCADE_FX_DISPLAY_FONT}`;
  ctx.fillText(cleared ? "COURSE CLEARED!" : "TIME", W / 2, cy - 4);
  ctx.fillStyle = "#F5F5F7";
  ctx.font = `800 22px ${ARCADE_FX_DISPLAY_FONT}`;
  ctx.fillText(`${n} / ${c.sectionTotal} stretches`, W / 2, cy + 34);
  ctx.restore();
}
