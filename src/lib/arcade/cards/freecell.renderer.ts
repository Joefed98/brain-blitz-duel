/**
 * FreeCell's art and layout (display only; the sim is freecell.ts). The world is 414 × 772: HUD chips across the top,
 * the four free cells (larger cards) over a faint "FREECELL", the eight columns spreading down the middle and the four
 * home piles along the bottom with faint suit symbols. The phone's hit tests (fcHit, fcDropPile) read the same layout.
 * freecellRev 2 adds two small buttons in the HUD row's gaps (Undo left of HOME, Reset right of it; fcButtonHit) and
 * the refused move's toast under the free cells ("Need a free cell to move 2 cards", fcNoteText, 1.6 s).
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "../engine";
import { arcadeFx, type ArcadeFxSpec } from "../arcadeFx.renderer";
import { NO_CARD } from "./cards";
import { CARD_FONT, drawCard, drawChip, drawFelt, drawSlot, roundRect } from "./cards.renderer";
import {
  FC_CELLS, FC_COLS, FC_INPUT_RESET, FC_INPUT_UNDO, FC_PILE_CELL, FC_PILE_HOME, fcHomeCount, fcNoteText, freecellGameFor, type FcState,
} from "./freecell";
import { cardOf, rankOf, suitOf } from "./cards";

export const FC_WORLD_W = 414;
export const FC_WORLD_H = 772;
export const FC_BG = "#0E2A57";

/* ---- Layout (30 Oct 2026 legibility pass: free cells and home piles the size of the column cards, so the columns
   get the room; columns spread down the screen and compress only when one would reach the home piles) ---- */
export const FC_COL_W = 48;
export const FC_COL_H = 68;
export const FC_BIG_W = FC_COL_W;
export const FC_BIG_H = FC_COL_H;
export const FC_CELL_Y = 44;
export const FC_COL_Y = FC_CELL_Y + FC_BIG_H + 14;
export const FC_HOME_Y = FC_WORLD_H - FC_BIG_H - 10;
export const FC_COL_BOTTOM = FC_HOME_Y - 8;
const BIG_GAP = (FC_WORLD_W - FC_CELLS * FC_BIG_W) / (FC_CELLS + 1);
const COL_GAP = (FC_WORLD_W - FC_COLS * FC_COL_W) / (FC_COLS + 1);
/** The most a column's cards step down: the large index and a good part of each card's body show. */
const STEP_MAX = 40;

export function fcBigX(i: number): number {
  return BIG_GAP + i * (FC_BIG_W + BIG_GAP);
}

export function fcColX(c: number): number {
  return COL_GAP + c * (FC_COL_W + COL_GAP);
}

/** How far a column of `n` cards steps each card down so it fits above the home piles. */
export function fcColStep(n: number): number {
  if (n <= 1) return STEP_MAX;
  return Math.min(STEP_MAX, (FC_COL_BOTTOM - FC_COL_Y - FC_COL_H) / (n - 1));
}

/** The card under a point: its pile and index (cells index 0), or null. */
export function fcHit(state: FcState, x: number, y: number): { pile: number; index: number } | null {
  for (let i = 0; i < FC_CELLS; i++) {
    const cx = fcBigX(i);
    if (x >= cx && x <= cx + FC_BIG_W && y >= FC_CELL_Y && y <= FC_CELL_Y + FC_BIG_H && state.cells[i] !== NO_CARD) return { pile: FC_PILE_CELL + i, index: 0 };
  }
  for (let c = 0; c < FC_COLS; c++) {
    const cx = fcColX(c);
    if (x < cx - COL_GAP / 2 || x > cx + FC_COL_W + COL_GAP / 2) continue;
    const col = state.cols[c]!;
    const step = fcColStep(col.length);
    for (let i = col.length - 1; i >= 0; i--) {
      const top = FC_COL_Y + i * step;
      if (y >= top && y <= top + FC_COL_H) return { pile: c, index: i };
    }
  }
  return null;
}

/** The pile under a drop point (columns by their whole strip; a free cell; home), or -1. */
export function fcDropPile(x: number, y: number): number {
  for (let i = 0; i < FC_CELLS; i++) {
    const cx = fcBigX(i);
    if (x >= cx - BIG_GAP / 2 && x <= cx + FC_BIG_W + BIG_GAP / 2 && y >= FC_CELL_Y - 10 && y <= FC_CELL_Y + FC_BIG_H + 8) return FC_PILE_CELL + i;
    if (x >= cx - BIG_GAP / 2 && x <= cx + FC_BIG_W + BIG_GAP / 2 && y >= FC_HOME_Y - 8) return FC_PILE_HOME;
  }
  if (y >= FC_COL_Y - 6 && y < FC_HOME_Y - 4) {
    for (let c = 0; c < FC_COLS; c++) {
      const cx = fcColX(c);
      if (x >= cx - COL_GAP / 2 && x <= cx + FC_COL_W + COL_GAP / 2) return c;
    }
  }
  return -1;
}

