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
