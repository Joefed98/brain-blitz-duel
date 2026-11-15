/**
 * The card games' looks (wave 2, E1): the account's card back (docs/art/wave-2/items/card-back/*.html; one `card-back`
 * slot, drawn on Full House's face-down deck: Joe, 11 Nov 2026) and Full House's table felts
 * (items/game-skin/full-house--*.html). Display only: a back is painted in the default back's exact card box, a felt
 * in the default felt's exact rectangle; card faces, slots, chips and every position are unchanged.
 */
import type { ContrastPair, GameLook } from "./look";
import { skinRedrawn } from "./redrawPreview";

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
  if (backRedrawn(back)) {
    paintSkinBackV2(ctx, back, w, h);
    return;
  }
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
  if (feltRedrawn(felt)) {
    paintSkinFeltV2(c, felt, w, h);
    return;
  }
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
  const backColours = back && backRedrawn(back) ? BACK_COLOURS_V2[back] : back === "royal-damask" ? ["#F2C14E", "#0E1A3A"] : back === "holo-foil" ? ["#FF8FD6", "#9FE8FF", "#FFFFFF"] : back === "neon" ? ["#22E4FF", "#0A0820"] : ["#E9C46A", "#1D3270"];
  return [
    { object: "card face", colours: ["#FFFFFF", "#F6F1E6"], backgrounds },
    { object: "deck's card back", colours: backColours, backgrounds },
  ];
}

/* ============================== The redraws (phase 2 step 4) ============================== */

/** Whether a back or felt draws its redraw (its item's switch, docs/design/cosmetics-redraws/). */
const backRedrawn = (back: CardBack): boolean => skinRedrawn(`card-back.${back}`);
const FELT_ITEMS: Readonly<Record<Felt, string>> = {
  midnight: "game-skin.full-house.midnight-felt",
  crimson: "game-skin.full-house.crimson-velvet",
  neon: "game-skin.full-house.neon-felt",
};
const feltRedrawn = (felt: Felt): boolean => skinRedrawn(FELT_ITEMS[felt]);

