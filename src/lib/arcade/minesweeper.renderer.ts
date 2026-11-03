/**
 * Minesweeper's art (display only; never imported by the sim or the server). A slate board in a dark metal frame with
 * corner screws over a faint hexagon background; covered squares bevelled (light on top, shadow below), revealed ones
 * recessed; numbers in their own colours with a soft glow; red pennant flags; a gold ripple on the last square
 * revealed (a wide one when the board is cleared). The board is painted into a device layer keyed on the squares'
 * states, so a frame is one blit plus the moving effects.
 */
import { drawHudPillRow } from "./hudPill.renderer";
import { deviceLayer } from "./cache.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { MINESWEEPER_FX } from "./arcadeFxGames.renderer";
import { reducedMotion } from "./art.renderer";
import { TICKS_PER_SECOND, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import {
  minesCleared,
  minesweeperGameFor,
  MINES_BOARD_H,
  MINES_BOARD_W,
  MINES_BOARD_X,
  MINES_BOARD_Y,
  MINES_BOOM,
  MINES_CELL,
  MINES_CELLS,
  MINES_COUNT,
  MINES_FLAG,
  MINES_FRAME,
  MINES_HIDDEN,
  MINES_OPEN,
  MINES_RUN_TICKS,
  MINES_SAFE,
  MINES_WORLD_H,
  MINES_WORLD_W,
  minesCellX,
  minesCellY,
  type MinesState,
} from "./minesweeper";

export const MINES_ART = {
  bg: "#0B0D11",
  hex: "rgba(120, 150, 180, 0.07)",
  frameHi: "#5A616C",
  frame: "#2E333B",
  frameLo: "#15181D",
  screw: "#8A929D",
  slate: "#262C33",
  cover: "#4E5966",
  coverHi: "#7C8896",
  coverLo: "#2B323A",
  open: "#1A1F25",
  openLo: "#11151A",
  flag: "#FF3B3B",
  pole: "#D9DDE2",
  boom: "#C62828",
  gold: "#F2C75C",
  chip: "rgba(20, 24, 30, 0.92)",
  chipEdge: "rgba(255, 255, 255, 0.12)",
  text: "#F3F1EC",
  muted: "#AEB6C0",
};

/** Number colours 1–8, each distinct (and each with its own soft glow). */
export const MINES_NUMBER_COLOURS = ["", "#5AB4FF", "#5CE08A", "#FF6B6B", "#C49BFF", "#FFB347", "#4FE3E0", "#F5F5F5", "#B7C0CA"];

const FONT = "800 22px Archivo, 'Duelz Mono', system-ui, sans-serif";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The faint hexagon background over the whole world. */
export function paintMinesHexes(ctx: CanvasRenderingContext2D, w: number, h: number, colour = MINES_ART.hex): void {
  const r = 14;
  const dx = r * Math.sqrt(3);
  const dy = r * 1.5;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let row = -1; row * dy < h + r; row++) {
    for (let col = -1; col * dx < w + dx; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0);
      const cy = row * dy;
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
  }
  ctx.stroke();
}

function screw(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const g = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5);
  g.addColorStop(0, "#C9CED5");
  g.addColorStop(1, "#4A5059");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 2.6, y + 1.6);
  ctx.lineTo(x + 2.6, y - 1.6);
  ctx.stroke();
}

/** The dark metal frame with its corner screws, round the board. */
export function paintMinesFrame(ctx: CanvasRenderingContext2D): void {
  const x = MINES_BOARD_X - MINES_FRAME;
  const y = MINES_BOARD_Y - MINES_FRAME;
  const w = MINES_BOARD_W + 2 * MINES_FRAME;
  const h = MINES_BOARD_H + 2 * MINES_FRAME;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, MINES_ART.frameHi);
  g.addColorStop(0.08, MINES_ART.frame);
  g.addColorStop(1, MINES_ART.frameLo);
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8);
  ctx.stroke();
  ctx.fillStyle = MINES_ART.slate;
  ctx.fillRect(MINES_BOARD_X - 2, MINES_BOARD_Y - 2, MINES_BOARD_W + 4, MINES_BOARD_H + 4);
  const s = MINES_FRAME / 2;
  screw(ctx, x + s, y + s);
  screw(ctx, x + w - s, y + s);
  screw(ctx, x + s, y + h - s);
  screw(ctx, x + w - s, y + h - s);
}

