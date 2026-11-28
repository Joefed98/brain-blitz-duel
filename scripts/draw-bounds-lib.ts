/**
 * Where a renderer's draws land (P4 desktop size PR 1, 28 Nov 2026; hud-bands-check): wraps one 2D context
 * (@napi-rs/canvas) and records the box each draw covers on that canvas, in its bitmap's pixels: fills, strokes and
 * rects (the current path's points through the transform in force at each call, a stroke grown by half its line width,
 * a miter by its full width), images (their destination rect), text (its measured ink box with the alignment and
 * baseline in force) and Path2D fills and strokes (the path's bounds). Each box is grown by the shadow in force, then
 * cut to the clip in force (save / restore kept) and to the canvas. Draws with nothing visible (globalAlpha 0) and
 * clearRect are not counted (see VISIBLE). Only draws on the wrapped context count: a cached layer counts where it is drawn onto it.
 *
 * Conservative by design: a curve counts its control points and an arc its whole circle, so a box can only be larger
 * than the ink, never smaller.
 */

export interface DrawBox {
  /** The draw's kind (fill, stroke, fillRect, strokeRect, drawImage, fillText, strokeText). */
  op: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** The text drawn, for text. */
  text?: string;
}

type Ctx = Record<string, any>;
type Rect = [number, number, number, number];

const EMPTY: Rect = [Infinity, Infinity, -Infinity, -Infinity];

/**
 * A pixel counts when the draw changes it by at least this much (of 255): 8, about 3 %, below which a change can't be
 * seen. An image counts only its pixels at or above it (with the draw's globalAlpha); a draw whose globalAlpha alone is
 * below it counts nothing; every other draw counts its whole box.
 */
export const VISIBLE = 8;

/**
 * The box of an image's pixels that are not fully clear, in its own pixels, or null when its pixels can't be read or
 * it is too large to read every draw (then the whole image counts). A canvas (a renderer's cached layer, which may be
 * repainted between draws) is read at every draw; a decoded image, which never changes, once.
 */
const inks = new WeakMap<object, Map<number, Rect | null>>();
const INK_READ_MAX = 400_000;
function inkOf(img: any, minAlpha: number): Rect | null {
  const canvas = typeof img?.getContext === "function";
  if (!canvas && inks.get(img)?.has(minAlpha)) return inks.get(img)!.get(minAlpha)!;
  let box: Rect | null = null;
  try {
    const w = img.width as number;
    const h = img.height as number;
    let data: Uint8ClampedArray | null = null;
    if (w > 0 && h > 0 && w * h <= INK_READ_MAX) {
      if (canvas) data = img.getContext("2d").getImageData(0, 0, w, h).data;
      else {
        const { createCanvas } = require("@napi-rs/canvas") as typeof import("@napi-rs/canvas");
        const c = createCanvas(w, h).getContext("2d");
        c.drawImage(img, 0, 0);
        data = c.getImageData(0, 0, w, h).data as unknown as Uint8ClampedArray;
      }
    }
    if (data) {
      box = [Infinity, Infinity, -Infinity, -Infinity];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (data[(y * w + x) * 4 + 3]! >= minAlpha) {
            if (x < box[0]) box[0] = x;
            if (y < box[1]) box[1] = y;
            if (x + 1 > box[2]) box[2] = x + 1;
            if (y + 1 > box[3]) box[3] = y + 1;
          }
    }
  } catch {
    box = null;
  }
  if (!canvas) {
    if (!inks.has(img)) inks.set(img, new Map());
    inks.get(img)!.set(minAlpha, box);
  }
  return box;
}

