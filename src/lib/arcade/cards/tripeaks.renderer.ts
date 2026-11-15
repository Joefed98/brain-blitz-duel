/**
 * TriPeaks' art and layout (display only; the sim is tripeaks.ts). The world is 414 × 772: HUD chips across the top,
 * three tall peaks of large cards, the run readout ("Run 3 (best 5)"; a row of ten flames until 3 Nov 2026), and the stock and discard on a dark panel
 * at the bottom, within thumb reach. Playable cards glow gold. tpHit reads the same layout.
 * The Cards & Board overhaul (15 Nov 2026, display only): real cards (realArt.renderer.ts), 54 × 80, the bottom row's
 * ten overlapping a little (each card's index shows), the peaks' rows overlapping like a real deal, and the stock and
 * discard as a large pair just under them; on the live stage a played card slides to the discard, the card it uncovers
 * flips, and a turned stock card slides off and flips (CardMotion).
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "../engine";
import { arcadeFx, type ArcadeFxSpec } from "../arcadeFx.renderer";
import { CARD_FONT, drawChip, drawSlot } from "./cards.renderer";
import { CardLayer, CardMotion, drawRealCard, drawRealFelt } from "./realArt.renderer";
import { arcPoint, drawOutline, drawSparks, FxTimeline } from "./cardsFx.renderer";
import { roundRect } from "./cards.renderer";
import { TP_CARDS, TP_STOCK, TP_STOCK_PILE, tpFree, tpPlayable, tripeaksGameFor, type TpState } from "./tripeaks";

export const TP_WORLD_W = 414;
export const TP_WORLD_H = 772;
export const TP_BG = "#0E2A57";

/*
 * Layout (30 Oct 2026 legibility pass): the bottom row's ten face-up cards side by side, never overlapping (so the card
 * is as wide as a tenth of the world allows), the peaks taller (taller cards, more space between rows), and a smaller
 * stock and discard panel at the bottom, within thumb reach.
 */
export const TP_CARD_W = 54;
export const TP_CARD_H = 80;
const MARGIN = 4;
const UNIT = (TP_WORLD_W - 2 * MARGIN - TP_CARD_W) / 9;
const ROW_Y0 = 54;
const ROW_STEP = 66;
export const TP_FLAME_Y = ROW_Y0 + 3 * ROW_STEP + TP_CARD_H + 30;
export const TP_PANEL_Y = TP_FLAME_Y + 30;
export const TP_PILE_W = 96;
export const TP_PILE_H = 142;
export const TP_PILE_Y = TP_PANEL_Y + 30;
export const TP_STOCK_X = TP_WORLD_W / 2 - 20 - TP_PILE_W;
export const TP_DISCARD_X = TP_WORLD_W / 2 + 20;

/** A peak card's box. */
export function tpCardBox(i: number): { x: number; y: number } {
  let row: number;
  let u: number;
  if (i < 3) {
    row = 0;
    u = 3 * i + 1.5;
  } else if (i < 9) {
    const j = i - 3;
    row = 1;
    u = 3 * (j >> 1) + 1 + (j & 1);
  } else if (i < 18) {
    row = 2;
    u = i - 9 + 0.5;
  } else {
    row = 3;
    u = i - 18;
  }
  return { x: MARGIN + u * UNIT, y: ROW_Y0 + row * ROW_STEP };
}

/** What a tap at a point hits: a peak card's index, TP_STOCK_PILE, or -1 (covered cards are under the ones drawn over them). */
export function tpHit(state: TpState, x: number, y: number): number {
  for (let i = TP_CARDS - 1; i >= 0; i--) {
    if (state.cleared[i]) continue;
    const b = tpCardBox(i);
    if (x >= b.x && x <= b.x + TP_CARD_W && y >= b.y && y <= b.y + TP_CARD_H) return i;
  }
  if (x >= TP_STOCK_X - 14 && x <= TP_STOCK_X + TP_PILE_W + 14 && y >= TP_PILE_Y - 14 && y <= TP_PILE_Y + TP_PILE_H + 14) return TP_STOCK_PILE;
  return -1;
}

/** Whether a point is over the discard (a drag's drop). */
export function tpOverDiscard(x: number, y: number): boolean {
  return x >= TP_DISCARD_X - 20 && x <= TP_DISCARD_X + TP_PILE_W + 20 && y >= TP_PILE_Y - 30 && y <= TP_PILE_Y + TP_PILE_H + 20;
}

