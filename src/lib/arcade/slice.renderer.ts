/**
 * Slice art: a ship's gun deck in the High Seas world. Render only.
 * Uses the sim's own stretched world transform; every store, keg and special
 * is drawn inside the sim radius (SLICE_R / SLICE_SPECIAL_R) at the sim's
 * position. Ports, sea, lanterns and planks are background only.
 */
import type { CanvasSize } from "./engine";
import {
  sliceFrenzyOn,
  sliceGame,
  sliceMultiplier,
  sliceObjectAt,
  sliceSlowOn,
  sliceSuppressed,
  SLICE_COMBO_FLASH_TICKS,
  SLICE_FLASH_TICKS,
  SLICE_HALVES_TICKS,
  SLICE_HUD_H,
  SLICE_R,
  SLICE_SPECIAL_FRENZY,
  SLICE_SPECIAL_NONE,
  SLICE_SPECIAL_R,
  SLICE_SPECIAL_SLOW,
  SLICE_WORLD_H,
  SLICE_WORLD_W,
  type SliceState,
} from "./slice";
import { TICKS_PER_SECOND as TICKS_PER_SECOND_SLICE } from "./engine";
import {
  seaClock,
  seaDeviceScale,
  seaNow,
  seaSprite,
  SEA_BRASS,
  SEA_BRASS_DARK,
  SEA_DEEP,
  SEA_GOLD,
  SEA_MID,
  SEA_SKY_LOW,
  SEA_SKY_TOP,
  SEA_TEXT,
  SEA_WOOD,
  SEA_WOOD_DARK,
  SEA_WOOD_LIGHT,
} from "./seas.renderer";
import { reducedMotion } from "./art.renderer";

/** Sim colour index → store. The sim has four colours. */
export const SLICE_STORES = ["barrel", "crate", "cannonball", "rope"] as const;
type Store = (typeof SLICE_STORES)[number] | "sack";
const STORE_COLOURS: Record<Store, string> = {
  barrel: "#B5653A",
  crate: "#D9A64E",
  cannonball: "#4A5562",
  rope: "#C8B07A",
  sack: SEA_GOLD,
};

function storeOf(colour: number): Store {
  return SLICE_STORES[colour % SLICE_STORES.length] ?? "sack";
}

