/**
 * Curl Champ's skins and world theme (wave 2, E1; docs/art/wave-2/items/game-skin/curl-champ--*.html,
 * items/world-theme/curl-champ--neon-rink.html). Display only.
 *
 * A stone skin paints the player's own stones (the gold-handled ones); the red opponents keep their red, so which
 * stones are yours reads as it does by default. The Neon Rink recolours the sheet (dark ice, neon rings, a glowing
 * hog line) and lights up the stones: yours cyan, the opponents' pink. Every stone keeps the default's projected
 * size; rings, lines and boards stay exactly where they are.
 */
import { artHash } from "../art.renderer";
import type { ContrastPair, GameLook } from "./look";


/** The sheet's colours (the default rink's exactly, and the Neon Rink's from its source). */
export interface RinkPalette {
  ice: string;
  iceFar: string;
  iceMid: string;
  /** Fills of the 12-foot, 8-foot, 4-foot and button. */
  house: readonly [string, string, string, string];
  /** Their neon edges (null: none). */
  ring: readonly [string | null, string | null, string | null, string | null];
  line: string;
  hog: string;
  glowHog: boolean;
  centre: string;
  pebble: readonly [string, string];
  reflections: boolean;
  board: string;
  led: string;
  floor: string;
}

export const DEFAULT_RINK: RinkPalette = {
  ice: "#E9F1F6",
  iceFar: "#B9C9D6",
  iceMid: "#DCE7EF",
  house: ["#1F5FB8", "#E9F1F6", "#C8202E", "#E9F1F6"],
  ring: [null, null, null, null],
  line: "#2B2B33",
  hog: "#C8202E",
  glowHog: false,
  centre: "#2B2B3399",
  pebble: ["#FFFFFF55", "#9FB3C455"],
  reflections: true,
  board: "#1A2230",
  led: "#3FD6FF",
  floor: "#0E1520",
};

export const NEON_RINK: RinkPalette = {
  ice: "#081422",
  iceFar: "#081422",
  iceMid: "#081422",
  house: ["#0A1A30", "#081422", "#2A0A2A", "#081422"],
  ring: ["#22E4FF", "#EEF2FF", "#FF3DCB", "#EEF2FF"],
  line: "#22E4FF80",
  hog: "#FF3DCB",
  glowHog: true,
  centre: "#22E4FF80",
  /** Faint skate scratches (the source's 0.18 pale-cyan strokes). */
  pebble: ["#9FE8FF2E", "#9FE8FF1A"],
  reflections: false,
  board: "#0A0820",
  led: "#22E4FF",
  floor: "#05040F",
};

