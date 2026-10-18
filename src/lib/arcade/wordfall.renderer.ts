/**
 * Letterfall art: wooden letter tiles in a toybox well on the lamp-lit
 * tabletop (toybox.renderer.ts), through the shared success layer. Render
 * only — never imported by the sim or the server. Every tile is drawn inside
 * its 60 px collision cell (2 px inset; the refused-chain shake moves it at most
 * 2 px), so what a finger sees is what the sim picks. wordfallRev 2 draws its
 * Enter box exactly on the sim's tap box (WF_ENTER_V2) under the well.
 */
import { deviceLayer } from "./cache.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { reducedMotion } from "./art.renderer";
import { wordfallFxFor } from "./arcadeFxGames.renderer";
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
  wfWorldH,
  wordfallGameFor,
  wordfallScore,
  WF_CELL,
  WF_COLS,
  WF_ENTER_V2,
  WF_MIN_WORD,
  WF_ROWS,
  WF_SHAKE_TICKS,
  WF_RUN_TICKS,
  WF_W,
  WF_WELL_H,
  WF_WELL_W,
  WF_WELL_X,
  WF_WELL_Y,
  type WordfallState,
} from "./wordfall";

const DISPLAY = "'Fredoka', 'Nunito', ui-rounded, system-ui, sans-serif";
export const TILE_FACE = "#F4E4C3";
const TILE_FACE_LOW = "#E3CC9C";
export const TILE_EDGE = "#B48A55";
export const PICK_FACE = "#F7CF63";
const PICK_EDGE = TOY_BRASS_DARK;
const BAD_FACE = "#EBA394";
const BAD_EDGE = "#A8402F";
const DANGER = "#D9363E";
const INSET = 2;
/** How long the last word stays on the word line, ticks. */
const WORD_SHOW_TICKS = 50;
/** End-of-run shimmer: length (ms) and the local score that earns it. */
export const WF_SHIMMER_MS = 1100;
export const WF_SHIMMER_SCORE = 120;

/**
 * When the live stage saw each finished run end (presentation clock), so the
 * shimmer plays once from the end of the run. Keyed by the final state, which
 * the sim never replaces once over. Only the live stage starts one (never the
 * reveal's replay); the dev trigger forces one on whatever is drawn next.
 */
const shimmerStart = new WeakMap<WordfallState, number>();
let devShimmerAt = -Infinity;

/** True once the run is over with a local score of 120 or more. */
export function wordfallEarnsShimmer(state: WordfallState): boolean {
  return (state.over === 1 || state.tick >= WF_RUN_TICKS) && wordfallScore(state.points) >= WF_SHIMMER_SCORE;
}

function presentationNow(): number {
  return typeof performance === "undefined" ? 0 : performance.now();
}

/** The live stage: the run has just ended on this state; shimmer from now. */
export function wordfallStartShimmer(state: WordfallState): void {
  if (!shimmerStart.has(state)) shimmerStart.set(state, presentationNow());
}

/** Dev only (screenshot tool): play the shimmer on the well as it stands. */
export function wordfallShimmerDev(): void {
  devShimmerAt = presentationNow();
}

/** Shimmer progress 0…1 while it plays, else null. */
function shimmerProgress(state: WordfallState): number | null {
  const now = presentationNow();
  const start = now - devShimmerAt < WF_SHIMMER_MS ? devShimmerAt : shimmerStart.get(state);
  if (start === undefined) return null;
  const p = (now - start) / WF_SHIMMER_MS;
  return p >= 0 && p < 1 ? p : null;
}

/**
 * The well's tiles shimmer from bottom to top: a soft gold band rises through
 * the stacks, painted inside each tile's face (never past its collision cell).
 * Reduced motion: one gentle even glow that fades, no travelling band.
 */
