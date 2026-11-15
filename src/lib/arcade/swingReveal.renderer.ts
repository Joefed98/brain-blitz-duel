/**
 * Grappler's run picture on the answer reveal (the Action overhaul, stage 2, 15 Nov 2026; display only): the course's
 * stretches (51 on every dealt course) as one path folded into three rows, read left to right then back: each swinging
 * stretch a vine's dip, each ledge-run section a flat plank; gold where it was cleared under par, lime where it was
 * cleared, a dashed lime where the run ended, faint where it never got to. Blue drops under a stretch are falls into the
 * river (or a squeeze's rock), a red wedge over it a pterodactyl catch; small gate posts stand over the stretches that
 * hold a gate, gold once lit. Drawn from traceSwingRun (the stored run replayed by the server's own replay).
 */
import type { SwingRunTrace } from "@/lib/duel/swingRunTrace";

export const SWING_RUN_COLOURS = {
  under: "#F2C75C",
  cleared: "#8FD15A",
  current: "#8FD15A",
  ahead: "rgba(255,255,255,0.2)",
  fall: "#5CC8F2",
  caught: "#FF5D6A",
  gateOff: "rgba(255,255,255,0.35)",
} as const;

/** Rows the path folds into. */
export const SWING_RUN_ROWS = 3;
/** The picture's height for a width (world px). */
export function swingRunPictureHeight(width: number): number {
  return Math.round(Math.max(150, Math.min(220, width * 0.56)));
}

/** Where stretch k sits: its row, its left and right x and its baseline y (the path runs right on even rows). */
export function swingRunSlot(k: number, total: number, width: number, height: number): { row: number; x0: number; x1: number; y: number } {
  const per = Math.ceil(total / SWING_RUN_ROWS);
  const row = Math.trunc(k / per);
  const i = k % per;
  const pad = 22;
  const w = (width - 2 * pad) / per;
  const rowH = height / SWING_RUN_ROWS;
  const y = rowH * row + rowH * 0.42;
  const left = row % 2 === 0 ? pad + i * w : width - pad - (i + 1) * w;
  return row % 2 === 0 ? { row, x0: left, x1: left + w, y } : { row, x0: left + w, x1: left, y };
}

export function drawSwingRunPicture(ctx: CanvasRenderingContext2D, trace: SwingRunTrace, size: { width: number; height: number }): void {
  const { width, height } = size;
  const total = trace.stretches.length;
  if (total === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const rowH = height / SWING_RUN_ROWS;
  const dip = Math.min(12, rowH * 0.22);
  // The turns between rows: a faint half loop at the ends.
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 3;
  const per = Math.ceil(total / SWING_RUN_ROWS);
  for (let r = 0; r + 1 < SWING_RUN_ROWS && (r + 1) * per < total; r++) {
    const end = swingRunSlot((r + 1) * per - 1, total, width, height);
    const next = swingRunSlot((r + 1) * per, total, width, height);
    const x = end.x1;
    const side = r % 2 === 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x, end.y);
    ctx.bezierCurveTo(x + side * 16, end.y, x + side * 16, next.y, next.x0, next.y);
    ctx.stroke();
  }
  trace.stretches.forEach((st, k) => {
    const { x0, x1, y } = swingRunSlot(k, total, width, height);
    const colour = SWING_RUN_COLOURS[st.state];
    ctx.strokeStyle = colour;
    ctx.lineWidth = st.state === "ahead" ? 3 : 5;
    if (st.state === "current") ctx.setLineDash([3, 4]);
    ctx.beginPath();
    const a = x0 + (x1 - x0) * 0.08;
    const b = x1 - (x1 - x0) * 0.08;
    if (st.swinging) {
      ctx.moveTo(a, y);
      ctx.quadraticCurveTo((a + b) / 2, y + dip * 2, b, y);
    } else {
      ctx.moveTo(a, y + dip * 0.4);
      ctx.lineTo(b, y + dip * 0.4);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const mid = (x0 + x1) / 2;
    // Gates over the stretch: two small posts, gold once lit.
    st.gates.forEach((lit, g) => {
      const gx = mid + (g - (st.gates.length - 1) / 2) * 7;
      ctx.strokeStyle = lit ? SWING_RUN_COLOURS.under : SWING_RUN_COLOURS.gateOff;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx - 2.5, y - 14);
      ctx.lineTo(gx - 2.5, y - 5);
      ctx.moveTo(gx + 2.5, y - 14);
      ctx.lineTo(gx + 2.5, y - 5);
      ctx.stroke();
    });
    // Falls: blue drops under the stretch (three at most, then the count beside them).
    const drops = Math.min(3, st.falls);
    for (let d = 0; d < drops; d++) {
      const dx = mid + (d - (drops - 1) / 2) * 6;
      const dy = y + dip + 9;
      ctx.fillStyle = SWING_RUN_COLOURS.fall;
      ctx.beginPath();
      ctx.moveTo(dx, dy - 4);
      ctx.quadraticCurveTo(dx + 3, dy, dx, dy + 2.5);
      ctx.quadraticCurveTo(dx - 3, dy, dx, dy - 4);
      ctx.fill();
    }
    if (st.falls > 3) {
      ctx.fillStyle = SWING_RUN_COLOURS.fall;
      ctx.font = "800 11px Archivo, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(String(st.falls), mid + 11, y + dip + 13);
    }
    // A pterodactyl catch: a red wedge over the stretch.
    if (st.caught > 0) {
      ctx.fillStyle = SWING_RUN_COLOURS.caught;
      ctx.beginPath();
      ctx.moveTo(mid - 6, y - 20);
      ctx.lineTo(mid + 6, y - 20);
      ctx.lineTo(mid, y - 13);
      ctx.closePath();
      ctx.fill();
    }
  });
  // The start (a lime dot) and the finish (a flag, gold when the course was cleared).
  const first = swingRunSlot(0, total, width, height);
  ctx.fillStyle = SWING_RUN_COLOURS.cleared;
  ctx.beginPath();
  ctx.arc(first.x0, first.y, 4, 0, Math.PI * 2);
  ctx.fill();
  const last = swingRunSlot(total - 1, total, width, height);
  ctx.strokeStyle = trace.finished ? SWING_RUN_COLOURS.under : SWING_RUN_COLOURS.gateOff;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(last.x1, last.y + 4);
  ctx.lineTo(last.x1, last.y - 16);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(last.x1, last.y - 16);
  ctx.lineTo(last.x1 + (last.x1 > last.x0 ? 10 : -10), last.y - 12);
  ctx.lineTo(last.x1, last.y - 8);
  ctx.closePath();
  ctx.fill();
  void rowH;
  ctx.restore();
}
