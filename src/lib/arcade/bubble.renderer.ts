/**
 * Bubble Pop art: an underwater reef in the High Seas world. Render only.
 * Uses the sim's own stretched world transform (scaleX/scaleY) and draws every
 * bubble at the sim's radius on its sim cell; rock, kelp and coral sit only in
 * the side wall margins and above the sim ceiling line.
 */
import type { CanvasSize } from "./engine";
import { artReady, drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { BUBBLE_FX } from "./arcadeFxGames.renderer";
import { successHud, successFrame } from './success.renderer';
import {
  bubbleGame,
  bubCellX,
  bubCellY,
  bubColour,
  bubIsSpecial,
  bubNextColour,
  bubRowCols,
  BUB_BOMB,
  BUB_COLS,
  BUB_JOKER,
  BUB_LINE,
  BUB_PALETTE,
  BUB_HUD_H,
  BUB_MAX_ROWS,
  BUB_R,
  BUB_ROW_H,
  BUB_SHOOTER_LINE,
  BUB_SHOOTER_X,
  BUB_SHOOTER_Y,
  BUB_TOP,
  BUB_WALL,
  BUB_WORLD_H,
  BUB_WORLD_W,
  type BubState,
} from "./bubble";
import { reducedMotion } from "./art.renderer";
import {
  seaClock,
  seaCoral,
  seaDeviceScale,
  seaKelp,
  seaNow,
  seaSprite,
  seaUnderwater,
  SEA_BRASS,
  SEA_BRASS_DARK,
  SEA_GOLD,
  SEA_TEXT,
} from "./seas.renderer";

export type BubCreature = "crab" | "starfish" | "fish" | "jellyfish" | "shell";
/** Colour value 1…5 → creature, one-to-one. */
export const BUB_CREATURES: readonly BubCreature[] = ["crab", "starfish", "fish", "jellyfish", "shell"];
export function bubCreature(value: number): BubCreature {
  return BUB_CREATURES[(value - 1) % BUB_CREATURES.length] ?? "fish";
}

/** True once all five creature sprites are ready; art is all five or none. */
function creatureArtReady(): boolean {
  return BUB_CREATURES.every((k) => artReady("underwater", k));
}

/** Draws a creature centred at (cx, cy), fitting radius r. */
export function drawCreature(c: CanvasRenderingContext2D, kind: BubCreature, cx: number, cy: number, r: number): void {
  // Art pilot (Underwater): creature sprites inside the bubble (the bubble circle stays the drawn bound),
  // only once all five are ready so art and drawn symbols never mix.
  if (creatureArtReady() && drawArtSprite(c, "underwater", kind, cx - r * 0.62, cy - r * 0.62, r * 1.24, r * 1.24)) return;
  c.save();
  c.fillStyle = "rgba(8,20,36,0.82)";
  c.strokeStyle = "rgba(8,20,36,0.82)";
  c.lineWidth = Math.max(1, r * 0.13);
  c.lineCap = "round";
  switch (kind) {
    case "fish":
      c.beginPath();
      c.ellipse(cx - r * 0.12, cy, r * 0.55, r * 0.34, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(cx + r * 0.35, cy);
      c.lineTo(cx + r * 0.78, cy - r * 0.34);
      c.lineTo(cx + r * 0.78, cy + r * 0.34);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath();
      c.arc(cx - r * 0.38, cy - r * 0.07, r * 0.09, 0, Math.PI * 2);
      c.fill();
      break;
    case "starfish":
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const d = i % 2 === 0 ? r * 0.72 : r * 0.3;
        c.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
      }
      c.closePath();
      c.fill();
      break;
    case "shell":
      c.beginPath();
      c.moveTo(cx, cy + r * 0.6);
      c.arc(cx, cy + r * 0.05, r * 0.62, Math.PI * 1.05, Math.PI * 1.95);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.55)";
      c.lineWidth = Math.max(0.8, r * 0.07);
      c.beginPath();
      for (const dx of [-0.36, -0.12, 0.12, 0.36]) {
        c.moveTo(cx, cy + r * 0.55);
        c.lineTo(cx + dx * r * 1.4, cy - r * 0.38);
      }
      c.stroke();
      break;
    case "crab":
      c.beginPath();
      c.ellipse(cx, cy + r * 0.1, r * 0.42, r * 0.28, 0, 0, Math.PI * 2);
      c.fill();
      for (const side of [-1, 1]) {
        c.beginPath();
        c.arc(cx + side * r * 0.55, cy - r * 0.32, r * 0.17, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(cx + side * r * 0.3, cy);
        c.lineTo(cx + side * r * 0.52, cy - r * 0.22);
        for (const k of [0, 1, 2]) {
          c.moveTo(cx + side * r * 0.3, cy + r * (0.12 + k * 0.1));
          c.lineTo(cx + side * r * 0.66, cy + r * (0.26 + k * 0.14));
        }
        c.stroke();
      }
      break;
    case "jellyfish":
      c.beginPath();
      c.arc(cx, cy - r * 0.05, r * 0.5, Math.PI, 0);
      c.closePath();
      c.fill();
      c.beginPath();
      for (const dx of [-0.32, -0.1, 0.12, 0.34]) {
        c.moveTo(cx + dx * r, cy);
        c.quadraticCurveTo(cx + (dx - 0.12) * r, cy + r * 0.32, cx + dx * r, cy + r * 0.62);
      }
      c.stroke();
      break;
  }
  c.restore();
}

/**
 * bubbleRev 2 specials, each with its own look and none of the creature
 * symbols, all drawn inside the bubble circle (the collision bound):
 *  - Joker: a thick five-colour rainbow ring round a white pearl with a violet
 *    four-point sparkle (unlike the starfish's five points).
 *  - Mine: a black naval sea mine with round-tipped horns and a red light, on an
 *    amber warning bubble.
 *  - Torpedo: a silver torpedo side-on (red-banded nose, cross fins, propeller)
 *    with arrowheads at both ends of the bubble: it clears the whole row.
 */
function paintSpecial(value: number) {
  return (c: CanvasRenderingContext2D, size: number) => {
    const r = size / 2;
    c.save();
    c.beginPath();
    c.arc(r, r, r - 0.5, 0, Math.PI * 2);
    c.clip();
    if (value === BUB_JOKER) {
      // Rainbow ring: one band per colour, bright and even.
      BUB_PALETTE.forEach((colour, i) => {
        const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / BUB_PALETTE.length;
        c.fillStyle = colour;
        c.beginPath();
        c.moveTo(r, r);
        c.arc(r, r, r, a0 - 0.02, a0 + (2 * Math.PI) / BUB_PALETTE.length + 0.02);
        c.closePath();
        c.fill();
      });
      const pearl = c.createRadialGradient(r * 0.82, r * 0.78, r * 0.05, r, r, r * 0.62);
      pearl.addColorStop(0, "#FFFFFF");
      pearl.addColorStop(1, "#E7E2FA");
      c.fillStyle = pearl;
      c.beginPath();
      c.arc(r, r, r * 0.6, 0, Math.PI * 2);
      c.fill();
      // A four-point sparkle (not the starfish's five points) with two small glints: wild.
      const sparkle = (cx: number, cy: number, outer: number, inner: number) => {
        c.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 4;
          const d = i % 2 === 0 ? outer : inner;
          c.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
        }
        c.closePath();
      };
      c.fillStyle = "#5B3FD0";
      sparkle(r, r, r * 0.46, r * 0.12);
      c.fill();
      sparkle(r + r * 0.3, r - r * 0.3, r * 0.14, r * 0.04);
      c.fill();
      sparkle(r - r * 0.28, r + r * 0.3, r * 0.1, r * 0.03);
      c.fill();
    } else if (value === BUB_BOMB) {
      const warn = c.createRadialGradient(r * 0.75, r * 0.7, r * 0.1, r, r, r);
      warn.addColorStop(0, "#FFC46B");
      warn.addColorStop(1, "#E0662A");
      c.fillStyle = warn;
      c.fillRect(0, 0, size, size);
      // Horns with round tips, then the black body over their roots.
      c.strokeStyle = "#141519";
      c.fillStyle = "#141519";
      c.lineWidth = Math.max(1.5, r * 0.15);
      c.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 4;
        c.beginPath();
        c.moveTo(r + Math.cos(a) * r * 0.4, r + Math.sin(a) * r * 0.4);
        c.lineTo(r + Math.cos(a) * r * 0.72, r + Math.sin(a) * r * 0.72);
        c.stroke();
        c.beginPath();
        c.arc(r + Math.cos(a) * r * 0.76, r + Math.sin(a) * r * 0.76, r * 0.11, 0, Math.PI * 2);
        c.fill();
      }
      const body = c.createRadialGradient(r * 0.8, r * 0.78, r * 0.05, r, r, r * 0.55);
      body.addColorStop(0, "#4A4E58");
      body.addColorStop(1, "#141519");
      c.fillStyle = body;
      c.beginPath();
      c.arc(r, r, r * 0.52, 0, Math.PI * 2);
      c.fill();
      // Red light with a glint.
      c.fillStyle = "#FF2E2E";
      c.beginPath();
      c.arc(r, r, r * 0.17, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.85)";
      c.beginPath();
      c.arc(r - r * 0.06, r - r * 0.06, r * 0.06, 0, Math.PI * 2);
      c.fill();
    } else {
      const sea = c.createRadialGradient(r * 0.75, r * 0.7, r * 0.1, r, r, r);
      sea.addColorStop(0, "#2E7FA8");
      sea.addColorStop(1, "#0D3550");
      c.fillStyle = sea;
      c.fillRect(0, 0, size, size);
      // Arrowheads at both edges: it clears left and right.
      c.fillStyle = "#FFE14D";
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(r + side * r * 0.86, r);
        c.lineTo(r + side * r * 0.64, r - r * 0.26);
        c.lineTo(r + side * r * 0.64, r + r * 0.26);
        c.closePath();
        c.fill();
      }
      // Torpedo, nose left: tail fins, body, nose band, propeller.
      const top = r - r * 0.17, h = r * 0.34;
      const left = r - r * 0.56, right = r + r * 0.34;
      c.fillStyle = "#8E98A6";
      c.beginPath();
      c.moveTo(right - r * 0.06, top + h * 0.15);
      c.lineTo(right + r * 0.16, top - r * 0.14);
      c.lineTo(right + r * 0.16, top + h + r * 0.14);
      c.lineTo(right - r * 0.06, top + h * 0.85);
      c.closePath();
      c.fill();
      const metal = c.createLinearGradient(0, top, 0, top + h);
      metal.addColorStop(0, "#F2F5F8");
      metal.addColorStop(0.55, "#B8C1CC");
      metal.addColorStop(1, "#6E7884");
      c.fillStyle = metal;
      c.beginPath();
      c.moveTo(left + h / 2, top);
      c.lineTo(right, top);
      c.lineTo(right, top + h);
      c.lineTo(left + h / 2, top + h);
      c.arc(left + h / 2, r, h / 2, Math.PI / 2, Math.PI * 1.5);
      c.closePath();
      c.fill();
      c.fillStyle = "#E23B3B";
      c.fillRect(left + h * 0.62, top, r * 0.1, h);
      c.fillStyle = "#3C434D";
      c.fillRect(right, r - r * 0.06, r * 0.12, r * 0.12);
      c.fillRect(right + r * 0.1, r - r * 0.16, r * 0.05, r * 0.32);
    }
    c.restore();
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = Math.max(1, r * 0.1);
    c.beginPath();
    c.arc(r, r, r - c.lineWidth / 2 - 0.5, 0, Math.PI * 2);
    c.stroke();
    // Rim highlight, as on the colour bubbles.
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = Math.max(1, r * 0.1);
    c.lineCap = "round";
    c.beginPath();
    c.arc(r, r, r * 0.8, Math.PI * 1.12, Math.PI * 1.42);
    c.stroke();
  };
}

