/**
 * The second pass's identity cosmetics (docs/design/cosmetics-redraws/ART-DIRECTION.md): name colours, avatar finishes,
 * the accessory, reaction packs, celebrations and the tile style, each built on Blender renders
 * (docs/design/cosmetics-redraws/blender/identity_cosmetics.py → public/cosmetics/redrawn/), in the same data shapes
 * as the first pass (so cosmetics.ts and PlayerCard apply them unchanged). They replace the first pass's entries for
 * the same items (scripts/cosmetic-redraws/cosmetics.ts and card.ts).
 *
 * - A name colour fills the name's letters with the material itself (a polished bar of chrome, candy lacquer or
 *   anodised metal), with the dark edge every name keeps, so it reads on any art and on the leaderboard strip.
 * - A finish paints the avatar's main shapes with a sphere of the material (a matcap), so real reflections fall
 *   across them; a rim of the same material round the circle makes the finish read at the card's size.
 * - Emotes are rendered objects and plates at each emote's own size, their words crisp SVG over them.
 * - Celebrations are rendered stages with the winner's avatar and place where the first pass put them.
 */
import type { FinishArt } from "../../../src/design/identity/cosmeticsArt.data";

const IMG = (piece: string) => `/cosmetics/redrawn/${piece}.webp`;
const u = (n: number) => `calc(${n} * var(--pc-u))`;

/* ---------------------------------------------------------------- name colours */

const NAME_PIECES: Record<string, string> = {
  "name-colour.chrome": "nc.chrome",
  "name-colour.electric-orange": "nc.electric-orange",
};

export const V2_NAME_COLOURS: Record<string, { className: string; style: Record<string, string> }> = Object.fromEntries(
  Object.entries(NAME_PIECES).map(([id, piece]) => [
    id,
    {
      className: "rd2-nc",
      style: {
        fontWeight: "900",
        fontSize: u(19),
        backgroundImage: `url(${IMG(piece)})`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        // The dark edge every name keeps, then a soft drop: one light, no glow.
        filter: `drop-shadow(0 ${u(1)} 0 #06080F) drop-shadow(${u(0.5)} ${u(1.5)} ${u(1.5)} rgba(0,0,0,0.85))`,
      },
    },
  ]),
);

/*
 * Keep the idea (Joe, 15 Nov 2026): Electric Orange stays a pixel face (Silkscreen, as the original), its letters now
 * filled with the rendered anodised orange and set on one crisp pixel step of burnt orange, with the dark edge; the
 * three neon colours stay neon: each letter a lit tube (a pale hot core, the colour as the glass, its light round it).
 */
V2_NAME_COLOURS["name-colour.electric-orange"] = {
  className: "rd2-nc",
  style: {
    fontFamily: "Silkscreen, Archivo, monospace",
    fontWeight: "700",
    fontSize: u(17),
    // The rendered anodised orange, lifted by a sheet of its own light so thin pixel strokes stay bright.
    backgroundImage: `linear-gradient(180deg, rgba(255,214,140,0.5) 0%, rgba(255,150,40,0.3) 50%, rgba(255,120,20,0.25) 100%), url(${IMG("nc.electric-orange")})`,
    backgroundSize: "100% 100%",
    backgroundPosition: "center",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    filter: `drop-shadow(${u(1.5)} ${u(1.5)} 0 #C24E00) drop-shadow(${u(1)} ${u(1)} 0 #06080F) drop-shadow(0 0 ${u(4)} rgba(255,122,24,0.4))`,
  },
};
const NEON: Record<string, [core: string, tube: string, light: string]> = {
  "name-colour.neon-pink": ["#FFE8F8", "#FF4FC8", "rgba(255,79,200,0.75)"],
  "name-colour.neon-cyan": ["#E8FDFF", "#22D8F2", "rgba(34,216,242,0.75)"],
  "name-colour.neon-red": ["#FFE6E6", "#FF3B4B", "rgba(255,59,75,0.75)"],
};
for (const [id, [core, tube, light]] of Object.entries(NEON))
  V2_NAME_COLOURS[id] = {
    className: "rd2-nc",
    style: {
      fontWeight: "800",
      fontSize: u(19),
      color: core,
      WebkitTextStroke: `${u(2.2)} ${tube}`,
      paintOrder: "stroke fill",
      filter: `drop-shadow(0 0 ${u(2)} ${light}) drop-shadow(0 0 ${u(6)} ${light}) drop-shadow(0 ${u(1)} ${u(0.5)} #06080F)`,
    },
  };

