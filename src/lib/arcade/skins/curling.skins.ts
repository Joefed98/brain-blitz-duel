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
import { glossDisc } from "./gloss.renderer";
import type { ContrastPair, GameLook } from "./look";
import { skinRedrawn } from "./redrawPreview";


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

/** The Neon Rink redrawn (phase 2 step 4): the same lines and rings, lit ice with depth, softer tube rings. */
export const NEON_RINK_V2: RinkPalette = {
  ...NEON_RINK,
  ice: "#0A1C30",
  iceFar: "#16365A",
  iceMid: "#0E2540",
  house: ["#0C2340", "#0A1C30", "#3A0E3A", "#0A1C30"],
  pebble: ["#BFF4FF26", "#9FE8FF14"],
  reflections: false,
  board: "#0A0820",
  floor: "#05040F",
};
const NEON_RINK_ITEM = "world-theme.curl-champ.neon-rink";
/** The Neon Rink's palette: the redraw where its switch is on. */
export function neonRinkPalette(): RinkPalette {
  return skinRedrawn(NEON_RINK_ITEM) ? NEON_RINK_V2 : NEON_RINK;
}

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

/**
 * The arena above the far boards under the Neon Rink: the rink's own dark ice colour carried up (the approved art draws
 * nothing above the sheet: no city, no crowd), with the far boards' cyan strip.
 */