function paintBubble(value: number) {
  if (bubIsSpecial(value)) return paintSpecial(value);
  return (c: CanvasRenderingContext2D, size: number) => {
    const r = size / 2;
    const colour = bubColour(value);
    const g = c.createRadialGradient(r * 0.75, r * 0.7, r * 0.1, r, r, r);
    g.addColorStop(0, colour + "B0");
    g.addColorStop(0.8, colour + "D8");
    g.addColorStop(1, colour);
    c.fillStyle = g;
    c.beginPath();
    c.arc(r, r, r - 0.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.55)";
    c.lineWidth = Math.max(1, r * 0.08);
    c.beginPath();
    c.arc(r, r, r - c.lineWidth, 0, Math.PI * 2);
    c.stroke();
    drawCreature(c, bubCreature(value), r, r + r * 0.04, r);
    // Rim highlight.
    c.strokeStyle = "rgba(255,255,255,0.85)";
    c.lineWidth = Math.max(1, r * 0.12);
    c.lineCap = "round";
    c.beginPath();
    c.arc(r, r, r * 0.74, Math.PI * 1.1, Math.PI * 1.45);
    c.stroke();
  };
}

/** Blits a cached bubble sprite at CSS-px centre with CSS-px radius. */
function blitBubble(ctx: CanvasRenderingContext2D, value: number, x: number, y: number, radius: number, dpr: number, alpha = 1): void {
  const key = bubIsSpecial(value) ? `bub-special2-${value}` : `bub${value}${creatureArtReady() ? "-art" : ""}`;
  const sprite = seaSprite(key, radius * 2 * dpr, paintBubble(value));
  if (!sprite) return;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(sprite as CanvasImageSource, x - radius, y - radius, radius * 2, radius * 2);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

/** kind 0 pop, 1 drop; bubbleRev 2: 2 bomb blast, 3 torpedo row flash, 4 joker sparkle. */
interface Fx { kind: 0 | 1 | 2 | 3 | 4; value: number; x: number; y: number; born: number; seed: number }
interface Memo { tick: number; grid: number[]; descents: number; fx: Fx[]; specials: number; blast: Fx | null }
const memos = new WeakMap<object, Memo>();
const FX_CAP = 4;

function memoFor(ctx: CanvasRenderingContext2D, state: BubState): Memo {
  let m = memos.get(ctx);
  if (!m || state.tick < m.tick) {
    m = { tick: state.tick, grid: [...state.grid], descents: state.descents, fx: [], specials: specialCount(state), blast: null };
    memos.set(ctx, m);
  }
  return m;
}

function specialCount(state: BubState): number {
  return (state.jokers ?? 0) + (state.bombs ?? 0) + (state.lines ?? 0);
}

function trackRemovals(m: Memo, state: BubState, colour: number): void {
  if (state.tick === m.tick) return;
  const now = seaNow();
  // bubbleRev 2: a special went off since the last frame; what it cleared pops (no fall).
  const special = specialCount(state) > m.specials;
  if (special && (state.lastSpecialCell ?? -1) >= 0) {
    const cell = state.lastSpecialCell!;
    const row = Math.floor(cell / BUB_COLS);
    const kind = state.lastSpecial === BUB_BOMB ? 2 : state.lastSpecial === BUB_LINE ? 3 : 4;
    m.blast = { kind, value: state.lastSpecial ?? 0, x: bubCellX(row, cell % BUB_COLS), y: bubCellY(row, m.descents), born: now, seed: cell };
  }
  m.specials = specialCount(state);
  if (special) colour = -1;
  if (state.popped + state.dropped > 0 && state.grid !== m.grid) {
    for (let row = 0; row < BUB_MAX_ROWS; row++) {
      for (let col = 0; col < bubRowCols(row); col++) {
        const i = row * BUB_COLS + col;
        const was = m.grid[i]!;
        if (!was || state.grid[i]) continue;
        if (m.fx.length >= FX_CAP) m.fx.shift();
        m.fx.push({
          kind: was === colour || colour === -1 ? 0 : 1,
          value: was,
          x: bubCellX(row, col),
          y: bubCellY(row, m.descents),
          born: now,
          seed: i * 7919,
        });
      }
    }
  }
  m.tick = state.tick;
  m.grid = [...state.grid];
  m.descents = state.descents;
}

let lastFlight = 0;

/** The game's drawing through the shared success layer (presentation only). */
export function drawBubbleArt(ctx: CanvasRenderingContext2D, state: BubState, size: CanvasSize): void {
  arcadeFx(ctx, BUBBLE_FX, state, () => drawBubbleArtWorld(ctx, state, size), size);
}

function drawBubbleArtWorld(ctx: CanvasRenderingContext2D, state: BubState, size: CanvasSize): void {
  const sx = size.width / BUB_WORLD_W;
  const sy = size.height / BUB_WORLD_H;
  const rs = Math.min(sx, sy);
  const dpr = seaDeviceScale(ctx);
  const t = seaClock();
  const X = (x: number) => x * sx;
  const Y = (y: number) => y * sy;

  ctx.save();
  seaUnderwater(ctx, size.width, size.height);

  // Rising background bubbles (margins and open water, behind everything).
  if (!reducedMotion()) {
    ctx.fillStyle = "rgba(220,240,255,0.22)";
    for (let i = 0; i < 10; i++) {
      const speed = 18 + (i * 37) % 23;
      const yy = size.height - ((t * speed + i * 97) % (size.height + 20));
      const xx = ((i * 131) % 100) / 100 * size.width + Math.sin(t + i) * 4;
      ctx.beginPath();
      ctx.arc(xx, yy, 1.2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Kelp and coral in the side margins only.
  const margin = X(BUB_WALL);
  const floor = size.height;
  seaKelp(ctx, margin * 0.45, floor, size.height * 0.42, Math.max(2, margin * 0.16), 0);
  seaKelp(ctx, size.width - margin * 0.5, floor, size.height * 0.34, Math.max(2, margin * 0.16), 2.1);
  seaCoral(ctx, margin * 0.55, floor, margin * 0.8, "#E0705A");
  seaCoral(ctx, size.width - margin * 0.45, floor, margin * 0.7, "#E58FB4");

  // Rock ledge from the top down to the sim ceiling line.
  const ceiling = Y(BUB_TOP + state.descents * BUB_ROW_H);
  ctx.fillStyle = "#2A2F38";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size.width, 0);
  ctx.lineTo(size.width, ceiling);
  const bumps = 14;
  for (let i = bumps; i >= 0; i--) {
    const x = (i / bumps) * size.width;
    const dip = (((i * 53) % 7) / 7) * Y(5);
    ctx.lineTo(x, ceiling - dip);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3B424D";
  for (let i = 0; i < 9; i++) {
    const x = ((i * 0.13 + 0.05) % 1) * size.width;
    const y = (((i * 41) % 10) / 10) * Math.max(2, ceiling - Y(10)) + Y(4);
    ctx.beginPath();
    ctx.ellipse(x, y, X(14), Y(5), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shooter line, faint.
  ctx.strokeStyle = "rgba(245,197,66,0.28)";
  ctx.setLineDash([6 * rs, 6 * rs]);
  ctx.lineWidth = Math.max(1, 1.5 * rs);
  ctx.beginPath();
  ctx.moveTo(X(BUB_WALL), Y(BUB_SHOOTER_LINE));
  ctx.lineTo(X(BUB_WORLD_W - BUB_WALL), Y(BUB_SHOOTER_LINE));
  ctx.stroke();
  ctx.setLineDash([]);

  // Field.
  const radius = (BUB_R - 1) * rs;
  for (let row = 0; row < BUB_MAX_ROWS; row++) {
    for (let col = 0; col < bubRowCols(row); col++) {
      const value = state.grid[row * BUB_COLS + col]!;
      if (!value) continue;
      blitBubble(ctx, value, X(bubCellX(row, col)), Y(bubCellY(row, state.descents)), radius, dpr);
    }
  }

  // Pops and drops (presentation memory only).
  const m = memoFor(ctx, state);
  if (state.flightColour) lastFlight = state.flightColour;
  trackRemovals(m, state, lastFlight);
  const now = seaNow();
  const still = reducedMotion();
  m.fx = m.fx.filter((f) => now - f.born < (still ? 160 : 480));
  for (const f of m.fx) {
    const age = (now - f.born) / 1000;
    if (f.kind === 0) {
      const k = age / (still ? 0.16 : 0.48);
      // Symbol drifts up and fades; a stream of tiny bubbles.
      ctx.save();
      ctx.globalAlpha = 1 - k;
      drawCreature(ctx, 'fish', X(f.x), Y(f.y) - (still ? 0 : age * 60 * rs), radius * 0.3);
      ctx.fillStyle = "rgba(230,245,255,0.85)";
      if (!still) {
        for (let i = 0; i < 3; i++) {
          const a = ((f.seed + i * 1301) % 628) / 100;
          ctx.beginPath();
          ctx.arc(
            X(f.x) + Math.cos(a) * radius * (0.3 + k),
            Y(f.y) - age * (70 + i * 14) * rs,
            Math.max(0.8, (1.6 + (i % 2)) * rs),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      ctx.restore();
    } else {
      const k = age / (still ? 0.16 : 0.48);
      blitBubble(ctx, f.value, X(f.x), Y(f.y) + (still ? 0 : age * age * 520 * rs), radius, dpr, 1 - k);
    }
  }

  // bubbleRev 2: the special's blast — a ring for the Bomb, a flash along the row for the Torpedo, a sparkle for the Joker.
  if (m.blast) {
    const f = m.blast;
    const age = (now - f.born) / 1000;
    const life = still ? 0.2 : 0.55;
    if (age >= life) m.blast = null;
    else {
      const k = age / life;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      if (f.kind === 2) {
        ctx.strokeStyle = "#FFB347";
        ctx.lineWidth = Math.max(2, 5 * rs * (1 - k));
        ctx.beginPath();
        ctx.arc(X(f.x), Y(f.y), (BUB_R + (still ? 2 : k * 2.4) * BUB_ROW_H) * rs, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,240,200,0.5)";
        ctx.beginPath();
        ctx.arc(X(f.x), Y(f.y), BUB_R * rs * (1.2 - k * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (f.kind === 3) {
        ctx.fillStyle = "rgba(200,250,255,0.75)";
        const h = BUB_R * 2 * sy * (1 - k * 0.7);
        ctx.fillRect(X(BUB_WALL), Y(f.y) - h / 2, X(BUB_WORLD_W - 2 * BUB_WALL), h);
      } else {
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = Math.max(1.5, 2.5 * rs);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          const d = (BUB_R + (still ? 4 : k * 26)) * rs;
          ctx.strokeStyle = BUB_PALETTE[i] ?? "#FFFFFF";
          ctx.beginPath();
          ctx.moveTo(X(f.x) + Math.cos(a) * d * 0.6, Y(f.y) + Math.sin(a) * d * 0.6);
          ctx.lineTo(X(f.x) + Math.cos(a) * d, Y(f.y) + Math.sin(a) * d);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // Diver's bubble gun.
  const gx = X(BUB_SHOOTER_X);
  const gy = Y(BUB_SHOOTER_Y);
  ctx.fillStyle = SEA_BRASS_DARK;
  ctx.beginPath();
  ctx.roundRect(gx - 26 * rs, gy + 12 * sy, 52 * rs, 14 * sy, 5 * rs);
  ctx.fill();
  ctx.fillStyle = SEA_BRASS;
  ctx.beginPath();
  ctx.roundRect(gx - 22 * rs, gy + 14 * sy, 44 * rs, 9 * sy, 4 * rs);
  ctx.fill();
  ctx.strokeStyle = SEA_BRASS;
  ctx.lineWidth = Math.max(1.5, 3 * rs);
  ctx.beginPath();
  ctx.arc(gx, gy, (BUB_R + 2) * rs, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  const holding = bubNextColour(state, 0);
  if (holding) blitBubble(ctx, holding, gx, gy, radius, dpr);

  // Loaded queue: the next three in a brass magazine beside the gun.
  const qy = gy + 19 * sy;
  ctx.fillStyle = "rgba(10,30,52,0.7)";
  ctx.beginPath();
  ctx.roundRect(gx + 30 * rs, qy - 9 * rs, 68 * rs, 18 * rs, 9 * rs);
  ctx.fill();
  ctx.strokeStyle = SEA_BRASS;
  ctx.lineWidth = Math.max(1, 1.5 * rs);
  ctx.stroke();
  for (let ahead = 1; ahead <= 3; ahead++) {
    const value = bubNextColour(state, ahead);
    if (value) blitBubble(ctx, value, gx + (30 + ahead * 20 - 6) * rs, qy, 8 * rs, dpr);
  }

  if (state.flightColour) blitBubble(ctx, state.flightColour, X(state.x / 256), Y(state.y / 256), radius, dpr);

  // HUD readout on the rock.
  ctx.fillStyle = SEA_GOLD;
  ctx.font = `bold ${Math.round(18 * rs)}px ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  successHud(ctx,'bubble',state.tick,14,18,()=>{ctx.fillText(`Popped ${state.popped}`, X(14), Y(BUB_HUD_H * 0.36));});
  const pop=m.fx[m.fx.length-1];
  successFrame(ctx,{id:'bubble',tick:state.tick,count:state.popped,colour:SEA_GOLD,width:size.width,height:size.height,point:{x:X(pop?.x??BUB_SHOOTER_X),y:Y(pop?.y??BUB_TOP),shape:'fish'},hud:{x:X(14),y:Y(8),text:`Popped ${state.popped}`}});
  successFrame(ctx,{id:'bubble-drop',tick:state.tick,count:Math.floor(state.dropped/5),colour:SEA_TEXT,width:size.width,height:size.height,point:{x:X(pop?.x??BUB_SHOOTER_X),y:Y(pop?.y??BUB_TOP),shape:'bubble'}});
  ctx.fillStyle = SEA_TEXT;
  ctx.restore();
}

/** Faint dotted bubble trail for the current aim; same path maths the stage used. */
export function drawBubbleAimTrail(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  shot: { vx: number; vy: number } | null,
  state: BubState,
): void {
  if (!shot || state.flightColour !== 0) return;
  const sx = size.width / BUB_WORLD_W;
  const sy = size.height / BUB_WORLD_H;
  const rs = Math.min(sx, sy);
  const left = BUB_WALL + BUB_R;
  const right = BUB_WORLD_W - BUB_WALL - BUB_R;
  let x = BUB_SHOOTER_X;
  let y = BUB_SHOOTER_Y;
  let vx = shot.vx / 64;
  const vy = shot.vy / 64;
  let travelled = 0;
  let next = 10;
  ctx.save();
  ctx.fillStyle = "rgba(225,242,255,0.5)";
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = Math.max(0.8, rs);
  const stepLen = Math.hypot(vx, vy);
  for (let i = 0; i < 160 && y > 0; i++) {
    x += vx;
    y += vy;
    if (x < left) {
      x = left + (left - x);
      vx = -vx;
    } else if (x > right) {
      x = right - (x - right);
      vx = -vx;
    }
    travelled += stepLen;
    if (travelled >= next) {
      next += 11;
      const r = Math.max(1.2, (2.6 - i * 0.004) * rs);
      ctx.beginPath();
      ctx.arc(x * sx, y * sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export const bubbleArtGame = { ...bubbleGame, draw: drawBubbleArt };
