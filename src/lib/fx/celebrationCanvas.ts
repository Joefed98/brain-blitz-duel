/**
 * The celebrations' one shared canvas scene (Prompt P, 23 Oct 2026; display only;
 * src/lib/fx/celebrations.ts). Sparks, the hero's run, the podium hero and the GO strike, drawn
 * into one full-screen 2D context by CelebrationLayer. Everything is pooled and preallocated:
 * sparks live in one Float32Array of CELEBRATION_PARTICLES slots, the strike's bolt in another,
 * the hero in one reused pose, so a frame allocates nothing.
 */
import { HERO_VICTORY_LOOP_MS, drawHero, heroDancePose, heroPose, heroRunPose, heroVictoryPose } from "@/lib/arcade/hero.renderer";

import {
  CELEBRATION_PARTICLES,
  HERO_DANCE_MS,
  HERO_GRAND_MS,
  HERO_RUN_MS,
  HERO_STILL_MS,
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

/** The 200 lap's fireworks: when each bursts (ms into the lap) and where (fractions of the screen's width and height). */
export const FIREWORK_AT = new Float32Array([150, 600, 1050, 1500, 1950, 2400]);
const FIREWORK_X = new Float32Array([0.25, 0.75, 0.5, 0.2, 0.8, 0.5]);
const FIREWORK_Y = new Float32Array([0.22, 0.17, 0.3, 0.38, 0.33, 0.14]);
/** Sparks per firework (the pool's cap still holds: older sparks are reused first). */
export const FIREWORK_SPARKS = 30;
/** The 190–199 dance: on (ms), dance, off over the last HERO_DANCE_OFF_MS. */
export const HERO_DANCE_ON_MS = 300;
export const HERO_DANCE_OFF_MS = 350;
/** The 200 lap's legs (ms): the run right, the leap back left, the dance, then off to the right. */
export const GRAND_RUN_END = 1000;
export const GRAND_LEAP_END = 1700;
export const GRAND_DANCE_END = 2300;

/** The hero's height (px) when running and on the podium. */
export const HERO_RUN_H = 58;
/** On the podium (Polish batch R, 25 Oct 2026): larger, standing on the top step. */
export const PODIUM_HERO_H = 60;
/** The podium hero's loop, pre-drawn once into a strip of this many frames (then one drawImage a frame). */
export const PODIUM_HERO_FRAMES = 24;

/** A canvas to pre-draw into (the layer passes a DOM one); without it the hero is drawn as vectors each frame. */
export type SpriteCanvas = { width: number; height: number; getContext(id: "2d"): unknown };
/** The sprite's box round the pose's foot point, in multiples of the hero's height. */
const SPRITE_LEFT = 1.3;
const SPRITE_RIGHT = 1.0;
const SPRITE_TOP = 1.25;
const SPRITE_BOTTOM = 0.2;

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
  /** The layer's canvas factory and device pixel ratio, for the podium hero's sprite strip. */
  makeCanvas: ((width: number, height: number) => SpriteCanvas) | null = null;
  spriteRatio = 1;
  private sprite: { canvas: SpriteCanvas; ratio: number; calm: boolean } | null = null;
  podium: { scope: number; at: number; calm: boolean; box: SceneBox } | null = null;
  strikeAt = -1;
  /** The reveal's hero moment (dance or the 200 lap; `calm`: reduced motion's still hero and glow). */
  show: { scope: number; at: number; kind: "dance" | "grand"; calm: boolean; fired: number } | null = null;
  /** Fireworks burst so far, across every lap (the layer plays a crackle for each new one). */
  fireworks = 0;
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

  heroShow(scope: number, kind: "dance" | "grand", calm: boolean, now: number): void {
    this.show = { scope, at: now, kind, calm, fired: 0 };
  }

  /** How long a hero moment lasts. */
  showMs(show: { kind: "dance" | "grand"; calm: boolean }): number {
    return show.calm ? HERO_STILL_MS : show.kind === "grand" ? HERO_GRAND_MS : HERO_DANCE_MS;
  }

  /** A tap skipped the reveal's moment: its hero, run and sparks go now (a podium's hero stays). */
  skip(scope: number): void {
    for (let s = 0; s < CELEBRATION_PARTICLES; s++) {
      if (this.sparks[s * F + 7] === scope) this.sparks[s * F + 5] = 0;
    }
    if (this.run?.scope === scope) this.run = null;
    if (this.show?.scope === scope) this.show = null;
  }

  podiumHero(scope: number, box: SceneBox, calm: boolean, now: number): void {
    this.podium = { scope, at: now, calm, box };
  }

  /** The victory loop pre-drawn into one strip (once per ratio and calm), foot point at a fixed place in each frame. */
  private podiumSprite(calm: boolean): SpriteCanvas | null {
    if (!this.makeCanvas) return null;
    const ratio = this.spriteRatio;
    if (this.sprite && this.sprite.ratio === ratio && this.sprite.calm === calm) return this.sprite.canvas;
    const h = PODIUM_HERO_H;
    const fw = Math.ceil((SPRITE_LEFT + SPRITE_RIGHT) * h * ratio);
    const fh = Math.ceil((SPRITE_TOP + SPRITE_BOTTOM) * h * ratio);
    const frames = calm ? 1 : PODIUM_HERO_FRAMES;
    const canvas = this.makeCanvas(fw * frames, fh);
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return null;
    const pose = heroPose();
    for (let i = 0; i < frames; i++) {
      heroVictoryPose(pose, SPRITE_LEFT * h, SPRITE_TOP * h, h, (i / frames) * HERO_VICTORY_LOOP_MS, calm);
      // Each frame's cape at its own angle (no easing between pre-drawn frames).
      pose.capeAt = -1;
      ctx.setTransform(ratio, 0, 0, ratio, i * fw, 0);
      drawHero(ctx, pose);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.sprite = { canvas, ratio, calm };
    return canvas;
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

  /**
   * The hero's box: its joints, the cape's reach and the outline round them (`mirrorX`: drawn mirrored
   * about it). The cape hangs about 5 head radii from the shoulders, so the pad covers it trailing.
   */
  private markHero(mirrorX = NaN): void {
    const p = this.pose;
    const pad = p.headR * 5.5;
    const l = Math.min(p.headX, p.handAX, p.handBX, p.footAX, p.footBX, p.shoulderX, p.hipX) - pad;
    const r = Math.max(p.headX, p.handAX, p.handBX, p.footAX, p.footBX, p.shoulderX, p.hipX) + pad;
    const t = Math.min(p.headY, p.handAY, p.handBY) - pad;
    const b = Math.max(p.footAY, p.footBY) + pad;
    if (Number.isNaN(mirrorX)) this.mark(l, t, r, b);
    else this.mark(Math.min(l, 2 * mirrorX - r), t, Math.max(r, 2 * mirrorX - l), b);
  }

  clear(scope: number): void {
    for (let s = 0; s < CELEBRATION_PARTICLES; s++) {
      if (this.sparks[s * F + 7] === scope) this.sparks[s * F + 5] = 0;
    }
    if (this.run?.scope === scope) this.run = null;
    if (this.podium?.scope === scope) this.podium = null;
    if (this.show?.scope === scope) this.show = null;
  }

  clearAll(): void {
    this.sparks.fill(0);
    this.run = null;
    this.show = null;
    this.podium = null;
    this.strikeAt = -1;
  }

  /** Is anything still moving (worth another frame)? */
  animating(now: number): boolean {
    if (this.live > 0) return true;
    if (this.run && now - this.run.at < HERO_RUN_MS) return true;
    if (this.show && now - this.show.at < this.showMs(this.show)) return true;
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
    this.drawShow(ctx, width, height, bottomInset, now);
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

  /** The hero drawn from the scene's pose, mirrored (facing left) when `dir` is -1. */
  private drawPoseAt(ctx: CanvasRenderingContext2D, mirrorX: number, dir: number): void {
    if (dir < 0) {
      ctx.save();
      ctx.translate(2 * mirrorX, 0);
      ctx.scale(-1, 1);
      drawHero(ctx, this.pose);
      ctx.restore();
      this.markHero(mirrorX);
    } else {
      drawHero(ctx, this.pose);
      this.markHero();
    }
  }

  /** A soft gold glow round a point: a few faint discs, no gradient (nothing allocated). */
  private drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
    ctx.save();
    ctx.fillStyle = "#FFE08A";
    for (let i = 4; i >= 1; i--) {
      ctx.globalAlpha = alpha * 0.07 * (5 - i);
      ctx.beginPath();
      ctx.arc(x, y, (r * i) / 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    this.mark(x - r, y - r, x + r, y + r);
  }

  /**
   * The reveal's hero moment. Dance (190–199): on from the left, dancing near the left edge, off the way
   * it came, clear of the screen's centre where the score sits. Grand (200): a run right along the
   * bottom, a leap back left in the victory pose, a dance, then off to the right, under fireworks.
   * Calm (reduced motion): the hero standing in the victory pose, still, with a short glow.
   */
  private drawShow(ctx: CanvasRenderingContext2D, width: number, height: number, bottomInset: number, now: number): void {
    const show = this.show;
    if (!show) return;
    const age = now - show.at;
    const total = this.showMs(show);
    if (age >= total || age < 0) {
      if (age >= total) this.show = null;
      return;
    }
    const footY = height - bottomInset - 18;
    const spot = Math.max(44, width * 0.18);
    const h = HERO_RUN_H;
    ctx.save();
    if (show.calm) {
      const alpha = Math.min(1, age / 250, (total - age) / 300);
      ctx.globalAlpha = alpha;
      this.drawGlow(ctx, spot, footY - h * 0.5, h * 1.1, alpha * Math.max(0, 1 - age / total));
      heroVictoryPose(this.pose, spot, footY, h, 0, true);
      this.drawPoseAt(ctx, spot, 1);
      ctx.restore();
      return;
    }
    if (show.kind === "dance") {
      ctx.globalAlpha = Math.min(1, age / 120, (total - age) / 120);
      if (age < HERO_DANCE_ON_MS) {
        const x = -40 + (spot + 40) * (age / HERO_DANCE_ON_MS);
        heroRunPose(this.pose, x, footY, h, age / 400);
        this.drawPoseAt(ctx, x, 1);
      } else if (age < total - HERO_DANCE_OFF_MS) {
        heroDancePose(this.pose, spot, footY, h, age - HERO_DANCE_ON_MS);
        this.drawPoseAt(ctx, spot, 1);
      } else {
        const k = (age - (total - HERO_DANCE_OFF_MS)) / HERO_DANCE_OFF_MS;
        const x = spot - (spot + 40) * k;
        heroRunPose(this.pose, x, footY, h, age / 400);
        this.drawPoseAt(ctx, x, -1);
      }
      ctx.restore();
      return;
    }
    // The 200 lap: fireworks on their schedule, a brightening glow at the start, then the hero's legs.
    while (show.fired < FIREWORK_AT.length && age >= FIREWORK_AT[show.fired]!) {
      const i = show.fired;
      this.burst(show.scope, width * FIREWORK_X[i]!, height * FIREWORK_Y[i]!, 0, FIREWORK_SPARKS, show.at + FIREWORK_AT[i]!);
      show.fired++;
      this.fireworks++;
    }
    const glow = Math.max(0, 1 - Math.abs(age - 500) / 500);
    if (glow > 0) {
      ctx.globalAlpha = glow * 0.08;
      ctx.fillStyle = "#FFE08A";
      ctx.fillRect(0, 0, width, height);
      this.mark(0, 0, width, height);
    }
    ctx.globalAlpha = Math.min(1, age / 120, (total - age) / 120);
    const far = Math.min(width - 44, width * 0.8);
    if (age < GRAND_RUN_END) {
      const x = -40 + (far + 40) * (age / GRAND_RUN_END);
      heroRunPose(this.pose, x, footY, h, age / 380);
      this.drawPoseAt(ctx, x, 1);
    } else if (age < GRAND_LEAP_END) {
      const k = (age - GRAND_RUN_END) / (GRAND_LEAP_END - GRAND_RUN_END);
      const x = far + (spot - far) * k;
      const lift = Math.min(height * 0.3, 240) * 4 * k * (1 - k);
      heroVictoryPose(this.pose, x, footY - lift, h, age, false);
      this.drawPoseAt(ctx, x, -1);
    } else if (age < GRAND_DANCE_END) {
      heroDancePose(this.pose, spot, footY, h, age - GRAND_LEAP_END);
      this.drawPoseAt(ctx, spot, 1);
    } else {
      const k = (age - GRAND_DANCE_END) / (total - GRAND_DANCE_END);
      const x = spot + (width + 40 - spot) * k;
      heroRunPose(this.pose, x, footY, h, age / 380);
      this.drawPoseAt(ctx, x, 1);
    }
    ctx.restore();
  }

  private drawPodium(ctx: CanvasRenderingContext2D, now: number): void {
    const podium = this.podium;
    if (!podium) return;
    const age = now - podium.at;
    if (age < 0) return;
    const box = podium.box;
    // On the gold step, at its right end, beside the winner's name and total (which the podium keeps to
    // the step's left part), clear of the step's medal (Polish batch R: the hero on the top step).
    const cx = box.left + box.width - 20;
    const footY = box.top + 1;
    const t = Math.min(age, PODIUM_HERO_BOB_MS);
    ctx.save();
    ctx.globalAlpha = Math.min(1, age / (podium.calm ? 300 : 180));
    const sprite = this.podiumSprite(podium.calm);
    if (sprite) {
      const h = PODIUM_HERO_H;
      const frames = podium.calm ? 1 : PODIUM_HERO_FRAMES;
      const frame = Math.floor(((t % HERO_VICTORY_LOOP_MS) / HERO_VICTORY_LOOP_MS) * frames) % frames;
      const fw = sprite.width / frames;
      const left = cx - SPRITE_LEFT * h;
      const top = footY - SPRITE_TOP * h;
      const w = (SPRITE_LEFT + SPRITE_RIGHT) * h;
      const hh = (SPRITE_TOP + SPRITE_BOTTOM) * h;
      ctx.drawImage(sprite as unknown as CanvasImageSource, frame * fw, 0, fw, sprite.height, left, top, w, hh);
      this.mark(left, top, left + w, top + hh);
    } else {
      heroVictoryPose(this.pose, cx, footY, PODIUM_HERO_H, t, podium.calm);
      drawHero(ctx, this.pose);
      this.markHero();
    }
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