export function neonRinkArena(ctx: CanvasRenderingContext2D, top: number, bottom: number, w: number): void {
  if (skinRedrawn(NEON_RINK_ITEM)) {
    neonRinkArenaV2(ctx, top, bottom, w);
    return;
  }
  ctx.fillStyle = "#081422";
  ctx.fillRect(-400, top, w + 800, bottom - top);
  ctx.fillStyle = "#0A0820";
  ctx.fillRect(-400, bottom - 6, w + 800, 6);
  ctx.save();
  ctx.shadowColor = "#22E4FF";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#22E4FF";
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
  const item = STONE_ITEMS.get(k);
  if (item && skinRedrawn(item)) {
    paintSkinStoneV2(ctx, k, sx, sy, rx, ry, lift, seed, moving);
    return;
  }
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
  const pal = look.world ? neonRinkPalette() : DEFAULT_RINK;
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

/* ============================== The redraws (phase 2 step 4) ============================== */

/** The catalogue item each stone look belongs to. */
const STONE_ITEMS: ReadonlyMap<StoneSkin, string> = new Map<StoneSkin, string>([
  ...Object.entries(STONES).map(([id, k]) => [k, id] as [StoneSkin, string]),
  [RINK_MINE, NEON_RINK_ITEM],
  [RINK_THEIRS, NEON_RINK_ITEM],
]);

/** The redrawn stones' polished tops (the side band and handle follow the skin's own colours). */
interface StoneFinish {
  top: readonly [string, string, string];
  side: readonly [string, string];
  speckle: string | null;
  /** Thin inlaid rings (neon tubes set into the polished top), outer then inner. */
  inlay: readonly (string | null)[];
}
const FINISHES_V2 = new Map<StoneSkin, StoneFinish>([
  [STONES["game-skin.curl-champ.glacier"]!, { top: ["#F4FDFF", "#A9DDF2", "#4F9CC2"], side: ["#6C7A92", "#2A3142"], speckle: "#FFFFFF", inlay: [null, null] }],
  [STONES["game-skin.curl-champ.aurora"]!, { top: ["#4A5680", "#2A3352", "#121730"], side: ["#5A6480", "#1E2438"], speckle: "#8F9BBF", inlay: [null, null] }],
  [STONES["game-skin.curl-champ.neon-stones"]!, { top: ["#3A3460", "#14102E", "#05040F"], side: ["#3A3460", "#0A0820"], speckle: null, inlay: ["#22E4FF", "#FF3DCB"] }],
  [RINK_MINE, { top: ["#2E3A66", "#0E1030", "#05040F"], side: ["#2A2458", "#0A0820"], speckle: null, inlay: ["#22E4FF", "#22E4FF"] }],
  [RINK_THEIRS, { top: ["#4A2A5E", "#1E0C2E", "#05040F"], side: ["#3A2048", "#0A0820"], speckle: null, inlay: ["#FF3DCB", "#FF3DCB"] }],
]);

/**
 * A redrawn stone: polished granite in the art kit's light (the side band lit on the left, the top's diffuse and one
 * tight highlight, the handle's own gloss), in exactly the default stone's outline, centre, radii and lift.
 */
function paintSkinStoneV2(ctx: CanvasRenderingContext2D, k: StoneSkin, sx: number, sy: number, rx: number, ry: number, lift: number, seed: number, moving: boolean): void {
  const f = FINISHES_V2.get(k)!;
  // The contact shadow (the default's own ellipse), a little softer at its edge.
  ctx.fillStyle = "#0B1A2A33";
  ctx.beginPath();
  ctx.ellipse(sx + rx * 0.08, sy + ry * 0.4, rx * 1.05, ry * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // The side band, lit from the left.
  const sg = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0);
  sg.addColorStop(0, f.side[0]);
  sg.addColorStop(0.35, f.side[0]);
  sg.addColorStop(1, f.side[1]);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(sx - rx, sy - lift);
  ctx.ellipse(sx, sy - lift, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  const ty = sy - lift;
  const edgeW = Math.max(0.6, rx * (2 / 42));
  // The polished top.
  const tg = ctx.createRadialGradient(sx - rx * 0.35, ty - ry * 0.45, 0, sx, ty, rx * 1.05);
  tg.addColorStop(0, f.top[0]);
  tg.addColorStop(0.55, f.top[1]);
  tg.addColorStop(1, f.top[2]);
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.ellipse(sx, ty, rx - edgeW / 2, Math.max(0.5, ry - edgeW / 2), 0, 0, Math.PI * 2);
  ctx.fill();
  if (k.topEdge) {
    ctx.strokeStyle = k.topEdge;
    ctx.lineWidth = edgeW;
    ctx.stroke();
  }
  if (f.speckle && rx > 5) {
    ctx.fillStyle = f.speckle;
    for (let i = 0; i < 26; i++) {
      const h = artHash(seed, i);
      const a = (h % 628) / 100;
      const r = Math.sqrt(((h >>> 10) % 100) / 100) * 0.9;
      ctx.globalAlpha = 0.25 + ((h >>> 20) % 50) / 100;
      ctx.fillRect(sx + Math.cos(a) * rx * r, ty + Math.sin(a) * ry * r, Math.max(0.5, rx * 0.03), Math.max(0.5, ry * 0.05));
    }
    ctx.globalAlpha = 1;
  }
  // The inner disc (the skin's own colour or the aurora), then the inlaid rings.
  const irx = (rx * 26) / 42;
  const iry = Math.max(0.4, (ry * 13) / 22);
  const iy = ty - (ry * 2) / 22;
  if (k.inner === "aurora") {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(sx, iy, irx, iry, 0, 0, Math.PI * 2);
    ctx.clip();
    const ag = ctx.createLinearGradient(sx - irx, iy - iry, sx + irx, iy + iry);
    ag.addColorStop(0, "#3DFF9A");
    ag.addColorStop(0.5, "#22E4FF");
    ag.addColorStop(1, "#FF3DCB");
    ctx.fillStyle = ag;
    ctx.fillRect(sx - irx, iy - iry, irx * 2, iry * 2);
    // Light ribbons drifting across it, and the disc's own depth (dark at its far edge).
    for (const off of [-0.35, 0.2]) {
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = Math.max(0.6, iry * 0.18);
      ctx.beginPath();
      ctx.moveTo(sx - irx, iy + iry * off);
      ctx.quadraticCurveTo(sx, iy + iry * (off - 0.6), sx + irx, iy + iry * (off + 0.1));
      ctx.stroke();
    }
    const dg = ctx.createRadialGradient(sx - irx * 0.3, iy - iry * 0.3, 0, sx, iy, irx * 1.1);
    dg.addColorStop(0.5, "rgba(0,0,0,0)");
    dg.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = dg;
    ctx.fillRect(sx - irx, iy - iry, irx * 2, iry * 2);
    ctx.restore();
  } else if (k.inner) {
    const ig = ctx.createRadialGradient(sx - irx * 0.3, iy - iry * 0.4, 0, sx, iy, irx);
    ig.addColorStop(0, "#FFFFFF");
    ig.addColorStop(1, k.inner);
    ctx.fillStyle = k.inner === "#0A0820" ? k.inner : ig;
    ctx.beginPath();
    ctx.ellipse(sx, iy, irx, iry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (k.innerEdge && !f.inlay[1]) {
    ctx.strokeStyle = k.innerEdge;
    ctx.lineWidth = edgeW;
    ctx.beginPath();
    ctx.ellipse(sx, iy, irx, iry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const [i, c] of f.inlay.entries()) {
    if (!c) continue;
    const s = i === 0 ? 0.86 : 26 / 42;
    const cy = i === 0 ? ty : iy;
    const ex = rx * s;
    const ey = Math.max(0.4, ry * (i === 0 ? 0.86 : 13 / 22));
    // A lit tube: its colour, a thin white core on the lit side.
    ctx.strokeStyle = c;
    ctx.lineWidth = Math.max(0.8, edgeW * 1.3);
    ctx.beginPath();
    ctx.ellipse(sx, cy, ex, ey, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = Math.max(0.4, edgeW * 0.45);
    ctx.beginPath();
    ctx.ellipse(sx, cy, ex, ey, 0, Math.PI * 0.95, Math.PI * 1.6);
    ctx.stroke();
  }
  glossDisc(ctx, sx, ty, rx - edgeW, Math.max(0.5, ry - edgeW), k.inner === "aurora" ? 0.6 : 0.9);
  // The handle: the default's shape, lit from the top left with a highlight along its top.
  const hw = rx * 0.95;
  const hh = Math.max(1.2, lift * 0.55);
  const hg = ctx.createLinearGradient(sx - hw * 0.7, ty - hh, sx + hw * 0.6, ty);
  hg.addColorStop(0, "#FFFFFF");
  hg.addColorStop(0.4, k.handle);
  hg.addColorStop(1, k.handle);
  ctx.fillStyle = hg;
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
  if (rx > 6) {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = Math.max(0.4, edgeW * 0.5);
    ctx.beginPath();
    ctx.moveTo(sx - hw * 0.6, ty - hh * 0.7);
    ctx.lineTo(sx + hw * 0.45, ty - hh * 0.7);
    ctx.stroke();
  }
  if (moving) {
    ctx.strokeStyle = "#FFFFFF66";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(sx, ty, rx * 1.15, ry * 1.3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** The arena above the far boards under the redrawn Neon Rink: the dark arena lit from the top left, roof lamps, the strip. */
function neonRinkArenaV2(ctx: CanvasRenderingContext2D, top: number, bottom: number, w: number): void {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, "#05040F");
  g.addColorStop(1, "#16365A");
  ctx.fillStyle = g;
  ctx.fillRect(-400, top, w + 800, bottom - top);
  const l = ctx.createRadialGradient(w * 0.15, top, 0, w * 0.15, top, w * 0.9);
  l.addColorStop(0, "rgba(160,220,255,0.16)");
  l.addColorStop(1, "rgba(160,220,255,0)");
  ctx.fillStyle = l;
  ctx.fillRect(-400, top, w + 800, bottom - top);
  // Roof lamps: small lit discs along a girder.
  const gy = top + (bottom - top) * 0.45;
  ctx.fillStyle = "#0A0820";
  ctx.fillRect(-400, gy - 2, w + 800, 3);
  for (let x = 20; x < w; x += 70) {
    const lg = ctx.createRadialGradient(x, gy + 2, 0, x, gy + 2, 6);
    lg.addColorStop(0, "#FFFFFF");
    lg.addColorStop(0.4, "#BFF4FF");
    lg.addColorStop(1, "rgba(191,244,255,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(x - 6, gy - 4, 12, 12);
  }
  ctx.fillStyle = "#0A0820";
  ctx.fillRect(-400, bottom - 6, w + 800, 6);
  ctx.fillStyle = "#22E4FF";
  ctx.fillRect(-400, bottom - 4, w + 800, 1.4);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(-400, bottom - 3.8, w + 800, 0.5);
}