/** Starts recording `ctx`'s draws into `sink`; returns the function that puts the context back as it was. */
export function recordDrawBoxes(ctx: Ctx, width: number, height: number, sink: (box: DrawBox) => void): () => void {
  const own = new Map<string, unknown>();
  const orig: Record<string, (...a: any[]) => any> = {};
  const call = (name: string, a: any[]) => orig[name]!.apply(ctx, a);
  let path: Rect = [...EMPTY];
  let clip: Rect = [0, 0, width, height];
  const clips: Rect[] = [];

  const add = (r: Rect, x: number, y: number) => {
    const t = ctx.getTransform();
    const px = t.a * x + t.c * y + t.e;
    const py = t.b * x + t.d * y + t.f;
    if (px < r[0]) r[0] = px;
    if (py < r[1]) r[1] = py;
    if (px > r[2]) r[2] = px;
    if (py > r[3]) r[3] = py;
  };
  const rectPoints = (r: Rect, x: number, y: number, w: number, h: number) => {
    add(r, x, y);
    add(r, x + w, y);
    add(r, x, y + h);
    add(r, x + w, y + h);
  };
  const scaleOf = () => {
    const t = ctx.getTransform();
    return Math.max(Math.hypot(t.a, t.b), Math.hypot(t.c, t.d));
  };
  const path2dBox = (p: { getBounds(): [number, number, number, number] }): Rect => {
    const [l, t, r, b] = p.getBounds();
    const box: Rect = [...EMPTY];
    if (Number.isFinite(l) && Number.isFinite(t)) rectPoints(box, l, t, r - l, b - t);
    return box;
  };
  const shadowGrow = (): number => {
    const colour = String(ctx.shadowColor ?? "");
    const blur = Number(ctx.shadowBlur ?? 0);
    const ox = Math.abs(Number(ctx.shadowOffsetX ?? 0));
    const oy = Math.abs(Number(ctx.shadowOffsetY ?? 0));
    if (!(blur > 0 || ox > 0 || oy > 0)) return 0;
    if (/^rgba\(.*,\s*0\)$|^transparent$|^#[0-9a-f]{6}00$|^#[0-9a-f]{3}0$/i.test(colour.replace(/\s+/g, ""))) return 0;
    return blur * 2 + Math.max(ox, oy);
  };
  const emit = (op: string, r: Rect, grow = 0, text?: string) => {
    if (!(r[2] >= r[0] && r[3] >= r[1])) return;
    if (Number(ctx.globalAlpha ?? 1) * 255 < VISIBLE) return;
    const g = grow + shadowGrow();
    const box = {
      op,
      x0: Math.max(r[0] - g, clip[0]),
      y0: Math.max(r[1] - g, clip[1]),
      x1: Math.min(r[2] + g, clip[2]),
      y1: Math.min(r[3] + g, clip[3]),
      ...(text !== undefined ? { text } : {}),
    };
    if (box.x1 <= box.x0 || box.y1 <= box.y0) return;
    sink(box);
  };
  const strokeGrow = () => {
    const w = Number(ctx.lineWidth ?? 1) * scaleOf();
    return ctx.lineJoin === "miter" ? w * Math.max(1, Number(ctx.miterLimit ?? 10) / 2) : w / 2;
  };

  const wrap = (name: string, fn: (...a: any[]) => any) => {
    orig[name] = ctx[name] as (...a: any[]) => any;
    own.set(name, Object.getOwnPropertyDescriptor(ctx, name));
    Object.defineProperty(ctx, name, { configurable: true, writable: true, value: fn });
  };

  wrap("beginPath", (...a: any[]) => {
    path = [...EMPTY];
    return call("beginPath", a);
  });
  for (const name of ["moveTo", "lineTo"]) wrap(name, (...a: any[]) => {
    add(path, a[0], a[1]);
    return call(name, a);
  });
  wrap("quadraticCurveTo", (...a: any[]) => {
    add(path, a[0], a[1]);
    add(path, a[2], a[3]);
    return call("quadraticCurveTo", a);
  });
  wrap("bezierCurveTo", (...a: any[]) => {
    add(path, a[0], a[1]);
    add(path, a[2], a[3]);
    add(path, a[4], a[5]);
    return call("bezierCurveTo", a);
  });
  wrap("arcTo", (...a: any[]) => {
    add(path, a[0], a[1]);
    add(path, a[2], a[3]);
    return call("arcTo", a);
  });
  wrap("arc", (...a: any[]) => {
    const [x, y, r] = a as number[];
    rectPoints(path, x! - Math.abs(r!), y! - Math.abs(r!), 2 * Math.abs(r!), 2 * Math.abs(r!));
    return call("arc", a);
  });
  wrap("ellipse", (...a: any[]) => {
    const [x, y, rx, ry] = a as number[];
    const r = Math.max(Math.abs(rx!), Math.abs(ry!));
    rectPoints(path, x! - r, y! - r, 2 * r, 2 * r);
    return call("ellipse", a);
  });
  for (const name of ["rect", "roundRect"]) wrap(name, (...a: any[]) => {
    rectPoints(path, a[0], a[1], a[2], a[3]);
    return call(name, a);
  });
  wrap("fill", (...a: any[]) => {
    emit("fill", a[0] && typeof a[0] === "object" ? path2dBox(a[0]) : path);
    return call("fill", a);
  });
  wrap("stroke", (...a: any[]) => {
    emit("stroke", a[0] && typeof a[0] === "object" ? path2dBox(a[0]) : path, strokeGrow());
    return call("stroke", a);
  });
  wrap("fillRect", (...a: any[]) => {
    const r: Rect = [...EMPTY];
    rectPoints(r, a[0], a[1], a[2], a[3]);
    emit("fillRect", r);
    return call("fillRect", a);
  });
  wrap("strokeRect", (...a: any[]) => {
    const r: Rect = [...EMPTY];
    rectPoints(r, a[0], a[1], a[2], a[3]);
    emit("strokeRect", r, strokeGrow());
    return call("strokeRect", a);
  });
  wrap("drawImage", (...a: any[]) => {
    const img = a[0] as { width: number; height: number };
    // The source part drawn and where it lands, then only the part of it holding ink (any pixel not fully clear).
    const [sx, sy, sw, sh] = a.length >= 9 ? [a[1], a[2], a[3], a[4]] : [0, 0, img.width, img.height];
    const [dx, dy, dw, dh] = a.length >= 9 ? [a[5], a[6], a[7], a[8]] : a.length >= 5 ? [a[1], a[2], a[3], a[4]] : [a[1], a[2], img.width, img.height];
    // A draw across the whole canvas (a backdrop layer) is not counted, so its pixels aren't read.
    const t0 = ctx.getTransform();
    const ink = Math.abs(dw * t0.a) >= 0.95 * width ? null : inkOf(img, Math.max(1, Math.ceil(VISIBLE / Math.max(Number(ctx.globalAlpha ?? 1), 1e-6))));
    const r: Rect = [...EMPTY];
    if (ink && sw > 0 && sh > 0) {
      const l = Math.max(ink[0], sx);
      const t = Math.max(ink[1], sy);
      const rr = Math.min(ink[2], sx + sw);
      const b = Math.min(ink[3], sy + sh);
      if (rr > l && b > t) rectPoints(r, dx + ((l - sx) / sw) * dw, dy + ((t - sy) / sh) * dh, ((rr - l) / sw) * dw, ((b - t) / sh) * dh);
    } else if (!ink) rectPoints(r, dx, dy, dw, dh);
    emit("drawImage", r);
    return call("drawImage", a);
  });
  for (const name of ["fillText", "strokeText"]) wrap(name, (...a: any[]) => {
    const m = ctx.measureText(String(a[0]));
    const x = Number(a[1]);
    const y = Number(a[2]);
    const r: Rect = [...EMPTY];
    rectPoints(r, x - m.actualBoundingBoxLeft, y - m.actualBoundingBoxAscent, m.actualBoundingBoxLeft + m.actualBoundingBoxRight, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
    emit(name, r, name === "strokeText" ? strokeGrow() : 0, String(a[0]));
    return call(name, a);
  });
  wrap("clip", (...a: any[]) => {
    const r = a[0] && typeof a[0] === "object" ? path2dBox(a[0]) : path;
    clip = [Math.max(clip[0], r[0]), Math.max(clip[1], r[1]), Math.min(clip[2], r[2]), Math.min(clip[3], r[3])];
    return call("clip", a);
  });
  wrap("save", (...a: any[]) => {
    clips.push([...clip]);
    return call("save", a);
  });
  wrap("restore", (...a: any[]) => {
    clip = clips.pop() ?? [0, 0, width, height];
    return call("restore", a);
  });
  wrap("reset", (...a: any[]) => {
    clip = [0, 0, width, height];
    clips.length = 0;
    path = [...EMPTY];
    return call("reset", a);
  });

  return () => {
    for (const [name, desc] of own) {
      if (desc) Object.defineProperty(ctx, name, desc as PropertyDescriptor);
      else delete ctx[name];
    }
  };
}
