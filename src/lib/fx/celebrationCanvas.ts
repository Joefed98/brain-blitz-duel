/**
 * The celebrations' one shared canvas scene (Prompt P, 23 Oct 2026; display only;
 * src/lib/fx/celebrations.ts). Sparks, the hero's run, the podium hero and the GO strike, drawn
 * into one full-screen 2D context by CelebrationLayer. Everything is pooled and preallocated:
 * sparks live in one Float32Array of CELEBRATION_PARTICLES slots, the strike's bolt in another,
 * the hero in one reused pose, so a frame allocates nothing.
 */
import { drawHero, heroPose, heroRunPose, heroVictoryPose } from "@/lib/arcade/hero.renderer";

import {
  CELEBRATION_PARTICLES,
  HERO_RUN_MS,
  PODIUM_HERO_BOB_MS,
  STRIKE_IN_MS,
  STRIKE_MS,
} from "./celebrations";

/** The gold gradient the sparks run through as they burn out. */
export const SPARK_GOLD = ["#FFE08A", "#F7BF2F", "#C98A0E"] as const;

/** x, y, vx, vy (px, px/s), born, life (ms), size, scope. */
const F = 8;
const GRAVITY = 420;

const BOLT_MAIN = 33;
const BOLT_BRANCH = 9;
const BRANCHES = 2;

/** The hero's height (px) when running and on the podium. */
export const HERO_RUN_H = 58;
export const PODIUM_HERO_H = 46;

export interface SceneBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class CelebrationScene {
  readonly sparks = new Float32Array(CELEBRATION_PARTICLES * F);
  live = 0;
  private cursor = 0;
  private readonly pose = heroPose();

  run: { scope: number; at: number } | null = null;
  podium: { scope: number; at: number; calm: boolean; box: SceneBox } | null = null;
  strikeAt = -1;
  private readonly bolt = new Float32Array((BOLT_MAIN + BRANCHES * BOLT_BRANCH) * 2);

  /** A seeded stream for spark spread and the bolt's shape (presentation only). */
  private seed = 0x51f3;
  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Sparks from a point (or a row `w` wide), up and out, with slight gravity. */
  burst(scope: number, x: number, y: number, w: number, count: number, now: number): void {
    for (let i = 0; i < count; i++) {
      // Reuse a dead slot first, else the oldest (round robin): never more than the cap.
      let slot = -1;
      for (let k = 0; k < CELEBRATION_PARTICLES; k++) {
        const s = (this.cursor + k) % CELEBRATION_PARTICLES;
        const o = s * F;
        if (this.sparks[o + 5]! <= 0 || now - this.sparks[o + 4]! >= this.sparks[o + 5]!) {
          slot = s;
          break;
        }
      }
      if (slot < 0) slot = this.cursor;
      this.cursor = (slot + 1) % CELEBRATION_PARTICLES;
      const o = slot * F;
      const angle = -Math.PI / 2 + (this.rand() - 0.5) * (w > 0 ? 1.6 : Math.PI * 1.9);
      const speed = 120 + this.rand() * 260;
      this.sparks[o] = x + (w > 0 ? (this.rand() - 0.5) * w : 0);
      this.sparks[o + 1] = y;
      this.sparks[o + 2] = Math.cos(angle) * speed;
      this.sparks[o + 3] = Math.sin(angle) * speed;
      this.sparks[o + 4] = now;
      this.sparks[o + 5] = 480 + this.rand() * 420;
      this.sparks[o + 6] = 1.6 + this.rand() * 2.2;
      this.sparks[o + 7] = scope;
    }
  }

  heroRun(scope: number, now: number): void {
    this.run = { scope, at: now };
  }

  podiumHero(scope: number, box: SceneBox, calm: boolean, now: number): void {
    this.podium = { scope, at: now, calm, box };
  }