export interface TpView {
  pressed: number;
  drag: { index: number; x: number; y: number; ox: number; oy: number } | null;
  /** The live stage's card motion; none on reveals and replays. */
  motion?: CardMotion;
  /** The discard as last drawn (its top, and the card under it while a new top slides in). */
  discard?: { top: number; under: number };
  /** Stage 2's effects (the overhaul): the timeline, the card the phone last tried and the state seen last frame. */
  fx?: FxTimeline;
  lastTry?: number;
  seen?: { run: number; turns: number; peaks: number; rejects: number; ended: number; tick: number; top: number };
}

export function tpNewView(): TpView {
  return { pressed: -1, drag: null, motion: new CardMotion(), discard: { top: -1, under: -1 }, fx: new FxTimeline(), lastTry: -1 };
}


const discardAt = () => ({ x: TP_DISCARD_X + TP_PILE_W / 2, y: TP_PILE_Y + TP_PILE_H / 2 });

/** The shared success layer: runs of five and more, each peak top, and the clear. */
export const TRIPEAKS_FX: ArcadeFxSpec<TpState> = {
  game: "tripeaks",
  world: "cards",
  width: TP_WORLD_W,
  height: TP_WORLD_H,
  shake: false,
  events: [
    { kind: "combo", count: (s) => s.plays, when: (s) => s.run >= 5, at: discardAt, label: (s) => `RUN ${s.run}` },
    {
      kind: "perfect",
      count: (s) => s.peaks,
      at: (s) => (s.lastPlay >= 0 && s.lastPlay < 3 ? { x: tpCardBox(s.lastPlay).x + TP_CARD_W / 2, y: tpCardBox(s.lastPlay).y + TP_CARD_H / 2 } : null),
      label: () => "PEAK!",
    },
    { kind: "final", count: (s) => (s.ended === 1 ? 1 : 0), label: () => "CLEARED!" },
  ],
  misses: [{ count: (s) => s.rejects }],
};

export function drawTripeaks(ctx: CanvasRenderingContext2D, state: TpState, size: CanvasSize, view?: TpView): void {
  arcadeFx(ctx, TRIPEAKS_FX, state, () => drawTripeaksWorld(ctx, state, size, view), size);
}