/* ---------------------------------------------------------------- avatar finishes */

const RIM_LIGHT = (id: string) =>
  `<linearGradient id="{{p}}${id}rl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.75"></stop><stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset="1" stop-color="#000000" stop-opacity="0.35"></stop></linearGradient>`;
/** The material as a sphere over the avatar's 100 × 100 box: its shapes take the sphere's shading. */
const matcap = (id: string, piece: string) =>
  `<pattern id="{{p}}${id}mc" patternUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><image href="${IMG(piece)}" x="2" y="2" width="96" height="96" preserveAspectRatio="none"></image></pattern>`;
function rim(id: string, paint: string): string {
  return (
    `<circle cx="50" cy="50" r="49" fill="none" stroke="#06080F" stroke-width="5.5"></circle>` +
    `<circle cx="50" cy="50" r="49" fill="none" stroke="${paint}" stroke-width="3.6"></circle>` +
    `<circle cx="50" cy="50" r="49" fill="none" stroke="url(#{{p}}${id}rl)" stroke-width="3.6"></circle>`
  );
}
const material = (id: string, piece: string): FinishArt => ({
  paint: `url(#{{p}}${id}mc)`,
  defs: matcap(id, piece) + RIM_LIGHT(id),
  stroke: null,
  shadow: false,
  overlay: null,
  filter: null,
  outer: rim(id, `url(#{{p}}${id}mc)`),
  wire: false,
});

export const V2_FINISHES: Record<string, FinishArt> = {
  "avatar-finish.chrome": material("r2ch", "fin.chrome"),
  "avatar-finish.carbon": material("r2cb", "fin.carbon"),
  "avatar-finish.holographic": material("r2ho", "fin.holographic"),
  "avatar-finish.neon-glow": {
    // The player's own colour kept, lit as a glass tube: a bright core line on every main shape, the tube's
    // reflections over it (a black glass sphere's, added as light), a halo and ring in the player's colour.
    paint: null,
    defs: RIM_LIGHT("r2ng"),
    stroke: { colour: "#FFFFFF", width: 1.3 },
    shadow: false,
    overlay: `<image href="${IMG("fin.neon-glow")}" x="2" y="2" width="96" height="96" preserveAspectRatio="none" style="mix-blend-mode: screen"></image>`,
    filter: "drop-shadow(0 0 2px {{m1}}) drop-shadow(0 0 5px {{m1}})",
    outer:
      `<circle cx="50" cy="50" r="49" fill="none" stroke="#06080F" stroke-width="5.5"></circle>` +
      `<circle cx="50" cy="50" r="49" fill="none" stroke="{{m1}}" stroke-width="3" style="filter: drop-shadow(0 0 3px {{m1}})"></circle>` +
      `<circle cx="50" cy="50" r="49" fill="none" stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="1"></circle>`,
    wire: false,
  },
};

export const V2_ACCESSORIES: Record<string, string> = {
  // A glass bolt with a lit cyan core above the circle, on a short dark stem.
  // Keep the idea (15 Nov 2026): a clearly cyan neon bolt, as large as the slot above the circle allows.
  "avatar-accessory.neon-bolt": `<image href="${IMG("acc.bolt3")}" x="36" y="-38" width="28" height="42"></image>`,
};

/* ---------------------------------------------------------------- emotes (each at its pack's own size) */

const svgOf = (w: number, h: number, inner: string) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${inner}</svg>`;
const imgOf = (piece: string, w: number, h: number) => `<image href="${IMG(piece)}" x="0" y="0" width="${w}" height="${h}"></image>`;
/** One line of words centred on a face, sized to fit (Archivo 900 ≈ 0.6 em a character). */
function word(text: string, cx: number, cy: number, faceW: number, fill: string, max: number, stroke?: string, engrave = false): string {
  const size = Math.min(max, Math.floor((faceW / (text.length * 0.6)) * 10) / 10);
  const attrs = `text-anchor="middle" dominant-baseline="central" font-family="Archivo, system-ui, sans-serif" font-weight="900" font-size="${size}"`;
  const under = engrave ? `<text x="${cx}" y="${(cy + 0.7).toFixed(1)}" ${attrs} fill="#FFF3C4" fill-opacity="0.7">${text}</text>` : "";
  return `${under}<text x="${cx}" y="${cy.toFixed(1)}" ${attrs} fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${(size / 6).toFixed(1)}" paint-order="stroke" stroke-linejoin="round"` : ""}>${text}</text>`;
}
const CALLS = ["Was that luck?", "My thumb slipped", "Rematch. Now.", "Who taught you that?!"];
const CALL_W = [102, 114, 96, 144];
const SIGNS = ["UNREAL", "OOPS", "BRB CRYING", "SHEESH"];
const SIGN_W = [74, 64, 114, 74];
const SIGN_INK = ["#FFB3EC", "#A6F6FF", "#FFC48A", "#E6FF9E"];

