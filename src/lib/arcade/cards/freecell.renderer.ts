/**
 * FreeCell's art and layout (display only; the sim is freecell.ts). The world is 414 × 772: HUD chips across the top,
 * one row of eight outlined places under them (the four free cells left, the four home piles with faint suit symbols
 * right) and the eight columns of large cards spreading down the rest of the table (3 Nov 2026). The phone's hit tests (fcHit, fcDropPile) read the same layout.
 * freecellRev 2 adds two small buttons in the HUD row's gaps (Undo left of HOME, Reset right of it; fcButtonHit) and
 * the refused move's toast under the free cells ("Need a free cell to move 2 cards", fcNoteText, 1.6 s).
 * The Cards & Board overhaul (15 Nov 2026, display and input mapping only): real cards (realArt.renderer.ts) 50 × 74,
 * as wide as eight columns allow on the 414-wide table, the columns down to a thumb row of labelled Undo and Reset
 * buttons (Reset asks first, confirmBoxes); on the live stage every card slides to its new place (CardMotion).
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "../engine";
import { arcadeFx, type ArcadeFxSpec } from "../arcadeFx.renderer";
import { NO_CARD } from "./cards";
import { CARD_FONT, drawChip, drawSlot, roundRect } from "./cards.renderer";
import { drawCardButton, drawResetConfirm, inButton, type CardButtonBox } from "./cardButtons.renderer";
import { CardLayer, CardMotion, drawRealFelt, drawRealCard } from "./realArt.renderer";
import { drawStamp, FxTimeline, shakeX } from "./cardsFx.renderer";
import {
  FC_CELLS, FC_COLS, FC_INPUT_HINT, FC_PILE_CELL, FC_INPUT_RESET, FC_INPUT_UNDO, FC_LV_EASY, FC_PILE_HOME, fcCardsOf, fcCellIndex, fcCellPile, fcHintsLeft, fcHomeCount, fcNoMovesText, fcNoteText, fcPack,
  fcHintButtonOn, fcUndosLeft, freecellGameAt, type FcState } from "./freecell";
import { fcHintMove } from "./freecellSolver";
import { cardOf, rankOf, suitOf } from "./cards";

export const FC_WORLD_W = 414;
export const FC_WORLD_H = 772;
export const FC_BG = "#0E2A57";

/* ---- Layout (3 Nov 2026 polish, display only: the sim takes piles, never points). One top row of eight slots on the
   columns' own grid, the four free cells on the left and the four home piles on the right, each slot outlined; under it
   the eight columns of larger cards spreading down the whole table, compressing only when one would reach the bottom.
   (Until 3 Nov 2026 the free cells sat alone over a faint "FREE CELL", the home piles along the bottom, the cards 48 × 68
   stepping at most 40 down, so the cards used the top 40 % and the middle was empty felt.) ---- */
export const FC_COL_W = 50;
export const FC_COL_H = 74;
export const FC_BIG_W = FC_COL_W;
export const FC_BIG_H = FC_COL_H;
export const FC_CELL_Y = 44;
/** The home piles share the top row with the free cells. */
export const FC_HOME_Y = FC_CELL_Y;
export const FC_COL_Y = FC_CELL_Y + FC_BIG_H + 14;
/** The thumb row: Undo left, Reset right (the overhaul; the HUD row's small round icons until then). */
export const FC_BTN_ROW_Y = FC_WORLD_H - 56;
export const FC_BTN_ROW_H = 46;
export const FC_COL_BOTTOM = FC_BTN_ROW_Y - 10;
const COL_GAP = (FC_WORLD_W - FC_COLS * FC_COL_W) / (FC_COLS + 1);
/** The most a column's cards step down: nearly the whole card shows (its index, its suit and most of its body). */
const STEP_MAX = 72;

/** Free cell `i`'s x: the top row's first four places, over columns 0–3. */
export function fcBigX(i: number): number {
  return fcColX(i);
}

/** Suit `s`'s home pile x: the top row's last four places, over columns 4–7. */
export function fcHomeX(s: number): number {
  return fcColX(FC_CELLS + s);
}

/**
 * The top row for `n` free cells (the difficulty levels, 15 Nov 2026): four cells keep the columns' grid exactly as
 * before; Easy's five and Expert's three spread the cells and the four home piles evenly across the table, the places
 * as large as nine (or seven) allow.
 */
