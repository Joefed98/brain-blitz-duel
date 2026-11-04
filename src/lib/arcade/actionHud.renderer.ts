/**
 * The Action group's one HUD (3 Nov 2026, Joe's audit; display only): every Action game (Slice, Roofbound, Grappler,
 * Moon Climb, Iron Wall, High Rise) draws its in-world readouts as the same dark rounded pill chips, a small
 * upper-case label and its value, in at most two rows across the top of the world. The main count is the first chip
 * of the first row (top left); a row's chips run left to right from the left edge, its `right` chips right to left
 * from the right edge. A chip's text is never more than one "·" (the helper refuses a second). The pixel arcade font is
 * Retro's identity and is not used here: Archivo (the app's display face) for both label and value.
 *
 * Render only: never reads or writes a sim, only the numbers each renderer hands it.
 */
import { ARCADE_FX_DISPLAY_FONT } from "./arcadeFx.renderer";
import { successHud } from "./success.renderer";

export type ActionChipTone = "plain" | "gold" | "good" | "bad" | "dim" | "hot";

export interface ActionChip {
  /** Upper-case label drawn small before the value ("STREAK"); empty for a value alone. */
  label: string;
  value: string;
  tone?: ActionChipTone;
  /** 0–1: a thin bar under the value (a timer or a meter). */
  meter?: number;
  /** 0–1: a ring round the chip fading out (a moment just happened). */
  flash?: number;
  /** A small icon painted in a 14 px square before the label. */
  icon?: (ctx: CanvasRenderingContext2D, cx: number, cy: number) => void;
  /** The shared success layer's HUD pulse (the main count only): its game id and the tick. */
  pulse?: { id: string; tick: number };
}

export interface ActionHudRow {
  left: ActionChip[];
  right?: ActionChip[];
}

/** Pill geometry (world px). */
export const ACTION_CHIP_H = 28;
export const ACTION_CHIP_GAP = 8;
export const ACTION_HUD_TOP = 10;
export const ACTION_HUD_EDGE = 10;
export const ACTION_ROW_STEP = ACTION_CHIP_H + 6;
/** The bottom of an n-row HUD (world px), for scenery or readouts placed under it. */
export function actionHudBottom(rows: number, top = ACTION_HUD_TOP): number {
  return top + rows * ACTION_ROW_STEP - 6;
}

const LABEL_FONT = `700 10px ${ARCADE_FX_DISPLAY_FONT}`;
const VALUE_FONT = `800 15px ${ARCADE_FX_DISPLAY_FONT}`;
const FILL = "rgba(10,12,18,0.82)";
const EDGE = "rgba(255,255,255,0.12)";
const LABEL = "#A9AEC0";
const TONES: Record<ActionChipTone, string> = {
  plain: "#F5F5F7",
  gold: "#F2C75C",
  good: "#5BE08A",
  bad: "#FF5D6A",
  dim: "#8C91A3",
  hot: "#FF9A3C",
};

/** A chip's width (world px) at the helper's fonts. */
export function actionChipWidth(ctx: CanvasRenderingContext2D, chip: ActionChip): number {
  ctx.font = LABEL_FONT;
  const lw = chip.label ? ctx.measureText(chip.label).width + chip.label.length * 0.6 + 6 : 0;
  ctx.font = VALUE_FONT;
  const vw = ctx.measureText(chip.value).width;
  return Math.ceil(24 + (chip.icon ? 18 : 0) + lw + vw);
}

/** Throws on a chip carrying more than one "·" (the HUD rule: at most one per line). */
function checkDots(chip: ActionChip): void {
  const dots = `${chip.label} ${chip.value}`.split("·").length - 1;
  if (dots > 1) throw new Error(`action HUD chip "${chip.label} ${chip.value}" has ${dots} "·"`);
}

function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, chip: ActionChip): number {
  checkDots(chip);
  const w = actionChipWidth(ctx, chip);
  const h = ACTION_CHIP_H;
  const r = h / 2;
  ctx.fillStyle = FILL;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = chip.tone === "gold" ? "rgba(242,199,92,0.55)" : EDGE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r - 0.5);
  ctx.stroke();
  let cx = x + 12;
  const cy = y + h / 2 + 0.5;
  if (chip.icon) {
    chip.icon(ctx, cx + 7, cy);
    cx += 18;
  }
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  if (chip.label) {
    ctx.font = LABEL_FONT;
    ctx.fillStyle = LABEL;
    // Letter-spaced by hand (canvas letterSpacing is not on every engine).
    for (const ch of chip.label) {
      ctx.fillText(ch, cx, cy + 0.5);
      cx += ctx.measureText(ch).width + 0.6;
    }
    cx += 6;
  }
  ctx.font = VALUE_FONT;
  ctx.fillStyle = TONES[chip.tone ?? "plain"];
  const value = () => ctx.fillText(chip.value, cx, cy);
  if (chip.pulse) successHud(ctx, chip.pulse.id, chip.pulse.tick, cx, cy, value);
  else value();
  if (chip.meter !== undefined) {
    const m = Math.max(0, Math.min(1, chip.meter));
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x + 12, y + h - 5, w - 24, 2);
    ctx.fillStyle = TONES[chip.tone ?? "gold"] ?? TONES.gold;
    ctx.fillRect(x + 12, y + h - 5, (w - 24) * m, 2);
  }
  if (chip.flash && chip.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, chip.flash);
    ctx.strokeStyle = TONES.gold;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, w + 4, h + 4, r + 2);
    ctx.stroke();
    ctx.restore();
  }
  return w;
}

/**
 * Draws up to two rows of chips across the top of a `width`-wide world. Saves and restores the context; fonts,
 * fills and alignment are left as they were.
 */
export function drawActionHud(ctx: CanvasRenderingContext2D, width: number, rows: readonly ActionHudRow[], top = ACTION_HUD_TOP): void {
  if (rows.length > 2) throw new Error("the action HUD has at most two rows");
  ctx.save();
  rows.forEach((row, k) => {
    const y = top + k * ACTION_ROW_STEP;
    let x = ACTION_HUD_EDGE;
    for (const chip of row.left) x += drawChip(ctx, x, y, chip) + ACTION_CHIP_GAP;
    let rx = width - ACTION_HUD_EDGE;
    for (const chip of row.right ?? []) {
      const w = actionChipWidth(ctx, chip);
      rx -= w;
      drawChip(ctx, rx, y, chip);
      rx -= ACTION_CHIP_GAP;
    }
  });
  ctx.restore();
}