/* Zap (keep the idea): the original's cyan bolt with speed lines, a spark and its face, now lit neon (emote3.zap is
 * rendered on the original's own outline, so the face and lines drawn over it sit where the original's did). */
const glowLine = (d: string, colour: string, w: number) =>
  `<path d="${d}" stroke="${colour}" stroke-width="${w * 2.6}" stroke-linecap="round" opacity="0.28" fill="none"></path><path d="${d}" stroke="${colour}" stroke-width="${w}" stroke-linecap="round" fill="none"></path><path d="${d}" stroke="#E8FDFF" stroke-width="${w * 0.35}" stroke-linecap="round" fill="none"></path>`;
const ZAP_SPEED = glowLine("M8 22 H20 M4 34 H18 M8 46 H20", "#22E4FF", 3);
const ZAP_SPARK = glowLine("M68 10 L74 4 M70 18 L78 16", "#FFE600", 2.5);
const ZAP_FACE =
  `<path d="M40 30 L46 33 M52 27 L46 33" stroke="#06080F" stroke-width="2.4" stroke-linecap="round"></path>` +
  `<circle cx="42" cy="37" r="2.6" fill="#06080F"></circle><circle cx="50" cy="34" r="2.6" fill="#06080F"></circle>` +
  `<circle cx="41.2" cy="36.2" r="0.8" fill="#FFFFFF"></circle><circle cx="49.2" cy="33.2" r="0.8" fill="#FFFFFF"></circle>` +
  `<path d="M41 45 L45 43 L49 45" fill="none" stroke="#06080F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>`;

/* Retro Arcade (keep the idea): the original's pixel heart and pixel words (Silkscreen), lit on a CRT screen. */
const HEART_ROWS = ["  XX XX  ", " XXXXXXX ", " XXXXXXX ", "  XXXXX  ", "   XXX   ", "    X    "];
const PIXEL_HEART = HEART_ROWS.flatMap((row, r) =>
  [...row].flatMap((ch, c) => {
    if (ch !== "X") return [];
    const x = 12 + c * 4;
    const y = 18 + r * 4;
    const lit = r === 1 && c <= 2 ? "#FFB3BF" : "#FF3D5C";
    return [`<rect x="${x - 0.6}" y="${y - 0.6}" width="5.2" height="5.2" fill="#FF3D5C" opacity="0.28"></rect>`, `<rect x="${x}" y="${y}" width="4" height="4" fill="${lit}"></rect>`];
  }),
).join("");
const SCANLINES = Array.from({ length: 22 }, (_, i) => `<rect x="9" y="${9 + i * 2}" width="42" height="0.6" fill="#FFFFFF" opacity="0.05"></rect>`).join("");
function pixelWord(text: string, colour: string, size: number): string {
  const a = `x="30" y="31" text-anchor="middle" dominant-baseline="central" font-family="Silkscreen, monospace" font-weight="700" font-size="${size}"`;
  return `<text ${a} fill="${colour}" stroke="${colour}" stroke-width="2.4" opacity="0.3">${text}</text><text ${a} fill="${colour}">${text}</text>`;
}

