/**
 * Pyramid's art and layout (display only; the sim is pyramid.ts). The world is 414 × 772 on Free Cell's blue felt:
 * HUD chips across the top, the seven-row pyramid of large cards (the bottom row of seven side by side, each row
 * overlapping the one above so every index shows), then a dark panel within thumb reach
 * holding the stock and waste piles (between them, "Need 4" while a card is selected) and the Undo / Reset buttons. The selected card glows gold; its partners (cards
 * adding to 13) and free Kings glow softly. pyHit reads the same layout.
 * The Cards & Board overhaul (15 Nov 2026, display and input mapping only): real cards (realArt.renderer.ts), 56 × 82
 * in the pyramid, covered cards dimmed until their last cover goes; Reset asks first (confirmBoxes); on the live stage
 * a turned stock card slides to the waste and flips, and an undone card slides back (CardMotion).
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "../engine";
import { arcadeFx, type ArcadeFxSpec } from "../arcadeFx.renderer";
import { rankOf } from "./cards";
import { CARD_FONT, drawChip, drawSlot, roundRect } from "./cards.renderer";
import { drawCardButton, drawResetConfirm, inButton, type CardButtonBox } from "./cardButtons.renderer";
import { CardLayer, CardMotion, drawRealCard, drawRealFelt } from "./realArt.renderer";
import { drawOutline, drawSparks, drawStamp, easeInOut, FxTimeline, shakeX } from "./cardsFx.renderer";
import {
  PY_INPUT_HINT, PY_INPUT_RESET, PY_INPUT_UNDO, PY_LV_EASY, pyCardAt, pyCardsOf, pyDeadEnd, pyFree, pyGlows, pyHintButtonOn, pyHintMove, pyHintsLeft, pyPack,
  pyPairsFullOf, pyramidGameAt, pyRowOf, pyRowsOf, pyStockPileOf, pyWastePileOf, pyWasteTop, type PyState,
} from "./pyramid";
import { pyLayoutBox, pyLayoutFor, type PyLayout } from "./pyramidLayout";

export const PY_WORLD_W = 414;
export const PY_WORLD_H = 772;
export const PY_BG = "#0E2A57";

/*
 * The polish plan (Joe, 20 Nov 2026, section 5: Thirteen's larger cards): 62 × 90 (were 56 × 82) on the same 58 px
 * step, so the bottom row of seven still fits the table (each card a little over its neighbour's right edge, its own
 * index clear), the rows 56 apart (were 52), and the panel 10 px lower (was 474).
 */
export const PY_CARD_W = 62;
export const PY_CARD_H = 90;
const STEP_X = 58;
const ROW_Y0 = 46;
const ROW_STEP = 56;
export const PY_INFO_Y = ROW_Y0 + 6 * ROW_STEP + PY_CARD_H + 12;
export const PY_PANEL_Y = 484;
export const PY_PILE_W = 92;
export const PY_PILE_H = 134;
export const PY_PILE_Y = PY_PANEL_Y + 34;
export const PY_STOCK_X = 64;
export const PY_WASTE_X = PY_WORLD_W - 64 - PY_PILE_W;
export const PY_BTN_Y = 690;
export const PY_BTN_H = 50;
/** Undo and Reset across the panel's foot. */
export const PY_BUTTONS: readonly { kind: number; box: CardButtonBox }[] = [
  { kind: PY_INPUT_UNDO, box: { x: 30, y: PY_BTN_Y, w: 168, h: PY_BTN_H } },
  { kind: PY_INPUT_RESET, box: { x: PY_WORLD_W - 30 - 168, y: PY_BTN_Y, w: 168, h: PY_BTN_H } },
];

/** A pyramid card's box (seven rows unless `rows` says otherwise: pyramidRev 4's level deals, pyramidLayout.ts). */
export function pyCardBox(i: number, rows = 7): { x: number; y: number } {
  const { row, pos } = pyRowOf(i);
  if (rows !== 7) return pyLayoutBox(pyLayoutFor(rows), row, pos);
  const rowW = (row + 1) * STEP_X - (STEP_X - PY_CARD_W);
  return { x: PY_WORLD_W / 2 - rowW / 2 + pos * STEP_X, y: ROW_Y0 + row * ROW_STEP };
}