/** A metal band lit from the top left (the art kit's light): the ramp's stops across the card's diagonal. */
function metal(ctx: CanvasRenderingContext2D, stops: readonly string[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, 84, 118);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
const GOLD_METAL = ["#FFF6D6", "#EDB43E", "#9A6418", "#E8C066", "#7A4E10"];
const SILVER_METAL = ["#FFFFFF", "#C9D3EA", "#6B7895", "#E6ECF8", "#55617D"];

/** An eight-point star (the Holo Foil's emblem), centre (x, y), outer radius r. */
function star8(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/** The redrawn backs, in the same 84 × 118 frame stretched to w × h, with the same outline after. */
function paintSkinBackV2(ctx: CanvasRenderingContext2D, back: CardBack, w: number, h: number): void {
  const r = Math.max(3, w * 0.09);
  ctx.save();
  rr(ctx, 0, 0, w, h, r);
  ctx.clip();
  ctx.scale(w / 84, h / 118);
  const BOLT = [45.5, 46, 35.5, 62, 42.5, 62, 39.5, 74, 50.5, 57, 43.5, 57];
  if (back === "royal-damask") {
    const bg = ctx.createRadialGradient(28, 30, 4, 42, 59, 80);
    bg.addColorStop(0, "#1E3470");
    bg.addColorStop(1, "#08102A");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 84, 118);
    // The damask: a quatrefoil and a diamond on a half-drop repeat, in gold ink.
    ctx.strokeStyle = metal(ctx, GOLD_METAL);
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 0.7;
    for (let row = -1; row < 10; row++)
      for (let col = -1; col < 7; col++) {
        const cx = col * 14 + (row % 2 ? 7 : 0);
        const cy = row * 13;
        ctx.beginPath();
        for (const [dx, dy] of [[0, -3], [3, 0], [0, 3], [-3, 0]] as const) {
          ctx.moveTo(cx + dx + 2.4, cy + dy);
          ctx.arc(cx + dx, cy + dy, 2.4, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 7, cy + 3.5);
        ctx.lineTo(cx + 8.6, cy + 6.5);
        ctx.lineTo(cx + 7, cy + 9.5);
        ctx.lineTo(cx + 5.4, cy + 6.5);
        ctx.closePath();
        ctx.stroke();
      }
    ctx.globalAlpha = 1;
    // The gold frame: a lit band and a fine inner line, corner studs.
    ctx.strokeStyle = metal(ctx, GOLD_METAL);
    ctx.lineWidth = 3.2;
    rr(ctx, 4.5, 4.5, 75, 109, 6);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    rr(ctx, 9, 9, 66, 100, 3);
    ctx.stroke();
    for (const [x, y] of [[9, 9], [75, 9], [9, 109], [75, 109]] as const) {
      ctx.fillStyle = metal(ctx, GOLD_METAL);
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(x - 0.7, y - 0.7, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // The medallion: a gold ring round a deep navy disc, the bolt in raised gold.
    const ring = ctx.createLinearGradient(26, 43, 58, 75);
    GOLD_METAL.forEach((c, i) => ring.addColorStop(i / (GOLD_METAL.length - 1), c));
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(42, 59, 17, 0, Math.PI * 2);
    ctx.fill();
    const disc = ctx.createRadialGradient(37, 53, 1, 42, 59, 14);
    disc.addColorStop(0, "#22387A");
    disc.addColorStop(1, "#08102A");
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(42, 59, 13.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.save();
    ctx.translate(0.8, 1.1);
    bolt(ctx, BOLT);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = ring;
    bolt(ctx, BOLT);
    ctx.fill();
  } else if (back === "holo-foil") {
    // A pearl foil: soft prism colours under fine diagonal lines, a silver frame, a white star.
    const g = ctx.createLinearGradient(0, 0, 84, 118);
    g.addColorStop(0, "#BFF4FF");
    g.addColorStop(0.28, "#D9C8FF");
    g.addColorStop(0.52, "#FFC8EC");
    g.addColorStop(0.76, "#FFEDB8");
    g.addColorStop(1, "#B8FFE6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 84, 118);
    ctx.save();
    ctx.translate(42, 59);
    ctx.rotate((30 * Math.PI) / 180);
    ctx.translate(-42, -59);
    for (let x = -70; x <= 150; x += 18) {
      const band = ctx.createLinearGradient(x, 0, x + 12, 0);
      band.addColorStop(0, "rgba(255,255,255,0)");
      band.addColorStop(0.5, "rgba(255,255,255,0.5)");
      band.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = band;
      ctx.fillRect(x, -40, 12, 200);
    }
    ctx.strokeStyle = "rgba(90,70,160,0.12)";
    ctx.lineWidth = 0.5;
    for (let x = -70; x <= 150; x += 2.2) {
      ctx.beginPath();
      ctx.moveTo(x, -40);
      ctx.lineTo(x, 160);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = metal(ctx, SILVER_METAL);
    ctx.lineWidth = 3.2;
    rr(ctx, 4.5, 4.5, 75, 109, 6);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    rr(ctx, 9, 9, 66, 100, 3);
    ctx.stroke();
    ctx.fillStyle = "rgba(40,30,90,0.35)";
    star8(ctx, 42.8, 60.2, 19);
    ctx.fill();
    const sg = ctx.createLinearGradient(26, 42, 58, 76);
    sg.addColorStop(0, "#FFFFFF");
    sg.addColorStop(0.5, "#F2EEFF");
    sg.addColorStop(1, "#B8B0E8");
    ctx.fillStyle = sg;
    star8(ctx, 42, 59, 19);
    ctx.fill();
    ctx.strokeStyle = "rgba(60,40,120,0.55)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    for (const [x, y] of [[20, 24], [64, 30], [24, 94], [62, 92]] as const) sparkle(ctx, x, y);
  } else {
    // Neon: dark glass with a fine grid, a lit cyan tube for the frame, pink traces, a cyan bolt with a white core.
    const bg = ctx.createRadialGradient(26, 28, 4, 42, 59, 82);
    bg.addColorStop(0, "#1E1650");
    bg.addColorStop(1, "#05040F");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 84, 118);
    ctx.strokeStyle = "rgba(34,228,255,0.1)";
    ctx.lineWidth = 0.5;
    for (let x = 6; x < 84; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 118);
      ctx.stroke();
    }
    for (let y = 6; y < 118; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(84, y);
      ctx.stroke();
    }
    for (const y of [26, 92]) {
      ctx.strokeStyle = "#FF3DCB";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(24, y);
      ctx.lineTo(30, y + (y < 59 ? 6 : -6));
      ctx.lineTo(54, y + (y < 59 ? 6 : -6));
      ctx.lineTo(60, y);
      ctx.lineTo(74, y);
      ctx.stroke();
      ctx.fillStyle = "#FFB8EC";
      for (const x of [10, 74]) {
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tube = (lw: number, c: string) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      rr(ctx, 5, 5, 74, 108, 6);
      ctx.stroke();
    };
    tube(4.2, "rgba(34,228,255,0.25)");
    tube(2.2, "#22E4FF");
    tube(0.7, "#E8FFFF");
    ctx.fillStyle = "rgba(34,228,255,0.18)";
    ctx.beginPath();
    ctx.arc(42, 60, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#22E4FF";
    bolt(ctx, BOLT);
    ctx.fill();
    ctx.strokeStyle = "#E8FFFF";
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  // The key light's sheen over the whole back, top left.
  const sheen = ctx.createLinearGradient(0, 0, 60, 84);
  sheen.addColorStop(0, "rgba(255,255,255,0.22)");
  sheen.addColorStop(0.4, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 84, 118);
  ctx.restore();
  ctx.strokeStyle = "#06080F";
  ctx.lineWidth = Math.max(1, w / 42);
  rr(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.stroke();
}

/** Each redrawn felt's rail (lit leather or dark lacquer) and its stitching. */
const FELT_V2: Readonly<Record<Felt, { rail: readonly [string, string]; stitch: string; tube: string | null }>> = {
  midnight: { rail: ["#6A4A2A", "#2A1A0C"], stitch: "rgba(200,220,255,0.45)", tube: null },
  crimson: { rail: ["#5A3A22", "#1E1008"], stitch: "rgba(255,210,170,0.45)", tube: null },
  neon: { rail: ["#2A2450", "#05040F"], stitch: "rgba(34,228,255,0.5)", tube: "#22E4FF" },
};

/** A redrawn felt: a lit rail, the cloth's weave lit from the top left with a vignette, stitching round its edge. */
function paintSkinFeltV2(c: CanvasRenderingContext2D, felt: Felt, w: number, h: number): void {
  const k = FELT_COLOURS[felt];
  const v = FELT_V2[felt];
  const rail = c.createLinearGradient(0, 0, w, h);
  rail.addColorStop(0, v.rail[0]);
  rail.addColorStop(1, v.rail[1]);
  c.fillStyle = rail;
  c.fillRect(0, 0, w, h);
  const inset = 5;
  const fw = w - inset * 2;
  const fh = h - inset * 2;
  c.save();
  rr(c, inset, inset, fw, fh, 14);
  c.clip();
  const g = c.createRadialGradient(w * 0.42, h * 0.38, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.78);
  g.addColorStop(0, k.centre);
  g.addColorStop(1, k.edge);
  c.fillStyle = g;
  c.fillRect(inset, inset, fw, fh);
  // The weave: a fine twill of light and dark threads.
  for (let y = inset; y < h - inset; y += 2) {
    c.fillStyle = (y / 2) % 2 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
    c.fillRect(inset, y, fw, 1);
  }
  for (let x = inset; x < w - inset; x += 3) {
    c.fillStyle = "rgba(0,0,0,0.035)";
    c.fillRect(x, inset, 1, fh);
  }
  // The nap: fixed specks, light and dark.
  let n = 0x51ed;
  for (let i = 0; i < (w * h) / 60; i++) {
    n = (Math.imul(n, 1103515245) + 12345) >>> 0;
    const x = inset + (((n >>> 8) % 10000) / 10000) * fw;
    n = (Math.imul(n, 1103515245) + 12345) >>> 0;
    const y = inset + (((n >>> 8) % 10000) / 10000) * fh;
    c.fillStyle = n & 1 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)";
    c.fillRect(x, y, 1, 1);
  }
  // The key light from the top left, and the cloth darkening into the rail.
  const light = c.createLinearGradient(inset, inset, w - inset, h - inset);
  light.addColorStop(0, "rgba(255,255,255,0.08)");
  light.addColorStop(0.5, "rgba(255,255,255,0)");
  light.addColorStop(1, "rgba(0,0,0,0.18)");
  c.fillStyle = light;
  c.fillRect(inset, inset, fw, fh);
  c.strokeStyle = "rgba(0,0,0,0.45)";
  c.lineWidth = 6;
  rr(c, inset, inset, fw, fh, 14);
  c.stroke();
  c.restore();
  // The stitching, just inside the cloth's edge.
  c.save();
  c.setLineDash([3, 3]);
  c.strokeStyle = v.stitch;
  c.lineWidth = 1;
  rr(c, inset + 5, inset + 5, fw - 10, fh - 10, 10);
  c.stroke();
  c.restore();
  // The rail's lit lip.
  c.strokeStyle = "rgba(255,255,255,0.18)";
  c.lineWidth = 1;
  rr(c, inset - 0.5, inset - 0.5, fw + 1, fh + 1, 14.5);
  c.stroke();
  if (v.tube) {
    c.strokeStyle = "rgba(34,228,255,0.3)";
    c.lineWidth = 4;
    rr(c, inset, inset, fw, fh, 14);
    c.stroke();
    c.strokeStyle = v.tube;
    c.lineWidth = 1.8;
    c.stroke();
    c.strokeStyle = "#E8FFFF";
    c.lineWidth = 0.6;
    c.stroke();
  }
}

/** The colours each redrawn back is drawn in, for the contrast check (with the switch on). */
const BACK_COLOURS_V2: Readonly<Record<CardBack, string[]>> = {
  "royal-damask": ["#EDB43E", "#FFF6D6", "#08102A"],
  "holo-foil": ["#FFFFFF", "#BFF4FF", "#FFC8EC"],
  neon: ["#22E4FF", "#E8FFFF", "#05040F"],
};
