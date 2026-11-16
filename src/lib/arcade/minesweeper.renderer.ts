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
  MINES_BOOM,
  MINES_CELL,
  minesCountFor,
  minesProgress,
  MINES_FLAG,
  MINES_FRAME,
  MINES_HIDDEN,
  MINES_OPEN,
  minesCellX,
  minesCellY,
  minesGeoFor,
  type MinesGeo,
  type MinesState,
} from "./minesweeper";
import { logicSprite, logicSpritesReady } from "./logicArt.renderer";

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
  boom: "#8E2424",
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
export function paintMinesFrame(ctx: CanvasRenderingContext2D, g: MinesGeo = minesGeoFor(1)): void {
  const x = g.boardX - MINES_FRAME;
  const y = g.boardY - MINES_FRAME;
  const w = g.boardW + 2 * MINES_FRAME;
  const h = g.boardH + 2 * MINES_FRAME;
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, MINES_ART.frameHi);
  grad.addColorStop(0.08, MINES_ART.frame);
  grad.addColorStop(1, MINES_ART.frameLo);
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8);
  ctx.stroke();
  ctx.fillStyle = MINES_ART.slate;
  ctx.fillRect(g.boardX - 2, g.boardY - 2, g.boardW + 4, g.boardH + 4);
  const s = MINES_FRAME / 2;
  screw(ctx, x + s, y + s);
  screw(ctx, x + w - s, y + s);
  screw(ctx, x + s, y + h - s);
  screw(ctx, x + w - s, y + h - s);
}

export { MINES_DEFUSE_TICKS } from "./minesweeperFx";
import { MINES_DEFUSE_TICKS } from "./minesweeperFx";

/** A tapped number whose flags don't add up yet gives a tiny shake (Logic overhaul 1; display only, set by the stage). */
let nudge: { cell: number; at: number } = { cell: -1, at: 0 };
const NUDGE_TICKS = 18;
export function setMinesNudge(cell: number, tick: number): void {
  nudge = { cell, at: tick };
}

/** The Logic overhaul's rendered pieces (Minefield A: raised silver stone, recessed slate, an iron mine, a cloth flag). */
export const MINES_SPRITES = ["mine-raised", "mine-open", "mine-mine", "mine-flag"] as const;

/** A covered square: raised, light on its top and left, shadow on its bottom and right. */
export function paintMinesCover(ctx: CanvasRenderingContext2D, x: number, y: number, size = MINES_CELL): void {
  const sprite = logicSprite("mine-raised");
  if (sprite) {
    ctx.drawImage(sprite, x + 0.5, y + 0.5, size - 1, size - 1);
    return;
  }
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
  const sprite = logicSprite("mine-open");
  if (sprite) {
    ctx.drawImage(sprite, x + 1, y + 1, size - 2, size - 2);
    return;
  }
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
  // Logic overhaul 1: bigger and bolder, a dark edge instead of a glow, so it reads on the slate.
  ctx.font = FONT.replace("800 22px", `900 ${Math.round(size * 0.7)}px`);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = size * 0.06;
  ctx.shadowOffsetY = size * 0.03;
  ctx.fillStyle = MINES_NUMBER_COLOURS[n]!;
  ctx.fillText(String(n), cx, cy + size * 0.03);
  ctx.restore();
}