function drawTripeaksWorld(ctx: CanvasRenderingContext2D, state: TpState, size: CanvasSize, view?: TpView): void {
  const W = TP_WORLD_W;
  ctx.save();
  ctx.scale(size.width / W, size.height / TP_WORLD_H);
  drawRealFelt(ctx, W, TP_WORLD_H);
  const cards = new CardLayer(ctx, view?.motion ?? null);
  noticeTripeaks(state, view);
  const nudge = view?.fx?.at<number>("nudge") ?? null;

  drawChip(ctx, 10, 9, "CLEARED", `${state.clearedCount}/${TP_CARDS}`, { gold: state.clearedCount === TP_CARDS });
  drawChip(ctx, W - 10, 9, "PEAKS", `${state.peaks}/3`, { align: "right", gold: state.peaks === 3 });
  // tripeaksRev 2: stock cards turned against the deal's par ("Stock 20 · par 20", the overhaul; "STOCK PAR 20/20" until then).
  if (state.stockPar !== undefined) drawChip(ctx, W / 2, 9, "", `Stock ${state.turns} · par ${state.stockPar}`, { align: "center", gold: state.turns <= state.stockPar });

  // Labels over the pair.
  const left = TP_STOCK - state.stockPos;
  ctx.fillStyle = "rgba(246,235,208,0.75)";
  ctx.font = `700 12px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`STOCK ${left}`, TP_STOCK_X + TP_PILE_W / 2, TP_PILE_Y - 14);
  ctx.fillText("DISCARD", TP_DISCARD_X + TP_PILE_W / 2, TP_PILE_Y - 14);

  // The stock: up to three backs; the next card is noted at the stock so a turn slides it from there.
  if (left > 0) {
    for (let k = Math.min(3, left) - 1; k >= 0; k--) cards.card(-100 - k, -1, TP_STOCK_X + k * 3, TP_PILE_Y - k * 3, TP_PILE_W, TP_PILE_H, { down: true, glow: k === 0 && view?.pressed === TP_STOCK_PILE ? 1 : 0, lift: k === 0 && view?.pressed === TP_STOCK_PILE ? 0.6 : 0 });
    view?.motion?.seed(state.stock[state.stockPos]!, TP_STOCK_X, TP_PILE_Y, true);
  } else drawSlot(ctx, TP_STOCK_X, TP_PILE_Y, TP_PILE_W, TP_PILE_H, -1, "EMPTY");

  // The discard: the card under the top stays drawn while the new top slides in.
  const d = view?.discard;
  if (d && d.top !== state.top) {
    d.under = d.top;
    d.top = state.top;
  }
  if (d && d.under >= 0 && d.under !== state.top) cards.card(d.under, d.under, TP_DISCARD_X, TP_PILE_Y, TP_PILE_W, TP_PILE_H);
  const fresh = state.lastTick > 0 ? Math.max(0, 1 - (state.tick - state.lastTick) / 16) : 0;

  const drag = view?.drag ?? null;
  for (let i = 0; i < TP_CARDS; i++) {
    if (state.cleared[i] || (drag && drag.index === i)) continue;
    const b = tpCardBox(i);
    const free = tpFree(state, i);
    const playable = state.ended === 0 && tpPlayable(state, i);
    const up = view?.pressed === i;
    // A refused card leans towards the discard and springs back.
    let nx = 0;
    let ny = 0;
    if (nudge && nudge.data === i) {
      const dx = TP_DISCARD_X - b.x;
      const dy = TP_PILE_Y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      const push = Math.sin(Math.PI * nudge.k) * 12;
      nx = (dx / d) * push;
      ny = (dy / d) * push;
    }
    cards.card(state.tab[i]!, state.tab[i]!, b.x + nx, b.y - (up ? 3 : 0) + ny, TP_CARD_W, TP_CARD_H, {
      down: !free,
      glow: up ? 1 : playable ? 0.7 : 0,
      lift: up ? 1 : 0,
    }, nx !== 0 || ny !== 0);
  }
  cards.card(state.top, state.top, TP_DISCARD_X, TP_PILE_Y, TP_PILE_W, TP_PILE_H, { glow: fresh * 0.9 });
  cards.flush();
  if (view?.fx) drawTripeaksFx(ctx, state, view.fx);

  // The run readout (3 Nov 2026: one chip, "Run 3 (best 5)", gold from a run of five).
  drawChip(ctx, W / 2, TP_FLAME_Y - 13, "Run", `${state.run} (best ${state.bestRun})`, { align: "center", gold: state.run >= 5 });

  // A run that ended stuck (stock gone, nothing playable) says why, under the pair (15 Nov 2026, display only).
  const stuck = tpStuckLines(state);
  if (stuck) {
    ctx.font = `800 15px ${CARD_FONT}`;
    ctx.fillStyle = "rgba(246,235,208,0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${stuck[0]} ${stuck[1]}`, W / 2, TP_PILE_Y + TP_PILE_H + 26);
  }

  if (drag) {
    const lifted = new CardLayer(ctx, view?.motion ?? null);
    lifted.card(state.tab[drag.index]!, state.tab[drag.index]!, drag.x - drag.ox, drag.y - drag.oy - 4, TP_CARD_W, TP_CARD_H, { glow: 1, lift: 1 }, true);
  }
  ctx.restore();
}

/** Starts stage 2's effects from what changed since the last frame (display only; the live stage's view alone). */
function noticeTripeaks(state: TpState, view?: TpView): void {
  const fx = view?.fx;
  if (!view || !fx) return;
  const seen = view.seen;
  view.seen = { run: state.run, turns: state.turns, peaks: state.peaks, rejects: state.rejects, ended: state.ended, tick: state.tick, top: state.top };
  if (!seen || state.tick < seen.tick) return;
  if (state.run > seen.run) fx.start("rung", 260, state.run);
  // A stock turn breaks a run of two or more: the ladder crumbles.
  if (state.turns > seen.turns && seen.run >= 2) fx.start("crumble", 520, Math.min(10, seen.run));
  // A peak's top card: it flies up from its peak with a sparkle (the card itself still lands on the discard).
  if (state.peaks > seen.peaks && state.lastPlay >= 0 && state.lastPlay < 3) fx.start("peak", 700, { index: state.lastPlay, card: state.top });
  if (state.rejects > seen.rejects && (view.lastTry ?? -1) >= 0 && (view.lastTry ?? -1) < TP_CARDS) fx.start("nudge", 300, view.lastTry);
  if (state.ended === 1 && seen.ended !== 1) for (let p = 0; p < 3; p++) fx.start(`light${p}`, 800, p, p * 260);
}