/* ---- freecellRev 2's buttons: small, in the HUD row's gaps either side of the HOME chip ---- */
export const FC_BTN_W = 38;
export const FC_BTN_H = 26;
export const FC_BTN_Y = 9;
/** Each button's centre x: Undo then Reset. */
export const FC_BTN_X = [FC_WORLD_W / 2 - 78, FC_WORLD_W / 2 + 84] as const;
/** The buttons' input kinds, in the same order. */
const FC_BTN_KIND = [FC_INPUT_UNDO, FC_INPUT_RESET] as const;
/** How long a refused move's toast shows, ticks. */
const NOTE_TICKS = 96;

/** The button under a point (its input kind), with a few world units of slop round each; 0 for none. */
export function fcButtonHit(x: number, y: number): number {
  for (let i = 0; i < 2; i++) {
    const cx = FC_BTN_X[i]!;
    if (Math.abs(x - cx) <= FC_BTN_W / 2 + 6 && y >= 0 && y <= FC_BTN_Y + FC_BTN_H + 8) return FC_BTN_KIND[i]!;
  }
  return 0;
}

/** The phone's drag and press (display only): the pressed card glows, a dragged run follows the finger. */
export interface FcView {
  pressed: { pile: number; index: number } | null;
  drag: { pile: number; index: number; x: number; y: number; ox: number; oy: number } | null;
  /** The button held down (its input kind), 0 for none. */
  button?: number;
}

export function fcNewView(): FcView {
  return { pressed: null, drag: null, button: 0 };
}

