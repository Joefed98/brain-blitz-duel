/**
 * Cards & Board's thumb-row buttons (display only): Undo, Reset, Draw and Play as dark pills with a gold edge (gold
 * filled while held), an icon and a label, the look of Free Cell's HUD buttons at a thumb-sized height. Used by
 * Pyramid, Golf Solitaire and Muggins; each game's renderer lays them out and hit-tests the same boxes.
 */
import { CARD_FONT, roundRect } from "./cards.renderer";

export type CardButtonIcon = "undo" | "reset" | "draw" | "play" | "none";

export interface CardButtonBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function inButton(b: CardButtonBox, x: number, y: number, slop = 6): boolean {
  return x >= b.x - slop && x <= b.x + b.w + slop && y >= b.y - slop && y <= b.y + b.h + slop;
}

function icon(ctx: CanvasRenderingContext2D, kind: CardButtonIcon, x: number, y: number, colour: string): void {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "undo") {
    ctx.arc(x + 1, y + 2, 6.5, Math.PI * 1.05, Math.PI * 2.35, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 9.5, y + 1);
    ctx.lineTo(x - 4, y - 4);
    ctx.lineTo(x - 3, y + 4);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "reset") {
    ctx.arc(x, y, 7, Math.PI * 0.3, Math.PI * 1.85, false);
    ctx.stroke();
    const a = Math.PI * 1.85;
    const ex = x + 7 * Math.cos(a);
    const ey = y + 7 * Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(ex + 4.5, ey + 1);
    ctx.lineTo(ex - 2.5, ey - 3.5);
    ctx.lineTo(ex - 1, ey + 4.5);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "draw") {
    // Two stacked tiles with an arrow out of the top one.
    roundRect(ctx, x - 7, y - 3, 10, 12, 2);
    ctx.stroke();
    roundRect(ctx, x - 3, y - 7, 10, 12, 2);
    ctx.stroke();
  } else if (kind === "play") {
    ctx.moveTo(x - 5, y - 7);
    ctx.lineTo(x + 7, y);
    ctx.lineTo(x - 5, y + 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** One button: `live` false greys it, `held` fills it gold, `primary` fills it gold-tinted (the action that plays). */
export function drawCardButton(
  ctx: CanvasRenderingContext2D,
  b: CardButtonBox,
  kind: CardButtonIcon,
  label: string,
  opts: { live?: boolean; held?: boolean; primary?: boolean } = {},
): void {
  const live = opts.live ?? true;
  const held = Boolean(opts.held) && live;
  const primary = Boolean(opts.primary) && live;
  roundRect(ctx, b.x, b.y, b.w, b.h, Math.min(16, b.h / 2));
  ctx.fillStyle = held ? "rgba(255,226,140,1)" : primary ? "rgba(233,196,106,0.95)" : "rgba(5,12,30,0.66)";
  ctx.fill();
  ctx.strokeStyle = held ? "#FFF1C4" : primary ? "#FFE7A3" : `rgba(233,196,106,${live ? 0.5 : 0.2})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const ink = held || primary ? "#231503" : live ? "#F6EBD0" : "rgba(246,235,208,0.35)";
  ctx.font = `800 15px ${CARD_FONT}`;
  const tw = ctx.measureText(label).width;
  const iconW = kind === "none" ? 0 : 22;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const left = cx - (tw + iconW) / 2;
  if (kind !== "none") icon(ctx, kind, left + 9, cy, ink);
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, left + iconW, cy + 0.5);
}

/* ---- Reset's confirmation (Cards & Board overhaul, 15 Nov 2026; display and input mapping only: the phone sends
   Reset only after "Reset" here is tapped, so a stray tap never throws the board back) ---- */

/** The confirmation panel's buttons in a w × h world (centred, a little above the middle). */
export function confirmBoxes(w: number, h: number): { panel: CardButtonBox; cancel: CardButtonBox; ok: CardButtonBox } {
  const pw = Math.min(330, w - 40);
  const ph = 150;
  const px = (w - pw) / 2;
  const py = Math.round(h * 0.4 - ph / 2);
  const bw = (pw - 48) / 2;
  return {
    panel: { x: px, y: py, w: pw, h: ph },
    cancel: { x: px + 16, y: py + ph - 62, w: bw, h: 46 },
    ok: { x: px + 32 + bw, y: py + ph - 62, w: bw, h: 46 },
  };
}

/** What a tap on the open confirmation hits: "ok", "cancel" (also anywhere off the panel) or null (the panel). */
export function confirmHit(w: number, h: number, x: number, y: number): "ok" | "cancel" | null {
  const b = confirmBoxes(w, h);
  if (inButton(b.ok, x, y, 2)) return "ok";
  if (inButton(b.cancel, x, y, 2)) return "cancel";
  if (inButton(b.panel, x, y, 0)) return null;
  return "cancel";
}

/** Draws the confirmation over a dimmed table: "Reset to the deal?", a second line, Cancel and Reset. */
export function drawResetConfirm(ctx: CanvasRenderingContext2D, w: number, h: number, line: string, held: "ok" | "cancel" | null = null): void {
  const b = confirmBoxes(w, h);
  ctx.save();
  ctx.fillStyle = "rgba(2,6,16,0.55)";
  ctx.fillRect(0, 0, w, h);
  roundRect(ctx, b.panel.x, b.panel.y, b.panel.w, b.panel.h, 18);
  ctx.fillStyle = "rgba(10,18,40,0.97)";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,196,106,0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#F6EBD0";
  ctx.font = `800 19px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Reset to the deal?", w / 2, b.panel.y + 30);
  ctx.fillStyle = "rgba(246,235,208,0.72)";
  ctx.font = `600 13px ${CARD_FONT}`;
  ctx.fillText(line, w / 2, b.panel.y + 56);
  ctx.restore();
  drawCardButton(ctx, b.cancel, "none", "Cancel", { held: held === "cancel" });
  drawCardButton(ctx, b.ok, "reset", "Reset", { primary: true, held: held === "ok" });
}
