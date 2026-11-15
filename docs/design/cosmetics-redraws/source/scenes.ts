/**
 * Every 3D piece the cosmetics redraws use: its scene in render.html, colours (uCol[0..7]), camera and pixel size.
 * The art kit's own palette (docs/design/style-guide/source/art2.mjs) plus each item's colour. Card pieces are drawn at
 * 3× the card's 300 × 112 units (a right-hand panel 168 × 112, or the whole card for a field), ornaments at 3× their
 * place on the frame, emotes at 192 px as the kit's icons.
 */
export const GOLD = "#EDB43E", GOLD_HI = "#F3DDA6", INK = "#121218", CREAM = "#F4EFE6", NAVY = "#2A3558", BLUE = "#4D8CFF",
  RED = "#E8473F", GREEN = "#3DDC84", ORANGE = "#FF8A3D", VIOLET = "#8E80FF", PINK = "#FF6BD6", TEAL = "#2ED3B7", SILVER = "#C9D3EA", BRONZE = "#D9A066";

export interface Job { scene: number; cols: string[]; w: number; h: number; yaw?: number; pitch?: number; zoom?: number; ground?: number; lookY?: number; variant?: number }

const panel = (scene: number, cols: string[], cam: Partial<Job> = {}): Job => ({ scene, cols, w: 504, h: 336, yaw: 0.45, pitch: 0.1, zoom: 1.25, ground: -1.15, ...cam });
const field = (scene: number, cols: string[], cam: Partial<Job> = {}): Job => ({ scene, cols, w: 900, h: 336, yaw: 0.5, pitch: -0.75, zoom: 1.1, ground: -3, lookY: 0, ...cam });
const piece = (scene: number, cols: string[], size: number, cam: Partial<Job> = {}): Job => ({ scene, cols, w: size, h: size, yaw: 0.45, pitch: 0.1, zoom: 1.35, ground: -1.15, ...cam });

/** Tier colours (src/lib/rated/tierDisplay.ts' hues, as art metal). */
export const TIER = {
  spark: { c: "#E08A4F", hi: "#FFC08A", bg: "#2A140A" },
  charge: { c: "#3DDC84", hi: "#A6F5C8", bg: "#06241A" },
  volt: { c: "#2ED3E8", hi: "#B4F4FF", bg: "#062530" },
  surge: { c: "#6E8CFF", hi: "#C2D0FF", bg: "#0E1640" },
  storm: { c: "#A97CFF", hi: "#DCC8FF", bg: "#1C0E3A" },
  lightning: { c: "#F2CF3B", hi: "#FFF0A8", bg: "#2A2206" },
  "top-500": { c: GOLD, hi: GOLD_HI, bg: "#1A1222" },
} as const;
const TIER_ORDER = ["spark", "charge", "volt", "surge", "storm", "lightning", "top-500"] as const;

