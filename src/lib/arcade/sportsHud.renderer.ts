/**
 * The Sports group's HUD pill chip (3 Nov 2026, display only; Joe's audit): a dark rounded pill holding a muted label
 * and a bright value ("THROW 1/10", "IN 3"), 22 px tall, the look Top Bins, Home Run, Crazy Golf and Cue Ball already
 * use. Swish and Flightpath draw their HUD with it in place of their dotted text lines. At most two rows of chips, the
 * main count top left, at most one "·" in a chip.
 */

const MONO = "'Duelz Mono', 'JetBrains Mono', ui-monospace, monospace";
const GOLD = "#F2C75C";
export const SPORTS_CHIP_H = 22;
export const SPORTS_CHIP_GAP = 6;

/**
 * Draws one chip with its left edge at x ("right": its right edge at x), its top at y; returns its width. `accent`
 * rings it gold and draws the value gold (a count that has started, a streak running).
 */
export function sportsChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
  accent = false,
  align: "left" | "right" = "left",
): number {
  ctx.save();
  ctx.font = `700 10px ${MONO}`;
  const lw = label ? Math.ceil(ctx.measureText(label).width) : 0;
  ctx.font = `800 12px ${MONO}`;
  const vw = Math.ceil(ctx.measureText(value).width);
  const w = 18 + lw + (label && value ? 6 : 0) + vw;
  const x0 = align === "left" ? x : x - w;
  ctx.fillStyle = "rgba(6,9,18,0.72)";
  ctx.beginPath();
  ctx.roundRect(x0, y, w, SPORTS_CHIP_H, SPORTS_CHIP_H / 2);
  ctx.fill();
  ctx.strokeStyle = accent ? "rgba(242,199,92,0.75)" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const cy = y + SPORTS_CHIP_H / 2 + 0.5;
  if (label) {
    ctx.font = `700 10px ${MONO}`;
    ctx.fillStyle = "rgba(243,241,236,0.62)";
    ctx.fillText(label, x0 + 9, cy);
  }
  ctx.font = `800 12px ${MONO}`;
  ctx.fillStyle = accent ? GOLD : "#F3F1EC";
  ctx.fillText(value, x0 + 9 + lw + (label && value ? 6 : 0), cy);
  ctx.restore();
  return w;
}

/** A row of chips from x, left to right, SPORTS_CHIP_GAP apart; returns the x after the last. */
export function sportsChipRow(ctx: CanvasRenderingContext2D, x: number, y: number, chips: readonly { label: string; value: string; accent?: boolean }[]): number {
  let at = x;
  for (const c of chips) at += sportsChip(ctx, at, y, c.label, c.value, c.accent ?? false) + SPORTS_CHIP_GAP;
  return at;
}
