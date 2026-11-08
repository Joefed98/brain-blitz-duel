/**
 * The shared arcade HUD pill (3 Nov 2026, the Cards & Board and Strategy polish; display only, never imported by a sim
 * or the server): a dark rounded pill holding a quiet label and a bold value ("Maze 1 / 4", "Popped 12"), the main count
 * top left, at most two rows of pills and at most one "·" a line. Cards & Board games keep their own `drawChip`
 * (cards.renderer.ts), the same shape on the felt. Archivo (self-hosted), never a monospace face.
 */

export const HUD_PILL_FONT = "'Archivo', system-ui, sans-serif";
export const HUD_PILL_H = 28;
/** The gap between two pills in a row, and between the two rows. */
export const HUD_PILL_GAP = 6;

export interface HudPillOpts {
  /** Which edge `x` names: the pill's left (default), right or centre. */
  align?: "left" | "right" | "center";
  /** Lit: a gold pill with dark text (a goal met, a streak on). */
  gold?: boolean;
  /** A warning: the value in a soft red (over par, a last life). */
  alert?: boolean;
  /** Height (default HUD_PILL_H). */
  h?: number;
  /** Faded (0–1): a pill that is not live yet. */
  alpha?: number;
}

function pillPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.closePath();
}

/** The pill's width for this label and value (the same fonts drawHudPill uses). */
export function hudPillWidth(ctx: CanvasRenderingContext2D, label: string, value: string, h = HUD_PILL_H): number {
  const ls = Math.round(h * 0.43);
  const vs = Math.round(h * 0.54);
  ctx.font = `700 ${ls}px ${HUD_PILL_FONT}`;
  const lw = label ? ctx.measureText(label).width + 6 : 0;
  ctx.font = `800 ${vs}px ${HUD_PILL_FONT}`;
  const vw = value ? ctx.measureText(value).width : 0;
  return Math.ceil(lw + vw + h * 0.86);
}

/** Draws one HUD pill with its top at `y`; returns its width. */
export function drawHudPill(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, value: string, opts: HudPillOpts = {}): number {
  const h = opts.h ?? HUD_PILL_H;
  const w = hudPillWidth(ctx, label, value, h);
  const left = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
  const ls = Math.round(h * 0.43);
  const vs = Math.round(h * 0.54);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  pillPath(ctx, left, y, w, h);
  ctx.fillStyle = opts.gold ? "rgba(242,199,92,0.96)" : "rgba(6,8,16,0.72)";
  ctx.fill();
  ctx.strokeStyle = opts.gold ? "#FFE7A3" : "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const pad = h * 0.43;
  const mid = y + h / 2 + 0.5;
  let tx = left + pad;
  if (label) {
    ctx.font = `700 ${ls}px ${HUD_PILL_FONT}`;
    ctx.fillStyle = opts.gold ? "rgba(40,26,4,0.78)" : "rgba(235,238,248,0.72)";
    ctx.fillText(label, tx, mid);
    tx += ctx.measureText(label).width + 6;
  }
  if (value) {
    ctx.font = `800 ${vs}px ${HUD_PILL_FONT}`;
    ctx.fillStyle = opts.gold ? "#231503" : opts.alert ? "#FF9A8A" : "#FFFFFF";
    ctx.fillText(value, tx, mid);
  }
  ctx.restore();
  return w;
}

/**
 * Lays a row of pills left to right from `x` (the main count first); returns the row's right edge. Pills that would pass
 * `maxX` are left for the caller's second row (returned as `rest`).
 */
export function drawHudPillRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pills: readonly { label: string; value: string; opts?: HudPillOpts }[],
  maxX = Infinity,
): { right: number; rest: { label: string; value: string; opts?: HudPillOpts }[] } {
  let cx = x;
  const rest: { label: string; value: string; opts?: HudPillOpts }[] = [];
  for (const p of pills) {
    const w = hudPillWidth(ctx, p.label, p.value, p.opts?.h);
    if (rest.length || (cx > x && cx + w > maxX)) {
      rest.push(p);
      continue;
    }
    drawHudPill(ctx, cx, y, p.label, p.value, { ...p.opts, align: "left" });
    cx += w + HUD_PILL_GAP;
  }
  return { right: cx - HUD_PILL_GAP, rest };
}

/*
 * Text pills (Orbit's HUD, 3 Nov 2026; folded in from hudPills.renderer.ts on 7 Nov 2026): one line of text in a
 * soft dark pill, 26 px tall, laid out in a row whose font steps down (to `minPx`) until its pills fit between `left`
 * and `right`, so a dense row never runs under a control or off the view.
 */
export const HUD_TEXT_PILL_H = 26;

export interface HudTextPill {
  text: string;
  colour?: string;
}

/** Each pill's x and width for a row at `px`, and the size it fits at. */
export function hudTextPillRowLayout(
  measure: (text: string, px: number) => number,
  pills: readonly HudTextPill[],
  left: number,
  right: number,
  px = 14,
  minPx = 10,
  gap = 6,
): { px: number; boxes: { x: number; w: number }[] } {
  let size = px;
  const lay = (s: number) => {
    const pad = Math.round(s * 0.85);
    let x = left;
    const boxes = pills.map((p) => {
      const w = Math.ceil(measure(p.text, s)) + pad * 2;
      const box = { x, w };
      x += w + gap;
      return box;
    });
    return { boxes, end: x - gap };
  };
  let out = lay(size);
  while (out.end > right && size > minPx) out = lay(--size);
  return { px: size, boxes: out.boxes };
}

/** Draws one row of text pills from `left`, `top` (height HUD_TEXT_PILL_H), fitted to end by `right`. */
export function drawHudTextPillRow(
  ctx: CanvasRenderingContext2D,
  pills: readonly HudTextPill[],
  left: number,
  top: number,
  right: number,
  px = 14,
): void {
  if (!pills.length) return;
  const measure = (text: string, s: number) => {
    ctx.font = `600 ${s}px ${HUD_PILL_FONT}`;
    const w = typeof ctx.measureText === "function" ? ctx.measureText(text)?.width : undefined;
    return typeof w === "number" && Number.isFinite(w) ? w : text.length * s * 0.6;
  };
  const lay = hudTextPillRowLayout(measure, pills, left, right, px);
  ctx.save();
  ctx.font = `600 ${lay.px}px ${HUD_PILL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  pills.forEach((p, i) => {
    const b = lay.boxes[i]!;
    ctx.fillStyle = "rgba(14,16,21,0.82)";
    ctx.beginPath?.();
    if (typeof ctx.roundRect === "function") ctx.roundRect(b.x, top, b.w, HUD_TEXT_PILL_H, HUD_TEXT_PILL_H / 2);
    else ctx.rect(b.x, top, b.w, HUD_TEXT_PILL_H);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = p.colour ?? "#F3F1EC";
    ctx.fillText(p.text, b.x + b.w / 2, top + HUD_TEXT_PILL_H / 2 + 0.5);
  });
  ctx.restore();
}
