/** Curve-following artwork only; authoritative collision remains in Flip's sim. */
const CURVE_STEP = 3;
const SPIKE_WIDTH = 16;
const SPIKE_HEIGHT = 22;
const GAP_STEP = 10;
const GAP_DEPTH = 40;
const OVERHANG_DEPTH = 34;

export function flipSurfaceLine(
  ctx: CanvasRenderingContext2D,
  surfaceAt: (x: number) => number,
  a: number,
  b: number,
  move = true,
): void {
  if (b <= a) return;
  if (move) ctx.moveTo(a, surfaceAt(a));
  else ctx.lineTo(a, surfaceAt(a));
  for (let x = Math.ceil(a / CURVE_STEP) * CURVE_STEP; x < b; x += CURVE_STEP) {
    ctx.lineTo(x, surfaceAt(x));
  }
  ctx.lineTo(b, surfaceAt(b));
}

export function drawFlipHazard(
  ctx: CanvasRenderingContext2D,
  kind: "spike" | "gap" | "overhang",
  a: number,
  b: number,
  dirY: number,
  surfaceAt: (x: number) => number,
  colour: string,
): void {
  ctx.save();
  ctx.fillStyle = colour;
  if (kind === "spike") {
    for (let x = a; x < b; x += SPIKE_WIDTH) {
      const end = Math.min(b, x + SPIKE_WIDTH);
      const tip = (x + end) / 2;
      ctx.beginPath();
      flipSurfaceLine(ctx, surfaceAt, x, end);
      const heightAt = (point: number) => SPIKE_HEIGHT * Math.max(0, 1 - Math.abs(point - tip) / ((end - x) / 2));
      for (let point = end; point > x; point -= CURVE_STEP) {
        ctx.lineTo(point, surfaceAt(point) + dirY * heightAt(point));
      }
      ctx.lineTo(x, surfaceAt(x));
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === "gap") {
    // The void stays outside the band; its rim and warning chevrons follow it.
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    flipSurfaceLine(ctx, surfaceAt, a, b);
    let zig = 0;
    for (let x = b; x > a; x -= GAP_STEP) {
      zig ^= 1;
      const point = Math.max(a, x - GAP_STEP);
      ctx.lineTo(point, surfaceAt(point) - dirY * (zig ? GAP_DEPTH : GAP_DEPTH - 12));
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const [edge, direction] of [[a, 1], [b, -1]] as const) {
      for (let k = 0; k < 2; k++) {
        const tip = edge + direction * (6 + k * 9);
        const rear = tip - direction * 8;
        const notch = tip - direction * 4;
        ctx.beginPath();
        ctx.moveTo(rear, surfaceAt(rear) - dirY * 2);
        ctx.lineTo(tip, surfaceAt(tip) - dirY * 8);
        ctx.lineTo(rear, surfaceAt(rear) - dirY * 14);
        ctx.lineTo(notch, surfaceAt(notch) - dirY * 8);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else {
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    flipSurfaceLine(ctx, surfaceAt, a, b);
    ctx.lineTo(b, surfaceAt(b) + dirY * OVERHANG_DEPTH);
    for (let x = Math.floor(b / CURVE_STEP) * CURVE_STEP; x > a; x -= CURVE_STEP) {
      ctx.lineTo(x, surfaceAt(x) + dirY * OVERHANG_DEPTH);
    }
    ctx.lineTo(a, surfaceAt(a) + dirY * OVERHANG_DEPTH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}