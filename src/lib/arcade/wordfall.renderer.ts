/**
 * Letterfall art: wooden letter tiles in a toybox well on the lamp-lit
 * tabletop (toybox.renderer.ts), through the shared success layer. Render
 * only — never imported by the sim or the server. Every tile is drawn inside
 * its 60 px collision cell (2 px inset; the refused-chain shake moves it at most
 * 2 px), so what a finger sees is what the sim picks.
 */
import { arcadeFx } from "./arcadeFx.renderer";
import { WORDFALL_FX } from "./arcadeFxGames.renderer";
import type { CanvasSize } from "./engine";
import {
  TOY_BRASS,
  TOY_BRASS_DARK,
  TOY_INK,
  TOY_OAK_LIGHT,
  TOY_WOOD_DARK,
  TOY_WOOD_DEEP,
  toyBoard,
  toyClock,
  toyTabletop,
} from "./toybox.renderer";
import {
  wfFind,
  wfLabel,
  wfWord,
  wordfallChainWord,
  wordfallGame,
  WF_CELL,
  WF_COLS,
  WF_H,
  WF_ROWS,
  WF_SHAKE_TICKS,
  WF_W,
  WF_WELL_H,
  WF_WELL_W,
  WF_WELL_X,
  WF_WELL_Y,
  type WordfallState,
} from "./wordfall";

const DISPLAY = "'Fredoka', 'Nunito', ui-rounded, system-ui, sans-serif";
const TILE_FACE = "#F4E4C3";
const TILE_FACE_LOW = "#E3CC9C";
const TILE_EDGE = "#B48A55";
const PICK_FACE = "#F7CF63";
const PICK_EDGE = TOY_BRASS_DARK;
const BAD_FACE = "#EBA394";
const BAD_EDGE = "#A8402F";
const DANGER = "#D9363E";
const INSET = 2;
/** How long the last word stays on the word line, ticks. */
const WORD_SHOW_TICKS = 50;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, letter: number, face: string, edge: string): void {
  const s = WF_CELL - INSET * 2;
  const g = ctx.createLinearGradient(0, y, 0, y + s);
  g.addColorStop(0, face);
  g.addColorStop(1, face === TILE_FACE ? TILE_FACE_LOW : face);
  roundRect(ctx, x, y, s, s, 9);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = edge;
  ctx.stroke();
  // Bevel: a lighter top lip and a darker bottom lip, inside the tile.
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(x + 7, y + 3, s - 14, 2);
  ctx.fillStyle = "rgba(60,30,10,0.18)";
  ctx.fillRect(x + 7, y + s - 5, s - 14, 2);
  const label = wfLabel(letter);
  ctx.fillStyle = TOY_INK;
  ctx.font = `700 ${label.length > 1 ? 25 : 31}px ${DISPLAY}`;
  ctx.fillText(label, x + s / 2, y + s / 2 + 2);
}

/** The word line above the well: the chain, the last word, or a refusal. */
function drawWordLine(ctx: CanvasRenderingContext2D, state: WordfallState): void {
  const x = WF_WELL_X;
  const y = 8;
  const w = WF_WELL_W;
  const h = 46;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = TOY_WOOD_DEEP;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = TOY_WOOD_DARK;
  ctx.stroke();
  const chain = wordfallChainWord(state).toUpperCase();
  const since = state.tick - state.lastWordTick;
  const refused = state.tick - state.shakeTick < WF_SHAKE_TICKS;
  let text = chain;
  let colour = "#FFF4DE";
  if (!chain && refused) {
    text = "NOT A WORD";
    colour = BAD_FACE;
  } else if (!chain && since >= 0 && since < WORD_SHOW_TICKS && state.lastWord.length) {
    text = wfWord(state.lastWord).toUpperCase();
    colour = PICK_FACE;
  } else if (!chain) {
    text = state.words ? `${state.words} WORD${state.words === 1 ? "" : "S"}` : "TAP LETTERS";
    colour = "rgba(255,244,222,0.45)";
  }
  const size = text.length > 11 ? 22 : 28;
  ctx.font = `700 ${size}px ${DISPLAY}`;
  ctx.fillStyle = colour;
  ctx.fillText(text, x + w / 2, y + h / 2 + 2, w - 24);
}

