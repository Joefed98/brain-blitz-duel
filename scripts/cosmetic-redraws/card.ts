/**
 * The redrawn player-card pieces (phase 2 step 4): card arts, frames and name colours, in the same shape
 * scripts/player-card-art.ts cuts from the approved sources (a card art's markup inside the 300 × 112 card svg; a
 * frame's markup and svg style; a name colour's class and style in card units), so PlayerCard draws them unchanged.
 *
 * The art kit's finish (docs/design/style-guide/STYLE-GUIDE.md "Art kit"): every object is a 3D piece rendered by the
 * kit's raymarcher (docs/design/cosmetics-redraws/source, public/cosmetics/redrawn/<piece>.webp), one gloss material,
 * one key light from the top left, a soft contact shadow; the card round it is the item's own colour, lit from the top
 * left, darkened under the name so the name, title and pill read on every art. Frames are bevelled metal lit from
 * the top left with 3D studs and a crest in the top-right corner, kept inside the card's box (nothing over the name,
 * the score beside a strip, or the badges).
 */
import { TIER } from "../../docs/design/cosmetics-redraws/source/scenes";

const IMG = (piece: string) => `/cosmetics/redrawn/${piece}.webp`;
const u = (n: number) => `calc(${n} * var(--pc-u))`;

/* ------------------------------------------------------------------ card arts */

interface ArtDef {
  /** Background, top left → bottom right. */
  bg: readonly [string, string];
  /** "panel": the piece on the right 168 × 112; "field": the piece across the card, faded under the name. */
  layout: "panel" | "field";
  /** A second 3D piece over the first, on the right panel (its piece name). */
  over?: string;
  /** A slow light sweep (the Legendaries). */
  sweep?: boolean;
  /** A coloured glow behind the piece (the item's own light, from the panel's centre). */
  halo?: string;
  /** A warm horizon glow along the card's bottom (a field's light). */
  glow?: string;
}

