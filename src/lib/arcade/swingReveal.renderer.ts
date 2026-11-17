/**
 * Grappler's run picture on the answer reveal (the Action overhaul, stage 2, 15 Nov 2026; display only): the course's
 * stretches (51 on every dealt course) as one path folded into rows, read left to right then back: each swinging
 * stretch a vine's dip, each ledge-run section a flat plank; gold where it was cleared under par, lime where it was
 * cleared, a dashed lime where the run ended, faint where it never got to. Blue drops under a stretch are falls into the
 * river (or a squeeze's rock), a red wedge over it a pterodactyl catch; small gate posts stand over the stretches that
 * hold a gate, gold once lit. Drawn from traceSwingRun (the stored run replayed by the server's own replay).
 *
 * Stage 3 (15 Nov 2026, Joe: 51 stretches squeezed 17 to a row read as a tight squiggle on a phone): the path folds
 * into as many rows as keep every stretch at least SWING_RUN_MIN_CELL px wide on the reveal's real width (8 or 9 a row
 * on a phone, so 7 or 6 rows), each row SWING_RUN_ROW_H tall, with bigger marks (SWING_RUN_MARKS) and the one figure it
 * draws (a stretch's falls past one) at SWING_RUN_TEXT_PX. The canvas is drawn at its displayed CSS size, so these are
 * on-screen pixels (swing-overhaul-check section 11 measures them at 375 x 667 and 390 x 844).
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

/** The narrowest a stretch is drawn (on-screen px), and the most a row holds. */
export const SWING_RUN_MIN_CELL = 34;
export const SWING_RUN_MAX_COLS = 10;
/** A row's height and the picture's side padding (on-screen px). */
export const SWING_RUN_ROW_H = 46;
export const SWING_RUN_PAD = 16;
/** The size of the one figure drawn in the picture (a stretch's fall count). */
export const SWING_RUN_TEXT_PX = 13;
/** The marks' on-screen sizes. */
export const SWING_RUN_MARKS = {
  /** Stretch lines: reached and ahead. */
  line: 6,
  lineAhead: 4,
  /** A swinging stretch's dip. */
  dip: 9,
  /** A fall's drop: width and height. */
  dropW: 8,
  dropH: 11,
  /** A gate's two posts: height, width and gap. */
  gateH: 12,
  gateW: 3,
  gateGap: 7,
  /** A catch's wedge: width and height. */
  wedgeW: 14,
  wedgeH: 9,
  /** The start dot's radius and the finish flag's height. */
  startR: 5,
  flagH: 18,
} as const;

/** The picture's layout for a width (on-screen px) and stretch count: stretches a row, rows, a stretch's width. */
export function swingRunLayout(width: number, total: number): { cols: number; rows: number; cell: number; rowH: number; height: number } {
  const cols = Math.max(4, Math.min(SWING_RUN_MAX_COLS, Math.floor((width - 2 * SWING_RUN_PAD) / SWING_RUN_MIN_CELL)));
  const rows = Math.max(1, Math.ceil(total / cols));
  const cell = (width - 2 * SWING_RUN_PAD) / cols;
  return { cols, rows, cell, rowH: SWING_RUN_ROW_H, height: rows * SWING_RUN_ROW_H + 12 };
}

/** The picture's height for a width (on-screen px); 51 stretches on every dealt course. */
export function swingRunPictureHeight(width: number, total = 51): number {
  return swingRunLayout(width, total).height;
}

/** Where stretch k sits: its row, its left and right x and its baseline y (the path runs right on even rows). */
export function swingRunSlot(k: number, total: number, width: number): { row: number; x0: number; x1: number; y: number } {
  const { cols, cell, rowH } = swingRunLayout(width, total);
  const row = Math.trunc(k / cols);
  const i = k % cols;
  const y = 4 + rowH * row + rowH * 0.46;
  const left = row % 2 === 0 ? SWING_RUN_PAD + i * cell : width - SWING_RUN_PAD - (i + 1) * cell;
  return row % 2 === 0 ? { row, x0: left, x1: left + cell, y } : { row, x0: left + cell, x1: left, y };
}