export interface FcTopRow {
  w: number;
  h: number;
  cellX: (i: number) => number;
  homeX: (s: number) => number;
}
const TOP_ROWS = new Map<number, FcTopRow>();
export function fcTopRow(n: number): FcTopRow {
  let row = TOP_ROWS.get(n);
  if (!row) {
    if (n === FC_CELLS) row = { w: FC_BIG_W, h: FC_BIG_H, cellX: fcBigX, homeX: fcHomeX };
    else {
      const slots = n + 4;
      const w = Math.min(FC_BIG_W, Math.floor((FC_WORLD_W - (slots + 1) * 4) / slots));
      const gap = (FC_WORLD_W - slots * w) / (slots + 1);
      const x = (k: number) => gap + k * (w + gap);
      row = { w, h: Math.round((w * FC_BIG_H) / FC_BIG_W), cellX: (i) => x(i), homeX: (s) => x(n + s) };
    }
    TOP_ROWS.set(n, row);
  }
  return row;
}

export function fcColX(c: number): number {
  return COL_GAP + c * (FC_COL_W + COL_GAP);
}

/** How far a column of `n` cards steps each card down so it fits above the table's bottom. */
export function fcColStep(n: number): number {
  if (n <= 1) return STEP_MAX;
  return Math.min(STEP_MAX, (FC_COL_BOTTOM - FC_COL_Y - FC_COL_H) / (n - 1));
}