/** The ladder chip size and place: beside the discard, growing upwards. */
const RUNG_H = 13;
const RUNG_W = 38;
const LADDER_X = TP_DISCARD_X + TP_PILE_W + 14;

function rung(ctx: CanvasRenderingContext2D, n: number, x: number, y: number, alpha: number, scale = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + RUNG_W / 2, y + RUNG_H / 2);
  ctx.scale(scale, scale);
  roundRect(ctx, -RUNG_W / 2, -RUNG_H / 2, RUNG_W, RUNG_H, RUNG_H / 2);
  ctx.fillStyle = n >= 5 ? "rgba(233,196,106,0.95)" : "rgba(5,12,30,0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,196,106,0.6)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = n >= 5 ? "#231503" : "#F6EBD0";
  ctx.font = `800 10px ${CARD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`×${n}`, 0, 0.5);
  ctx.restore();
}

/** The run ladder (growing, or crumbling after a stock turn), the peak top's flight and the finish's lit peaks. */
function drawTripeaksFx(ctx: CanvasRenderingContext2D, state: TpState, fx: FxTimeline): void {
  const base = TP_PILE_Y + TP_PILE_H - RUNG_H;
  const crumble = fx.at<number>("crumble");
  if (crumble) {
    for (let n = 1; n <= crumble.data; n++) {
      const fall = crumble.k * crumble.k * (60 + n * 8);
      const drift = (n % 2 ? 1 : -1) * crumble.k * (6 + n);
      ctx.save();
      ctx.translate(drift, fall);
      rung(ctx, n, LADDER_X, base - (n - 1) * (RUNG_H + 1), 1 - crumble.k);
      ctx.restore();
    }
  } else if (state.ended === 0 || state.run > 0) {
    const pop = fx.at<number>("rung");
    const shown = Math.min(10, state.run);
    for (let n = 1; n <= shown; n++) {
      const fresh = pop && n === shown ? 1.5 - 0.5 * pop.k : 1;
      rung(ctx, n, LADDER_X, base - (n - 1) * (RUNG_H + 1), 1, fresh);
    }
  }
  const peak = fx.at<{ index: number; card: number }>("peak");
  if (peak) {
    const b = tpCardBox(peak.data.index);
    const p = arcPoint(b.x, b.y, b.x, b.y - 70, peak.k, 0);
    ctx.save();
    ctx.globalAlpha = 1 - peak.k;
    drawRealCard(ctx, peak.data.card, p.x, p.y, TP_CARD_W, TP_CARD_H, { glow: 1 });
    ctx.restore();
    drawSparks(ctx, b.x + TP_CARD_W / 2, b.y + TP_CARD_H / 2, peak.k, 46, 12);
  }
  for (let p = 0; p < 3; p++) {
    const light = fx.at(`light${p}`);
    if (!light) continue;
    // The cleared peak's outline, from its top card down to its base, lit gold.
    const top = tpCardBox(p);
    const left = tpCardBox(18 + 3 * p);
    const right = tpCardBox(18 + 3 * p + 3);
    const a = Math.sin(Math.PI * light.k);
    drawOutline(ctx, left.x - 4, top.y - 4, right.x + TP_CARD_W - left.x + 8, left.y + TP_CARD_H - top.y + 8, a, 14);
    drawSparks(ctx, top.x + TP_CARD_W / 2, top.y + 6, light.k, 30, 8);
  }
}

/** The note for a run that ended stuck (`ended` 3: the stock is gone and no card plays), or null. Display only. */
export function tpStuckLines(state: Pick<TpState, "ended">): readonly [string, string] | null {
  return state.ended === 3 ? ["NO PLAYS", "LEFT"] : null;
}

/** The art game for a stage: the revision's sim with this draw (no stamp: tripeaksRev 1). */
export function tripeaksArtGame(view?: TpView, rev?: number | null): ArcadeGame<TpState, ArcadeInputEvent | null> {
  return { ...tripeaksGameFor(rev), draw: (ctx, state, size) => drawTripeaks(ctx, state, size, view) };
}

export const tripeaksArt = tripeaksArtGame();