export function drawSwingRunPicture(ctx: CanvasRenderingContext2D, trace: SwingRunTrace, size: { width: number; height: number }): void {
  const { width } = size;
  const total = trace.stretches.length;
  if (total === 0) return;
  const M = SWING_RUN_MARKS;
  const { cols } = swingRunLayout(width, total);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // The turns between rows: a faint half loop past the row's end.
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = M.lineAhead;
  for (let r = 0; (r + 1) * cols < total; r++) {
    const end = swingRunSlot((r + 1) * cols - 1, total, width);
    const next = swingRunSlot((r + 1) * cols, total, width);
    const side = r % 2 === 0 ? 1 : -1;
    const x = end.x1;
    ctx.beginPath();
    ctx.moveTo(x - side * 3, end.y);
    ctx.bezierCurveTo(x + side * 12, end.y, x + side * 12, next.y, next.x0 - side * 3, next.y);
    ctx.stroke();
  }
  trace.stretches.forEach((st, k) => {
    const { x0, x1, y } = swingRunSlot(k, total, width);
    ctx.strokeStyle = SWING_RUN_COLOURS[st.state];
    ctx.lineWidth = st.state === "ahead" ? M.lineAhead : M.line;
    if (st.state === "current") ctx.setLineDash([5, 6]);
    ctx.beginPath();
    const a = x0 + (x1 - x0) * 0.1;
    const b = x1 - (x1 - x0) * 0.1;
    if (st.swinging) {
      ctx.moveTo(a, y);
      ctx.quadraticCurveTo((a + b) / 2, y + M.dip * 2, b, y);
    } else {
      ctx.moveTo(a, y + M.dip * 0.5);
      ctx.lineTo(b, y + M.dip * 0.5);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const mid = (x0 + x1) / 2;
    // Gates over the stretch: two posts, gold once lit.
    st.gates.forEach((lit, g) => {
      const gx = mid + (g - (st.gates.length - 1) / 2) * (M.gateGap + M.gateW * 2 + 4);
      ctx.strokeStyle = lit ? SWING_RUN_COLOURS.under : SWING_RUN_COLOURS.gateOff;
      ctx.lineWidth = M.gateW;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(gx - M.gateGap / 2, y - 6 - M.gateH);
      ctx.lineTo(gx - M.gateGap / 2, y - 6);
      ctx.moveTo(gx + M.gateGap / 2, y - 6 - M.gateH);
      ctx.lineTo(gx + M.gateGap / 2, y - 6);
      ctx.stroke();
      ctx.lineCap = "round";
    });
    // Falls: one blue drop under the stretch, and the count beside it past one.
    if (st.falls > 0) {
      const dx = st.falls > 1 ? mid - 5 : mid;
      const dy = y + M.dip + 9;
      ctx.fillStyle = SWING_RUN_COLOURS.fall;
      ctx.beginPath();
      ctx.moveTo(dx, dy - M.dropH * 0.6);
      ctx.quadraticCurveTo(dx + M.dropW * 0.62, dy + M.dropH * 0.05, dx, dy + M.dropH * 0.4);
      ctx.quadraticCurveTo(dx - M.dropW * 0.62, dy + M.dropH * 0.05, dx, dy - M.dropH * 0.6);
      ctx.fill();
      if (st.falls > 1) {
        ctx.font = `800 ${SWING_RUN_TEXT_PX}px Archivo, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(String(st.falls), dx + M.dropW * 0.6 + 2, dy);
      }
    }
    // A pterodactyl catch: a red wedge over the stretch.
    if (st.caught > 0) {
      ctx.fillStyle = SWING_RUN_COLOURS.caught;
      ctx.beginPath();
      ctx.moveTo(mid - M.wedgeW / 2, y - 22);
      ctx.lineTo(mid + M.wedgeW / 2, y - 22);
      ctx.lineTo(mid, y - 22 + M.wedgeH);
      ctx.closePath();
      ctx.fill();
    }
  });
  // The start (a lime dot) and the finish (a flag, gold when the course was cleared).
  const first = swingRunSlot(0, total, width);
  ctx.fillStyle = SWING_RUN_COLOURS.cleared;
  ctx.beginPath();
  ctx.arc(first.x0, first.y, M.startR, 0, Math.PI * 2);
  ctx.fill();
  const last = swingRunSlot(total - 1, total, width);
  ctx.strokeStyle = trace.finished ? SWING_RUN_COLOURS.under : SWING_RUN_COLOURS.gateOff;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(last.x1, last.y + 5);
  ctx.lineTo(last.x1, last.y - M.flagH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(last.x1, last.y - M.flagH);
  ctx.lineTo(last.x1 + (last.x1 > last.x0 ? 12 : -12), last.y - M.flagH + 5);
  ctx.lineTo(last.x1, last.y - M.flagH + 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