/** The layout a state's pyramid is drawn in (its rows: seven before pyramidRev 4's level deals). */
function layoutOf(state: Pick<PyState, "rows">): PyLayout {
  return pyLayoutFor(pyRowsOf(state));
}

/** What a tap hits: a pyramid card (the top-most drawn under the point), the stock or the waste (pyStockPileOf / pyWastePileOf: 28 and 29 on seven rows), or -1. */
export function pyHit(state: PyState, x: number, y: number): number {
  const L = layoutOf(state);
  const rows = pyRowsOf(state);
  for (let i = pyCardsOf(state) - 1; i >= 0; i--) {
    if (state.gone[i]) continue;
    const b = pyCardBox(i, rows);
    if (x >= b.x && x <= b.x + L.cardW && y >= b.y && y <= b.y + L.cardH) return i;
  }
  if (x >= PY_STOCK_X - 14 && x <= PY_STOCK_X + PY_PILE_W + 14 && y >= PY_PILE_Y - 14 && y <= PY_PILE_Y + PY_PILE_H + 14) return pyStockPileOf(state);
  if (x >= PY_WASTE_X - 14 && x <= PY_WASTE_X + PY_PILE_W + 14 && y >= PY_PILE_Y - 14 && y <= PY_PILE_Y + PY_PILE_H + 14) return pyWastePileOf(state);
  return -1;
}

/** A level's buttons (the difficulty levels): Undo, Hint, Reset. */
export const PY_LEVEL_BUTTONS: readonly { kind: number; box: CardButtonBox }[] = [
  { kind: PY_INPUT_UNDO, box: { x: 20, y: PY_BTN_Y, w: 120, h: PY_BTN_H } },
  { kind: PY_INPUT_HINT, box: { x: PY_WORLD_W / 2 - 60, y: PY_BTN_Y, w: 120, h: PY_BTN_H } },
  { kind: PY_INPUT_RESET, box: { x: PY_WORLD_W - 20 - 120, y: PY_BTN_Y, w: 120, h: PY_BTN_H } },
];
export function pyButtonsOf(state?: Pick<PyState, "lv"> & { rev?: number }): readonly { kind: number; box: CardButtonBox }[] {
  // D6's Hard and Expert (pyramidRev 4) have no hints, so no Hint button.
  return state?.lv && pyHintButtonOn(state) ? PY_LEVEL_BUTTONS : PY_BUTTONS;
}

/** The Undo, Reset (or a level's Hint) button under a point (its input kind), 0 for none. */
export function pyButtonHit(x: number, y: number, state?: Pick<PyState, "lv"> & { rev?: number }): number {
  for (const b of pyButtonsOf(state)) if (inButton(b.box, x, y)) return b.kind;
  return 0;
}

/* ---- The difficulty levels' hint (display only) ---- */
const HINT_TICKS = 150;
const IDLE_HINT_TICKS = 8 * 60;
let hintMemo: { key: string; move: number[] | null } | null = null;
/** The hint showing now (live stage only): after a hint for 2.5 s, or on Easy after 8 s without a move. */
export function pyHintShown(state: PyState, view?: PyView): { move: number[]; glow: number } | null {
  if (!view || !state.lv || state.ended !== 0) return null;
  const asked = (state.hints ?? 0) > 0 ? state.tick - (state.hintTick ?? 0) : Infinity;
  const idle = state.lv === PY_LV_EASY && state.tick - Math.max(state.lastTick, state.hintTick ?? 0) >= IDLE_HINT_TICKS;
  if (!(asked < HINT_TICKS) && !idle) return null;
  const key = `${state.lv}:${pyPack(state).join(",")}`;
  if (hintMemo?.key !== key) hintMemo = { key, move: pyHintMove(state) };
  if (!hintMemo.move) return null;
  const pulse = 0.55 + 0.35 * Math.sin((state.tick / 60) * Math.PI * 1.4);
  return { move: hintMemo.move, glow: asked < HINT_TICKS ? Math.min(1, (HINT_TICKS - asked) / 30) * pulse : pulse };
}

