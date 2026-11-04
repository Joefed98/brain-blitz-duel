/**
 * Action-style HUD pills (3 Nov 2026, Joe's audit; display only): soft dark rounded pills in the display font,
 * as Iron Wall's HUD draws them, laid out in rows. A row's font steps down (to `minPx`) until its pills fit
 * between `left` and `right`, so a dense row never runs under a control or off the view. Render only.
 */
export const HUD_PILL_FONT = "'Archivo', 'Saira', system-ui, sans-serif";
export const HUD_PILL_H = 26;

export interface HudPill {
  text: string;
  colour?: string;
}

/** Each pill's x and width for a row at `px`, and the size it fits at. */
export function hudPillRowLayout(
  measure: (text: string, px: number) => number,
  pills: readonly HudPill[],
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

/** Draws one row of pills from `left`, `top` (height HUD_PILL_H), fitted to end by `right`. */
export function drawHudPillRow(
  ctx: CanvasRenderingContext2D,
  pills: readonly HudPill[],
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
  const lay = hudPillRowLayout(measure, pills, left, right, px);
  ctx.save();
  ctx.font = `600 ${lay.px}px ${HUD_PILL_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  pills.forEach((p, i) => {
    const b = lay.boxes[i]!;
    ctx.fillStyle = "rgba(14,16,21,0.82)";
    ctx.beginPath?.();
    if (typeof ctx.roundRect === "function") ctx.roundRect(b.x, top, b.w, HUD_PILL_H, HUD_PILL_H / 2);
    else ctx.rect(b.x, top, b.w, HUD_PILL_H);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = p.colour ?? "#F3F1EC";
    ctx.fillText(p.text, b.x + b.w / 2, top + HUD_PILL_H / 2 + 0.5);
  });
  ctx.restore();
}
