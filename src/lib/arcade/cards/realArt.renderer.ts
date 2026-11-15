/**
 * The Cards & Board overhaul's real art and motion (phase 2 step 4, 15 Nov 2026; display only, never imported by a
 * sim or the server).
 *
 * Art: Blender renders (scripts/cards-board-art/, packed into public/cards-board/) of real cards on linen stock, ivory
 * Mahjong tiles and the two tables. The images load on first draw in a browser; until then, and in node where the
 * checks draw, the same faces are painted flat (cardFace.renderer.ts) and the table is the code-drawn felt. A skin
 * (a card back, a felt) still draws through cards.renderer's skin painters.
 *
 * Motion: a CardMotion per live stage (the games' views hold one; reveals and replays pass none, so they draw still)
 * remembers where each card was drawn. When a card's place changes it slides there along a short arc (150–260 ms,
 * eased out), drawn on top of the still cards; a card turning face up flips (its width closing to the back's edge and
 * opening on the face). Reduced motion: every card is drawn at its place at once.
 */
import { reducedMotion } from "../art.renderer";
import { cardBackOf, feltOf, paintSkinBack } from "../skins/cards.skins";
import { CARD_FACE_ASPECT, CARD_FACE_RADIUS, paintCardBackFace, paintCardFace } from "./cardFace.renderer";
import { cardsLookNow, drawFelt, roundRect } from "./cards.renderer";

/* ================================ Images ================================ */

/** The packed images and their layouts (scripts/cards-board-art/pack.py). */
export const REAL_ART = {
  cards: { url: "/cards-board/cards.webp", cols: 8, cellW: 204, cellH: 298, pad: 2, w: 200, h: 294 },
  tiles: { url: "/cards-board/tiles.webp", cols: 6, cellW: 190, cellH: 244, pad: 2, w: 186, h: 240 },
  felt: { url: "/cards-board/felt.webp" },
  mahjongTable: { url: "/cards-board/mahjong-table.webp" },
} as const;

type ArtKey = keyof typeof REAL_ART;
const images = new Map<ArtKey, HTMLImageElement>();
const ready = new Set<ArtKey>();

/** Starts loading an image (browser only); true once it has decoded. */
export function realArtReady(key: ArtKey): boolean {
  if (ready.has(key)) return true;
  if (typeof Image === "undefined" || typeof window === "undefined") return false;
  if (!images.has(key)) {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => ready.add(key);
    img.src = REAL_ART[key].url;
    images.set(key, img);
  }
  return false;
}

/** Starts loading a game's images as its chunk loads (rooms preload the round's game during the round before, practice
 *  while the intro is up), so the first frame of play is already real. */
export function preloadRealArt(keys: readonly ArtKey[] = Object.keys(REAL_ART) as ArtKey[]): void {
  for (const k of keys) realArtReady(k);
}

/* ================================ Caches ================================ */

const PAD = 6;
const cache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function scaleOf(ctx: CanvasRenderingContext2D): number {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const s = t ? Math.hypot(t.a, t.b) : 1;
  return Math.max(0.5, Math.round(s * 4) / 4);
}

/** A source rectangle drawn into w × h at a context, halving first while the source is over twice the target (sharp). */
function drawDown(ctx: CanvasRenderingContext2D, img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, w: number, h: number): void {
  let src: CanvasImageSource = img;
  let x = sx;
  let y = sy;
  let cw = sw;
  let ch = sh;
  while (cw > w * 2.2 && ch > h * 2.2) {
    const nw = Math.ceil(cw / 2);
    const nh = Math.ceil(ch / 2);
    const step = makeCanvas(nw, nh);
    const c = step.getContext("2d") as CanvasRenderingContext2D | null;
    if (!c) break;
    c.imageSmoothingQuality = "high";
    c.drawImage(src, x, y, cw, ch, 0, 0, nw, nh);
    src = step as CanvasImageSource;
    x = 0;
    y = 0;
    cw = nw;
    ch = nh;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, x, y, cw, ch, 0, 0, w, h);
}

