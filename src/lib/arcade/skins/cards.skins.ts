/**
 * The card games' looks (wave 2, E1): the account's card back (docs/art/wave-2/items/card-back/*.html; one `card-back`
 * slot, drawn on Full House's face-down deck: Joe, 11 Nov 2026) and Full House's table felts
 * (items/game-skin/full-house--*.html). Display only: a back is painted in the default back's exact card box, a felt
 * in the default felt's exact rectangle; card faces, slots, chips and every position are unchanged.
 */
import type { ContrastPair, GameLook } from "./look";

export type CardBack = "royal-damask" | "holo-foil" | "neon";
export type Felt = "midnight" | "crimson" | "neon";

const BACKS: Readonly<Record<string, CardBack>> = {
  "card-back.royal-damask": "royal-damask",
  "card-back.holo-foil": "holo-foil",
  "card-back.neon": "neon",
};
const FELTS: Readonly<Record<string, Felt>> = {
  "game-skin.full-house.midnight-felt": "midnight",
  "game-skin.full-house.crimson-velvet": "crimson",
  "game-skin.full-house.neon-felt": "neon",
};

export const cardBackOf = (look: GameLook): CardBack | null => (look.back && BACKS[look.back]) || null;
export const feltOf = (look: GameLook): Felt | null => (look.skin && FELTS[look.skin]) || null;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function goldGradient(ctx: CanvasRenderingContext2D, w: number, h: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, 0.4 * w, h);
  g.addColorStop(0, "#FFF3C4");
  g.addColorStop(0.35, "#F2C14E");
  g.addColorStop(0.7, "#C8902A");
  g.addColorStop(1, "#FFE08A");
  return g;
}

function bolt(ctx: CanvasRenderingContext2D, pts: readonly number[]): void {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, pts[i]!, pts[i + 1]!);
  ctx.closePath();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // The source's 4-point star (5 × 5 units, the arms 1.5 in).
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x + 1.5, y - 1.5);
  ctx.lineTo(x + 5, y);
  ctx.lineTo(x + 1.5, y + 1.5);
  ctx.lineTo(x, y + 5);
  ctx.lineTo(x - 1.5, y + 1.5);
  ctx.lineTo(x - 5, y);
  ctx.lineTo(x - 1.5, y - 1.5);
  ctx.closePath();
  ctx.fill();
}

