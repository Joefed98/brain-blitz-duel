/**
 * The Sports overhaul's HUD material (15 Nov 2026, Home Run and Top Bins rev 5; display only): pills of dark smoked
 * glass with a crisp highlight along the top of their curve and a faint shade at the foot, gold ones in deep enamel
 * with the same highlight. Light on the material, never a glow round the edge or a sheen washing over the text.
 */

/** Paints a glass pill's body at (x, y, w, h); text is the caller's. */
export function glassPill(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, gold = false): void {
  const r = h / 2;
  ctx.save();
  // A soft drop shadow under the pill (depth, not glow).
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.roundRect(x, y + 1.5, w, h, r);
  ctx.fill();
  const body = ctx.createLinearGradient(0, y, 0, y + h);
  if (gold) {
    body.addColorStop(0, "#F8DD8C");
    body.addColorStop(0.5, "#E2B04A");
    body.addColorStop(1, "#A9772A");
  } else {
    body.addColorStop(0, "rgba(46,54,78,0.92)");
    body.addColorStop(0.55, "rgba(12,16,28,0.9)");
    body.addColorStop(1, "rgba(6,8,16,0.94)");
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  // The rim: a thin, even line (no glow).
  ctx.strokeStyle = gold ? "rgba(120,80,20,0.9)" : "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // The crisp highlight along the top curve: a narrow bright band hugging the upper edge, fading out toward the ends.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, w - 2, h - 2, r - 1);
  ctx.clip();
  const hl = ctx.createLinearGradient(x, 0, x + w, 0);
  const a = gold ? 0.75 : 0.32;
  hl.addColorStop(0, "rgba(255,255,255,0)");
  hl.addColorStop(0.2, `rgba(255,255,255,${a})`);
  hl.addColorStop(0.8, `rgba(255,255,255,${a})`);
  hl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = hl;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.7, y + 1.8);
  ctx.lineTo(x + w - r * 0.7, y + 1.8);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** A glossy specular spot on a sphere (leather or resin): a crisp small highlight up and left of centre. */
export function glossSpot(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (r < 2.5) return;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.26, r * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