  /** One branching bolt from near the top to the lower part of the screen. */
  strike(width: number, height: number, now: number): void {
    this.strikeAt = now;
    const b = this.bolt;
    const x0 = width * (0.3 + this.rand() * 0.4);
    const x1 = width * (0.25 + this.rand() * 0.5);
    const y0 = -4;
    const y1 = height * (0.62 + this.rand() * 0.12);
    // Midpoint displacement into BOLT_MAIN points.
    b[0] = x0;
    b[1] = y0;
    b[(BOLT_MAIN - 1) * 2] = x1;
    b[(BOLT_MAIN - 1) * 2 + 1] = y1;
    let step = BOLT_MAIN - 1;
    let jitter = width * 0.16;
    while (step > 1) {
      const half = step / 2;
      for (let i = half; i < BOLT_MAIN; i += step) {
        const a = (i - half) * 2;
        const c = (i + half) * 2;
        b[i * 2] = (b[a]! + b[c]!) / 2 + (this.rand() - 0.5) * jitter;
        b[i * 2 + 1] = (b[a + 1]! + b[c + 1]!) / 2 + (this.rand() - 0.5) * jitter * 0.25;
      }
      step = half;
      jitter *= 0.55;
    }
    // Two short forks off the main bolt, angled away and down.
    for (let k = 0; k < BRANCHES; k++) {
      const from = 9 + k * 10 + Math.floor(this.rand() * 4);
      const base = (BOLT_MAIN + k * BOLT_BRANCH) * 2;
      let x = b[from * 2]!;
      let y = b[from * 2 + 1]!;
      const dir = k === 0 ? -1 : 1;
      for (let i = 0; i < BOLT_BRANCH; i++) {
        b[base + i * 2] = x;
        b[base + i * 2 + 1] = y;
        x += dir * (8 + this.rand() * 12);
        y += 10 + this.rand() * 14;
      }
    }
  }

  /** The hero's box: its joints, the cape's reach and the outline round them. */
  private markHero(): void {
    const p = this.pose;
    const pad = p.headR * 3;
    this.mark(
      Math.min(p.headX, p.handAX, p.handBX, p.footAX, p.footBX, p.shoulderX) - pad,
      Math.min(p.headY, p.handAY, p.handBY) - pad,
      Math.max(p.headX, p.handAX, p.handBX, p.footAX, p.footBX, p.shoulderX) + pad,
      Math.max(p.footAY, p.footBY) + pad,
    );
  }

  clear(scope: number): void {
    for (let s = 0; s < CELEBRATION_PARTICLES; s++) {
      if (this.sparks[s * F + 7] === scope) this.sparks[s * F + 5] = 0;
    }
    if (this.run?.scope === scope) this.run = null;
    if (this.podium?.scope === scope) this.podium = null;
  }

  clearAll(): void {
    this.sparks.fill(0);
    this.run = null;
    this.podium = null;
    this.strikeAt = -1;
  }

  /** Is anything still moving (worth another frame)? */
  animating(now: number): boolean {
    if (this.live > 0) return true;
    if (this.run && now - this.run.at < HERO_RUN_MS) return true;
    if (this.strikeAt >= 0 && now - this.strikeAt < STRIKE_MS) return true;
    if (this.podium && !this.podium.calm && now - this.podium.at < PODIUM_HERO_BOB_MS) return true;
    return false;
  }