/** A card's cached bitmap: the soft contact shadow, then the face, back or skin back. */
function cardBitmap(key: string, w: number, h: number, scale: number, paint: (c: CanvasRenderingContext2D) => void) {
  const full = `${key}:${w}x${h}@${scale}`;
  let canvas = cache.get(full);
  if (!canvas) {
    if (cache.size > 500) cache.clear();
    canvas = makeCanvas(Math.ceil((w + PAD * 2) * scale), Math.ceil((h + PAD * 2) * scale));
    const c = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (c) {
      c.scale(scale, scale);
      c.translate(PAD, PAD);
      c.save();
      c.shadowColor = "rgba(0,0,0,0.42)";
      c.shadowBlur = 3.5;
      c.shadowOffsetY = 1.6;
      roundRect(c, 0.4, 0.4, w - 0.8, h - 0.8, Math.max(2, w * CARD_FACE_RADIUS));
      c.fillStyle = "#000";
      c.fill();
      c.restore();
      paint(c);
    }
    cache.set(full, canvas);
  }
  return canvas;
}

/** The atlas cell of a card (0–51, 52 the back). */
function atlasPaint(index: number, w: number, h: number) {
  const a = REAL_ART.cards;
  return (c: CanvasRenderingContext2D) => {
    const img = images.get("cards")!;
    const col = index % a.cols;
    const row = Math.floor(index / a.cols);
    c.save();
    c.beginPath();
    roundRect(c, 0, 0, w, h, Math.max(2, w * CARD_FACE_RADIUS));
    c.clip();
    drawDownWorld(c, img, col * a.cellW + a.pad, row * a.cellH + a.pad, a.w, a.h, w, h);
    c.restore();
  };
}