function drawWorld(ctx: CanvasRenderingContext2D, state: WordfallState): void {
  toyTabletop(ctx);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawWordLine(ctx, state);
  toyBoard(ctx, WF_WELL_X, WF_WELL_Y, WF_WELL_W, WF_WELL_H, 8);

  ctx.save();
  ctx.beginPath();
  ctx.rect(WF_WELL_X, WF_WELL_Y, WF_WELL_W, WF_WELL_H);
  ctx.clip();
  // Column grooves.
  ctx.strokeStyle = "rgba(70,40,15,0.22)";
  ctx.lineWidth = 2;
  for (let c = 1; c < WF_COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(WF_WELL_X + c * WF_CELL, WF_WELL_Y);
    ctx.lineTo(WF_WELL_X + c * WF_CELL, WF_WELL_Y + WF_WELL_H);
    ctx.stroke();
  }
  // Danger: a column one tile from full (or the one that overflowed) glows red at the top.
  const t = toyClock();
  state.well.forEach((stack, col) => {
    const full = state.over === 1 && state.overCol === col;
    if (stack.length < WF_ROWS - 1 && !full) return;
    const pulse = full ? 0.55 : t === 0 ? 0.3 : 0.22 + 0.12 * Math.sin(t / 160);
    const g = ctx.createLinearGradient(0, WF_WELL_Y, 0, WF_WELL_Y + WF_CELL * 2);
    g.addColorStop(0, `rgba(217,54,62,${pulse})`);
    g.addColorStop(1, "rgba(217,54,62,0)");
    ctx.fillStyle = g;
    ctx.fillRect(WF_WELL_X + col * WF_CELL, WF_WELL_Y, WF_CELL, WF_CELL * 2);
    if (full) {
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 3;
      ctx.strokeRect(WF_WELL_X + col * WF_CELL + 1.5, WF_WELL_Y + 1.5, WF_CELL - 3, WF_WELL_H - 3);
    }
  });

  const chain = new Set(state.chain);
  const shaking = state.tick - state.shakeTick < WF_SHAKE_TICKS ? new Set(state.shake) : null;
  state.well.forEach((stack, col) => {
    for (const tile of stack) {
      const bad = shaking?.has(tile.id) ?? false;
      const dx = bad ? ((state.tick % 4) < 2 ? -2 : 2) : 0;
      const x = WF_WELL_X + col * WF_CELL + INSET + dx;
      const y = WF_WELL_Y + tile.y / 256 + INSET;
      if (chain.has(tile.id)) drawTile(ctx, x, y, tile.l, PICK_FACE, PICK_EDGE);
      else if (bad) drawTile(ctx, x, y, tile.l, BAD_FACE, BAD_EDGE);
      else drawTile(ctx, x, y, tile.l, TILE_FACE, TILE_EDGE);
    }
  });

  // The chain's path through the centres of its tiles.
  if (state.chain.length) {
    const points = state.chain
      .map((id) => wfFind(state.well, id))
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .map((f) => ({ x: WF_WELL_X + f.col * WF_CELL + WF_CELL / 2, y: WF_WELL_Y + f.tile.y / 256 + WF_CELL / 2 }));
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = TOY_BRASS;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.globalAlpha = 1;
    const last = points[points.length - 1];
    if (last) {
      ctx.strokeStyle = TOY_OAK_LIGHT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(last.x, last.y, WF_CELL / 2 - 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.restore();
}

/** Letterfall drawn through the shared success layer (presentation only). */
export function drawWordfall(ctx: CanvasRenderingContext2D, state: WordfallState, size: CanvasSize): void {
  arcadeFx(ctx, WORDFALL_FX, state, () => {
    ctx.save();
    ctx.scale(size.width / WF_W, size.height / WF_H);
    drawWorld(ctx, state);
    ctx.restore();
  }, size);
}

export const wordfallArtGame = { ...wordfallGame, draw: drawWordfall };