/** Painters work in a unit box of `size` px; content stays inside the inscribed circle. */
function paintStore(kind: Store) {
  return (c: CanvasRenderingContext2D, size: number) => {
    const r = size / 2;
    c.translate(r, r);
    const col = STORE_COLOURS[kind];
    c.lineWidth = Math.max(1, r * 0.08);
    c.strokeStyle = "#20140A";
    switch (kind) {
      case "barrel": {
        c.fillStyle = col;
        c.beginPath();
        c.ellipse(0, 0, r * 0.7, r * 0.94, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = "rgba(0,0,0,0.18)";
        for (const dx of [-0.35, 0, 0.35]) c.fillRect(dx * r - r * 0.03, -r * 0.85, r * 0.06, r * 1.7);
        c.fillStyle = "#3A3A3A";
        for (const dy of [-0.55, 0.55]) c.fillRect(-r * 0.66, dy * r - r * 0.07, r * 1.32, r * 0.14);
        break;
      }
      case "crate": {
        const h = r * 0.68;
        c.fillStyle = col;
        c.fillRect(-h, -h, h * 2, h * 2);
        c.strokeRect(-h, -h, h * 2, h * 2);
        c.strokeStyle = "#7A5129";
        c.lineWidth = r * 0.14;
        c.beginPath();
        c.moveTo(-h, -h);
        c.lineTo(h, h);
        c.moveTo(-h, -h + r * 0.1);
        c.lineTo(h, -h + r * 0.1);
        c.moveTo(-h, h - r * 0.1);
        c.lineTo(h, h - r * 0.1);
        c.stroke();
        break;
      }
      case "cannonball": {
        c.fillStyle = col;
        c.beginPath();
        c.arc(0, 0, r * 0.92, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = "rgba(255,255,255,0.28)";
        c.beginPath();
        c.arc(-r * 0.32, -r * 0.32, r * 0.24, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case "rope": {
        c.strokeStyle = "#5C4326";
        c.lineWidth = r * 0.22;
        c.beginPath();
        c.arc(0, 0, r * 0.8, 0, Math.PI * 2);
        c.stroke();
        c.strokeStyle = col;
        c.lineWidth = r * 0.16;
        for (const rr of [0.8, 0.52, 0.26]) {
          c.beginPath();
          c.arc(0, 0, r * rr, 0, Math.PI * 2);
          c.stroke();
        }
        c.strokeStyle = "rgba(60,40,20,0.6)";
        c.lineWidth = r * 0.05;
        c.setLineDash([r * 0.12, r * 0.12]);
        for (const rr of [0.8, 0.52]) {
          c.beginPath();
          c.arc(0, 0, r * rr, 0, Math.PI * 2);
          c.stroke();
        }
        break;
      }
      case "sack": {
        c.fillStyle = col;
        c.beginPath();
        c.ellipse(0, r * 0.18, r * 0.78, r * 0.7, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = "#8C5A1E";
        c.fillRect(-r * 0.3, -r * 0.62, r * 0.6, r * 0.16);
        break;
      }
    }
  };
}

function paintKeg(c: CanvasRenderingContext2D, size: number): void {
  const r = size / 2;
  c.translate(r, r);
  c.fillStyle = "#2B1D12";
  c.beginPath();
  c.ellipse(0, r * 0.08, r * 0.7, r * 0.86, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#E0503C";
  c.lineWidth = r * 0.1;
  c.stroke();
  c.fillStyle = "#555";
  for (const dy of [-0.45, 0.6]) c.fillRect(-r * 0.66, dy * r - r * 0.06, r * 1.32, r * 0.12);
  c.fillStyle = "#E0503C";
  c.font = `bold ${Math.round(r * 0.55)}px ui-monospace, monospace`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("XXX", 0, r * 0.1);
}

function paintDoubloon(c: CanvasRenderingContext2D, size: number): void {
  const r = size / 2;
  c.translate(r, r);
  const g = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
  g.addColorStop(0, "rgba(255,230,140,0.9)");
  g.addColorStop(1, "rgba(255,200,60,0)");
  c.fillStyle = g;
  c.fillRect(-r, -r, size, size);
  c.fillStyle = SEA_BRASS_DARK;
  c.beginPath();
  c.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = SEA_GOLD;
  c.beginPath();
  c.arc(0, 0, r * 0.68, 0, Math.PI * 2);
  c.fill();
  // Cross of the doubloon.
  c.fillStyle = SEA_BRASS_DARK;
  c.fillRect(-r * 0.08, -r * 0.45, r * 0.16, r * 0.9);
  c.fillRect(-r * 0.45, -r * 0.08, r * 0.9, r * 0.16);
}

function paintHourglass(c: CanvasRenderingContext2D, size: number): void {
  const r = size / 2;
  c.translate(r, r);
  c.fillStyle = SEA_WOOD_DARK;
  c.fillRect(-r * 0.6, -r * 0.8, r * 1.2, r * 0.16);
  c.fillRect(-r * 0.6, r * 0.64, r * 1.2, r * 0.16);
  c.fillRect(-r * 0.56, -r * 0.7, r * 0.1, r * 1.4);
  c.fillRect(r * 0.46, -r * 0.7, r * 0.1, r * 1.4);
  c.fillStyle = "rgba(200,230,245,0.75)";
  c.beginPath();
  c.moveTo(-r * 0.4, -r * 0.64);
  c.lineTo(r * 0.4, -r * 0.64);
  c.lineTo(r * 0.06, 0);
  c.lineTo(r * 0.4, r * 0.64);
  c.lineTo(-r * 0.4, r * 0.64);
  c.lineTo(-r * 0.06, 0);
  c.closePath();
  c.fill();
  c.fillStyle = "#E8C77A";
  c.beginPath();
  c.moveTo(-r * 0.25, -r * 0.3);
  c.lineTo(r * 0.25, -r * 0.3);
  c.lineTo(0, -r * 0.04);
  c.closePath();
  c.moveTo(-r * 0.36, r * 0.62);
  c.lineTo(r * 0.36, r * 0.62);
  c.lineTo(0, r * 0.3);
  c.closePath();
  c.fill();
}

type Sprite = ReturnType<typeof seaSprite>;
function spriteFor(object: { bomb: boolean; special: number; colour: number }, px: number): { s: Sprite; r: number } {
  if (object.special === SLICE_SPECIAL_FRENZY) return { s: seaSprite("sl-doubloon", px * (SLICE_SPECIAL_R / SLICE_R), paintDoubloon), r: SLICE_SPECIAL_R };
  if (object.special === SLICE_SPECIAL_SLOW) return { s: seaSprite("sl-hourglass", px * (SLICE_SPECIAL_R / SLICE_R), paintHourglass), r: SLICE_SPECIAL_R };
  if (object.bomb) return { s: seaSprite("sl-keg", px, paintKeg), r: SLICE_R };
  const kind = storeOf(object.colour);
  return { s: seaSprite(`sl-${kind}`, px, paintStore(kind)), r: SLICE_R };
}

interface Memo { tick: number; trail: { seg: readonly [number, number, number, number]; at: number }[] }
const memos = new WeakMap<object, Memo>();

function background(ctx: CanvasRenderingContext2D): void {
  const W = SLICE_WORLD_W;
  const H = SLICE_WORLD_H;
  const t = seaClock();
  // Deck planks as the arena floor.
  ctx.fillStyle = SEA_WOOD_DARK;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 13; i++) {
    const x = i * 30;
    ctx.fillStyle = i % 2 ? "#5A3D22" : "#634427";
    ctx.fillRect(x, 0, 29, H);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (let y = (i * 97) % 140; y < H; y += 140) ctx.fillRect(x, y, 29, 1.5);
  }
  ctx.fillStyle = "rgba(10,12,20,0.35)";
  ctx.fillRect(0, 0, W, H);

  // Cannon ports along the bottom margin: sea and a distant enemy ship.
  const portY = H - 46;
  for (let i = 0; i < 4; i++) {
    const px = 22 + i * 92;
    ctx.fillStyle = SEA_WOOD_LIGHT;
    ctx.fillRect(px - 3, portY - 3, 62, 42);
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, portY, 56, 36);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, portY, 0, portY + 36);
    sky.addColorStop(0, SEA_SKY_TOP);
    sky.addColorStop(0.5, SEA_SKY_LOW);
    sky.addColorStop(0.5, SEA_MID);
    sky.addColorStop(1, SEA_DEEP);
    ctx.fillStyle = sky;
    ctx.fillRect(px, portY, 56, 36);
    if (i === 2) {
      const sx = px + 28 + Math.sin(t * 0.2) * 6;
      ctx.fillStyle = "rgba(30,24,20,0.7)";
      ctx.fillRect(sx - 10, portY + 15, 20, 3);
      ctx.fillRect(sx - 1, portY + 5, 1.5, 10);
      ctx.beginPath();
      ctx.moveTo(sx, portY + 6);
      ctx.lineTo(sx + 6, portY + 13);
      ctx.lineTo(sx, portY + 13);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(207,232,245,0.35)";
    const off = (t * 10) % 14;
    for (let x = px - 14 + off; x < px + 56; x += 14) ctx.fillRect(x, portY + 22, 6, 1);
    ctx.restore();
  }

  // Lanterns swinging in the side margins.
  for (const [lx, phase] of [[14, 0], [W - 14, 1.6]] as const) {
    const a = Math.sin(t * 1.3 + phase) * 0.18;
    const ly = SLICE_HUD_H;
    const ex = lx + Math.sin(a) * 34;
    const ey = ly + Math.cos(a) * 34;
    ctx.strokeStyle = "#2A1A0C";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const glow = ctx.createRadialGradient(ex, ey + 6, 1, ex, ey + 6, 40);
    glow.addColorStop(0, "rgba(255,200,110,0.35)");
    glow.addColorStop(1, "rgba(255,200,110,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(ex - 40, ey - 34, 80, 80);
    ctx.fillStyle = SEA_BRASS;
    ctx.fillRect(ex - 5, ey, 10, 3);
    ctx.fillStyle = "#FFD27A";
    ctx.fillRect(ex - 4, ey + 3, 8, 9);
    ctx.fillStyle = SEA_BRASS;
    ctx.fillRect(ex - 5, ey + 12, 10, 2);
  }
}

export function drawSliceArt(ctx: CanvasRenderingContext2D, state: SliceState, size: CanvasSize): void {
  const scaleX = size.width / SLICE_WORLD_W;
  const scaleY = size.height / SLICE_WORLD_H;
  const px = SLICE_R * 2 * Math.max(scaleX, scaleY) * seaDeviceScale(ctx);
  const now = seaNow();
  const still = reducedMotion();

  let m = memos.get(ctx);
  if (!m || state.tick < m.tick) {
    m = { tick: state.tick, trail: [] };
    memos.set(ctx, m);
  }
  if (state.swipe && state.tick !== m.tick) {
    const last = m.trail[m.trail.length - 1];
    if (!last || last.seg !== state.swipe) m.trail.push({ seg: state.swipe, at: now });
  }
  m.tick = state.tick;
  m.trail = m.trail.filter((e) => now - e.at < 160).slice(-10);

  ctx.save();
  ctx.fillStyle = SEA_DEEP;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.scale(scaleX, scaleY);
  background(ctx);

  for (let index = 0; index < state.objects.length; index++) {
    const object = state.objects[index]!;
    if (sliceSuppressed(state, object)) continue;
    const slicedAt = state.slicedAt[index]!;
    const { s, r } = spriteFor(object, px);
    if (slicedAt) {
      const age = state.tick - slicedAt;
      if (age > SLICE_HALVES_TICKS) continue;
      const at = sliceObjectAt(object, slicedAt, state.slowFrom);
      if (!at || !s) continue;
      const cx = at.x / 256;
      const cy = at.y / 256 + (age * age) / 20;
      const spread = 3 + age;
      const k = age / SLICE_HALVES_TICKS;
      ctx.globalAlpha = Math.max(0, 1 - k);
      const sw = (s as { width: number }).width;
      const sh = (s as { height: number }).height;
      ctx.drawImage(s as CanvasImageSource, 0, 0, sw / 2, sh, cx - spread - r, cy - r, r, r * 2);
      ctx.drawImage(s as CanvasImageSource, sw / 2, 0, sw / 2, sh, cx + spread, cy - r, r, r * 2);
      // Barrel spray / crate planks; deterministic from age.
      if (!object.bomb && object.special === SLICE_SPECIAL_NONE && !still) {
        const kind = storeOf(object.colour);
        const by = at.y / 256;
        if (kind === "barrel") {
          ctx.fillStyle = "rgba(200,120,60,0.85)";
          for (let i = 0; i < 8; i++) {
            const a = -Math.PI * (0.15 + (i / 7) * 0.7);
            const d = age * (2 + (i % 3));
            ctx.fillRect(cx + Math.cos(a) * d, by + Math.sin(a) * d + (age * age) / 30, 2.5, 2.5);
          }
        } else if (kind === "crate") {
          ctx.fillStyle = "#B88A44";
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.4;
            const d = age * 1.8;
            ctx.save();
            ctx.translate(cx + Math.cos(a) * d, by + Math.sin(a) * d + (age * age) / 18);
            ctx.rotate(a + age * 0.2);
            ctx.fillRect(-7, -1.5, 14, 3);
            ctx.restore();
          }
        }
      }
      ctx.globalAlpha = 1;
      continue;
    }
    const at = sliceObjectAt(object, state.tick, state.slowFrom);
    if (!at || !s) continue;
    const cx = at.x / 256;
    const cy = at.y / 256;
    if (cy - SLICE_R > SLICE_WORLD_H) continue;
    ctx.drawImage(s as CanvasImageSource, cx - r, cy - r, r * 2, r * 2);
    if (object.bomb) {
      // Sparking fuse rising from the keg's top, inside the radius.
      const flick = still ? 0 : Math.sin(now / 40 + index) * 1.5;
      ctx.strokeStyle = "#C8B07A";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.72);
      ctx.quadraticCurveTo(cx + 4, cy - r * 0.85, cx + 3, cy - r * 0.94);
      ctx.stroke();
      ctx.fillStyle = "#FFD27A";
      ctx.beginPath();
      ctx.arc(cx + 3 + flick * 0.4, cy - r * 0.94, 2 + Math.abs(flick) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Cutlass arc: steel, brass at ×2, gold at ×3.
  const mult = sliceMultiplier(state.streak);
  const blade = mult >= 3 ? "245,197,66" : mult === 2 ? "201,160,74" : "220,228,236";
  ctx.lineCap = "round";
  for (const e of m.trail) {
    const k = 1 - (now - e.at) / 160;
    const [x1, y1, x2, y2] = e.seg;
    ctx.strokeStyle = `rgba(${blade},${0.5 * k})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  if (state.swipe) {
    const [x1, y1, x2, y2] = state.swipe;
    ctx.strokeStyle = `rgba(${blade},0.95)`;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(224,80,60,${(state.flash / SLICE_FLASH_TICKS) * 0.45})`;
    ctx.fillRect(0, 0, SLICE_WORLD_W, SLICE_WORLD_H);
  }

  // Brass gauge for the combo multiplier.
  const gx = 38;
  const gy = SLICE_HUD_H + 34;
  ctx.fillStyle = SEA_BRASS_DARK;
  ctx.beginPath();
  ctx.arc(gx, gy, 24, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1A140C";
  ctx.beginPath();
  ctx.arc(gx, gy, 20, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = SEA_BRASS;
  ctx.lineWidth = 3;
  for (let i = 1; i <= 3; i++) {
    const a = Math.PI + ((i - 1) / 2) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(gx + Math.cos(a) * 15, gy + Math.sin(a) * 15);
    ctx.lineTo(gx + Math.cos(a) * 19, gy + Math.sin(a) * 19);
    ctx.stroke();
  }
  const na = Math.PI + ((mult - 1) / 2) * Math.PI;
  ctx.strokeStyle = mult >= 3 ? SEA_GOLD : SEA_TEXT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(gx + Math.cos(na) * 17, gy + Math.sin(na) * 17);
  ctx.stroke();
  ctx.fillStyle = SEA_GOLD;
  ctx.font = "bold 13px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`×${mult}`, gx, gy + 3);
  if (state.comboLive) {
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText(`${Math.ceil(Math.max(0, state.comboUntil - state.tick) / TICKS_PER_SECOND_SLICE)}s`, gx, gy + 18);
  }

  // HUD beam.
  ctx.fillStyle = SEA_WOOD_DARK;
  ctx.fillRect(0, 0, SLICE_WORLD_W, SLICE_HUD_H);
  ctx.fillStyle = SEA_WOOD;
  ctx.fillRect(0, SLICE_HUD_H - 4, SLICE_WORLD_W, 4);
  ctx.fillStyle = SEA_GOLD;
  ctx.font = "bold 20px ui-monospace, monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(`Sliced ${state.slices}`, 14, SLICE_HUD_H / 2);
  ctx.textAlign = "center";
  if (sliceFrenzyOn(state, state.tick)) ctx.fillText("FRENZY", SLICE_WORLD_W / 2, SLICE_HUD_H / 2);
  else if (sliceSlowOn(state, state.tick)) {
    ctx.fillStyle = SEA_TEXT;
    ctx.fillText("SLOW", SLICE_WORLD_W / 2, SLICE_HUD_H / 2);
  }
  ctx.strokeStyle = SEA_WOOD_DARK;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, SLICE_WORLD_W - 2, SLICE_WORLD_H - 2);
  if (state.comboFlash > 0) {
    ctx.strokeStyle = SEA_GOLD;
    ctx.globalAlpha = state.comboFlash / SLICE_COMBO_FLASH_TICKS;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, SLICE_WORLD_W - 6, SLICE_WORLD_H - 6);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export const sliceArtGame = { ...sliceGame, draw: drawSliceArt };