function drawShimmer(ctx: CanvasRenderingContext2D, state: WordfallState, p: number): void {
  const s = WF_CELL - INSET * 2;
  const band = WF_CELL * 1.6;
  const still = reducedMotion();
  const bandY = WF_WELL_Y + WF_WELL_H + band / 2 - p * (WF_WELL_H + band);
  state.well.forEach((stack, col) => {
    for (const tile of stack) {
      const x = WF_WELL_X + col * WF_CELL + INSET;
      const y = WF_WELL_Y + tile.y / 256 + INSET;
      const k = still ? 0.5 * (1 - p) : Math.max(0, 1 - Math.abs(y + s / 2 - bandY) / band);
      if (k <= 0.01) continue;
      ctx.save();
      roundRect(ctx, x, y, s, s, 9);
      ctx.clip();
      const g = ctx.createLinearGradient(x, y + s, x + s, y);
      g.addColorStop(0, `rgba(247,207,99,${0.36 * k})`);
      g.addColorStop(0.5, `rgba(255,248,220,${0.5 * k})`);
      g.addColorStop(1, `rgba(247,207,99,${0.36 * k})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, s, s);
      ctx.restore();
    }
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, letter: number, face: string, edge: string): void {
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

/**
 * wordfallRev 2's Enter box: a brass key filling exactly the sim's tap box
 * (stroke inset by half its width, so nothing is drawn outside it). Lit once
 * the chain is a word's length, muted otherwise; it submits either way.
 */
function drawEnterBox(ctx: CanvasRenderingContext2D, state: WordfallState): void {
  const { x, y, w, h } = WF_ENTER_V2;
  const ready = state.chain.length >= WF_MIN_WORD && state.over !== 1;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, ready ? "#FFD978" : "#8C6A3E");
  g.addColorStop(1, ready ? "#E9A93A" : "#6E5030");
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 14);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ready ? TOY_BRASS_DARK : TOY_WOOD_DARK;
  ctx.stroke();
  ctx.fillStyle = ready ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.16)";
  ctx.fillRect(x + 16, y + 5, w - 32, 2);
  ctx.font = `700 24px ${DISPLAY}`;
  ctx.fillStyle = ready ? TOY_INK : "#F3E2C0";
  ctx.fillText("ENTER", x + w / 2, y + h / 2 + 2, w - 24);
}

/** The tabletop, the well's board and its column grooves: static, so one cached layer in play. */
function paintWell(ctx: CanvasRenderingContext2D): void {
  toyTabletop(ctx);
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
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, state: WordfallState): void {
  // Low-end performance (16 Oct 2026): the table, the well and its grooves are one cached layer
  // (cache.renderer deviceLayer: the same pixels). The word line (y 8–55) and ENTER (from y 630)
  // were painted between the table and the board; neither overlaps the board and its rim
  // (y 64–620), so drawing them after it leaves every pixel as it was.
  deviceLayer(ctx, "wordfall-well", paintWell);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawWordLine(ctx, state);
  if (state.rev === 2) drawEnterBox(ctx, state);

  ctx.save();
  ctx.beginPath();
  ctx.rect(WF_WELL_X, WF_WELL_Y, WF_WELL_W, WF_WELL_H);
  ctx.clip();
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
  const shimmer = shimmerProgress(state);
  if (shimmer !== null) drawShimmer(ctx, state, shimmer);
  ctx.restore();
  ctx.restore();
}

/** Letterfall drawn through the shared success layer (presentation only). */
export function drawWordfall(ctx: CanvasRenderingContext2D, state: WordfallState, size: CanvasSize): void {
  arcadeFx(ctx, wordfallFxFor(state), state, () => {
    ctx.save();
    ctx.scale(size.width / WF_W, size.height / wfWorldH(state));
    drawWorld(ctx, state);
    ctx.restore();
  }, size);
}

export const wordfallArtGame = { ...wordfallGameFor(1), draw: drawWordfall };
export const wordfallArtGameV2 = { ...wordfallGameFor(2), draw: drawWordfall };

/** The art game for a stored revision (its init and input ranges follow the revision). */
export function wordfallArtGameFor(rev?: number): typeof wordfallArtGame {
  return rev === 2 ? wordfallArtGameV2 : wordfallArtGame;
}