/** A red pennant on a pole. */
export function paintMinesFlag(ctx: CanvasRenderingContext2D, x: number, y: number, size = MINES_CELL, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const sprite = logicSprite("mine-flag");
  if (sprite) {
    ctx.drawImage(sprite, x + size * 0.1, y + size * 0.08, size * 0.8, size * 0.8);
    ctx.restore();
    return;
  }
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
  const sprite = logicSprite("mine-mine");
  if (sprite) {
    ctx.drawImage(sprite, cx - size * 0.42, cy - size * 0.42, size * 0.84, size * 0.84);
    return;
  }
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
  const g = minesGeoFor(s.rev);
  ctx.fillStyle = MINES_ART.bg;
  ctx.fillRect(0, 0, g.worldW, g.worldH);
  paintMinesHexes(ctx, g.worldW, g.worldH);
  paintMinesFrame(ctx, g);
  for (let cell = 0; cell < g.cells; cell++) {
    const x = minesCellX(cell, g);
    const y = minesCellY(cell, g);
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
      // At the end (the reveal's summary of the run, Logic overhaul 1): a flag on a mine is ringed gold, a flag on a
      // safe square struck through in red.
      if (over && v === MINES_FLAG) {
        ctx.save();
        ctx.lineWidth = Math.max(2, MINES_CELL / 12);
        ctx.strokeStyle = s.mines[cell] ? MINES_ART.gold : MINES_ART.boom;
        ctx.beginPath();
        if (s.mines[cell]) ctx.arc(x + MINES_CELL / 2, y + MINES_CELL / 2, MINES_CELL * 0.42, 0, Math.PI * 2);
        else {
          ctx.moveTo(x + MINES_CELL * 0.18, y + MINES_CELL * 0.18);
          ctx.lineTo(x + MINES_CELL * 0.82, y + MINES_CELL * 0.82);
        }
        ctx.stroke();
        ctx.restore();
      }
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

/**
 * The HUD's figures (Logic review, 15 Nov 2026; display only): the safe squares beyond the free opening, as the reveal
 * counts them ("33 of 87"), and the mines less the flags placed (a mine hit no longer counts as one found).
 */
export function minesHudFigures(s: Pick<MinesState, "open" | "revealed" | "opening" | "rev">): { safe: string; cleared: boolean; minesLeft: number } {
  let flags = 0;
  const cells = minesGeoFor(s.rev).cells;
  for (let i = 0; i < cells; i++) if (s.open[i] === MINES_FLAG) flags += 1;
  const { got, of } = minesProgress(s);
  return { safe: `${got}/${of}`, cleared: got >= of, minesLeft: minesCountFor(s.rev) - flags };
}

/** The HUD chips across the top: safe squares (beyond the opening), mines less flags placed, and mines hit. */
function paintHud(ctx: CanvasRenderingContext2D, s: MinesState): void {
  const f = minesHudFigures(s);
  // Pill chips (3 Nov 2026), the main count (safe squares) top left.
  drawHudPillRow(ctx, 10, 8, [
    { label: "Safe", value: f.safe, opts: { gold: f.cleared } },
    { label: "Mines", value: String(f.minesLeft) },
    { label: "Hits", value: String(s.hits), opts: { alert: s.hits > 0 } },
  ]);
}

/** The board, the HUD and the moving effects, under the shared success layer (MINESWEEPER_FX). */
export function drawMinesweeper(ctx: CanvasRenderingContext2D, s: MinesState, size: CanvasSize): void {
  arcadeFx(ctx, MINESWEEPER_FX, s, () => drawMinesWorld(ctx, s), size);
}

function drawMinesWorld(ctx: CanvasRenderingContext2D, s: MinesState): void {
  const g = minesGeoFor(s.rev);
  const over = minesCleared(s) || s.tick >= g.runTicks;
  const key = `mines|${s.seed}|${over ? 1 : 0}|${logicSpritesReady(MINES_SPRITES) ? 1 : 0}|${s.open.join("")}`;
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
      const cx = minesCellX(s.lastOpen, g) + MINES_CELL / 2;
      const cy = minesCellY(s.lastOpen, g) + MINES_CELL / 2;
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
  // A number tapped too early shakes (its square redrawn, the number swaying a couple of pixels and settling).
  if (nudge.cell >= 0 && s.open[nudge.cell] === MINES_OPEN) {
    const age = s.tick - nudge.at;
    if (age >= 0 && age < NUDGE_TICKS) {
      const x = minesCellX(nudge.cell, g), y = minesCellY(nudge.cell, g);
      const dx = still ? 0 : Math.sin(age * 1.4) * 2.2 * (1 - age / NUDGE_TICKS);
      paintMinesOpen(ctx, x, y);
      paintMinesNumber(ctx, s.nums[nudge.cell]!, x + MINES_CELL / 2 + dx, y + MINES_CELL / 2);
    }
  }
  // The clear (Logic overhaul 1): the mines still hidden are defused one by one, out from the last square opened, each
  // shown under a fading gold ring (display only; the run is already decided).
  if (minesCleared(s) && s.clearedTick > 0) {
    const age = s.tick - s.clearedTick;
    const at = s.lastOpen >= 0 ? s.lastOpen : 0;
    const ax = minesCellX(at, g), ay = minesCellY(at, g);
    const hidden: number[] = [];
    for (let cell = 0; cell < g.cells; cell++) if (s.mines[cell] && s.open[cell] !== MINES_BOOM) hidden.push(cell);
    hidden.sort((p, q) => Math.hypot(minesCellX(p, g) - ax, minesCellY(p, g) - ay) - Math.hypot(minesCellX(q, g) - ax, minesCellY(q, g) - ay));
    const shown = still ? hidden.length : Math.min(hidden.length, Math.floor(age / MINES_DEFUSE_TICKS) + 1);
    for (let i = 0; i < shown; i++) {
      const cell = hidden[i]!;
      const cx = minesCellX(cell, g) + MINES_CELL / 2;
      const cy = minesCellY(cell, g) + MINES_CELL / 2;
      const since = still ? 99 : age - i * MINES_DEFUSE_TICKS;
      ctx.save();
      ctx.globalAlpha = 0.85;
      paintMinesMine(ctx, cx, cy, MINES_CELL * 0.8);
      if (since < 24) {
        ctx.globalAlpha = (1 - since / 24) * 0.9;
        ctx.strokeStyle = MINES_ART.gold;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, MINES_CELL * (0.3 + since / 60), 0, Math.PI * 2);
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
      // Logic overhaul 1: a dull red pulse, not a bright white zap.
      ctx.globalAlpha = (1 - age / life) * 0.55;
      ctx.fillStyle = MINES_ART.boom;
      ctx.fillRect(minesCellX(s.lastHit, g), minesCellY(s.lastHit, g), MINES_CELL, MINES_CELL);
      ctx.restore();
    }
  }
}

/** The playable game with its art (the stage draws through this). One object per revision: a stage resets its
 * run when its game object changes, so a re-render (the Reveal / Flag switch) must hand it the same one. */
const ART_GAMES = new Map<number, ArcadeGame<MinesState, ArcadeInputEvent | null>>();
export function minesweeperArtGameFor(rev?: number | null): ArcadeGame<MinesState, ArcadeInputEvent | null> {
  const r = minesGeoFor(rev).rev;
  let game = ART_GAMES.get(r);
  if (!game) {
    game = { ...minesweeperGameFor(r), draw: drawMinesweeper };
    ART_GAMES.set(r, game);
  }
  return game;
}