/** The card under a point: its pile and index (cells index 0), or null. */
export function fcHit(state: FcState, x: number, y: number): { pile: number; index: number } | null {
  const row = fcTopRow(state.cells.length);
  for (let i = 0; i < state.cells.length; i++) {
    const cx = row.cellX(i);
    if (x >= cx && x <= cx + row.w && y >= FC_CELL_Y && y <= FC_CELL_Y + row.h && state.cells[i] !== NO_CARD) return { pile: fcCellPile(i), index: 0 };
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

/** The pile under a drop point (the top row's places, free cells left and home right; columns by their whole strip), or -1. */
export function fcDropPile(x: number, y: number, cells = FC_CELLS): number {
  if (y >= FC_CELL_Y - 10 && y < FC_COL_Y - 6) {
    if (cells !== FC_CELLS) {
      const row = fcTopRow(cells);
      const half = (row.homeX(0) - row.cellX(cells - 1) - row.w) / 2;
      for (let i = 0; i < cells; i++) if (x >= row.cellX(i) - half && x <= row.cellX(i) + row.w + half) return fcCellPile(i);
      for (let k = 0; k < 4; k++) if (x >= row.homeX(k) - half && x <= row.homeX(k) + row.w + half) return FC_PILE_HOME;
      return -1;
    }
    for (let k = 0; k < FC_COLS; k++) {
      const cx = fcColX(k);
      if (x >= cx - COL_GAP / 2 && x <= cx + FC_COL_W + COL_GAP / 2) return k < FC_CELLS ? FC_PILE_CELL + k : FC_PILE_HOME;
    }
    return -1;
  }
  if (y >= FC_COL_Y - 6) {
    for (let c = 0; c < FC_COLS; c++) {
      const cx = fcColX(c);
      if (x >= cx - COL_GAP / 2 && x <= cx + FC_COL_W + COL_GAP / 2) return c;
    }
  }
  return -1;
}

/* ---- freecellRev 2's Undo and Reset: labelled buttons in a thumb row under the columns (the overhaul) ---- */
/** The buttons' boxes and input kinds: Undo then Reset. */
export const FC_BUTTONS: readonly { kind: number; box: CardButtonBox }[] = [
  { kind: FC_INPUT_UNDO, box: { x: 16, y: FC_BTN_ROW_Y, w: 150, h: FC_BTN_ROW_H } },
  { kind: FC_INPUT_RESET, box: { x: FC_WORLD_W - 16 - 150, y: FC_BTN_ROW_Y, w: 150, h: FC_BTN_ROW_H } },
];
/** A level's thumb row (the difficulty levels): Undo, Hint in the middle, Reset. */
export const FC_LEVEL_BUTTONS: readonly { kind: number; box: CardButtonBox }[] = [
  { kind: FC_INPUT_UNDO, box: { x: 16, y: FC_BTN_ROW_Y, w: 118, h: FC_BTN_ROW_H } },
  { kind: FC_INPUT_HINT, box: { x: FC_WORLD_W / 2 - 55, y: FC_BTN_ROW_Y, w: 110, h: FC_BTN_ROW_H } },
  { kind: FC_INPUT_RESET, box: { x: FC_WORLD_W - 16 - 118, y: FC_BTN_ROW_Y, w: 118, h: FC_BTN_ROW_H } },
];
export function fcButtonsOf(state: Pick<FcState, "lv"> & { rev?: number }): readonly { kind: number; box: CardButtonBox }[] {
  // D6 (23 Nov 2026): a level with no hints (freecellRev 6's Hard and Expert) has Normal's Undo and Reset only.
  return state.lv && fcHintButtonOn(state) ? FC_LEVEL_BUTTONS : FC_BUTTONS;
}
/** How long a refused move's toast shows, ticks. */
const NOTE_TICKS = 96;

/** The button under a point (its input kind), with a few world units of slop round each; 0 for none. */
export function fcButtonHit(x: number, y: number, state?: Pick<FcState, "lv"> & { rev?: number }): number {
  for (const b of state ? fcButtonsOf(state) : FC_BUTTONS) if (inButton(b.box, x, y)) return b.kind;
  return 0;
}

/** The phone's drag and press (display only): the pressed card glows, a dragged run follows the finger. */
export interface FcView {
  pressed: { pile: number; index: number } | null;
  drag: { pile: number; index: number; x: number; y: number; ox: number; oy: number } | null;
  /** The button held down (its input kind), 0 for none. */
  button?: number;
  /** Reset's confirmation is open (and which of its buttons is held). */
  confirm?: boolean;
  confirmHeld?: "ok" | "cancel" | null;
  /** The live stage's card motion (slides and flips); none on reveals and replays. */
  motion?: CardMotion;
  /** Stage 2's effects (the overhaul): the timeline, the last move the phone sent (for the wobble) and the state seen. */
  fx?: FxTimeline;
  lastTry?: { pile: number; index: number } | null;
  seen?: { rejects: number; flyTick: number; ended: number; tick: number };
}

export function fcNewView(): FcView {
  return { pressed: null, drag: null, button: 0, confirm: false, confirmHeld: null, motion: new CardMotion(), fx: new FxTimeline(), lastTry: null };
}

function drawButtons(ctx: CanvasRenderingContext2D, state: FcState, view?: FcView): void {
  for (const b of fcButtonsOf(state)) {
    if (b.kind === FC_INPUT_HINT) {
      const left = fcHintsLeft(state);
      drawCardButton(ctx, b.box, "hint", left === Infinity || left > 1 ? "Hint" : left === 1 ? "Hint (1)" : "No hints", { live: state.ended === 0 && left > 0, held: view?.button === b.kind });
      continue;
    }
    const isUndo = b.kind === FC_INPUT_UNDO;
    const undos = fcUndosLeft(state);
    const live = state.ended === 0 && (isUndo ? (state.hist?.length ?? 0) > 0 && undos > 0 : state.moves > 0);
    const label = isUndo ? (undos === Infinity ? "Undo" : `Undo (${undos})`) : "Reset";
    drawCardButton(ctx, b.box, isUndo ? "undo" : "reset", label, { live, held: view?.button === b.kind });
  }
}

/** A dead end (no card can move anywhere): a steady pill where the toast sits, until a move, Undo or Reset (display only). */
function drawNoMoves(ctx: CanvasRenderingContext2D, state: FcState): void {
  const text = fcNoMovesText(state);
  if (!text) return;
  ctx.save();
  ctx.font = `800 14px ${CARD_FONT}`;
  const w = Math.ceil(ctx.measureText(text).width + 30);
  const h = 30;
  const x = FC_WORLD_W / 2 - w / 2;
  const y = FC_BTN_ROW_Y - h - 12;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(6,10,24,0.92)";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,196,106,0.75)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#F6EBD0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, FC_WORLD_W / 2, y + h / 2 + 0.5);
  ctx.restore();
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

/** A top-row place's outline (drawn under its card or empty slot): free cells a light frame, home piles gold, so an
 *  empty one still reads as a place to put a card. */
function placeOutline(ctx: CanvasRenderingContext2D, x: number, y: number, kind: "cell" | "home", row: FcTopRow = fcTopRow(FC_CELLS)): void {
  roundRect(ctx, x - 1.5, y - 1.5, row.w + 3, row.h + 3, Math.max(4, row.w * 0.11));
  ctx.strokeStyle = kind === "home" ? "rgba(233,196,106,0.85)" : "rgba(214,226,255,0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Where a pile's card sits now (for the drag's offset and the move glow). */
export function fcCardBox(state: FcState, pile: number, index: number): { x: number; y: number; w: number; h: number } {
  const cell = fcCellIndex(pile, state.cells.length);
  if (cell >= 0) {
    const row = fcTopRow(state.cells.length);
    return { x: row.cellX(cell), y: FC_CELL_Y, w: row.w, h: row.h };
  }
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
    const row = fcTopRow(state.cells.length);
    const cell = fcCellIndex(pile, state.cells.length);
    const from = cell >= 0 ? { x: row.cellX(cell), y: FC_CELL_Y } : { x: fcColX(pile), y: FC_COL_Y + index * fcColStep(index + 1) };
    const to = { x: row.homeX(s), y: FC_HOME_Y };
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
    { kind: "pop", count: (s) => fcHomeCount(s), at: () => ({ x: fcHomeX(2) - COL_GAP / 2, y: FC_HOME_Y + FC_BIG_H / 2 }), label: () => null },
    { kind: "streak", count: (s) => fcHomeCount(s), every: 13, at: () => ({ x: FC_WORLD_W / 2, y: FC_COL_Y + 40 }), label: (_s, c) => `${c} HOME` },
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
  drawRealFelt(ctx, W, H);
  const cards = new CardLayer(ctx, view?.motion ?? null);
  noticeFreecell(state, view);
  const wobble = view?.fx?.at<{ pile: number; index: number } | null>("wobble") ?? null;
  const wobbleX = (pile: number, index: number) => (wobble?.data && wobble.data.pile === pile && index >= wobble.data.index ? shakeX(wobble.k, 5) : 0);

  // HUD chips.
  const home = fcHomeCount(state);
  drawChip(ctx, 10, 9, "MOVES", `${state.moves}`);
  const all = fcCardsOf(state);
  const row = fcTopRow(state.cells.length);
  drawChip(ctx, W / 2, 9, "HOME", `${home}/${all}`, { align: "center", gold: home === all });
  drawChip(ctx, W - 10, 9, "PAR", `${state.par}`, { align: "right", gold: state.ended === 1 && state.moves <= state.par });
  if (state.hist) drawButtons(ctx, state, view);

  // The top row: the four free cells, then the four home piles, every place outlined.
  const dragging = view?.drag ?? null;
  const pressed = view?.pressed ?? null;
  const held = (pile: number, index: number) => (pressed && pressed.pile === pile && index >= pressed.index) || (dragging && dragging.pile === pile && index >= dragging.index);
  const fresh = state.lastTick > 0 && state.tick - state.lastTick < 18 ? 1 - (state.tick - state.lastTick) / 18 : 0;
  for (let i = 0; i < state.cells.length; i++) {
    const x = row.cellX(i);
    placeOutline(ctx, x, FC_CELL_Y, "cell", row);
    const card = state.cells[i]!;
    if (card === NO_CARD || (dragging && dragging.pile === fcCellPile(i))) drawSlot(ctx, x, FC_CELL_Y, row.w, row.h, -1, "FREE");
  }
  // Home piles with faint suit symbols (rev 3: the top as drawn waits for the cards still flying there). The whole pile
  // is drawn, bottom up, so a card arriving or undone out of it has a place to slide from.
  const { flights, homeShown } = fcFlights(state);
  for (let s = 0; s < 4; s++) {
    const x = row.homeX(s);
    placeOutline(ctx, x, FC_HOME_Y, "home", row);
    if (homeShown[s]! === 0) drawSlot(ctx, x, FC_HOME_Y, row.w, row.h, s);
  }
  for (let s = 0; s < 4; s++) {
    const top = homeShown[s]!;
    for (let r = 1; r <= top; r++) {
      const card = cardOf(s, r);
      cards.card(card, card, row.homeX(s), FC_HOME_Y, row.w, row.h, { glow: r === top && state.lastTo === FC_PILE_HOME && fresh > 0 ? fresh * 0.6 : 0 });
    }
  }
  const hint = fcHintShown(state, view);
  const hintGlow = (pile: number, index: number) => (hint && hint.move[0] === pile && index >= hint.move[1] ? hint.glow : 0);
  for (let i = 0; i < state.cells.length; i++) {
    const card = state.cells[i]!;
    const pile = fcCellPile(i);
    if (card === NO_CARD || (dragging && dragging.pile === pile)) continue;
    const up = held(pile, 0);
    const wx = wobbleX(pile, 0);
    cards.card(card, card, row.cellX(i) + wx, FC_CELL_Y - (up ? 3 : 0), row.w, row.h, { lift: up ? 1 : 0, glow: up ? 0.8 : Math.max(hintGlow(pile, 0), state.lastTo === pile ? fresh * 0.8 : 0) }, wx !== 0);
  }

  // The columns.
  for (let c = 0; c < FC_COLS; c++) {
    const x = fcColX(c);
    const col = state.cols[c]!;
    if (col.length === 0) drawSlot(ctx, x, FC_COL_Y, FC_COL_W, FC_COL_H);
    const step = fcColStep(col.length);
    for (let i = 0; i < col.length; i++) {
      if (dragging && dragging.pile === c && i >= dragging.index) break;
      const up = held(c, i);
      const glow = up ? 0.8 : Math.max(hintGlow(c, i), state.lastTo === c && i >= col.length - state.lastCount ? fresh * 0.8 : 0);
      const wx = wobbleX(c, i);
      cards.card(col[i]!, col[i]!, x + wx, FC_COL_Y + i * step - (up ? 3 : 0), FC_COL_W, FC_COL_H, { glow, lift: up ? 1 : 0 }, wx !== 0);
    }
  }

  // Auto moves on their way home (the first to land drawn last, on top), placed exactly where the flight has them.
  for (let k = flights.length - 1; k >= 0; k--) {
    const f = flights[k]!;
    cards.card(f.card, f.card, f.x, f.y, row.w, row.h, { glow: 0.5, lift: 0.6 }, true);
  }
  cards.flush();
  // The hint's destination: a soft gold outline where the move would go (display only).
  if (hint) drawHintTarget(ctx, state, hint.move[2], hint.glow, row);

  // Two or more cards home in one go: "×n" stamped over the home row.
  const combo = view?.fx?.at<number>("combo");
  if (combo) drawStamp(ctx, `×${combo.data}`, row.homeX(2) - COL_GAP / 2, FC_HOME_Y + row.h + 18, combo.k, 24);
  // The finish: the home piles' cards bounce down the table (900 ms) as "ALL HOME!" arrives.
  const cascade = view?.fx?.at("cascade");
  if (cascade) drawCascade(ctx, cascade.k, row, Math.min(10, all / 4));

  // The dragged run follows the finger, lifted off the table.
  if (dragging) {
    const run = dragging.pile < FC_COLS ? state.cols[dragging.pile]!.slice(dragging.index) : [state.cells[fcCellIndex(dragging.pile, state.cells.length)]!];
    const big = dragging.pile >= FC_COLS;
    const w = big ? row.w : FC_COL_W;
    const h = big ? row.h : FC_COL_H;
    const lifted = new CardLayer(ctx, view?.motion ?? null);
    run.forEach((card, k) => {
      if (card === NO_CARD) return;
      lifted.card(card, card, dragging.x - dragging.ox, dragging.y - dragging.oy - 4 + k * 30, w, h, { glow: k === 0 ? 1 : 0, lift: 1 }, true);
    });
  }

  if (state.ended === 2 && home < all) {
    ctx.fillStyle = "rgba(4,10,26,0.25)";
    ctx.fillRect(0, 0, W, H);
  }
  if (state.ended === 0) drawNote(ctx, state);
  drawNoMoves(ctx, state);
  if (view?.confirm && state.ended === 0) drawResetConfirm(ctx, W, H, "Every card goes back. It counts as a move.", view.confirmHeld ?? null);
  ctx.restore();
}

/** Starts stage 2's effects from what changed since the last frame (display only; the live stage's view alone). */
function noticeFreecell(state: FcState, view?: FcView): void {
  const fx = view?.fx;
  if (!view || !fx) return;
  const seen = view.seen;
  view.seen = { rejects: state.rejects, flyTick: state.flyTick ?? 0, ended: state.ended, tick: state.tick };
  if (!seen || state.tick < seen.tick) return;
  // A refused move: the card (and the run on it) wobbles back where it came from.
  if (state.rejects > seen.rejects && view.lastTry) fx.start("wobble", 320, view.lastTry);
  // An auto-move batch of two or more cards home.
  const n = (state.fly?.length ?? 0) / 3;
  if ((state.flyTick ?? 0) !== seen.flyTick && n >= 2) fx.start("combo", 800, n);
  if (state.ended === 1 && seen.ended !== 1) fx.start("cascade", 900);
}

/** The bouncing cards: each suit's top cards leave its home pile in turn and bounce down the felt, fading out. */
function drawCascade(ctx: CanvasRenderingContext2D, k: number, row: FcTopRow = fcTopRow(FC_CELLS), top = 10): void {
  const floor = FC_BTN_ROW_Y - 8 - row.h;
  for (let s = 0; s < 4; s++) {
    for (let j = 0; j < 3; j++) {
      const delay = (s * 3 + j) * 0.045;
      const t = (k - delay) / (1 - delay);
      if (t <= 0) continue;
      const ms = t * 900;
      const x0 = row.homeX(s);
      const vx = (s < 2 ? -1 : 1) * (0.06 + 0.02 * j) - (s === 1 ? 0.05 : 0) + (s === 2 ? 0.05 : 0);
      // A falling card bouncing off the floor with half its speed each time.
      let y = FC_HOME_Y;
      let vy = -0.15;
      let rest = ms;
      const g = 0.0016;
      for (let step = 0; step < 6 && rest > 0; step++) {
        const tHit = (vy + Math.sqrt(vy * vy + 2 * g * (floor - y))) / g;
        if (rest < tHit) {
          y = y + vy * rest + 0.5 * g * rest * rest;
          rest = 0;
        } else {
          rest -= tHit;
          y = floor;
          vy = -(vy + g * tHit) * 0.55;
        }
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 0.6) / 0.4);
      drawRealCard(ctx, cardOf(s, top - j), x0 + vx * ms, y, row.w, row.h);
      ctx.restore();
    }
  }
}

/** The art game for a stage: the revision's sim with this draw (the view, when given, is the phone's press and drag). */
export function freecellArtGame(view?: FcView, rev?: number | null, level?: string | null): ArcadeGame<FcState, ArcadeInputEvent | null> {
  return { ...freecellGameAt(rev, level), draw: (ctx, state, size) => drawFreecell(ctx, state, size, view) };
}

/* ---- The difficulty levels' hints (display only; the sim only counts them) ---- */

/** How long a hint's glow shows (ticks), and Easy's idle glow: after this many ticks with no move. */
const HINT_TICKS = 150;
const IDLE_HINT_TICKS = 8 * 60;
/** The hint's move for a position, worked out once per position (the solver's short search). */
let hintMemo: { key: string; move: readonly [number, number, number] | null } | null = null;
function hintFor(state: FcState): readonly [number, number, number] | null {
  const key = fcPackKey(state);
  if (hintMemo?.key !== key) hintMemo = { key, move: fcHintMove(state) };
  return hintMemo.move;
}
function fcPackKey(state: FcState): string {
  return `${state.lv}:${fcPack(state).join(",")}`;
}

/**
 * The hint showing now (live stage only: a view is given): for HINT_TICKS after a hint was asked for, or on Easy once
 * the player has made no move for 8 s. The glow fades in and out softly.
 */
export function fcHintShown(state: FcState, view?: FcView): { move: readonly [number, number, number]; glow: number } | null {
  if (!view || !state.lv || state.ended !== 0) return null;
  const asked = (state.hints ?? 0) > 0 ? state.tick - (state.hintTick ?? 0) : Infinity;
  const quietSince = Math.max(state.lastTick, state.hintTick ?? 0, state.noteTick ?? 0);
  const idle = state.lv === FC_LV_EASY && state.tick - quietSince >= IDLE_HINT_TICKS;
  if (!(asked < HINT_TICKS) && !idle) return null;
  const move = hintFor(state);
  if (!move) return null;
  const pulse = 0.55 + 0.35 * Math.sin((state.tick / 60) * Math.PI * 1.4);
  return { move, glow: asked < HINT_TICKS ? Math.min(1, (HINT_TICKS - asked) / 30) * pulse : pulse };
}

function drawHintTarget(ctx: CanvasRenderingContext2D, state: FcState, to: number, glow: number, row: FcTopRow): void {
  let box: { x: number; y: number; w: number; h: number };
  if (to === FC_PILE_HOME) box = { x: row.homeX(0), y: FC_HOME_Y, w: row.homeX(3) + row.w - row.homeX(0), h: row.h };
  else if (to < FC_COLS) {
    const col = state.cols[to]!;
    box = { x: fcColX(to), y: FC_COL_Y + Math.max(0, col.length - 1) * fcColStep(col.length), w: FC_COL_W, h: FC_COL_H };
  } else box = fcCardBox(state, to, 0);
  ctx.save();
  roundRect(ctx, box.x - 3, box.y - 3, box.w + 6, box.h + 6, 7);
  ctx.strokeStyle = `rgba(233,196,106,${(0.9 * glow).toFixed(3)})`;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.restore();
}

export const freecellArt = freecellArtGame();