/** a mixed towards b by k (0–1), #RRGGBB. */
function mix(a: string, b: string, k: number): string {
  const n = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2].map((i) => Math.round(n(a, i) + (n(b, i) - n(a, i)) * k).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
/* The tier arts keep their tier's colour as the card's own colour: the hue lit at the top left, deep at the bottom right. */
const tierArt = (t: keyof typeof TIER): ArtDef => ({ bg: [mix(TIER[t].c, "#06080F", 0.42), mix(TIER[t].c, "#06080F", 0.86)], layout: "panel", halo: TIER[t].hi });

export const CARD_ART_DEFS: Record<string, ArtDef> = {
  "card-art.joulz-navy": { bg: ["#2A3A78", "#0B1028"], layout: "panel", halo: "#3A4C8F" },
  "card-art.bolt-stripes": { bg: ["#26346A", "#0A0F24"], layout: "field" },
  "card-art.grid": { bg: ["#16285A", "#070C1E"], layout: "field" },
  "card-art.waves": { bg: ["#123072", "#06102A"], layout: "field" },
  "card-art.hexes": { bg: ["#33236A", "#0D0A20"], layout: "field" },
  "card-art.dots": { bg: ["#3A2266", "#0D0A1E"], layout: "field" },
  "card-art.sunburst": { bg: ["#8A5410", "#1E1006"], layout: "panel", halo: "#FFB347" },
  "card-art.tier.spark": tierArt("spark"),
  "card-art.tier.charge": tierArt("charge"),
  "card-art.tier.volt": tierArt("volt"),
  "card-art.tier.surge": tierArt("surge"),
  "card-art.tier.storm": tierArt("storm"),
  "card-art.tier.lightning": tierArt("lightning"),
  "card-art.tier.top-500": { ...tierArt("top-500"), sweep: true },
  "card-art.crimson": { bg: ["#8A1426", "#1E060C"], layout: "panel", halo: "#E8473F" },
  "card-art.royal": { bg: ["#3A2AA8", "#0E0A34"], layout: "panel", halo: "#7A63FF" },
  "card-art.emerald": { bg: ["#0F7A4C", "#051A12"], layout: "panel", halo: "#3DDC84" },
  "card-art.lava": { bg: ["#8A2A0A", "#1A0804"], layout: "panel", halo: "#FF6A2B" },
  "card-art.diamond-plate": { bg: ["#7A5A18", "#1E1406"], layout: "field", sweep: true, over: "card-art.diamond-plate.gems" },
  "card-art.frost": { bg: ["#2A6EA8", "#0A2240"], layout: "panel", halo: "#A8DCFF" },
  "card-art.neon-skyline": { bg: ["#8A2A9A", "#160A3A"], layout: "panel", sweep: true, glow: "#FF8A5A", halo: "#FF6BD6" },
  "card-art.static": { bg: ["#262B3A", "#0A0B10"], layout: "field" },
};

function cardArtMarkup(id: string, d: ArtDef): string {
  const p = "{{p}}";
  const piece = d.layout === "panel" ? `<image href="${IMG(id)}" x="140" y="0" width="160" height="112" preserveAspectRatio="xMidYMid meet"></image>` : `<g mask="url(#${p}fade)"><image href="${IMG(id)}" x="0" y="0" width="300" height="112" preserveAspectRatio="xMidYMid slice"></image></g>`;
  const halo =
    (d.halo ? `<ellipse cx="226" cy="58" rx="86" ry="60" fill="url(#${p}halo)"></ellipse>` : "") +
    (d.glow ? `<ellipse cx="190" cy="112" rx="170" ry="50" fill="url(#${p}glow)"></ellipse>` : "");
  const sweep = d.sweep ? `<g class="rd-sweep"><rect x="-60" y="-20" width="46" height="160" fill="url(#${p}sweep)" transform="skewX(-22)"></rect></g>` : "";
  return (
    `<defs>` +
    `<clipPath id="${p}c"><rect width="300" height="112" rx="10"></rect></clipPath>` +
    `<linearGradient id="${p}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${d.bg[0]}"></stop><stop offset="1" stop-color="${d.bg[1]}"></stop></linearGradient>` +
    `<radialGradient id="${p}key" cx="0.08" cy="0" r="0.9"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.16"></stop><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"></stop></radialGradient>` +
    (d.glow ? `<radialGradient id="${p}glow"><stop offset="0" stop-color="${d.glow}" stop-opacity="0.55"></stop><stop offset="1" stop-color="${d.glow}" stop-opacity="0"></stop></radialGradient>` : "") +
    (d.halo ? `<radialGradient id="${p}halo"><stop offset="0" stop-color="${d.halo}" stop-opacity="0.42"></stop><stop offset="1" stop-color="${d.halo}" stop-opacity="0"></stop></radialGradient>` : "") +
    `<linearGradient id="${p}scrim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#06080F" stop-opacity="0.5"></stop><stop offset="0.45" stop-color="#06080F" stop-opacity="0.28"></stop><stop offset="0.72" stop-color="#06080F" stop-opacity="0"></stop></linearGradient>` +
    `<linearGradient id="${p}floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#000000" stop-opacity="0"></stop><stop offset="1" stop-color="#000000" stop-opacity="0.32"></stop></linearGradient>` +
    `<linearGradient id="${p}gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.10"></stop><stop offset="0.42" stop-color="#FFFFFF" stop-opacity="0.02"></stop><stop offset="0.43" stop-color="#FFFFFF" stop-opacity="0"></stop></linearGradient>` +
    (d.layout === "field"
      ? `<linearGradient id="${p}fadeg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.16"></stop><stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0.26"></stop><stop offset="0.7" stop-color="#FFFFFF" stop-opacity="0.9"></stop><stop offset="1" stop-color="#FFFFFF" stop-opacity="1"></stop></linearGradient><mask id="${p}fade"><rect width="300" height="112" fill="url(#${p}fadeg)"></rect></mask>`
      : "") +
    (d.sweep ? `<linearGradient id="${p}sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.22"></stop><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"></stop></linearGradient>` : "") +
    `</defs>` +
    `<g clip-path="url(#${p}c)">` +
    `<rect width="300" height="112" fill="url(#${p}bg)"></rect>` +
    `<rect width="300" height="112" fill="url(#${p}key)"></rect>` +
    halo +
    piece +
    (d.over ? `<image href="${IMG(d.over)}" x="140" y="0" width="160" height="112" preserveAspectRatio="xMidYMid meet"></image>` : "") +
    `<rect width="300" height="112" fill="url(#${p}floor)"></rect>` +
    `<rect width="300" height="112" fill="url(#${p}scrim)"></rect>` +
    sweep +
    `<rect width="300" height="112" fill="url(#${p}gloss)"></rect>` +
    `</g>`
  );
}

/* ------------------------------------------------------------------ frames */

interface Metal { hi: string; mid: string; lo: string }
const METALS: Record<string, Metal> = {
  bronze: { hi: "#FFD9AE", mid: "#C98B4E", lo: "#5E3418" },
  silver: { hi: "#FFFFFF", mid: "#C9D3EA", lo: "#55617D" },
  gold: { hi: "#FFF3C4", mid: "#EDB43E", lo: "#7A4E10" },
  obsidian: { hi: "#C9B4FF", mid: "#33265A", lo: "#0A0614" },
};
const tierMetal = (t: keyof typeof TIER): Metal => ({ hi: TIER[t].hi, mid: TIER[t].c, lo: TIER[t].bg });

interface FrameDef {
  metal: Metal;
  stud: string;
  /** The crest in the top-right corner (a rendered piece), or none. */
  crest?: string;
  /** A second, thinner band inside (the earned frames). */
  double?: boolean;
  /** A light running round the band (the animated frames). */
  glint?: boolean;
  /** The frame's svg style: a soft shadow under the metal (never a glow). */
}

export const FRAME_DEFS: Record<string, FrameDef> = {
  "frame.bronze": { metal: METALS.bronze!, stud: "orn.stud-bronze" },
  "frame.silver": { metal: METALS.silver!, stud: "orn.stud-silver" },
  "frame.obsidian": { metal: METALS.obsidian!, stud: "orn.stud-obsidian", double: true },
  "frame.founding": { metal: METALS.gold!, stud: "orn.stud-gold", crest: "orn.bolt-gold", double: true, glint: true },
  "frame.top-500": { metal: METALS.gold!, stud: "orn.gem-top-500", crest: "orn.crown", double: true, glint: true },
  "frame.championship": { metal: METALS.gold!, stud: "orn.stud-gold", crest: "orn.trophy", double: true, glint: true },
  ...Object.fromEntries(
    (["spark", "charge", "volt", "surge", "storm", "lightning", "top-500"] as const).map((t) => [
      `frame.s1-${t}`,
      { metal: tierMetal(t), stud: "orn.stud-gold", crest: `orn.gem-${t}`, double: t === "lightning" || t === "top-500" || t === "storm", glint: t === "lightning" || t === "top-500" || t === "storm" } satisfies FrameDef,
    ]),
  ),
};

function frameMarkup(d: FrameDef): string {
  const p = "{{p}}";
  const m = d.metal;
  const band = (x: number, w: number, rx: number) => `x="${x}" y="${x}" width="${300 - 2 * x}" height="${112 - 2 * x}" rx="${rx}"`;
  const stud = (x: number, y: number) => `<image href="${IMG(d.stud)}" x="${x}" y="${y}" width="15" height="15"></image>`;
  return (
    `<defs>` +
    `<linearGradient id="${p}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.hi}"></stop><stop offset="0.3" stop-color="${m.mid}"></stop><stop offset="0.62" stop-color="${m.lo}"></stop><stop offset="0.85" stop-color="${m.mid}"></stop><stop offset="1" stop-color="${m.hi}"></stop></linearGradient>` +
    `<linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.7"></stop><stop offset="0.12" stop-color="#FFFFFF" stop-opacity="0.15"></stop><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"></stop></linearGradient>` +
    `</defs>` +
    `<rect ${band(5, 0, 8)} fill="none" stroke="#06080F" stroke-opacity="0.55" stroke-width="5"></rect>` +
    `<rect ${band(3, 0, 9.5)} fill="none" stroke="url(#${p}m)" stroke-width="6"></rect>` +
    `<rect ${band(3, 0, 9.5)} fill="none" stroke="url(#${p}s)" stroke-width="6"></rect>` +
    `<rect ${band(0.6, 0, 10.4)} fill="none" stroke="${m.lo}" stroke-width="1.2"></rect>` +
    `<rect ${band(6.4, 0, 6.6)} fill="none" stroke="#06080F" stroke-opacity="0.75" stroke-width="1"></rect>` +
    `<rect ${band(5.6, 0, 7.2)} fill="none" stroke="${m.hi}" stroke-opacity="0.45" stroke-width="0.6"></rect>` +
    (d.double ? `<rect ${band(9.5, 0, 4.5)} fill="none" stroke="url(#${p}m)" stroke-width="1.4"></rect>` : "") +
    (d.glint
      ? `<rect class="rd-glint" ${band(3, 0, 9.5)} fill="none" stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round" pathLength="800"></rect>`
      : "") +
    stud(-1, -1) +
    stud(-1, 98) +
    stud(286, 98) +
    (d.crest ? `<image href="${IMG(d.crest)}" x="250" y="1" width="48" height="48"></image>` : stud(286, -1))
  );
}

/* ------------------------------------------------------------------ name colours */

const NAME_GRADS: Record<string, string> = {
  "name-colour.chrome": "linear-gradient(180deg,#FFFFFF 0%,#EEF3FB 30%,#A3AFC6 47%,#3E4862 53%,#9AA6BE 72%,#F4F7FD 100%)",
  "name-colour.neon-pink": "linear-gradient(180deg,#FFE6F7 0%,#FF9BE3 34%,#FF4FC4 66%,#D11E92 100%)",
  "name-colour.neon-cyan": "linear-gradient(180deg,#EFFEFF 0%,#8AF3FF 34%,#22D3EE 66%,#0E8FB2 100%)",
  "name-colour.neon-red": "linear-gradient(180deg,#FFE6E6 0%,#FF8A8A 34%,#F23A48 66%,#A9142A 100%)",
  "name-colour.electric-orange": "linear-gradient(180deg,#FFF4C8 0%,#FFC44D 34%,#FF7D1F 66%,#C8420C 100%)",
};

function nameStyle(grad: string): Record<string, string> {
  return {
    fontWeight: "900",
    fontSize: u(19),
    background: grad,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    // The dark edge every name keeps (docs/art/wave-2/README.md), then a soft drop under it: one light, no glow.
    filter: `drop-shadow(0 ${u(1)} 0 #06080F) drop-shadow(${u(0.5)} ${u(1.5)} ${u(1.5)} rgba(0,0,0,0.85))`,
  };
}

/* ------------------------------------------------------------------ motion */

const SWEEP_CSS = `.pcard .rd-sweep{animation:pc-rdSweep 5.5s ease-in-out infinite}
@keyframes pc-rdSweep{0%{transform:translateX(-60px)}60%,100%{transform:translateX(480px)}}
@media (prefers-reduced-motion: reduce){.pcard .rd-sweep{animation:none;opacity:0}}`;
const GLINT_CSS = `.pcard .rd-glint{stroke-dasharray:46 754;animation:pc-rdGlint 4.8s linear infinite}
@keyframes pc-rdGlint{from{stroke-dashoffset:800}to{stroke-dashoffset:0}}
@media (prefers-reduced-motion: reduce){.pcard .rd-glint{animation:none;opacity:0}}`;

export function buildCardPieces(): {
  cardArts: Record<string, string>;
  frames: Record<string, { markup: string; style: Record<string, string> }>;
  names: Record<string, { className: string; style: Record<string, string> }>;
  css: Record<string, string>;
  images: string[];
} {
  const cardArts: Record<string, string> = {};
  const frames: Record<string, { markup: string; style: Record<string, string> }> = {};
  const names: Record<string, { className: string; style: Record<string, string> }> = {};
  const css: Record<string, string> = {};
  const images = new Set<string>();
  for (const [id, d] of Object.entries(CARD_ART_DEFS)) {
    cardArts[id] = cardArtMarkup(id, d);
    images.add(id);
    if (d.over) images.add(d.over);
    if (d.sweep) css[id] = SWEEP_CSS;
  }
  for (const [id, d] of Object.entries(FRAME_DEFS)) {
    frames[id] = { markup: frameMarkup(d), style: { filter: "drop-shadow(1px 2px 2px rgba(0,0,0,0.55))", overflow: "visible" } };
    images.add(d.stud);
    if (d.crest) images.add(d.crest);
    if (d.glint) css[id] = GLINT_CSS;
  }
  for (const [id, g] of Object.entries(NAME_GRADS)) names[id] = { className: "rd-nc", style: nameStyle(g) };
  return { cardArts, frames, names, css, images: [...images].sort() };
}