/** A covered square: raised, light on its top and left, shadow on its bottom and right. */
export function paintMinesCover(ctx: CanvasRenderingContext2D, x: number, y: number, size = MINES_CELL): void {
  const b = Math.max(2, Math.round(size / 10));
  ctx.fillStyle = MINES_ART.cover;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  ctx.fillStyle = MINES_ART.coverHi;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 1);
  ctx.lineTo(x + size - 1, y + 1);
  ctx.lineTo(x + size - 1 - b, y + 1 + b);
  ctx.lineTo(x + 1 + b, y + 1 + b);
  ctx.lineTo(x + 1 + b, y + size - 1 - b);
  ctx.lineTo(x + 1, y + size - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = MINES_ART.coverLo;
  ctx.beginPath();
  ctx.moveTo(x + size - 1, y + size - 1);
  ctx.lineTo(x + 1, y + size - 1);
  ctx.lineTo(x + 1 + b, y + size - 1 - b);
  ctx.lineTo(x + size - 1 - b, y + size - 1 - b);
  ctx.lineTo(x + size - 1 - b, y + 1 + b);
  ctx.lineTo(x + size - 1, y + 1);
  ctx.closePath();
  ctx.fill();
}

/** A revealed square: sunk into the slate, its top and left edges in shadow. */
export function paintMinesOpen(ctx: CanvasRenderingContext2D, x: number, y: number, size = MINES_CELL): void {
  ctx.fillStyle = MINES_ART.open;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  ctx.fillStyle = MINES_ART.openLo;
  ctx.fillRect(x + 1, y + 1, size - 2, 2);
  ctx.fillRect(x + 1, y + 1, 2, size - 2);
}

/** A number with its colour and a soft glow. */
export function paintMinesNumber(ctx: CanvasRenderingContext2D, n: number, cx: number, cy: number, size = MINES_CELL): void {
  if (n <= 0 || n > 8) return;
  ctx.save();
  ctx.font = FONT.replace("22px", `${Math.round(size * 0.6)}px`);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = MINES_NUMBER_COLOURS[n]!;
  ctx.shadowBlur = size * 0.28;
  ctx.fillStyle = MINES_NUMBER_COLOURS[n]!;
  ctx.fillText(String(n), cx, cy + size * 0.03);
  ctx.restore();
}

/** A red pennant on a pole. */
export function paintMinesFlag(ctx: CanvasRenderingContext2D, x: number, y: number, size = MINES_CELL, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const u = size / 36;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + 11 * u, y + 27 * u, 15 * u, 3 * u);
  ctx.fillStyle = MINES_ART.pole;
  ctx.fillRect(x + 16 * u, y + 7 * u, 2.4 * u, 21 * u);
  ctx.fillRect(x + 12 * u, y + 26 * u, 11 * u, 2.6 * u);
  ctx.fillStyle = MINES_ART.flag;
  ctx.beginPath();
  ctx.moveTo(x + 18.4 * u, y + 7 * u);
  ctx.lineTo(x + 29 * u, y + 12 * u);
  ctx.lineTo(x + 18.4 * u, y + 17.5 * u);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.moveTo(x + 18.4 * u, y + 7 * u);
  ctx.lineTo(x + 25 * u, y + 10.2 * u);
  ctx.lineTo(x + 18.4 * u, y + 11 * u);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A mine: a dark sphere with eight spikes and a glint. */
export function paintMinesMine(ctx: CanvasRenderingContext2D, cx: number, cy: number, size = MINES_CELL): void {
  const r = size * 0.22;
  ctx.save();
  ctx.strokeStyle = "#0A0A0C";
  ctx.lineWidth = Math.max(1.5, size / 16);
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (Math.PI / 4) * k;
    ctx.moveTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
    ctx.lineTo(cx + Math.cos(a) * r * 1.55, cy + Math.sin(a) * r * 1.55);
  }
  ctx.stroke();
  ctx.fillStyle = "#121216";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintBoard(ctx: CanvasRenderingContext2D, s: MinesState, over: boolean): void {
  ctx.fillStyle = MINES_ART.bg;
  ctx.fillRect(0, 0, MINES_WORLD_W, MINES_WORLD_H);
  paintMinesHexes(ctx, MINES_WORLD_W, MINES_WORLD_H);
  paintMinesFrame(ctx);
  for (let cell = 0; cell < MINES_CELLS; cell++) {
    const x = minesCellX(cell);
    const y = minesCellY(cell);
    const v = s.open[cell];
    if (v === MINES_OPEN) {
      paintMinesOpen(ctx, x, y);
      paintMinesNumber(ctx, s.nums[cell]!, x + MINES_CELL / 2, y + MINES_CELL / 2);
    } else if (v === MINES_BOOM) {
      ctx.fillStyle = MINES_ART.boom;
      ctx.fillRect(x + 1, y + 1, MINES_CELL - 2, MINES_CELL - 2);
      paintMinesMine(ctx, x + MINES_CELL / 2, y + MINES_CELL / 2);
    } else {
      paintMinesCover(ctx, x, y);
      if (v === MINES_FLAG) paintMinesFlag(ctx, x, y);
      // At the buzzer the mines still hidden show faintly (the board is never played on again).
      if (over && v === MINES_HIDDEN && s.mines[cell]) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        paintMinesMine(ctx, x + MINES_CELL / 2, y + MINES_CELL / 2);
        ctx.restore();
      }
    }
  }
}