/** drawDown at world units on a scaled cache context. */
function drawDownWorld(c: CanvasRenderingContext2D, img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, w: number, h: number): void {
  const t = c.getTransform();
  const k = Math.hypot(t.a, t.b) || 1;
  c.save();
  c.setTransform(1, 0, 0, 1, t.e, t.f);
  drawDown(c, img, sx, sy, sw, sh, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
  c.restore();
}

export interface RealCardLook {
  down?: boolean;
  /** The gold glow (selected, playable, lit), 0–1. */
  glow?: number;
  /** Dimmed (covered or not playable), 0–1. */
  dim?: number;
  /** Lifted off the table (picked up): a deeper shadow under it, 0–1. */
  lift?: number;
  /** Horizontal squeeze for a flip, 0–1 of the width (1 = flat). */
  flipW?: number;
}

/** Draws one real card at (x, y), w × h world units (card −1 or `down` draws the back). */
export function drawRealCard(ctx: CanvasRenderingContext2D, card: number, x: number, y: number, w: number, h: number, look: RealCardLook = {}): void {
  const scale = scaleOf(ctx);
  const down = look.down || card < 0;
  const skinBack = down ? cardBackOf(cardsLookNow()) : null;
  const art = realArtReady("cards");
  const img = skinBack
    ? cardBitmap(`skin:${skinBack}`, w, h, scale, (c) => paintSkinBack(c, skinBack, w, h))
    : down
      ? cardBitmap(art ? "rb" : "fb", w, h, scale, art ? atlasPaint(52, w, h) : (c) => paintCardBackFace(c, w, h))
      : cardBitmap(art ? `r${card}` : `f${card}`, w, h, scale, art ? atlasPaint(card, w, h) : (c) => paintCardFace(c, card, w, h));
  const fw = look.flipW ?? 1;
  const lift = look.lift ?? 0;
  if (lift > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${0.35 * lift})`;
    ctx.shadowBlur = 10 * lift;
    ctx.shadowOffsetY = 5 * lift;
    roundRect(ctx, x + (w * (1 - fw)) / 2, y, w * fw, h, Math.max(2, w * CARD_FACE_RADIUS));
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fill();
    ctx.restore();
  }
  if (look.glow && look.glow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(255,205,90,${Math.min(1, look.glow)})`;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(255,214,110,${Math.min(1, look.glow)})`;
    ctx.lineWidth = 2.5;
    roundRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, Math.max(4, w * 0.1));
    ctx.stroke();
    ctx.restore();
  }
  if (fw < 1) {
    ctx.drawImage(img as CanvasImageSource, x + (w * (1 - fw)) / 2 - PAD * fw, y - PAD, (w + PAD * 2) * fw, h + PAD * 2);
  } else ctx.drawImage(img as CanvasImageSource, x - PAD, y - PAD, w + PAD * 2, h + PAD * 2);
  if (look.dim && look.dim > 0) {
    ctx.fillStyle = `rgba(8,18,40,${Math.min(0.7, look.dim)})`;
    roundRect(ctx, x + (w * (1 - fw)) / 2, y, w * fw, h, Math.max(2, w * CARD_FACE_RADIUS));
    ctx.fill();
  }
}

/** The card table: a felt skin when one is worn, else the Blender baize (the code felt until it loads). */
export function drawRealFelt(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (feltOf(cardsLookNow()) || !realArtReady("felt")) {
    drawFelt(ctx, w, h);
    return;
  }
  ctx.drawImage(images.get("felt")!, 0, 0, w, h);
}

/** The Mahjong table image if loaded (null: paint the code table). */
export function mahjongTableImage(): HTMLImageElement | null {
  return realArtReady("mahjongTable") ? images.get("mahjongTable")! : null;
}

/** A Mahjong tile (face and body; `depth` 6 world units to the bottom right) from the atlas, or false if not loaded. */
export function drawRealTile(ctx: CanvasRenderingContext2D, face: number, x: number, y: number, w: number, h: number): boolean {
  if (!realArtReady("tiles")) return false;
  const a = REAL_ART.tiles;
  const scale = scaleOf(ctx);
  const tw = w + 6;
  const th = h + 6;
  const key = `tile${face}:${tw}x${th}@${scale}`;
  let canvas = cache.get(key);
  if (!canvas) {
    canvas = makeCanvas(Math.ceil(tw * scale), Math.ceil(th * scale));
    const c = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (c) {
      const col = face % a.cols;
      const row = Math.floor(face / a.cols);
      drawDown(c, images.get("tiles")!, col * a.cellW + a.pad, row * a.cellH + a.pad, a.w, a.h, Math.ceil(tw * scale), Math.ceil(th * scale));
    }
    cache.set(key, canvas);
  }
  ctx.drawImage(canvas as CanvasImageSource, x, y, tw, th);
  return true;
}

/* ================================ Motion ================================ */

/** How long a slide takes: 150 ms plus a little per unit travelled, at most 260 ms. */
export function slideMs(distance: number): number {
  return Math.min(260, 150 + distance * 0.25);
}
/** How long a flip takes. */
export const FLIP_MS = 180;

interface Track {
  /** Where the card is drawn now (start of the current slide), its target, and when the slide began. */
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t0: number;
  ms: number;
  down: boolean;
  flip0: number;
  seen: number;
}

export interface Placed {
  x: number;
  y: number;
  /** Mid-slide: draw it over the still cards. */
  moving: boolean;
  /** The width share for a flip (1: flat). */
  flipW: number;
  /** Draw the back (the first half of a flip from face down). */
  down: boolean;
  /** 0–1: how far off the table (the arc's height). */
  lift: number;
}

/** Remembers each card's drawn place on one stage; see the file's head. */
export class CardMotion {
  private tracks = new Map<number, Track>();
  private now = 0;
  private frameNo = 0;
  /** Set false to draw every card at its place (reduced motion is also read on each frame). */
  enabled = true;

  /** Starts a frame (the stage's clock; performance.now() by default). */
  frame(now = typeof performance !== "undefined" ? performance.now() : 0): void {
    this.now = now;
    this.frameNo++;
  }

  private still(): boolean {
    return !this.enabled || reducedMotion();
  }

  /** Notes where a card is without drawing it (a stock card about to be turned starts from the stock). */
  seed(key: number, x: number, y: number, down: boolean): void {
    const t = this.tracks.get(key);
    // Only a card not drawn last frame (or this one) is placed: one on the table keeps its place.
    if (t && t.seen >= this.frameNo - 1) return;
    this.tracks.set(key, { fx: x, fy: y, tx: x, ty: y, t0: -1e9, ms: 0, down, flip0: -1e9, seen: this.frameNo - 1 });
  }

  /** Where to draw card `key` this frame, given where it belongs. `instant` places it (a drag, a flight). */
  place(key: number, x: number, y: number, down = false, instant = false): Placed {
    const t = this.tracks.get(key);
    const still = this.still();
    if (!t || instant || still) {
      const flipping = !!t && !still && t.down && !down;
      this.tracks.set(key, { fx: x, fy: y, tx: x, ty: y, t0: -1e9, ms: 0, down, flip0: flipping ? this.now : (t?.flip0 ?? -1e9), seen: this.frameNo });
      return this.flipOf({ x, y, moving: false, flipW: 1, down, lift: 0 }, this.tracks.get(key)!);
    }
    if (t.tx !== x || t.ty !== y) {
      // A new target: start from wherever it is drawn now.
      const cur = this.at(t);
      t.fx = cur.x;
      t.fy = cur.y;
      t.tx = x;
      t.ty = y;
      t.t0 = this.now;
      t.ms = slideMs(Math.hypot(x - cur.x, y - cur.y));
    }
    if (t.down && !down) t.flip0 = this.now;
    t.down = down;
    t.seen = this.frameNo;
    const p = this.at(t);
    return this.flipOf({ x: p.x, y: p.y, moving: p.k < 1, flipW: 1, down, lift: p.k < 1 ? Math.sin(Math.PI * p.k) : 0 }, t);
  }

  private flipOf(p: Placed, t: Track): Placed {
    const age = this.now - t.flip0;
    if (age < 0 || age >= FLIP_MS || this.still()) return p;
    const k = age / FLIP_MS;
    return { ...p, flipW: Math.max(0.04, Math.abs(Math.cos(Math.PI * k))), down: k < 0.5 ? true : p.down, moving: true };
  }

  private at(t: Track): { x: number; y: number; k: number } {
    const age = this.now - t.t0;
    if (age >= t.ms || t.ms <= 0) return { x: t.tx, y: t.ty, k: 1 };
    const k = Math.max(0, age / t.ms);
    const e = 1 - Math.pow(1 - k, 3);
    const d = Math.hypot(t.tx - t.fx, t.ty - t.fy);
    const arc = Math.min(18, d * 0.1) * Math.sin(Math.PI * e);
    return { x: t.fx + (t.tx - t.fx) * e, y: t.fy + (t.ty - t.fy) * e - arc, k };
  }

  /** Whether anything is still moving (the stage keeps drawing while it is). */
  busy(): boolean {
    for (const t of this.tracks.values()) if (this.now - t.t0 < t.ms || this.now - t.flip0 < FLIP_MS) return true;
    return false;
  }
}

/**
 * A frame's card drawing: still cards at once, moving ones queued and drawn on top at flush(). `motion` null draws
 * everything still (reveals, replays, the intro's still).
 */
export class CardLayer {
  private queued: (() => void)[] = [];
  constructor(
    private ctx: CanvasRenderingContext2D,
    readonly motion: CardMotion | null,
  ) {
    motion?.frame();
  }

  /** Draws card `card` (key: its id; backs and generic piles pass a key of their own) that belongs at (x, y). */
  card(key: number, card: number, x: number, y: number, w: number, h: number, look: RealCardLook = {}, instant = false): void {
    if (!this.motion) {
      drawRealCard(this.ctx, card, x, y, w, h, look);
      return;
    }
    const p = this.motion.place(key, x, y, !!look.down, instant);
    const draw = () => drawRealCard(this.ctx, card, p.x, p.y, w, h, { ...look, down: p.down, flipW: p.flipW, lift: Math.max(look.lift ?? 0, p.lift * 0.8), glow: p.moving ? 0 : (look.glow ?? 0), dim: p.moving ? 0 : (look.dim ?? 0) });
    if (p.moving) this.queued.push(draw);
    else draw();
  }

  /** Draws the queued moving cards. */
  flush(): void {
    for (const d of this.queued) d();
    this.queued = [];
  }
}

/** The card size for a width at the overhaul's aspect. */
export function cardHeightFor(w: number): number {
  return Math.round(w / CARD_FACE_ASPECT);
}