export interface PyView {
  pressed: number;
  button: number;
  /** Reset's confirmation is open (and which of its buttons is held). */
  confirm?: boolean;
  confirmHeld?: "ok" | "cancel" | null;
  /** The live stage's card motion; none on reveals and replays. */
  motion?: CardMotion;
  /** Stage 2's effects (the overhaul): the timeline, the last place tapped, where each card was drawn last frame, the state seen. */
  fx?: FxTimeline;
  lastTry?: number;
  boxes?: Map<number, PyBox>;
  seen?: { pairs: number; kings: number; rejects: number; ended: number; tick: number; sel: number; free: boolean[] };
}

/** A card as drawn last frame (a pair taken this frame flies from there). */
interface PyBox {
  card: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function pyNewView(): PyView {
  return { pressed: -1, button: 0, confirm: false, confirmHeld: null, motion: new CardMotion(), fx: new FxTimeline(), lastTry: -1, boxes: new Map() };
}

const wasteAt = () => ({ x: PY_WASTE_X + PY_PILE_W / 2, y: PY_PILE_Y + PY_PILE_H / 2 });
const lastAt = (s: PyState) => {
  const n = pyCardsOf(s);
  const a = s.lastA >= 0 && s.lastA < n ? s.lastA : s.lastB >= 0 && s.lastB < n ? s.lastB : -1;
  if (a < 0) return wasteAt();
  const L = layoutOf(s);
  const b = pyCardBox(a, L.rows);
  return { x: b.x + L.cardW / 2, y: b.y + L.cardH / 2 };
};

/** The shared success layer: a pair of pyramid cards, a King, the clear. */
export const PYRAMID_FX: ArcadeFxSpec<PyState> = {
  game: "pyramid",
  world: "cards",
  width: PY_WORLD_W,
  height: PY_WORLD_H,
  shake: false,
  events: [
    { kind: "combo", count: (s) => s.ppPairs, at: lastAt, label: (s) => (s.ppPairs >= pyPairsFullOf(s) ? "13!" : "13") },
    { kind: "pop", count: (s) => s.kings, at: lastAt, label: () => "KING" },
    { kind: "final", count: (s) => (s.ended === 1 ? 1 : 0), label: () => "CLEARED!" },
  ],
  misses: [{ count: (s) => s.rejects }],
};

export function drawPyramid(ctx: CanvasRenderingContext2D, state: PyState, size: CanvasSize, view?: PyView): void {
  arcadeFx(ctx, PYRAMID_FX, state, () => drawPyramidWorld(ctx, state, size, view), size);
}

function drawPyramidWorld(ctx: CanvasRenderingContext2D, state: PyState, size: CanvasSize, view?: PyView): void {
  const W = PY_WORLD_W;
  const H = PY_WORLD_H;
  ctx.save();
  ctx.scale(size.width / W, size.height / H);
  drawRealFelt(ctx, W, H);
  const cards = new CardLayer(ctx, view?.motion ?? null);
  noticePyramid(state, view);
  const fx = view?.fx ?? null;
  const wrong = fx?.at<number[]>("wrong") ?? null;
  const shake = (i: number) => (wrong && wrong.data.includes(i) ? shakeX(wrong.k, 4) : 0);

  // D6's taller pyramids (pyramidRev 4): the state's cards, layout and pairs figure; seven rows read exactly as before.
  const N = pyCardsOf(state);
  const L = layoutOf(state);
  const ROWS = L.rows;
  const STOCK = pyStockPileOf(state);
  const WASTE = pyWastePileOf(state);
  const PAIRS = pyPairsFullOf(state);
  drawChip(ctx, 10, 9, "REMOVED", `${state.removed}/${N}`, { gold: state.removed === N });
  drawChip(ctx, W - 10, 9, "PAIRS", `${Math.min(state.ppPairs, PAIRS)}/${PAIRS}`, { align: "right", gold: state.ppPairs >= PAIRS });

  const live = state.ended === 0;
  const selCard = state.sel >= 0 ? pyCardAt(state, state.sel) : -1;
  // Hard and Expert (the difficulty levels): no partner or King glow; the hint's cards glow instead when asked for.
  const helps = pyGlows(state);
  const hint = pyHintShown(state, view);
  const hinted = (a: number) => (hint && hint.move.includes(a) ? hint.glow : 0);
  const partner = (card: number) => helps && live && selCard >= 0 && rankOf(card) + rankOf(selCard) === 13;
  for (let i = 0; i < N; i++) {
    if (state.gone[i]) continue;
    const b = pyCardBox(i, ROWS);
    const free = pyFree(state, i);
    const card = state.tab[i]!;
    const up = state.sel === i || view?.pressed === i;
    const glow = up ? 1 : Math.max(free && (partner(card) || (helps && live && rankOf(card) === 13)) ? 0.55 : 0, hinted(i));
    // A card whose last cover just went brightens from its dimmed look (stage 2).
    const uncover = fx?.at(`uncover${i}`);
    const dim = free ? (uncover ? 0.36 * (1 - uncover.k) : 0) : 0.36;
    const sx = shake(i);
    cards.card(card, card, b.x + sx, b.y - (up ? 3 : 0), L.cardW, L.cardH, { glow: uncover ? Math.max(glow, 0.6 * (1 - uncover.k)) : glow, dim, lift: up ? 1 : 0 }, sx !== 0);
  }

  // (The rules line "ONE PASS · PAIRS ADD TO 13 · K ALONE" lived here until 3 Nov 2026; it is in How to play.)

  // The panel: stock and waste, then Undo and Reset.
  roundRect(ctx, 14, PY_PANEL_Y, W - 28, H - PY_PANEL_Y - 14, 22);
  ctx.fillStyle = "rgba(3,8,22,0.62)";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,196,106,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
  const left = state.pile.length - state.pos;
  ctx.fillStyle = "rgba(246,235,208,0.78)";
  ctx.font = `700 13px ${CARD_FONT}`;
  ctx.fillText(`STOCK ${left}`, PY_STOCK_X + PY_PILE_W / 2, PY_PANEL_Y + 18);
  ctx.fillText(`WASTE ${state.pos}`, PY_WASTE_X + PY_PILE_W / 2, PY_PANEL_Y + 18);
  if (left > 0) {
    for (let k = Math.min(3, left) - 1; k >= 0; k--) cards.card(-100 - k, -1, PY_STOCK_X + k * 3, PY_PILE_Y - k * 3, PY_PILE_W, PY_PILE_H, { down: true, glow: k === 0 && view?.pressed === STOCK ? 1 : k === 0 ? hinted(STOCK) : 0 });
    // The next stock card is noted at the stock, so a turn slides it from there and flips it.
    view?.motion?.seed(state.pile[state.pos]!, PY_STOCK_X, PY_PILE_Y, true);
  } else drawSlot(ctx, PY_STOCK_X, PY_PILE_Y, PY_PILE_W, PY_PILE_H, -1, "EMPTY");
  const top = pyWasteTop(state);
  if (top >= 0) {
    if (state.pos > 1) cards.card(state.pile[state.pos - 2]!, state.pile[state.pos - 2]!, PY_WASTE_X - 4, PY_PILE_Y + 3, PY_PILE_W, PY_PILE_H, { dim: 0.4 });
    const up = state.sel === WASTE || view?.pressed === WASTE;
    const glow = up ? 1 : Math.max(partner(top) || (helps && live && rankOf(top) === 13) ? 0.55 : 0, hinted(WASTE));
    const sx = shake(WASTE);
    cards.card(top, top, PY_WASTE_X + sx, PY_PILE_Y - (up ? 3 : 0), PY_PILE_W, PY_PILE_H, { glow, lift: up ? 1 : 0 }, sx !== 0);
  } else drawSlot(ctx, PY_WASTE_X, PY_PILE_Y, PY_PILE_W, PY_PILE_H, -1, "WASTE");
  cards.flush();
  if (fx) drawPyramidFx(ctx, fx, L);
  if (view?.boxes) rememberBoxes(state, view.boxes);

  // Between the piles, only while a card is selected: the rank its partner needs (3 Nov 2026; until then a large "13"
  // over "TAP TWO" whenever nothing was selected).
  if (selCard >= 0 && live && rankOf(selCard) < 13) {
    ctx.font = `800 15px ${CARD_FONT}`;
    ctx.fillStyle = "rgba(246,235,208,0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Need ${PY_RANK_NAMES[13 - rankOf(selCard)]}`, W / 2, PY_PILE_Y + PY_PILE_H / 2);
  }
  // A dead end (15 Nov 2026, display only): on pyramidRev 3 it waits for Undo or Reset; a run that ended stuck says so.
  const deadEnd = pyDeadEndLines(state);
  if (deadEnd) {
    ctx.font = `800 14px ${CARD_FONT}`;
    ctx.fillStyle = "rgba(246,235,208,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(deadEnd[0], W / 2, PY_PILE_Y + PY_PILE_H / 2 - 10);
    ctx.fillText(deadEnd[1], W / 2, PY_PILE_Y + PY_PILE_H / 2 + 10);
  }

  for (const b of pyButtonsOf(state)) {
    if (b.kind === PY_INPUT_HINT) {
      const left = pyHintsLeft(state);
      drawCardButton(ctx, b.box, "hint", left === Infinity ? "Hint" : left > 0 ? `Hint (${left})` : "No hints", { live: live && left > 0, held: view?.button === b.kind });
      continue;
    }
    const isUndo = b.kind === PY_INPUT_UNDO;
    const liveBtn = live && (isUndo ? state.hist.length > 0 : state.hist.length > 0 || state.resets > 0);
    drawCardButton(ctx, b.box, isUndo ? "undo" : "reset", isUndo ? "Undo" : "Reset", { live: liveBtn, held: view?.button === b.kind });
  }
  if (view?.confirm && live) drawResetConfirm(ctx, W, H, "Every pair goes back to the deal.", view.confirmHeld ?? null);
  ctx.restore();
}

/** Where each pyramid card and the waste's top are drawn (the pyramid's indexes, the waste's tap), for next frame's flights. */
function rememberBoxes(state: PyState, boxes: Map<number, PyBox>): void {
  boxes.clear();
  const L = layoutOf(state);
  for (let i = 0; i < pyCardsOf(state); i++) {
    if (state.gone[i]) continue;
    const b = pyCardBox(i, L.rows);
    boxes.set(i, { card: state.tab[i]!, x: b.x, y: b.y, w: L.cardW, h: L.cardH });
  }
  const top = pyWasteTop(state);
  if (top >= 0) boxes.set(pyWastePileOf(state), { card: top, x: PY_WASTE_X, y: PY_PILE_Y, w: PY_PILE_W, h: PY_PILE_H });
}

/** Starts stage 2's effects from what changed since the last frame (display only; the live stage's view alone). */
function noticePyramid(state: PyState, view?: PyView): void {
  const fx = view?.fx;
  if (!view || !fx) return;
  const n = pyCardsOf(state);
  const rows = pyRowsOf(state);
  const free = Array.from({ length: n }, (_, i) => !state.gone[i] && pyFree(state, i));
  const seen = view.seen;
  view.seen = { pairs: state.pairs, kings: state.kings, rejects: state.rejects, ended: state.ended, tick: state.tick, sel: state.sel, free };
  if (!seen || state.tick < seen.tick) return;
  const boxes = view.boxes ?? new Map<number, PyBox>();
  if (state.pairs > seen.pairs) {
    const a = boxes.get(state.lastA);
    const b = boxes.get(state.lastB);
    if (a && b) fx.start("pair", 560, [a, b]);
  } else if (state.kings > seen.kings) {
    const k = boxes.get(state.lastA);
    if (k) fx.start("king", 700, k);
  }
  // A refused pair: both cards shake (the one held and the one just tapped).
  if (state.rejects > seen.rejects) fx.start("wrong", 300, [seen.sel, view.lastTry ?? -1].filter((i) => i >= 0));
  // Cards whose last cover just went (not after an undo or reset, which put covers back).
  if (state.pairs + state.kings > seen.pairs + seen.kings) for (let i = 0; i < n; i++) if (free[i] && !seen.free[i]) fx.start(`uncover${i}`, 320);
  if (state.ended === 1 && seen.ended !== 1) for (let row = rows - 1; row >= 0; row--) fx.start(`row${row}`, 700, row, (rows - 1 - row) * 90);
}

/** A pair flying off with "13" between, a King spinning away, and the finish's outline lighting from the bottom. */
function drawPyramidFx(ctx: CanvasRenderingContext2D, fx: FxTimeline, L: PyLayout): void {
  const CW = L.cardW;
  const CH = L.cardH;
  const pair = fx.at<PyBox[]>("pair");
  if (pair) {
    const [a, b] = pair.data as [PyBox, PyBox];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const k = pair.k;
    const meet = easeInOut(Math.min(1, k / 0.45));
    const fly = Math.max(0, (k - 0.45) / 0.55);
    ctx.save();
    ctx.globalAlpha = 1 - fly;
    for (const [c, side] of [[a, -1], [b, 1]] as const) {
      const x = c.x + (mx + side * 9 - c.x) * meet + fly * 60;
      const y = c.y + (my - c.y) * meet - fly * fly * 220;
      drawRealCard(ctx, c.card, x, y, CW, CH, { lift: 1 });
    }
    ctx.restore();
    if (k > 0.3) drawStamp(ctx, "13", mx + CW / 2, my - 8, (k - 0.3) / 0.7, 26);
  }
  const king = fx.at<PyBox>("king");
  if (king) {
    const c = king.data;
    const k = king.k;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.translate(c.x + CW / 2, c.y + CH / 2 - k * k * 200);
    ctx.rotate(k * Math.PI * 2);
    drawRealCard(ctx, c.card, -CW / 2, -CH / 2, CW, CH, { glow: 1 });
    ctx.restore();
    drawSparks(ctx, c.x + CW / 2, c.y + CH / 2, k, 50, 14);
  }
  for (let row = 0; row < L.rows; row++) {
    const lit = fx.at(`row${row}`);
    if (!lit) continue;
    const a = Math.sin(Math.PI * lit.k);
    for (let pos = 0; pos <= row; pos++) {
      const b = pyCardBox(row * (row + 1) / 2 + pos, L.rows);
      drawOutline(ctx, b.x, b.y, CW, CH, a, 6);
    }
  }
}

/** The dead-end note between the piles (display only), two short lines, or null. */
export function pyDeadEndLines(state: PyState): readonly [string, string] | null {
  const d = pyDeadEnd(state);
  return d === "wait" ? ["NO MOVES", "UNDO OR RESET"] : d === "over" ? ["NO MOVES", "LEFT"] : null;
}

/** The partner rank as the cards show it (1 is an Ace, 11–12 Jack and Queen). */
const PY_RANK_NAMES = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

/** The art game for a stage: the revision's sim with this draw (no stamp: pyramidRev 1). */
export function pyramidArtGame(view?: PyView, rev?: number | null, level?: string | null): ArcadeGame<PyState, ArcadeInputEvent | null> {
  return { ...pyramidGameAt(rev, level), draw: (ctx, state, size) => drawPyramid(ctx, state, size, view) };
}

export const pyramidArt = pyramidArtGame();