/** The HUD chips across the top: mines left (25 less flags and mines hit), safe squares and mines hit. */
function paintHud(ctx: CanvasRenderingContext2D, s: MinesState): void {
  let marked = 0;
  for (let i = 0; i < MINES_CELLS; i++) if (s.open[i] === MINES_FLAG || s.open[i] === MINES_BOOM) marked += 1;
  // Pill chips (3 Nov 2026), the main count (safe squares) top left.
  drawHudPillRow(ctx, 10, 8, [
    { label: "Safe", value: `${s.revealed}/${MINES_SAFE}`, opts: { gold: s.revealed >= MINES_SAFE } },
    { label: "Mines", value: String(MINES_COUNT - marked) },
    { label: "Hits", value: String(s.hits), opts: { alert: s.hits > 0 } },
  ]);
}

/** The board, the HUD and the moving effects, under the shared success layer (MINESWEEPER_FX). */
export function drawMinesweeper(ctx: CanvasRenderingContext2D, s: MinesState, size: CanvasSize): void {
  arcadeFx(ctx, MINESWEEPER_FX, s, () => drawMinesWorld(ctx, s), size);
}

function drawMinesWorld(ctx: CanvasRenderingContext2D, s: MinesState): void {
  const over = minesCleared(s) || s.tick >= MINES_RUN_TICKS;
  const key = `mines|${s.seed}|${over ? 1 : 0}|${s.open.join("")}`;
  deviceLayer(ctx, key, (c) => paintBoard(c, s, over));
  paintHud(ctx, s);
  const still = reducedMotion();
  // A gold ripple on the last square revealed (a wide one on the square that clears the board).
  if (s.lastOpen >= 0) {
    const cleared = minesCleared(s) && s.clearedTick === s.lastOpenTick;
    const life = cleared ? TICKS_PER_SECOND * 1.4 : TICKS_PER_SECOND * 0.55;
    const age = s.tick - s.lastOpenTick;
    if (age >= 0 && age < life) {
      const k = age / life;
      const cx = minesCellX(s.lastOpen) + MINES_CELL / 2;
      const cy = minesCellY(s.lastOpen) + MINES_CELL / 2;
      ctx.save();
      ctx.strokeStyle = MINES_ART.gold;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.lineWidth = cleared ? 4 : 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, still ? MINES_CELL * 0.45 : MINES_CELL * (0.35 + k * (cleared ? 6 : 0.9)), 0, Math.PI * 2);
      ctx.stroke();
      if (cleared && !still) {
        ctx.globalAlpha = (1 - k) * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, MINES_CELL * (0.2 + k * 3.5), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  // A mine hit flashes its square.
  if (s.lastHit >= 0) {
    const age = s.tick - s.lastHitTick;
    const life = TICKS_PER_SECOND * 0.5;
    if (age >= 0 && age < life) {
      ctx.save();
      ctx.globalAlpha = (1 - age / life) * 0.6;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(minesCellX(s.lastHit), minesCellY(s.lastHit), MINES_CELL, MINES_CELL);
      ctx.restore();
    }
  }
}

/** The playable game with its art (the stage draws through this). One object for the one revision: a stage resets its
 * run when its game object changes, so a re-render (the Reveal / Flag switch) must hand it the same one. */
const MINES_ART_GAME: ArcadeGame<MinesState, ArcadeInputEvent | null> = { ...minesweeperGameFor(), draw: drawMinesweeper };
export function minesweeperArtGameFor(_rev?: number | null): ArcadeGame<MinesState, ArcadeInputEvent | null> {
  return MINES_ART_GAME;
}