export const V2_REACTIONS: Record<string, { svg: string; label: string }[]> = {
  "reaction.spark": [{ svg: svgOf(76, 76, imgOf("emote3.spark", 76, 76)), label: "Spark" }],
  "reaction.zap": [{ svg: svgOf(80, 76, ZAP_SPEED + imgOf("emote3.zap", 80, 76) + ZAP_FACE + ZAP_SPARK), label: "Zap" }],
  "reaction.clutch": [{ svg: svgOf(118, 48, imgOf("emote2.clutch", 118, 48) + word("CLUTCH!", 59, 24, 82, "#1C1306", 19, undefined, true)), label: "CLUTCH!" }],
  "reaction.captains-calls": CALLS.map((t, i) => ({
    svg: svgOf(CALL_W[i]!, 46, imgOf(`emote2.bubble-${i}`, CALL_W[i]!, 46) + word(t, CALL_W[i]! / 2, 21, CALL_W[i]! - 22, "#121218", 13)),
    label: t,
  })),
  "reaction.retro-arcade": [
    { svg: svgOf(60, 60, imgOf("emote3.arcade", 60, 60) + PIXEL_HEART + SCANLINES), label: "Retro Arcade" },
    ...(
      [
        ["1UP", "#3DFF9A", 12],
        ["LAG!!", "#FFE600", 10],
        ["GLHF", "#22E4FF", 10],
      ] as const
    ).map(([t, c, size]) => ({ svg: svgOf(60, 60, imgOf("emote3.arcade", 60, 60) + pixelWord(t, c, size) + SCANLINES), label: t })),
  ],
  "reaction.neon-signs": SIGNS.map((t, i) => ({
    svg: svgOf(SIGN_W[i]!, 40, imgOf(`emote2.sign-${i}`, SIGN_W[i]!, 40) + word(t, SIGN_W[i]! / 2, 20, SIGN_W[i]! - 22, SIGN_INK[i]!, 14, "#06080F")),
    label: t,
  })),
};

/* ---------------------------------------------------------------- celebrations (240 × 150) */

const GOLD_GRAD = `<linearGradient id="{{p}}r2g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#FFF3C4"></stop><stop offset="0.35" stop-color="#EDB43E"></stop><stop offset="0.7" stop-color="#B07A1E"></stop><stop offset="1" stop-color="#FFE08A"></stop></linearGradient>`;
const SAMPLE =
  `<circle cx="120" cy="74" r="18" fill="#1E2640" stroke="#06080F" stroke-width="2"></circle><path d="M108 78c0-8 5-13 12-13s12 5 12 13c0 6-4 9-12 11-8-2-12-5-12-11z" fill="#FF6BD6" stroke="#06080F" stroke-width="1.5"></path><path d="M111 74h18l-2 5-4-2-3 3-3-3-4 2z" fill="#22E4FF"></path>`;
function stage(piece: string, defs: string, motion: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 150" width="100%" height="100%" style="display: block" aria-hidden="true">` +
    `<defs><clipPath id="{{p}}r2c"><rect width="240" height="150" rx="10"></rect></clipPath>${GOLD_GRAD}${defs}</defs>` +
    `<g clip-path="url(#{{p}}r2c)"><image href="${IMG(piece)}" x="0" y="0" width="240" height="150" preserveAspectRatio="xMidYMid slice"></image>${motion}` +
    // The place on the drum's front, the winner's avatar on its top.
    `<text x="120" y="128" text-anchor="middle" font-family="Archivo, system-ui, sans-serif" font-weight="900" font-size="16" fill="url(#{{p}}r2g)" stroke="#06080F" stroke-width="2.4" paint-order="stroke">{{place}}</text>` +
    `{{avatar}}</g>` +
    `<rect x="1" y="1" width="238" height="148" rx="10" fill="none" stroke="#2A3352" stroke-width="2"></rect></svg>`
  );
}
const MOTES = [
  [70, 40], [82, 70], [94, 28], [64, 92], [176, 38], [160, 66], [150, 24], [172, 90], [88, 52], [156, 50],
] as const;