  /** Draws one frame in CSS px (the caller set the device-pixel transform and cleared). */
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, bottomInset: number, now: number): void {
    this.dirtyL = Infinity;
    this.dirtyT = Infinity;
    this.dirtyR = -Infinity;
    this.dirtyB = -Infinity;
    this.drawStrike(ctx, width, height, now);
    this.drawPodium(ctx, now);
    this.drawRun(ctx, width, height, bottomInset, now);
    this.drawSparks(ctx, now);
  }

  /**
   * The box drawn into this frame (CSS px), so the layer clears only that next frame instead of the
   * whole screen; empty (left > right) when nothing was drawn.
   */
  dirtyL = Infinity;
  dirtyT = Infinity;
  dirtyR = -Infinity;
  dirtyB = -Infinity;
  private mark(l: number, t: number, r: number, b: number): void {
    if (l < this.dirtyL) this.dirtyL = l;
    if (t < this.dirtyT) this.dirtyT = t;
    if (r > this.dirtyR) this.dirtyR = r;
    if (b > this.dirtyB) this.dirtyB = b;
  }

  private drawSparks(ctx: CanvasRenderingContext2D, now: number): void {
    let live = 0;
    const p = this.sparks;
    for (let band = 0; band < SPARK_GOLD.length; band++) {
      ctx.fillStyle = SPARK_GOLD[band]!;
      ctx.beginPath();
      for (let s = 0; s < CELEBRATION_PARTICLES; s++) {
        const o = s * F;
        const life = p[o + 5]!;
        if (life <= 0) continue;
        const age = now - p[o + 4]!;
        if (age >= life || age < 0) {
          if (age >= life) p[o + 5] = 0;
          continue;
        }
        const k = age / life;
        // Light gold first, then gold, then deep gold as it burns out.
        if (Math.min(SPARK_GOLD.length - 1, Math.floor(k * SPARK_GOLD.length)) !== band) continue;
        const t = age / 1000;
        const x = p[o]! + p[o + 2]! * t * (1 - k * 0.35);
        const y = p[o + 1]! + p[o + 3]! * t * (1 - k * 0.35) + 0.5 * GRAVITY * t * t;
        const size = p[o + 6]! * (1 - k * 0.6);
        ctx.rect(x - size / 2, y - size / 2, size, size);
        this.mark(x - size, y - size, x + size, y + size);
      }
      ctx.fill();
    }
    // Count every live spark (each sits in exactly one band).
    for (let s = 0; s < CELEBRATION_PARTICLES; s++) {
      const o = s * F;
      if (p[o + 5]! > 0 && now - p[o + 4]! < p[o + 5]!) live++;
    }
    this.live = live;
  }

  private drawRun(ctx: CanvasRenderingContext2D, width: number, height: number, bottomInset: number, now: number): void {
    if (!this.run) return;
    const age = now - this.run.at;
    if (age >= HERO_RUN_MS || age < 0) {
      if (age >= HERO_RUN_MS) this.run = null;
      return;
    }
    const k = age / HERO_RUN_MS;
    const x = -40 + (width + 80) * k;
    const footY = height - bottomInset - 18;
    heroRunPose(this.pose, x, footY, HERO_RUN_H, age / 400);
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.min(age, HERO_RUN_MS - age) / 120);
    drawHero(ctx, this.pose);
    this.markHero();
    ctx.restore();
  }

  private drawPodium(ctx: CanvasRenderingContext2D, now: number): void {
    const podium = this.podium;
    if (!podium) return;
    const age = now - podium.at;
    if (age < 0) return;
    const box = podium.box;
    // On the floor at the gold step's front right corner, beside the winner: below the winner's name
    // and total, clear of the step's "1" (centred at its top).
    const cx = box.left + box.width - 17;
    const footY = box.top + box.height - 3;
    const t = Math.min(age, PODIUM_HERO_BOB_MS);
    heroVictoryPose(this.pose, cx, footY, PODIUM_HERO_H, t, podium.calm);
    ctx.save();
    ctx.globalAlpha = Math.min(1, age / (podium.calm ? 300 : 180));
    drawHero(ctx, this.pose);
    this.markHero();
    ctx.restore();
  }

  private drawStrike(ctx: CanvasRenderingContext2D, width: number, height: number, now: number): void {
    if (this.strikeAt < 0) return;
    const age = now - this.strikeAt;
    if (age >= STRIKE_MS || age < 0) {
      if (age >= STRIKE_MS) this.strikeAt = -1;
      return;
    }
    const alpha = age < STRIKE_IN_MS ? age / STRIKE_IN_MS : Math.max(0, 1 - (age - STRIKE_IN_MS) / (STRIKE_MS - STRIKE_IN_MS)) ** 1.6;
    const b = this.bolt;
    ctx.save();
    // A soft warm brightening of the whole screen, never white and never strong.
    ctx.globalAlpha = alpha * 0.1;
    ctx.fillStyle = "#FFE08A";
    ctx.fillRect(0, 0, width, height);
    this.mark(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = alpha * (pass === 0 ? 0.4 : 1);
      ctx.strokeStyle = pass === 0 ? "#F7BF2F" : "#FFFBEA";
      ctx.lineWidth = pass === 0 ? 7 : 2;
      ctx.beginPath();
      ctx.moveTo(b[0]!, b[1]!);
      for (let i = 1; i < BOLT_MAIN; i++) ctx.lineTo(b[i * 2]!, b[i * 2 + 1]!);
      ctx.stroke();
      ctx.lineWidth = pass === 0 ? 4 : 1.2;
      ctx.beginPath();
      for (let k = 0; k < BRANCHES; k++) {
        const base = (BOLT_MAIN + k * BOLT_BRANCH) * 2;
        ctx.moveTo(b[base]!, b[base + 1]!);
        for (let i = 1; i < BOLT_BRANCH; i++) ctx.lineTo(b[base + i * 2]!, b[base + i * 2 + 1]!);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