/** A ring's neon edge on the path just filled. */
export function neonStroke(ctx: CanvasRenderingContext2D, colour: string, width: number): void {
  ctx.save();
  ctx.shadowColor = colour;
  ctx.shadowBlur = 4;
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** The arena above the far boards under the Neon Rink: night, a neon city's glow and a cyan board strip. */
export function neonRinkArena(ctx: CanvasRenderingContext2D, top: number, bottom: number, w: number): void {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, "#05040F");
  g.addColorStop(1, "#160A30");
  ctx.fillStyle = g;
  ctx.fillRect(-400, top, w + 800, bottom - top);
  // Towers with lit windows.
  for (let i = 0; i < 40; i++) {
    const h = artHash(i, 61);
    const bw = 14 + (h % 18);
    const bh = 14 + ((h >>> 5) % 40);
    const x = -60 + i * 14;
    ctx.fillStyle = "#0C0820";
    ctx.fillRect(x, bottom - 6 - bh, bw, bh);
    for (let k = 0; k < 4; k++) {
      const hk = artHash(i * 7 + k, 62);
      if (hk % 3 === 0) continue;
      ctx.fillStyle = ["#FF3DCB", "#22E4FF", "#F2C14E"][hk % 3]!;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x + 3 + (hk % Math.max(1, bw - 6)), bottom - 6 - bh + 4 + ((hk >>> 4) % Math.max(1, bh - 8)), 2, 2);
      ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = "#0A0820";
  ctx.fillRect(-400, bottom - 6, w + 800, 6);
  ctx.save();
  ctx.shadowColor = "#FF3DCB";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#FF3DCB";
  ctx.fillRect(-400, bottom - 4, w + 800, 1.4);
  ctx.restore();
}

/* ================================ Stones ================================ */

export interface StoneSkin {
  /** The stone's side band (the source's under-ellipse). */
  side: string;
  /** The top: a fill, or the aurora gradient. */
  top: string;
  topEdge: string | null;
  /** The inner disc: a fill, "aurora" for the gradient, or null. */
  inner: string | null;
  innerEdge: string | null;
  handle: string;
  handleEdge: string;
  glow: string | null;
  speckle: string | null;
}

const STONES: Readonly<Record<string, StoneSkin>> = {
  "game-skin.curl-champ.glacier": { side: "#3A3F4F", top: "#B8E6F5", topEdge: "#06080F", inner: "#EAF9FF", innerEdge: null, handle: "#FFFFFF", handleEdge: "#06080F", glow: null, speckle: "#5FA8C8" },
  "game-skin.curl-champ.aurora": { side: "#3A3F4F", top: "#2A3352", topEdge: "#06080F", inner: "aurora", innerEdge: null, handle: "#E8FFFF", handleEdge: "#06080F", glow: "#3DFF9A", speckle: null },
  "game-skin.curl-champ.neon-stones": { side: "#3A3F4F", top: "#0A0820", topEdge: "#22E4FF", inner: "#0A0820", innerEdge: "#FF3DCB", handle: "#22E4FF", handleEdge: "#06080F", glow: "#22E4FF", speckle: null },
};
/** The Neon Rink's lit-up stones (the source's: a dark stone with a neon rim and inner ring, the handle in the rim's colour). */
const RINK_MINE: StoneSkin = { side: "#1A1440", top: "#0A0820", topEdge: "#22E4FF", inner: null, innerEdge: "#22E4FF", handle: "#22E4FF", handleEdge: "#06080F", glow: "#22E4FF", speckle: null };
const RINK_THEIRS: StoneSkin = { side: "#1A1440", top: "#0A0820", topEdge: "#FF3DCB", inner: null, innerEdge: "#FF3DCB", handle: "#FF3DCB", handleEdge: "#06080F", glow: "#FF3DCB", speckle: null };

/** The skin a stone takes: the player's skin on their own stones, the Neon Rink's lit stones, or null (default). */
export function curlStoneSkin(look: GameLook, mine: boolean): StoneSkin | null {
  const skin = mine && look.skin ? STONES[look.skin] : undefined;
  if (skin) return skin;
  if (look.world) return mine ? RINK_MINE : RINK_THEIRS;
  return null;
}

/**
 * A skinned stone at its projected place (the default's centre, radii and lift): the side band, the top with its edge,
 * the inner disc, then the handle, all inside the default stone's outline.
 */
export function paintSkinStone(ctx: CanvasRenderingContext2D, k: StoneSkin, sx: number, sy: number, rx: number, ry: number, lift: number, seed: number, moving: boolean): void {
  ctx.fillStyle = "#0B1A2A33";
  ctx.beginPath();
  ctx.ellipse(sx + rx * 0.08, sy + ry * 0.4, rx * 1.05, ry * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = k.side;
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(sx - rx, sy - lift);
  ctx.ellipse(sx, sy - lift, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  const ty = sy - lift;
  const edgeW = Math.max(0.6, rx * (2 / 42));
  ctx.save();
  if (k.glow) {
    ctx.shadowColor = k.glow;
    ctx.shadowBlur = Math.min(6, rx * 0.35);
  }
  ctx.fillStyle = k.top;
  ctx.beginPath();
  ctx.ellipse(sx, ty, rx - edgeW / 2, Math.max(0.5, ry - edgeW / 2), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (k.topEdge) {
    ctx.strokeStyle = k.topEdge;
    ctx.lineWidth = edgeW;
    ctx.stroke();
  }
  if (k.speckle && rx > 5) {
    ctx.fillStyle = k.speckle;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 12; i++) {
      const h = artHash(seed, i);
      const a = (h % 628) / 100;
      const r = ((h >>> 10) % 90) / 100;
      ctx.fillRect(sx + Math.cos(a) * rx * r, ty + Math.sin(a) * ry * r, Math.max(0.5, rx * 0.04), Math.max(0.5, ry * 0.08));
    }
    ctx.globalAlpha = 1;
  }
  if (k.inner || k.innerEdge) {
    const irx = (rx * 26) / 42;
    const iry = Math.max(0.4, (ry * 13) / 22);
    const iy = ty - (ry * 2) / 22;
    ctx.beginPath();
    ctx.ellipse(sx, iy, irx, iry, 0, 0, Math.PI * 2);
    if (k.inner === "aurora") {
      const g = ctx.createLinearGradient(sx - irx, iy - iry, sx + irx, iy + iry);
      g.addColorStop(0, "#3DFF9A");
      g.addColorStop(0.5, "#22E4FF");
      g.addColorStop(1, "#FF3DCB");
      ctx.fillStyle = g;
      ctx.fill();
    } else if (k.inner) {
      ctx.fillStyle = k.inner;
      ctx.fill();
    }
    if (k.innerEdge) {
      ctx.strokeStyle = k.innerEdge;
      ctx.lineWidth = edgeW;
      ctx.stroke();
    }
  }
  // The handle (the default's shape), in the skin's colour with a dark edge.
  const hw = rx * 0.95;
  const hh = Math.max(1.2, lift * 0.55);
  ctx.fillStyle = k.handle;
  ctx.strokeStyle = k.handleEdge;
  ctx.lineWidth = Math.max(0.5, edgeW * 0.8);
  ctx.beginPath();
  ctx.ellipse(sx - hw * 0.15, ty - hh * 0.4, hw * 0.55, Math.max(1, hh * 0.65), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(sx - hw * 0.15, ty - hh * 0.75, hw * 0.75, Math.max(1, hh * 0.6));
  ctx.fill();
  ctx.stroke();
  if (moving) {
    ctx.strokeStyle = "#FFFFFF66";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(sx, ty, rx * 1.15, ry * 1.3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** What each Curl Champ look must keep visible: your stone and an opponent's, on the ice and in the house. */
export function curlingContrast(look: GameLook): ContrastPair[] {
  const pal = look.world ? NEON_RINK : DEFAULT_RINK;
  // The sheet the stones are played on (the house's rings are markings on it; the default's red stone reads on the
  // sheet, not against the red four-foot, so the check asks the same of every look).
  const backgrounds = [pal.ice, pal.iceFar];
  const colours = (s: StoneSkin | null, mine: boolean) =>
    s ? [s.top, s.handle, ...(s.topEdge ? [s.topEdge] : []), ...(s.innerEdge ? [s.innerEdge] : []), ...(s.inner && s.inner !== "aurora" ? [s.inner] : [])] : mine ? ["#5D626C", "#E8B53A", "#FFE29A"] : ["#5D626C", "#C42A2E", "#FF8A80"];
  return [
    { object: "your stone", colours: colours(curlStoneSkin(look, true), true), backgrounds },
    { object: "opponent's stone", colours: colours(curlStoneSkin(look, false), false), backgrounds },
  ];
}
