/**
 * The Cards & Board overhaul's in-game effects, stage 2 (15 Nov 2026; display only, never imported by a sim or the
 * server). Inside a canvas game the effects are the game's own renderer's (the effects kit, src/lib/fx/kit.ts, serves
 * DOM pieces and result screens; docs/design/game-fx/README.md), so the five games share this small timeline instead:
 *
 *  - `FxTimeline`: one-shot animations on the wall clock, started when a renderer notices the sim's state change (a
 *    pair taken, a hand made, a refused move) and read back each frame as a 0–1 progress. It lives on the live stage's
 *    view, so reveals, replays and the intro's still draw no effect.
 *  - Reduced motion: nothing starts (`FxTimeline.start` returns false); the state change itself is always drawn, as the
 *    kit's reduced variant does. The board's own pieces carry the effects (never a control or the arena).
 *  - Small painters: a decaying shake, a spark burst, a stamped label, a gold outline.
 */
import { reducedMotion } from "../art.renderer";
import { CARD_FONT, CARD_GOLD, roundRect } from "./cards.renderer";

interface Run {
  t0: number;
  ms: number;
  data: unknown;
}

const clock = (): number => (typeof performance !== "undefined" ? performance.now() : 0);

/** One-shot animations keyed by name, on the wall clock. */
export class FxTimeline {
  private runs = new Map<string, Run>();
  /** Set false to draw no effects (the stage's checks can; reduced motion is read on each start). */
  enabled = true;
  /** The clock (tests pass their own). */
  now: () => number = clock;

  /** Starts (or restarts) an effect; false (nothing started) under reduced motion or when disabled. */
  start(key: string, ms: number, data: unknown = null, delayMs = 0): boolean {
    if (!this.enabled || reducedMotion()) return false;
    this.runs.set(key, { t0: this.now() + delayMs, ms, data });
    return true;
  }

  /** The effect's progress 0–1 and its data while it runs (null before its delay, after its end, or never started). */
  at<T = unknown>(key: string): { k: number; data: T } | null {
    const r = this.runs.get(key);
    if (!r) return null;
    const age = this.now() - r.t0;
    if (age < 0) return null;
    if (age >= r.ms) {
      this.runs.delete(key);
      return null;
    }
    return { k: age / r.ms, data: r.data as T };
  }

  /** Every running effect whose key starts with `prefix` (for effects with one run per piece). */
  each<T = unknown>(prefix: string): { key: string; k: number; data: T }[] {
    const out: { key: string; k: number; data: T }[] = [];
    for (const key of [...this.runs.keys()]) {
      if (!key.startsWith(prefix)) continue;
      const a = this.at<T>(key);
      if (a) out.push({ key, ...a });
    }
    return out;
  }

  /** Whether anything is still running (the stage keeps drawing while it is). */
  busy(): boolean {
    const now = this.now();
    for (const r of this.runs.values()) if (now - r.t0 < r.ms) return true;
    return false;
  }

  clear(): void {
    this.runs.clear();
  }
}

export const easeOut = (k: number): number => 1 - Math.pow(1 - k, 3);
export const easeInOut = (k: number): number => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** A decaying side-to-side shake, in world units (three swings, gone at k = 1). */
export function shakeX(k: number, amp = 4): number {
  return amp * Math.sin(k * Math.PI * 6) * (1 - k);
}

/** A spark burst round (x, y): `n` short rays on fixed angles, growing out and fading with k. */
export function drawSparks(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, radius = 26, n = 10, colour = CARD_GOLD): void {
  if (k <= 0 || k >= 1) return;
  const e = easeOut(k);
  ctx.save();
  ctx.globalAlpha = 1 - k;
  ctx.strokeStyle = colour;
  ctx.lineCap = "round";
  ctx.lineWidth = 2.2 * (1 - k * 0.6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const r0 = radius * 0.35 + radius * 0.45 * e;
    const r1 = r0 + radius * 0.35 * (1 - k);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

/** A label stamped down: large and faint at k = 0, landing at full size by k = 0.35, then holding and fading. */
export function drawStamp(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, k: number, size = 22, colour = "#FFE7A3", scaleFrom = 1.8): void {
  if (k <= 0 || k >= 1) return;
  const land = Math.min(1, k / 0.35);
  const s = scaleFrom - (scaleFrom - 1) * easeOut(land);
  const alpha = k < 0.35 ? land : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  ctx.font = `900 ${size}px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, size * 0.16);
  ctx.strokeStyle = "rgba(10,14,28,0.92)";
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = colour;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** A gold outline round a box, fading with k. */
export function drawOutline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha: number, r = 6, colour = "255,214,110"): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.shadowColor = `rgba(${colour},${Math.min(1, alpha)})`;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = `rgba(${colour},${Math.min(1, alpha)})`;
  ctx.lineWidth = 2.5;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}

/** A point along a short upward arc from a to b at k (the arc's height grows with the distance). */
export function arcPoint(ax: number, ay: number, bx: number, by: number, k: number, lift = 0.25): { x: number; y: number } {
  const e = easeInOut(k);
  const d = Math.hypot(bx - ax, by - ay);
  return { x: ax + (bx - ax) * e, y: ay + (by - ay) * e - Math.sin(Math.PI * e) * d * lift };
}