export const JOBS: Record<string, Job> = {
  // Card arts: the panel on the right (or the whole card for a field).
  "card-art.joulz-navy": panel(0, [GOLD], { yaw: 0.55, zoom: 1.4, lookY: 0.05 }),
  "card-art.bolt-stripes": field(1, [GOLD, "#26305A", "#33416E"], { pitch: -0.15, yaw: 0.2, zoom: 1.05, lookY: 0 }),
  "card-art.grid": field(2, [, "#25305A", , "#22E4FF"], { pitch: -0.62, yaw: 0.6, zoom: 1.0 }),
  "card-art.waves": field(4, [, "#2D6BFF", TEAL], { pitch: -0.2, yaw: 0.25, zoom: 1.0, lookY: 0.1 }),
  "card-art.hexes": field(5, [, "#3A2E6E", , PINK], { pitch: -0.62, yaw: 0.4, zoom: 1.0 }),
  "card-art.dots": field(3, [, "#3B2A5E", , PINK], { pitch: -0.55, yaw: 0.5, zoom: 1.05 }),
  "card-art.sunburst": panel(6, [GOLD, "#C77A1E", "#E8A33A"], { yaw: 0.15, pitch: 0.05, zoom: 0.82 }),
  ...Object.fromEntries(
    TIER_ORDER.map((t, i) => [`card-art.tier.${t}`, panel(7, [TIER[t].c, TIER[t].hi, , t === "top-500" ? PINK : CREAM], { variant: i, yaw: 0.5, zoom: 1.4, lookY: 0.05 })]),
  ),
  "card-art.crimson": panel(8, [, "#E8473F", "#B0242E"], { yaw: 0.3, pitch: 0.05, zoom: 1.1, lookY: 0.1 }),
  "card-art.royal": panel(9, [GOLD, "#4D3AB8", , RED], { yaw: 0.5, pitch: -0.2, zoom: 1.35, lookY: 0 }),
  "card-art.emerald": panel(10, [, "#2FC077", "#7DF0B0"], { yaw: 0.35, pitch: -0.25, zoom: 1.15, lookY: -0.1 }),
  "card-art.lava": panel(11, [, "#FF6A2B", "#FFD36B"], { yaw: 0.4, zoom: 1.3, lookY: 0.05 }),
  "card-art.diamond-plate": field(12, [, "#C99A3A", GOLD_HI, PINK], { pitch: -0.55, yaw: 0.5, zoom: 1.25, lookY: 0.15 }),
  "card-art.frost": panel(13, [, "#A8DCFF", "#E8F7FF"], { yaw: 0.35, pitch: 0.05, zoom: 1.55, lookY: 0.1, ground: -0.85 }),
  "card-art.neon-skyline": panel(14, ["#FFD36B", "#5A46C8", "#FF8FD6", "#7FF0FF"], { pitch: 0.02, yaw: 0.25, zoom: 1.05, lookY: 0.05, ground: -1.2 }),
  "card-art.diamond-plate.gems": panel(10, [, PINK, "#7FE6FF"], { yaw: 0.35, pitch: -0.25, zoom: 1.2, lookY: -0.1, ground: -0.75 }),
  "card-art.static": field(15, [, "#3A3F55", "#272B3D", "#22E4FF"], { pitch: -0.7, yaw: 0.5, zoom: 1.05 }),
  // Frame ornaments.
  "orn.bolt-gold": piece(0, [GOLD], 132, { zoom: 1.7, yaw: 0.35, ground: -3 }),
  "orn.crown": piece(9, [GOLD, "#5B2A86", , "#FF4FA0"], 180, { yaw: 0.35, pitch: -0.1, zoom: 1.75, ground: -3 }),
  "orn.trophy": piece(17, [GOLD, "#3A2E26", , GOLD_HI], 180, { yaw: 0.35, pitch: 0.12, zoom: 1.6, ground: -3 }),
  "orn.stud-bronze": piece(16, [BRONZE, "#8A5A2E"], 72, { yaw: 0.2, pitch: 0.2, zoom: 1.35, ground: -3 }),
  "orn.stud-silver": piece(16, ["#E8EEFA", "#8F9BB8"], 72, { yaw: 0.2, pitch: 0.2, zoom: 1.35, ground: -3 }),
  "orn.stud-obsidian": piece(16, [VIOLET, "#1A1030"], 72, { yaw: 0.2, pitch: 0.2, zoom: 1.35, ground: -3 }),
  "orn.stud-gold": piece(16, [GOLD, "#A8762A"], 72, { yaw: 0.2, pitch: 0.2, zoom: 1.35, ground: -3 }),
  ...Object.fromEntries(TIER_ORDER.map((t) => [`orn.gem-${t}`, piece(18, [TIER[t].c], 108, { yaw: 0.3, pitch: 0.15, zoom: 2.1, ground: -3 })])),
};

const icon = (scene: number, cols: string[], cam: Partial<Job> = {}): Job => piece(scene, cols, 228, cam);
/* A wide emote: the piece's half-width follows the emote's own aspect (its size in the pack, ×3). */
const wide = (scene: number, cols: string[], w: number, h: number): Job => ({ scene, cols, w: w * 3, h: h * 3, yaw: 0, pitch: 0.06, zoom: 1.85, ground: -3, lookY: 0.02, variant: Math.max(0.6, (w / h) * 0.86 - 0.1) });
Object.assign(JOBS, {
  "acc.neon-bolt": piece(0, ["#3FD6F5"], 132, { zoom: 1.5, yaw: 0.35, ground: -3 }),
  "emote.spark": icon(19, [GOLD], { yaw: 0.3, pitch: 0.05, zoom: 1.75, ground: -3 }),
  "emote.zap": icon(0, ["#3FD6F5"], { yaw: 0.35, zoom: 1.75, ground: -3 }),
  "emote.clutch": wide(21, [GOLD, "#B07A1E"], 118, 48),
  ...Object.fromEntries([102, 114, 96, 144].map((w, i) => [`emote.bubble-${i}`, wide(20, [, "#FFFCF4"], w, 46)])),
  ...Object.fromEntries(["#FF6BD6", "#2ED3E8", GOLD, GREEN].map((c, i) => [`emote.key-${i}`, { ...wide(21, [c, NAVY], 60, 60), variant: 0.82 }])),
  ...Object.fromEntries((["#FF6BD6", "#2ED3E8", "#FF8A3D", "#C6FF3D"] as const).map((c, i) => [`emote.sign-${i}`, wide(22, [INK, c], [74, 64, 114, 74][i]!, 40)])),
  "cel.podium": { scene: 23, cols: [NAVY, GOLD, GOLD_HI], w: 360, h: 240, yaw: 0.2, pitch: -0.32, zoom: 1.35, ground: -0.8, lookY: -0.2 },
  "cel.bolt": piece(0, [GOLD], 96, { zoom: 1.5, yaw: 0.35, ground: -3 }),
} satisfies Record<string, Job>);