export const V2_CELEBRATIONS: Record<string, { svg: string; sample: string }> = {
  "celebration.spotlight": {
    // Two stage spots through haze onto the drum; dust drifting in the beams.
    svg: stage("cel2.spotlight", "", MOTES.map(([x, y], i) => `<circle class="rd2-mote rd2-mote${i % 3}" cx="${x}" cy="${y}" r="${i % 2 ? 0.9 : 1.3}" fill="#FFF3D6"></circle>`).join("")),
    sample: SAMPLE,
  },
  "celebration.shockwave": {
    // The wave leaving the drum: rings of light racing out across the glass floor.
    svg: stage(
      "cel2.shockwave",
      `<radialGradient id="{{p}}r2w"><stop offset="0.82" stop-color="#8AF3FF" stop-opacity="0"></stop><stop offset="0.95" stop-color="#C9F8FF" stop-opacity="0.9"></stop><stop offset="1" stop-color="#8AF3FF" stop-opacity="0"></stop></radialGradient>`,
      [0, 1, 2].map((i) => `<ellipse class="rd2-wave rd2-wave${i}" cx="120" cy="113" rx="44" ry="11" fill="url(#{{p}}r2w)" style="transform-origin: 120px 113px"></ellipse>`).join(""),
    ),
    sample: SAMPLE,
  },
  "celebration.circuit-overload": {
    // The board's traces charging: a surge of light across the floor, then the drum's gold catching it.
    svg: stage(
      "cel2.circuit",
      `<radialGradient id="{{p}}r2s" cx="0.5" cy="0.78" r="0.6"><stop offset="0" stop-color="#FFD98A" stop-opacity="0.55"></stop><stop offset="1" stop-color="#FFD98A" stop-opacity="0"></stop></radialGradient>`,
      `<rect class="rd2-surge" width="240" height="150" fill="url(#{{p}}r2s)"></rect>`,
    ),
    sample: SAMPLE,
  },
};

/* ---------------------------------------------------------------- the tile style (90 × 90) */

export const V2_TILE_STYLES: Record<string, { back: string; front: string; sample: string }> = {
  "tile-style.circuit-trace": {
    back:
      `<defs><clipPath id="{{p}}r2tc"><rect x="3" y="3" width="84" height="84" rx="18"></rect></clipPath></defs>` +
      `<image href="${IMG("tile2.circuit")}" x="3" y="3" width="84" height="84" preserveAspectRatio="xMidYMid slice" clip-path="url(#{{p}}r2tc)"></image>` +
      `<rect x="3" y="3" width="84" height="84" rx="18" fill="#06080F" fill-opacity="0.1"></rect>` +
      `<rect x="3" y="3" width="84" height="84" rx="18" fill="none" stroke="#3B6B5E" stroke-width="2"></rect>`,
    front: `<rect x="3" y="3" width="84" height="40" rx="18" fill="#FFFFFF" opacity="0.05"></rect>`,
    sample: "",
  },
};

export const V2_COSMETICS_CSS: Record<string, string> = {
  "celebration.spotlight": `.jzc .rd2-mote{animation:jzc-rd2Mote 3.4s ease-in-out infinite}.jzc .rd2-mote1{animation-delay:-1.1s}.jzc .rd2-mote2{animation-delay:-2.3s}
@keyframes jzc-rd2Mote{0%,100%{opacity:.15;transform:translateY(0)}50%{opacity:.9;transform:translateY(-4px)}}
@media (prefers-reduced-motion: reduce){.jzc .rd2-mote{animation:none;opacity:.5}}`,
  "celebration.shockwave": `.jzc .rd2-wave{animation:jzc-rd2Wave 2.4s cubic-bezier(.2,.7,.3,1) infinite}.jzc .rd2-wave1{animation-delay:.8s}.jzc .rd2-wave2{animation-delay:1.6s}
@keyframes jzc-rd2Wave{0%{transform:scale(.7);opacity:0}15%{opacity:1}100%{transform:scale(2.6);opacity:0}}
@media (prefers-reduced-motion: reduce){.jzc .rd2-wave{animation:none;opacity:0}}`,
  "celebration.circuit-overload": `.jzc .rd2-surge{animation:jzc-rd2Surge 2.2s ease-in-out infinite}
@keyframes jzc-rd2Surge{0%,100%{opacity:.2}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){.jzc .rd2-surge{animation:none;opacity:.5}}`,
};

/** Every piece the overrides draw. */
export const V2_COSMETIC_PIECES: readonly string[] = [
  ...Object.values(NAME_PIECES),
  "fin.chrome",
  "fin.carbon",
  "fin.holographic",
  "fin.neon-glow",
  "acc.bolt3",
  "emote3.spark",
  "emote3.arcade",
  "emote3.zap",
  "emote2.clutch",
  ...[0, 1, 2, 3].flatMap((i) => [`emote2.bubble-${i}`, `emote2.sign-${i}`]),
  "cel2.spotlight",
  "cel2.shockwave",
  "cel2.circuit",
  "tile2.circuit",
];