/** A card back in its skin, painted in the source's 84 × 118 frame stretched to the card's w × h. */
export function paintSkinBack(ctx: CanvasRenderingContext2D, back: CardBack, w: number, h: number): void {
  const r = Math.max(3, w * 0.09);
  ctx.save();
  rr(ctx, 0, 0, w, h, r);
  ctx.clip();
  ctx.scale(w / 84, h / 118);
  if (back === "royal-damask") {
    ctx.fillStyle = "#0E1A3A";
    ctx.fillRect(0, 0, 84, 118);
    const gold = goldGradient(ctx, 84, 118);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 0.9;
    ctx.globalAlpha = 0.7;
    for (let x = -12; x <= 86; x += 14)
      for (let y = -18; y <= 122; y += 14) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 6, y + 6);
        ctx.lineTo(x, y + 12);
        ctx.lineTo(x - 6, y + 6);
        ctx.closePath();
        ctx.stroke();
      }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    rr(ctx, 5, 5, 74, 108, 5);
    ctx.stroke();
    ctx.fillStyle = "#0E1A3A";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(42, 59, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = gold;
    bolt(ctx, [45, 49, 37, 61, 42, 61, 39, 70, 48, 57, 43, 57]);
    ctx.fill();
  } else if (back === "holo-foil") {
    const g = ctx.createLinearGradient(0, 0, 84, 118);
    g.addColorStop(0, "#9FE8FF");
    g.addColorStop(0.25, "#C79BFF");
    g.addColorStop(0.5, "#FF8FD6");
    g.addColorStop(0.75, "#FFE08A");
    g.addColorStop(1, "#7FFFD0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 84, 118);
    ctx.save();
    ctx.translate(42, 59);
    ctx.rotate((25 * Math.PI) / 180);
    ctx.translate(-42, -59);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    for (let x = -56; x <= 126; x += 14) ctx.fillRect(x, -20, 5, 170);
    ctx.restore();
    ctx.fillStyle = "#FFFFFF";
    for (const [x, y] of [[18, 22], [62, 30], [30, 84], [66, 96], [42, 58]] as const) sparkle(ctx, x, y);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.5;
    rr(ctx, 5, 5, 74, 108, 5);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#0A0820";
    ctx.fillRect(0, 0, 84, 118);
    ctx.strokeStyle = "#FF3DCB";
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.8;
    for (const y of [30, 59, 88]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(24, y);
      ctx.lineTo(32, y - 8);
      ctx.lineTo(52, y - 8);
      ctx.lineTo(60, y);
      ctx.lineTo(84, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = "#22E4FF";
    ctx.shadowBlur = 4;
    ctx.strokeStyle = "#22E4FF";
    ctx.lineWidth = 2.5;
    rr(ctx, 4, 4, 76, 110, 6);
    ctx.stroke();
    ctx.fillStyle = "#22E4FF";
    bolt(ctx, [46, 46, 36, 62, 43, 62, 40, 74, 51, 58, 44, 58]);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = "#06080F";
  ctx.lineWidth = Math.max(1, w / 42);
  rr(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.stroke();
}

/** Each felt's colours: the rail round the table, the felt's centre and edge (the source's radial gradient), a neon edge. */
export const FELT_COLOURS: Readonly<Record<Felt, { rail: string; centre: string; edge: string; neon: string | null }>> = {
  midnight: { rail: "#3A2A18", centre: "#1A4A8A", edge: "#081A3A", neon: null },
  crimson: { rail: "#2A1A10", centre: "#A01830", edge: "#3A0612", neon: null },
  neon: { rail: "#0A0820", centre: "#14563C", edge: "#062014", neon: "#22E4FF" },
};

/** A felt in its skin over the table's w × h: the rail, the felt's lit gradient, its nap, a neon edge for Neon felt. */
export function paintSkinFelt(c: CanvasRenderingContext2D, felt: Felt, w: number, h: number): void {
  const k = FELT_COLOURS[felt];
  c.fillStyle = k.rail;
  c.fillRect(0, 0, w, h);
  const inset = 5;
  const g = c.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.75);
  g.addColorStop(0, k.centre);
  g.addColorStop(1, k.edge);
  c.fillStyle = g;
  rr(c, inset, inset, w - inset * 2, h - inset * 2, 14);
  c.fill();
  // The nap: fine specks (the source's white at 0.08), fixed.
  c.fillStyle = "rgba(255,255,255,0.08)";
  let n = 0x9e37;
  for (let i = 0; i < (w * h) / 90; i++) {
    n = (Math.imul(n, 1103515245) + 12345) >>> 0;
    const x = inset + ((n >>> 8) % 10000) / 10000 * (w - inset * 2);
    n = (Math.imul(n, 1103515245) + 12345) >>> 0;
    const y = inset + ((n >>> 8) % 10000) / 10000 * (h - inset * 2);
    c.fillRect(x, y, 1, 1);
  }
  if (k.neon) {
    c.save();
    c.shadowColor = k.neon;
    c.shadowBlur = 6;
    c.strokeStyle = k.neon;
    c.lineWidth = 2;
    rr(c, inset, inset, w - inset * 2, h - inset * 2, 14);
    c.stroke();
    c.restore();
  }
}

/** The screen fill round a skinned felt: its edge colour running on (cardsFill's gradients, in the felt's colours). */
export function feltFillStops(felt: Felt): { above: [number, string][]; side: [number, string][]; below: [number, string][] } {
  const k = FELT_COLOURS[felt];
  return {
    above: [[0, k.rail], [1, k.rail]],
    side: [[0, k.rail], [0.5, k.rail], [1, k.rail]],
    below: [[0, k.rail], [1, "#05040A"]],
  };
}

/** What each Full House look must keep visible: a card face and the deck's back on the felt. */
export function cardsContrast(look: GameLook): ContrastPair[] {
  const felt = feltOf(look);
  const backgrounds = felt ? [FELT_COLOURS[felt].centre, FELT_COLOURS[felt].edge] : ["#0E2A57"];
  const back = cardBackOf(look);
  const backColours = back === "royal-damask" ? ["#F2C14E", "#0E1A3A"] : back === "holo-foil" ? ["#FF8FD6", "#9FE8FF", "#FFFFFF"] : back === "neon" ? ["#22E4FF", "#0A0820"] : ["#E9C46A", "#1D3270"];
  return [
    { object: "card face", colours: ["#FFFFFF", "#F6F1E6"], backgrounds },
    { object: "deck's card back", colours: backColours, backgrounds },
  ];
}
