/**
 * The art kit's finish for the redrawn in-game looks (docs/design/style-guide/STYLE-GUIDE.md "Art kit"): one gloss
 * material and one key light from the top left. Painted over an object's own colours and kept inside its outline:
 * a broad diffuse (lit top left, falling off bottom right), one tight white highlight and a soft rim on the shadow
 * side. Display only; deterministic (no randomness).
 */

/** Gloss over a sphere already painted at (x, y), radius r: everything stays inside r. */
export function glossSphere(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, strength = 1): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  // The diffuse: lit up and to the left, shade down and to the right.
  const lx = x - r * 0.38;
  const ly = y - r * 0.42;
  const d = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 1.75);
  d.addColorStop(0, `rgba(255,255,255,${0.2 * strength})`);
  d.addColorStop(0.35, "rgba(255,255,255,0)");
  d.addColorStop(0.62, `rgba(0,0,0,${0.12 * strength})`);
  d.addColorStop(1, `rgba(0,0,0,${0.55 * strength})`);
  ctx.fillStyle = d;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  // The soft rim: a little bounce light along the lower right edge.
  const rim = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.78, x - r * 0.2, y - r * 0.25, r * 1.22);
  rim.addColorStop(0, "rgba(255,255,255,0)");
  rim.addColorStop(0.75, `rgba(255,255,255,${0.16 * strength})`);
  rim.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = rim;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  // The tight highlight.
  const hr = Math.max(0.6, r * 0.2);
  const hx = x - r * 0.4;
  const hy = y - r * 0.45;
  const h = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
  h.addColorStop(0, `rgba(255,255,255,${0.95 * Math.min(1, strength)})`);
  h.addColorStop(0.45, `rgba(255,255,255,${0.55 * Math.min(1, strength)})`);
  h.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = h;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.fill();
}

/** Gloss over a flat elliptical top (a stone's, seen from above): lit top left, a tight highlight, the far edge shaded. */
export function glossDisc(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, strength = 1): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
  g.addColorStop(0, `rgba(255,255,255,${0.28 * strength})`);
  g.addColorStop(0.45, "rgba(255,255,255,0)");
  g.addColorStop(1, `rgba(0,0,0,${0.38 * strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  const hx = x - rx * 0.42;
  const hy = y - ry * 0.4;
  const hr = Math.max(0.6, rx * 0.22);
  ctx.translate(hx, hy);
  ctx.scale(1, Math.max(0.2, ry / rx));
  const h = ctx.createRadialGradient(0, 0, 0, 0, 0, hr);
  h.addColorStop(0, `rgba(255,255,255,${0.85 * Math.min(1, strength)})`);
  h.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = h;
  ctx.beginPath();
  ctx.arc(0, 0, hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A small deterministic hash in [0, 1). */
export function hash01(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