/** An undo (a curved arrow back) or reset (a full circle arrow) icon centred at (x, y). */
function buttonIcon(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, colour: string): void {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (kind === FC_INPUT_UNDO) {
    // A hook from the right curving over to the left, the arrowhead pointing left.
    ctx.arc(x + 1, y + 2, 6, Math.PI * 1.05, Math.PI * 2.35, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 1);
    ctx.lineTo(x - 4, y - 3.5);
    ctx.lineTo(x - 3, y + 3.5);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.arc(x, y, 6.5, Math.PI * 0.3, Math.PI * 1.85, false);
    ctx.stroke();
    const a = Math.PI * 1.85;
    const ex = x + 6.5 * Math.cos(a);
    const ey = y + 6.5 * Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(ex + 4, ey + 1);
    ctx.lineTo(ex - 2.5, ey - 3);
    ctx.lineTo(ex - 1, ey + 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawButtons(ctx: CanvasRenderingContext2D, state: FcState, view?: FcView): void {
  for (let i = 0; i < 2; i++) {
    const kind = FC_BTN_KIND[i]!;
    const cx = FC_BTN_X[i]!;
    const left = cx - FC_BTN_W / 2;
    const live = kind === FC_INPUT_UNDO ? (state.hist?.length ?? 0) > 0 : state.moves > 0;
    const held = view?.button === kind;
    roundRect(ctx, left, FC_BTN_Y, FC_BTN_W, FC_BTN_H, FC_BTN_H / 2);
    ctx.fillStyle = held ? "rgba(233,196,106,0.95)" : "rgba(5,12,30,0.62)";
    ctx.fill();
    ctx.strokeStyle = held ? "#FFE7A3" : `rgba(233,196,106,${live ? 0.45 : 0.18})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    buttonIcon(ctx, kind, cx, FC_BTN_Y + FC_BTN_H / 2, held ? "#231503" : live ? "#F6EBD0" : "rgba(246,235,208,0.35)");
  }
}

/** The refused move's toast: a dark pill under the free cells, fading out over its last third. */
function drawNote(ctx: CanvasRenderingContext2D, state: FcState): void {
  const text = fcNoteText(state);
  const age = state.tick - (state.noteTick ?? 0);
  if (!text || age < 0 || age >= NOTE_TICKS) return;
  const alpha = age < NOTE_TICKS * 0.66 ? 1 : 1 - (age - NOTE_TICKS * 0.66) / (NOTE_TICKS * 0.34);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 14px ${CARD_FONT}`;
  const w = Math.ceil(ctx.measureText(text).width + 30);
  const h = 30;
  const x = FC_WORLD_W / 2 - w / 2;
  const y = FC_CELL_Y + FC_BIG_H + 24;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(6,10,24,0.92)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,140,120,0.75)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#FBEFE6";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, FC_WORLD_W / 2, y + h / 2 + 0.5);
  ctx.restore();
}

/** Where a pile's card sits now (for the drag's offset and the move glow). */
export function fcCardBox(state: FcState, pile: number, index: number): { x: number; y: number; w: number; h: number } {
  if (pile >= FC_PILE_CELL && pile < FC_PILE_CELL + FC_CELLS) return { x: fcBigX(pile - FC_PILE_CELL), y: FC_CELL_Y, w: FC_BIG_W, h: FC_BIG_H };
  const col = state.cols[pile] ?? [];
  return { x: fcColX(pile), y: FC_COL_Y + index * fcColStep(col.length), w: FC_COL_W, h: FC_COL_H };
}

/* ---- freecellRev 3: the auto moves fly home (display only; FcState.fly) ---- */

/** Each auto-moved card leaves this many ticks after the one before it and takes FC_FLY_TICKS to land. */
export const FC_FLY_GAP = 2;
export const FC_FLY_TICKS = 8;

/** A card in flight: where it is now (eased from its pile to its suit's home pile). */
export interface FcFlight {
  card: number;
  x: number;
  y: number;
}

/**
 * The auto moves still in the air at this tick, and each suit's home top as drawn (the card under the first one still
 * to land). Nothing flies once the run is over (the clock stops, so a flight would hang).
 */
export function fcFlights(state: FcState): { flights: FcFlight[]; homeShown: number[] } {
  const homeShown = state.home.slice();
  const flights: FcFlight[] = [];
  const fly = state.fly;
  if (!fly || fly.length === 0 || state.ended) return { flights, homeShown };
  const age = state.tick - (state.flyTick ?? 0);
  const n = fly.length / 3;
  if (age >= (n - 1) * FC_FLY_GAP + FC_FLY_TICKS) return { flights, homeShown };
  for (let k = 0; k < n; k++) {
    const card = fly[k * 3]!;
    const pile = fly[k * 3 + 1]!;
    const index = fly[k * 3 + 2]!;
    const t = (age - k * FC_FLY_GAP) / FC_FLY_TICKS;
    if (t >= 1) continue;
    const s = suitOf(card);
    homeShown[s] = Math.min(homeShown[s]!, rankOf(card) - 1);
    const from = pile >= FC_PILE_CELL ? { x: fcBigX(pile - FC_PILE_CELL), y: FC_CELL_Y } : { x: fcColX(pile), y: FC_COL_Y + index * fcColStep(index + 1) };
    const to = { x: fcBigX(s), y: FC_HOME_Y };
    const e = t <= 0 ? 0 : 1 - (1 - t) * (1 - t);
    flights.push({ card, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
  }
  return { flights, homeShown };
}

/** The shared success layer: a burst at home for every card home, a banner each full suit and when all are home. */
export const FREECELL_FX: ArcadeFxSpec<FcState> = {
  game: "freecell",
  world: "cards",
  width: FC_WORLD_W,
  height: FC_WORLD_H,
  shake: false,
  events: [
    { kind: "pop", count: (s) => fcHomeCount(s), at: () => ({ x: FC_WORLD_W / 2, y: FC_HOME_Y + FC_BIG_H / 2 }), label: () => null },
    { kind: "streak", count: (s) => fcHomeCount(s), every: 13, at: () => ({ x: FC_WORLD_W / 2, y: FC_HOME_Y - 30 }), label: (_s, c) => `${c} HOME` },
    { kind: "final", count: (s) => (s.ended === 1 ? 1 : 0), label: () => "ALL HOME!" },
  ],
  misses: [{ count: (s) => s.rejects }],
};

/** Draws a frame of FreeCell with the shared success layer (`view`: the phone's press and drag; the reveal passes none). */
export function drawFreecell(ctx: CanvasRenderingContext2D, state: FcState, size: CanvasSize, view?: FcView): void {
  arcadeFx(ctx, FREECELL_FX, state, () => drawFreecellWorld(ctx, state, size, view), size);
}

function drawFreecellWorld(ctx: CanvasRenderingContext2D, state: FcState, size: CanvasSize, view?: FcView): void {
  const W = FC_WORLD_W;
  const H = FC_WORLD_H;
  ctx.save();
  ctx.scale(size.width / W, size.height / H);
  drawFelt(ctx, W, H);

  // HUD chips.
  const home = fcHomeCount(state);
  drawChip(ctx, 10, 9, "MOVES", `${state.moves}`);
  drawChip(ctx, W / 2, 9, "HOME", `${home}/52`, { align: "center", gold: home === 52 });
  drawChip(ctx, W - 10, 9, "PAR", `${state.par}`, { align: "right", gold: state.ended === 1 && state.moves <= state.par });
  if (state.hist) drawButtons(ctx, state, view);

  // The free cells over a faint FREE CELL.
  ctx.save();
  ctx.fillStyle = "rgba(233,196,106,0.07)";
  ctx.font = `900 52px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FREE CELL", W / 2, FC_CELL_Y + FC_BIG_H / 2 + 2);
  ctx.restore();
  const dragging = view?.drag ?? null;
  const pressed = view?.pressed ?? null;
  const lit = (pile: number, index: number) =>
    (pressed && pressed.pile === pile && index >= pressed.index) || (dragging && dragging.pile === pile && index >= dragging.index) ? 1 : 0;
  const fresh = state.lastTick > 0 && state.tick - state.lastTick < 18 ? 1 - (state.tick - state.lastTick) / 18 : 0;
  for (let i = 0; i < FC_CELLS; i++) {
    const x = fcBigX(i);
    const card = state.cells[i]!;
    if (card === NO_CARD || (dragging && dragging.pile === FC_PILE_CELL + i)) drawSlot(ctx, x, FC_CELL_Y, FC_BIG_W, FC_BIG_H, -1, "FREE");
    if (card !== NO_CARD && !(dragging && dragging.pile === FC_PILE_CELL + i)) {
      drawCard(ctx, card, x, FC_CELL_Y, FC_BIG_W, FC_BIG_H, { glow: lit(FC_PILE_CELL + i, 0) || (state.lastTo === FC_PILE_CELL + i ? fresh * 0.8 : 0) });
    }
  }

  // The columns.
  for (let c = 0; c < FC_COLS; c++) {
    const x = fcColX(c);
    const col = state.cols[c]!;
    if (col.length === 0) drawSlot(ctx, x, FC_COL_Y, FC_COL_W, FC_COL_H);
    const step = fcColStep(col.length);
    for (let i = 0; i < col.length; i++) {
      if (dragging && dragging.pile === c && i >= dragging.index) break;
      const glow = lit(c, i) || (state.lastTo === c && i >= col.length - state.lastCount ? fresh * 0.8 : 0);
      drawCard(ctx, col[i]!, x, FC_COL_Y + i * step, FC_COL_W, FC_COL_H, { glow });
    }
  }

  // Home piles with faint suit symbols (rev 3: the top as drawn waits for the cards still flying there).
  const { flights, homeShown } = fcFlights(state);
  for (let s = 0; s < 4; s++) {
    const x = fcBigX(s);
    const top = homeShown[s]!;
    if (top === 0) drawSlot(ctx, x, FC_HOME_Y, FC_BIG_W, FC_BIG_H, s);
    else drawCard(ctx, cardOf(s, top), x, FC_HOME_Y, FC_BIG_W, FC_BIG_H, { glow: state.lastTo === FC_PILE_HOME && fresh > 0 ? fresh * 0.6 : 0 });
  }

  // Auto moves on their way home (the first to land drawn last, on top).
  for (let k = flights.length - 1; k >= 0; k--) {
    const f = flights[k]!;
    drawCard(ctx, f.card, f.x, f.y, FC_BIG_W, FC_BIG_H, { glow: 0.5 });
  }

  // The dragged run follows the finger.
  if (dragging) {
    const cards = dragging.pile < FC_COLS ? state.cols[dragging.pile]!.slice(dragging.index) : [state.cells[dragging.pile - FC_PILE_CELL]!];
    const big = dragging.pile >= FC_PILE_CELL;
    const w = big ? FC_BIG_W : FC_COL_W;
    const h = big ? FC_BIG_H : FC_COL_H;
    cards.forEach((card, k) => {
      if (card === NO_CARD) return;
      drawCard(ctx, card, dragging.x - dragging.ox, dragging.y - dragging.oy + k * 30, w, h, { glow: k === 0 ? 1 : 0 });
    });
  }

  if (state.ended === 2 && home < 52) {
    ctx.fillStyle = "rgba(4,10,26,0.25)";
    ctx.fillRect(0, 0, W, H);
  }
  if (state.ended === 0) drawNote(ctx, state);
  ctx.restore();
}

/** The art game for a stage: the revision's sim with this draw (the view, when given, is the phone's press and drag). */
export function freecellArtGame(view?: FcView, rev?: number | null): ArcadeGame<FcState, ArcadeInputEvent | null> {
  return { ...freecellGameFor(rev), draw: (ctx, state, size) => drawFreecell(ctx, state, size, view) };
}

export const freecellArt = freecellArtGame();
